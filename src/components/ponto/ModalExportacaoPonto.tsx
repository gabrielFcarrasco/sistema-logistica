// src/components/ponto/ModalExportacaoPonto.tsx
import { useState } from 'react';
import { X, FileSpreadsheet, Loader2, Download } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
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
  const [erro, setErro] = useState('');

  const handleExportarPDF = async () => {
    setErro('');
    setExportando(true);

    try {
      // Aciona o serviço unificado de geração de PDF
      await gerarFolhaDePontoPDF(mesExport, funcionarios, jornadaPadrao);
      onClose(); // Fecha o modal após o sucesso
    } catch (error) {
      console.error(error);
      setErro('Erro ao gerar o PDF. Verifica a tua ligação à internet e tenta novamente.');
    } finally {
      setExportando(false);
    }
  };

  if (!aberto) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.85)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(4px)' }}>
      <div style={{ backgroundColor: 'white', borderRadius: '24px', padding: '30px', maxWidth: '400px', width: '100%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', animation: 'fadeIn 0.3s' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ backgroundColor: '#f0fdf4', padding: '10px', borderRadius: '10px' }}>
              <FileSpreadsheet size={24} color="#16a34a" />
            </div>
            <h3 style={{ margin: 0, color: '#0f172a', fontSize: '18px', fontWeight: '800' }}>Exportar Folha</h3>
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', padding: '8px', borderRadius: '50%', cursor: 'pointer' }}>
            <X size={18} color="#475569" />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '25px' }}>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
            Gera o documento oficial em PDF com as horas extras, atrasos e faltas de todos os colaboradores da empresa.
          </p>
          
          <Input 
            label="Mês de Referência" 
            type="month" 
            value={mesExport} 
            onChange={(e) => setMesExport(e.target.value)} 
          />
          
          {erro && (
            <div style={{ padding: '10px', backgroundColor: '#fef2f2', color: '#b91c1c', fontSize: '12px', borderRadius: '8px', border: '1px solid #fecaca', fontWeight: 'bold' }}>
              {erro}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Button onClick={onClose} style={{ flex: 1, backgroundColor: '#f1f5f9', color: '#475569', border: 'none', height: '45px', fontWeight: 'bold' }}>
            Cancelar
          </Button>
          <Button onClick={handleExportarPDF} disabled={exportando || !mesExport} style={{ flex: 1, backgroundColor: '#16a34a', color: 'white', border: 'none', height: '45px', fontWeight: 'bold', display: 'flex', justifyContent: 'center', gap: '8px' }}>
            {exportando ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> A Processar...</> : <><Download size={18} /> Gerar PDF</>}
          </Button>
        </div>

      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}