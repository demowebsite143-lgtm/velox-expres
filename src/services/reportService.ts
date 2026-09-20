import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { money, shortDate } from '@/lib/format';
import type { AnalyticsDailyRow, AnalyticsSummary } from '@/types/database';
import type { Slice } from '@/services/analyticsService';
import type { Expense } from '@/types/database';
import type { OrderWithRelations } from '@/services/orderService';

/**
 * Report generation, entirely client-side. Every figure that goes into
 * a CSV or PDF here is a value already fetched from the database —
 * nothing is computed or estimated for the report itself.
 */

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function buildCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(csvCell).join(','));
  // Leading BOM so Excel opens UTF-8 (₹, etc.) correctly rather than mangling it.
  return `\uFEFF${lines.join('\r\n')}`;
}

export function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  const csv = buildCsv(headers, rows);
  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), filename);
}

/* ------------------------------------------------------------------ */
/* Orders CSV                                                          */
/* ------------------------------------------------------------------ */

export function downloadOrdersCsv(orders: OrderWithRelations[], filename = 'orders.csv') {
  const headers = [
    'Order ID', 'Placed at', 'Status', 'Customer', 'Phone', 'Pickup area', 'Delivery area',
    'Receiver', 'Parcel type', 'Weight (kg)', 'Distance (km)', 'Amount', 'Payment method',
    'Payment status', 'Rider',
  ];
  const rows = orders.map((o) => [
    o.code, o.created_at, o.status, o.customer_name, o.customer_phone,
    o.pickup_area?.name ?? '', o.delivery_area?.name ?? '', o.receiver_name,
    o.parcel_type, o.weight_kg, o.distance_km ?? '', Number(o.total_amount),
    o.payment_method, o.payment_status, o.rider?.name ?? '',
  ]);
  downloadCsv(filename, headers, rows);
}

/* ------------------------------------------------------------------ */
/* Expenses CSV                                                        */
/* ------------------------------------------------------------------ */

export function downloadExpensesCsv(expenses: Expense[], filename = 'expenses.csv') {
  const headers = ['Date', 'Title', 'Category', 'Amount', 'Payment method', 'Notes'];
  const rows = expenses.map((e) => [
    e.spent_on, e.title, e.category.replace(/_/g, ' '), Number(e.amount),
    e.payment_method ?? '', e.description ?? '',
  ]);
  downloadCsv(filename, headers, rows);
}

/* ------------------------------------------------------------------ */
/* Summary PDF                                                         */
/* ------------------------------------------------------------------ */

export interface SummaryPdfInput {
  brandName: string;
  rangeLabel: string;
  from: string;
  to: string;
  summary: AnalyticsSummary;
  daily: AnalyticsDailyRow[];
  ordersByStatus: Slice[];
  paymentBreakdown: Slice[];
  revenueByArea: Slice[];
  revenueByParcelType: Slice[];
}

export function downloadSummaryPdf(input: SummaryPdfInput) {
  const doc = new jsPDF({ unit: 'pt' });
  const margin = 40;
  let y = margin;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(`${input.brandName || 'Business'} — Report`, margin, y);
  y += 20;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(
    `${input.rangeLabel} · ${shortDate(input.from)} to ${shortDate(input.to)} · Generated ${shortDate(new Date())}`,
    margin,
    y,
  );
  y += 24;
  doc.setTextColor(20);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Metric', 'Value']],
    body: [
      ['Revenue', money(Number(input.summary.revenue))],
      ['Expenses', money(Number(input.summary.expenses))],
      ['Net profit', money(Number(input.summary.net_profit))],
      ['Delivered & paid orders', String(input.summary.revenue_order_count)],
      ['Average order value', money(Number(input.summary.avg_order_value))],
      ['Total orders placed', String(input.summary.total_orders)],
      ['Delivered', String(input.summary.delivered_orders)],
      ['Cancelled', String(input.summary.cancelled_orders)],
      ['In progress', String(input.summary.in_progress_orders)],
      ['Awaiting payment', money(Number(input.summary.pending_payment_amount))],
    ],
    theme: 'grid',
    headStyles: { fillColor: [10, 31, 68] },
    styles: { fontSize: 9, cellPadding: 5 },
    columnStyles: { 1: { halign: 'right' } },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 24;

  const addBreakdownTable = (title: string, rows: Slice[], valueLabel: string) => {
    if (rows.length === 0) return;
    if (y > 680) { doc.addPage(); y = margin; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(title, margin, y);
    y += 8;
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [[title.includes('by') ? title.split(' by ')[1] ?? 'Group' : 'Group', valueLabel, 'Orders']],
      body: rows.map((r) => [r.label.replace(/_/g, ' '), money(r.value), String(r.count)]),
      theme: 'striped',
      headStyles: { fillColor: [26, 58, 112] },
      styles: { fontSize: 9, cellPadding: 4 },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 20;
  };

  addBreakdownTable('Orders by status', input.ordersByStatus, 'Amount');
  addBreakdownTable('Payments by status', input.paymentBreakdown, 'Amount');
  addBreakdownTable('Revenue by area', input.revenueByArea, 'Revenue');
  addBreakdownTable('Revenue by parcel type', input.revenueByParcelType, 'Revenue');

  if (input.daily.length > 0) {
    if (y > 650) { doc.addPage(); y = margin; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Day by day', margin, y);
    y += 8;
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Date', 'Revenue', 'Expenses', 'Orders']],
      body: input.daily.map((d) => [shortDate(d.day), money(d.revenue), money(d.expenses), String(d.orders)]),
      theme: 'striped',
      headStyles: { fillColor: [26, 58, 112] },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    });
  }

  doc.save(`report-${input.from}-to-${input.to}.pdf`);
}
