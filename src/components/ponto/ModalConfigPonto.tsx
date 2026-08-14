// src/components/ponto/ModalConfigPonto.tsx
import { X, Save } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';

interface Props {
  aberto: boolean;
  onClose: () => void;
  configEdit: any;
  setConfigEdit: (val: any) => void;
  salvarConfiguracao: () => void;
  isMobile: boolean;
}

export default function ModalConfigPonto({ aberto, onClose, configEdit, setConfigEdit, salvarConfiguracao, isMobile }: Props) {
  if (!aberto) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)', padding: '15px' }}>
      <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '500px', borderRadius: '24px', padding: isMobile ? '24px' : '32px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '20px', marginBottom: '25px' }}>
          <div>
            <h3 style={{ margin: 0, color: '#0f172a', fontSize: '20px', fontWeight: '800' }}>Quadro de Horários Global</h3>
            <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>Edite as regras do ponto para toda a empresa.</p>
          </div>
          <button onClick={onClose} style={{ background: '#f8fafc', border: 'none', cursor: 'pointer', padding: '10px', borderRadius: '50%' }}><X size={20} color="#64748b" /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
          <Input type="time" label="Hora de Entrada" value={configEdit.entrada} onChange={e => setConfigEdit({...configEdit, entrada: e.target.value})} />
          <Input type="time" label="Saída Almoço" value={configEdit.saidaAlmoco} onChange={e => setConfigEdit({...configEdit, saidaAlmoco: e.target.value})} />
          <Input type="time" label="Retorno Almoço" value={configEdit.retornoAlmoco} onChange={e => setConfigEdit({...configEdit, retornoAlmoco: e.target.value})} />
          <Input type="time" label="Saída Fim de Expediente" value={configEdit.saidaFim} onChange={e => setConfigEdit({...configEdit, saidaFim: e.target.value})} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '30px' }}>
          <div style={{ backgroundColor: '#fffbeb', padding: '10px', borderRadius: '12px', border: '1px solid #fde68a' }}>
            <Input type="time" label="Limite para Atraso" value={configEdit.limiteAtraso} onChange={e => setConfigEdit({...configEdit, limiteAtraso: e.target.value})} />
          </div>
          <div style={{ backgroundColor: '#f0fdf4', padding: '10px', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
            <Input type="time" label="Carga Horária / Jornada" value={configEdit.cargaHoraria} onChange={e => setConfigEdit({...configEdit, cargaHoraria: e.target.value})} />
          </div>
        </div>

        <Button onClick={salvarConfiguracao} style={{ width: '100%', height: '56px', fontSize: '16px', backgroundColor: '#0f172a', display: 'flex', justifyContent: 'center', gap: '10px', borderRadius: '14px', fontWeight: 'bold' }}>
          <Save size={20} /> Salvar Regras
        </Button>
      </div>
    </div>
  );
}