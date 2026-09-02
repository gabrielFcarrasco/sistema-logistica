// src/components/ponto/CartaoColaborador.tsx
import { Handshake, AlertCircle, Clock, UserMinus, FileText, UserCheck, Edit3, MapPin } from 'lucide-react';
import Button from '../ui/Button';

interface Props {
  func: any;
  regHoje: any;
  acordoHoje: any;
  estaAtrasado: boolean;
  temFaltaOuAtestado: boolean;
  semPontoAinda: boolean;
  concluido: boolean;
  bancoHorasDia: any;
  isMobile: boolean;
  lancarAusencia: (id: string, nome: string, tipo: 'Falta' | 'Atestado Médico') => void;
  abrirModalEdicao: (func: any, reg: any) => void;
  formatarHoraLimpa: (hora?: string) => string;
}

export default function CartaoColaborador({
  func, regHoje, acordoHoje, estaAtrasado, temFaltaOuAtestado, semPontoAinda, concluido, bancoHorasDia,
  isMobile, lancarAusencia, abrirModalEdicao, formatarHoraLimpa
}: Props) {
  
  let corFundo = 'white'; 
  let corBorda = 'rgba(226, 232, 240, 0.8)'; 
  if (temFaltaOuAtestado) { corFundo = '#fff5f5'; corBorda = '#fecaca'; }
  else if (estaAtrasado) { corFundo = '#fffbeb'; corBorda = '#fde68a'; }

  const RenderHoraComGps = ({ hora, linkGps }: { hora?: string, linkGps?: string }) => {
    if (!hora || hora === '--:--') return <strong style={{ color: '#cbd5e1', fontSize: '16px', fontWeight: '600' }}>--:--</strong>;
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
        <strong style={{ color: '#0f172a', fontSize: '16px', fontWeight: '800' }}>{hora}</strong>
        {linkGps && (
          <a href={linkGps} target="_blank" rel="noopener noreferrer" title="Ver no Maps" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#eff6ff', padding: '4px', borderRadius: '50%', color: '#3b82f6', transition: '0.2s' }}>
            <MapPin size={14} />
          </a>
        )}
      </div>
    );
  };

  return (
    <div style={{ backgroundColor: corFundo, borderRadius: '20px', border: `1px solid ${corBorda}`, padding: isMobile ? '20px' : '24px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '24px', boxShadow: '0 4px 15px -3px rgba(0,0,0,0.03)', transition: 'all 0.3s ease' }}>
      
      {/* 1. Área de Identificação */}
      <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div style={{ width: '40px', height: '40px', backgroundColor: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontWeight: 'bold', fontSize: '16px' }}>{func.nome.charAt(0)}</div>
          <div>
            <strong style={{ display: 'block', fontSize: '16px', color: '#0f172a', fontWeight: '700' }}>{func.nome}</strong>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Mat: {func.matricula}</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingLeft: '52px' }}>
          {acordoHoje && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', backgroundColor: '#eef2ff', color: '#4f46e5', padding: '4px 8px', borderRadius: '20px', fontWeight: 'bold', border: '1px solid #c7d2fe' }}><Handshake size={12} /> Acordo Ativo</span>}
          {regHoje?.justificativa && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', backgroundColor: temFaltaOuAtestado ? '#fee2e2' : '#fef3c7', color: temFaltaOuAtestado ? '#b91c1c' : '#d97706', padding: '4px 8px', borderRadius: '20px', fontWeight: 'bold' }}><AlertCircle size={12} /> {regHoje.justificativa}</span>}
          {bancoHorasDia && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', backgroundColor: bancoHorasDia.val >= 0 ? '#dcfce7' : '#fee2e2', color: bancoHorasDia.val >= 0 ? '#166534' : '#991b1b', padding: '4px 8px', borderRadius: '20px', fontWeight: 'bold', border: `1px solid ${bancoHorasDia.val >= 0 ? '#bbf7d0' : '#fecaca'}` }}><Clock size={12} /> Saldo Dia: {bancoHorasDia.text}</span>}
        </div>
      </div>

      {/* 2. Área de Horários */}
      <div style={{ flex: 1.5, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', backgroundColor: 'rgba(248, 250, 252, 0.5)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(226, 232, 240, 0.5)' }}>
        {[
          { label: 'ENTRADA', valor: formatarHoraLimpa(regHoje?.entrada1), link: regHoje?.entrada1_local },
          { label: 'SAÍDA ALM.', valor: formatarHoraLimpa(regHoje?.saida1), link: regHoje?.saida1_local },
          { label: 'RETORNO', valor: formatarHoraLimpa(regHoje?.entrada2), link: regHoje?.entrada2_local },
          { label: 'SAÍDA FIM', valor: formatarHoraLimpa(regHoje?.saida2), link: regHoje?.saida2_local }
        ].map((ponto, idx) => (
          <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700', marginBottom: '4px' }}>{ponto.label}</span>
            <RenderHoraComGps hora={ponto.valor} linkGps={ponto.link} />
          </div>
        ))}
      </div>

      {/* 3. Área de Ações do Gestor */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', justifyContent: 'center' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch', height: estaAtrasado ? 'auto' : '50px' }}>
          <div style={{ flex: 3, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {estaAtrasado ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', height: '40px' }}>
                <Button onClick={() => lancarAusencia(func.id, func.nome, 'Falta')} style={{ backgroundColor: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5', fontSize: '12px', padding: 0, borderRadius: '10px' }}><UserMinus size={14} style={{ marginRight: '6px' }}/> Falta</Button>
                <Button onClick={() => lancarAusencia(func.id, func.nome, 'Atestado Médico')} style={{ backgroundColor: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', fontSize: '12px', padding: 0, borderRadius: '10px' }}><FileText size={14} style={{ marginRight: '6px' }}/> Atestado</Button>
              </div>
            ) : semPontoAinda ? (
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#64748b', backgroundColor: '#f1f5f9', borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', border: '1px dashed #cbd5e1' }}>Aguardando...</div>
            ) : concluido || temFaltaOuAtestado ? (
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: temFaltaOuAtestado ? '#991b1b' : '#15803d', backgroundColor: temFaltaOuAtestado ? '#fee2e2' : '#dcfce7', borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', height: '100%' }}>{temFaltaOuAtestado ? 'Justificado' : <><UserCheck size={16} /> Concluído</>}</div>
            ) : (
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#0ea5e9', backgroundColor: '#e0f2fe', borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', height: '100%' }}><Clock size={16} /> Em Andamento</div>
            )}
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
             <Button onClick={() => abrirModalEdicao(func, regHoje)} style={{ height: '100%', minHeight: estaAtrasado ? '40px' : '100%', backgroundColor: '#f8fafc', color: '#3b82f6', border: '1px solid #cbd5e1', padding: 0, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }} title="Ajustar Manualmente"><Edit3 size={18} /></Button>
          </div>
        </div>
      </div>
    </div>
  );
}