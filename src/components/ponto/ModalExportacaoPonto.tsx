// src/components/ponto/ModalExportacaoPonto.tsx
import { X, Download } from 'lucide-react';
import Button from '../ui/Button';

interface Props {
  aberto: boolean;
  onClose: () => void;
  mesExport: string;
  setMesExport: (val: string) => void;
  funcExportId: string;
  setFuncExportId: (val: string) => void;
  funcionarios: any[];
  exportando: boolean;
  gerarEspelhoPonto: () => void;
}

export default function ModalExportacaoPonto({ aberto, onClose, mesExport, setMesExport, funcExportId, setFuncExportId, funcionarios, exportando, gerarEspelhoPonto }: Props) {
  if (!aberto) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)', padding: '15px' }}>
      <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '400px', borderRadius: '24px', padding: '30px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, color: '#0f172a', fontSize: '18px', fontWeight: '800' }}>Exportar Espelho</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '5px' }}><X size={20} color="#64748b" /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '25px' }}>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '5px' }}>Mês de Referência</label>
            <input type="month" value={mesExport} onChange={e => setMesExport(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
          </div>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '5px' }}>Colaborador</label>
            <select value={funcExportId} onChange={e => setFuncExportId(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}>
              <option value="">Selecione o funcionário...</option>
              {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>
        </div>

        <Button onClick={gerarEspelhoPonto} disabled={exportando || !funcExportId} style={{ width: '100%', height: '50px', backgroundColor: '#10b981', display: 'flex', justifyContent: 'center', gap: '8px', fontWeight: 'bold' }}>
          <Download size={18} /> {exportando ? 'Gerando...' : 'Exportar PDF'}
        </Button>
      </div>
    </div>
  );
}