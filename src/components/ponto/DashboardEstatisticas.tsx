// src/components/ponto/DashboardEstatisticas.tsx
import { BarChart2, UserCheck, AlertTriangle, UserMinus } from 'lucide-react';

interface Props {
  total: number;
  presentes: number;
  atrasados: number;
  ausentes: number;
}

export default function DashboardEstatisticas({ total, presentes, atrasados, ausentes }: Props) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '30px' }}>
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '15px' }}>
        <div style={{ backgroundColor: '#f1f5f9', padding: '12px', borderRadius: '12px' }}><BarChart2 size={24} color="#475569" /></div>
        <div>
          <p style={{ margin: 0, fontSize: '12px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Total Equipe</p>
          <h3 style={{ margin: 0, fontSize: '24px', color: '#0f172a' }}>{total}</h3>
        </div>
      </div>
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: '15px' }}>
        <div style={{ backgroundColor: '#f0fdf4', padding: '12px', borderRadius: '12px' }}><UserCheck size={24} color="#16a34a" /></div>
        <div>
          <p style={{ margin: 0, fontSize: '12px', color: '#166534', fontWeight: 'bold', textTransform: 'uppercase' }}>Presentes</p>
          <h3 style={{ margin: 0, fontSize: '24px', color: '#15803d' }}>{presentes}</h3>
        </div>
      </div>
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', gap: '15px' }}>
        <div style={{ backgroundColor: '#fffbeb', padding: '12px', borderRadius: '12px' }}><AlertTriangle size={24} color="#d97706" /></div>
        <div>
          <p style={{ margin: 0, fontSize: '12px', color: '#b45309', fontWeight: 'bold', textTransform: 'uppercase' }}>Atrasados / Pendentes</p>
          <h3 style={{ margin: 0, fontSize: '24px', color: '#b45309' }}>{atrasados}</h3>
        </div>
      </div>
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: '15px' }}>
        <div style={{ backgroundColor: '#fef2f2', padding: '12px', borderRadius: '12px' }}><UserMinus size={24} color="#dc2626" /></div>
        <div>
          <p style={{ margin: 0, fontSize: '12px', color: '#b91c1c', fontWeight: 'bold', textTransform: 'uppercase' }}>Ausentes / Justificados</p>
          <h3 style={{ margin: 0, fontSize: '24px', color: '#b91c1c' }}>{ausentes}</h3>
        </div>
      </div>
    </div>
  );
}