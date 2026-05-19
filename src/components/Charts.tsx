import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';

const emotionalData = [
  { subject: 'Satisfeito', A: 120, fullMark: 150 },
  { subject: 'Feliz', A: 98, fullMark: 150 },
  { subject: 'Ansioso', A: 86, fullMark: 150 },
  { subject: 'Culpado', A: 30, fullMark: 150 },
  { subject: 'Neutro', A: 85, fullMark: 150 },
  { subject: 'Nervoso', A: 65, fullMark: 150 },
];

export function EmotionalRadarChart() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-[300px] w-full bg-slate-900/10 animate-pulse rounded-2xl" />;

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={emotionalData}>
          <PolarGrid stroke="#1E293B" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: '#94A3B8', fontSize: 10 }} />
          <PolarRadiusAxis axisLine={false} tick={false} />
          <Radar
            name="Família Silva"
            dataKey="A"
            stroke="#6366F1"
            fill="#6366F1"
            fillOpacity={0.2}
          />
          <Tooltip 
             contentStyle={{ 
              borderRadius: '16px', 
              border: '1px solid #1E293B', 
              backgroundColor: '#09090B',
              color: '#F8FAFC',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
              fontSize: '12px'
            }} 
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

const data = [
  { name: 'Jan', entrada: 4000, saida: 2400 },
  { name: 'Fev', entrada: 3000, saida: 1398 },
  { name: 'Mar', entrada: 2000, saida: 9800 },
  { name: 'Abr', entrada: 2780, saida: 3908 },
  { name: 'Mai', entrada: 8900, saida: 4320 },
];

const pieData = [
  { name: 'Moradia', value: 1200 },
  { name: 'Alimentação', value: 850 },
  { name: 'Lazer', value: 400 },
  { name: 'Educação', value: 250 },
  { name: 'Outros', value: 120 },
];

const COLORS = ['#6366F1', '#4F46E5', '#312E81', '#1E1B4B', '#09090B'];

export function MainFlowChart() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-[300px] w-full bg-slate-900/10 animate-pulse rounded-2xl" />;

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorEntrada" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorSaida" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#FB7185" stopOpacity={0.2}/>
              <stop offset="95%" stopColor="#FB7185" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1E293B" />
          <XAxis 
            dataKey="name" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#94A3B8', fontSize: 10 }} 
            dy={10}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#94A3B8', fontSize: 10 }} 
          />
          <Tooltip 
            contentStyle={{ 
              borderRadius: '16px', 
              border: '1px solid #1E293B', 
              backgroundColor: '#09090B',
              color: '#F8FAFC',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
              fontSize: '12px'
            }} 
          />
          <Area 
            type="monotone" 
            dataKey="entrada" 
            stroke="#6366F1" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorEntrada)" 
          />
          <Area 
            type="monotone" 
            dataKey="saida" 
            stroke="#FB7185" 
            strokeWidth={2}
            fillOpacity={1} 
            fill="url(#colorSaida)" 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoriesPieChart() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-[200px] w-full bg-slate-900/10 animate-pulse rounded-full" />;

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
          >
            {pieData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="#1E293B" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip 
             contentStyle={{ 
              borderRadius: '16px', 
              border: '1px solid #1E293B', 
              backgroundColor: '#09090B',
              color: '#F8FAFC',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
              fontSize: '12px'
            }} 
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
