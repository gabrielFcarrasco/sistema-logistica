// src/components/ponto/ModalExportacaoPonto.tsx
import { X, Download, Users } from 'lucide-react';
import Button from '../ui/Button';
import { gerarFolhaDePontoPDF } from '../../services/geradorPdfPonto';

interface Props {
  aberto: boolean;
  onClose: () => void;
  mesExport: string;
  setMesExport: (val: string) => void;
  funcionarios: any[];
  exportando: boolean;
  setExportando: (val: boolean) => void;
  jornadaPadrao: any;
}

export default function ModalExportacaoPonto({ 
  aberto, onClose, mesExport, setMesExport, funcionarios, exportando, setExportando, jornadaPadrao 
}: Props) {
  
  if (!aberto) return null;

  const handleExportar = async () => {
    setExportando(true);
    
    try {
      // Passamos o mês, a lista inteira de funcionários e a jornada oficial
      await gerarFolhaDePontoPDF(mesExport, funcionarios, jornadaPadrao);
      onClose();
      alert("Folha de Ponto Geral exportada com sucesso!");
    } catch (error) {
      console.error(error);
      alert("Houve um erro ao gerar o PDF em lote. Tente novamente.");
    } finally {
      setExportando(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)', padding: '15px' }}>
      <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '400px', borderRadius: '24px', padding: '30px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, color: '#0f172a', fontSize: '18px', fontWeight: '800' }}>Exportação Geral</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '5px' }}><X size={20} color="#64748b" /></button>
        </div>

        <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '15px', borderRadius: '12px', marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <Users size={24} color="#16a34a" />
          <p style={{ margin: 0, fontSize: '13px', color: '#166534', lineHeight: '1.4' }}>
            Este processo irá gerar um único arquivo PDF contendo as folhas de ponto de <strong>todos os {funcionarios.length} funcionários</strong>, separados por página.
          </p>
        </div>

        <div style={{ marginBottom: '25px' }}>
          <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '5px' }}>Mês de Referência</label>
          <input type="month" value={mesExport} onChange={e => setMesExport(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
        </div>

        <Button onClick={handleExportar} disabled={exportando} style={{ width: '100%', height: '50px', backgroundColor: '#10b981', display: 'flex', justifyContent: 'center', gap: '8px', fontWeight: 'bold' }}>
          <Download size={18} /> {exportando ? 'Processando Lote...' : 'Gerar PDF Completo'}
        </Button>
      </div>
    </div>
  );
}