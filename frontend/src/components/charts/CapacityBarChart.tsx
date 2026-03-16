import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface CapacityBarChartProps {
  data: { month: string; demand: number; capacity: number }[];
}

export default function CapacityBarChart({ data }: CapacityBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" fontSize={12} />
        <YAxis fontSize={12} />
        <Tooltip />
        <Legend />
        <Bar dataKey="demand" fill="#fa5252" name="Demand" />
        <Bar dataKey="capacity" fill="#40c057" name="Capacity" />
      </BarChart>
    </ResponsiveContainer>
  );
}
