import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { COLOR_ERROR, COLOR_SUCCESS, TEXT_DIM } from '../../brandTokens';

interface CapacityBarChartProps {
  data: { month: string; demand: number; capacity: number }[];
  unit?: 'hours' | 'fte';
}

export default function CapacityBarChart({ data, unit = 'hours' }: CapacityBarChartProps) {
  const isFte = unit === 'fte';
  const tickFormatter = isFte
    ? (v: number) => `${v.toFixed(1)}`
    : (v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v);

  const tooltipFormatter = (value: number, name: string) =>
    isFte ? [`${value.toFixed(1)} FTE`, name] : [`${value.toLocaleString()} hrs`, name];

  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" fontSize={12} />
        <YAxis
          fontSize={12}
          tickFormatter={tickFormatter}
          label={{
            value: isFte ? 'FTE' : 'Hours',
            angle: -90,
            position: 'insideLeft',
            offset: -5,
            style: { fontSize: 11, fill: TEXT_DIM },
          }}
        />
        <Tooltip formatter={tooltipFormatter} />
        <Legend />
        <Bar dataKey="demand" fill={COLOR_ERROR} name="Demand" />
        <Bar dataKey="capacity" fill={COLOR_SUCCESS} name="Capacity" />
      </BarChart>
    </ResponsiveContainer>
  );
}
