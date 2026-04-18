import { ReactNode } from 'react';

// 1. Adicionamos 'icone' nas propriedades que o componente aceita
interface StatCardProps {
  titulo: string;
  valor: string | number;
  corDestaque: string;
  icone?: ReactNode; // ReactNode significa que aceita um componente React (nosso SVG)
}

export default function StatCard({ titulo, valor, corDestaque, icone }: StatCardProps) {
  return (
    <div style={{ 
      backgroundColor: 'white', 
      padding: '24px', 
      borderRadius: '12px', 
      boxShadow: 'var(--sombra-card)', 
      borderLeft: `4px solid ${corDestaque}`,
      display: 'flex', 
      justifyContent: 'space-between', // Separa o texto do ícone
      alignItems: 'center'
    }}>
      <div>
        <h3 style={{ margin: 0, color: 'var(--cor-texto-claro)', fontSize: '14px', fontWeight: 500 }}>
          {titulo}
        </h3>
        <p style={{ margin: '8px 0 0 0', fontSize: '28px', fontWeight: 'bold', color: 'var(--cor-texto-escuro)' }}>
          {valor}
        </p>
      </div>
      
      {/* 2. Se o ícone for passado na tela, nós desenhamos ele aqui */}
      {icone && (
        <div style={{ color: corDestaque, opacity: 0.8 }}>
          {icone}
        </div>
      )}
    </div>
  );
}