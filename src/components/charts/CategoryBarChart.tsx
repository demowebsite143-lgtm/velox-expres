import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useChartColors } from './chartTheme';
import { money } from '@/lib/format';
import type { Slice } from '@/services/analyticsService';

const PALETTE_KEYS = ['primary', 'accent', 'success', 'info', 'warning', 'danger', 'primaryLight'] as const;

/**
 * Horizontal bars, longest first — reads better than vertical bars once
 * labels get longer than a word or two (area names, parcel types).
 */
export default function CategoryBarChart({
  data,
  valueLabel = 'Amount',
  formatValue = money,
}: {
  data: Slice[];
  valueLabel?: string;
  formatValue?: (n: number) => string;
}) {
  const colors = useChartColors();
  const palette = PALETTE_KEYS.map((k) => colors[k]);
  const chartData = [...data].sort((a, b) => b.value - a.value).slice(0, 8);
  const height = Math.max(180, chartData.length * 42);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={(v: number) => formatValue(v)}
          tick={{ fontSize: 11, fill: colors.muted }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          width={110}
          tick={{ fontSize: 12, fill: colors.muted }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value: number) => [formatValue(value), valueLabel]}
          contentStyle={{ borderRadius: 10, borderColor: colors.grid, fontSize: 13 }}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={22}>
          {chartData.map((entry, i) => (
            <Cell key={entry.label} fill={palette[i % palette.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
