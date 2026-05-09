'use client';

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface PaymentChartProps {
  depreciation: number;
  financeCharge: number;
  tax: number;
  gap: number;
}

const COLORS = ['#f97316', '#3b82f6', '#6b7280', '#10b981'];

export function PaymentChart({ depreciation, financeCharge, tax, gap }: PaymentChartProps) {
  const data = [
    { name: 'Depreciation', value: parseFloat(depreciation.toFixed(2)) },
    { name: 'Finance Charge', value: parseFloat(financeCharge.toFixed(2)) },
    { name: 'Tax', value: parseFloat(tax.toFixed(2)) },
    ...(gap > 0 ? [{ name: 'GAP Insurance', value: parseFloat(gap.toFixed(2)) }] : []),
  ].filter(d => d.value > 0);

  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={35}
            outerRadius={65}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => {
              const num = typeof value === 'number' ? value : 0;
              return [`$${num.toFixed(2)} (${((num / total) * 100).toFixed(1)}%)`, ''];
            }}
          />
          <Legend
            iconSize={8}
            formatter={(value) => <span className="text-xs text-gray-600 dark:text-gray-400">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
