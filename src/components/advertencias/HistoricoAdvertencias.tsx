// src/components/advertencias/HistoricoAdvertencias.tsx
import jsPDF from "jspdf";
import logoCarvalho from '../../assets/logopdf.png';
import { Download } from 'lucide-react';
import Button from '../ui/Button';

interface Advertencia { 
  id: string; 
  funcionarioNome: string; 
  tipo: 'oral' | 'escrita';
  motivo: string; 
  dataOcorrencia: string; 
  horaOcorrencia?: string;
}

interface Props {
  advertencias: Advertencia[];
}

export default function HistoricoAdvertencias({ advertencias }: Props) {
  
  const gerarPDFFormal = (adv: Advertencia) => {
    // ... (Mantenha aqui a sua função de gerar PDF intacta)
  };

  return (
    <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: 'var(--sombra-card)' }}>
      <h3 style={{ marginBottom: '15px', fontSize: '16px', color: '#1e293b' }}>Histórico do RH</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '650px', overflowY: 'auto' }}>
        {/* ✨ PROTEÇÃO AQUI: Se advertencias for undefined, usamos || [] para evitar o erro de map */}
        {(advertencias || []).length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '20px' }}>Nenhum registo efetuado.</p>
        ) : (
          (advertencias || []).map(adv => (
            <div key={adv.id} style={{ border: '1px solid #e2e8f0', padding: '15px', borderRadius: '8px', backgroundColor: adv.tipo === 'oral' ? '#fffbeb' : '#fff5f5' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <strong style={{ color: '#1e293b', fontSize: '14px' }}>{adv.funcionarioNome}</strong>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: adv.tipo === 'oral' ? '#b45309' : '#b91c1c' }}>{adv.tipo.toUpperCase()}</span>
              </div>
              <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 10px 0' }}>{adv.motivo}</p>
              <Button onClick={() => gerarPDFFormal(adv)} style={{ width: '100%', backgroundColor: 'white', color: '#1e293b', border: '1px solid #cbd5e1' }}>
                <Download size={16} /> Baixar PDF
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}