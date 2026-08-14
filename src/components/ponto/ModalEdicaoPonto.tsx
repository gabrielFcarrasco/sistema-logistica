// src/components/ponto/ModalEdicaoPonto.tsx
import { X, Save } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';

interface Props {
  aberto: boolean;
  onClose: () => void;
  funcEditando: any;
  dataFiltro: string;
  entrada1: string; setEntrada1: (v: string) => void;
  saida1: string; setSaida1: (v: string) => void;
  entrada2: string; setEntrada2: (v: string) => void;
  saida2: string; setSaida2: (v: string) => void;
  cargaHorariaManual: string; setCargaHorariaManual: (v: string) => void;
  justificativa: string; setJustificativa: (v: string) => void;
  salvarEdicaoPonto: () => void;
  isMobile: boolean;
}

export default function ModalEdicaoPonto({
  aberto, onClose, funcEditando, dataFiltro,
  entrada1, setEntrada1, saida1, setSaida1, entrada2, setEntrada2, saida2, setSaida2,
  cargaHorariaManual, setCargaHorariaManual, justificativa, setJustificativa,
  salvarEdicaoPonto, isMobile
}: Props) {
  if (!aberto) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)', padding: '15px' }}>
      <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '500px', borderRadius: '24px', padding: isMobile ? '24px' : '32px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '20px', marginBottom: '25px' }}>
          <div>
            <h3 style={{ margin: 0, color: '#0f172a', fontSize: '20px', fontWeight: '800' }}>Ajuste Manual</h3>
            <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>{funcEditando?.nome} - Dia: {dataFiltro.split('-').reverse().join('/')}</p>
          </div>
          <button onClick={onClose} style={{ background: '#f8fafc', border: 'none', cursor: 'pointer', padding: '10px', borderRadius: '50%' }}><X size={20} color="#64748b" /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px', marginBottom: '25px' }}>
          <Input type="time" label="Entrada" value={entrada1} onChange={e => setEntrada1(e.target.value)} />
          <Input type="time" label="Saída Almoço" value={saida1} onChange={e => setSaida1(e.target.value)} />
          <Input type="time" label="Retorno Almoço" value={entrada2} onChange={e => setEntrada2(e.target.value)} />
          <Input type="time" label="Saída Final" value={saida2} onChange={e => setSaida2(e.target.value)} />
        </div>

        <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '25px' }}>
          <label style={{ fontSize: '13px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '8px' }}>Carga Horária Prevista</label>
          <Input type="time" label="" value={cargaHorariaManual} onChange={e => setCargaHorariaManual(e.target.value)} />
        </div>

        <div style={{ marginBottom: '30px' }}>
          <label style={{ fontSize: '13px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '8px' }}>Justificativa (Opcional)</label>
          <textarea 
            value={justificativa} 
            onChange={e => setJustificativa(e.target.value)} 
            placeholder="Ex: Esqueceu de bater o ponto..."
            style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', minHeight: '90px', fontFamily: 'inherit', boxSizing: 'border-box', fontSize: '14px' }}
          />
        </div>

        <Button onClick={salvarEdicaoPonto} style={{ width: '100%', height: '56px', fontSize: '16px', backgroundColor: '#3b82f6', display: 'flex', justifyContent: 'center', gap: '10px', borderRadius: '14px', fontWeight: 'bold' }}>
          <Save size={20} /> Salvar Alterações
        </Button>
      </div>
    </div>
  );
}