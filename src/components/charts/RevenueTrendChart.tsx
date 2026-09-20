import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useChartColors } from './chartTheme';
import { moneyCompact, shortDate } from '@/lib/format';
import type { AnalyticsDailyRow } from '@/types/database';

/**
 * Daily revenue and expenses as bars, with net profit as a line over
 * them — the same shape finance dashboards use so the gap between the
 * two bars visually is the profit line.
 */
export default function RevenueTrendChart({ data }: { data: AnalyticsDailyRow[] }) {
  const colors = useChartColors();
  const chartData = data.map((d) => ({ ...d, profit: d.revenue - d.expenses }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} vertical={false} />
        <XAxis
          dataKey="day"
          tickFormatter={(v: string) => shortDate(v).replace(/\s\d{4}$/, '')}
          tick={{ fontSize: 12, fill: colors.muted }}
          axisLine={{ stroke: colors.grid }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v: number) => moneyCompact(v)}
          tick={{ fontSize: 12, fill: colors.muted }}
          axisLine={false}
          tickLine={false}
          width={64}
        />
        <Tooltip
          formatter={(value: number, name: string) => [
            moneyCompact(value),
            name === 'revenue' ? 'Revenue' : name === 'expenses' ? 'Expenses' : 'Profit',
          ]}
          labelFormatter={(v: string) => shortDate(v)}
          contentStyle={{ borderRadius: 10, borderColor: colors.grid, fontSize: 13 }}
        />
        <Bar dataKey="revenue" fill={colors.primary} radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar dataKey="expenses" fill={colors.accent} radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Line type="monotone" dataKey="profit" stroke={colors.success} strokeWidth={2.5} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
