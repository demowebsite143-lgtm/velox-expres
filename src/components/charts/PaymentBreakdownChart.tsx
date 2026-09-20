import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useChartColors } from './chartTheme';
import { money } from '@/lib/format';
import type { Slice } from '@/services/analyticsService';
import type { PaymentStatus } from '@/types/database';

const STATUS_COLOR_KEY: Record<string, keyof ReturnType<typeof useChartColors>> = {
  verified: 'success',
  submitted: 'info',
  pending: 'warning',
  failed: 'danger',
  refunded: 'muted',
};

export default function PaymentBreakdownChart({ data }: { data: Slice[] }) {
  const colors = useChartColors();

  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          innerRadius={56}
          outerRadius={88}
          paddingAngle={2}
        >
          {data.map((entry) => (
            <Cell
              key={entry.label}
              fill={colors[STATUS_COLOR_KEY[entry.label as PaymentStatus] ?? 'muted']}
            />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number) => money(value)}
          contentStyle={{ borderRadius: 10, borderColor: colors.grid, fontSize: 13 }}
        />
        <Legend
          formatter={(value: string) => value.charAt(0).toUpperCase() + value.slice(1)}
          wrapperStyle={{ fontSize: 12, color: colors.muted }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
