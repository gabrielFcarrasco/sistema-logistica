// src/components/entrega/ModalJustificativa.tsx
import { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import Button from '../ui/Button';

const JUSTIFICATIVAS_PADRAO = [
  "Dano em serviço (Rasgou/Quebrou)",
  "Extravio / Perda",
  "Desgaste prematuro (Material ruim)",
  "Tamanho incorreto / Troca",
  "Roubo / Furto",
  "Defeito de fábrica"
];

interface Props {
  item: any | null;
  onClose: () => void;
  onConfirm: (justificativa: string) => void;
}

export default function ModalJustificativa({ item, onClose, onConfirm }: Props) {
  const [selecao, setSelecao] = useState('');

  useEffect(() => {
    if (item) setSelecao('');
  }, [item]);

  if (!item) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.95)', zIndex: 15000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '450px', borderRadius: '20px', padding: '30px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ backgroundColor: '#fff7ed', width: '70px', height: '70px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px' }}>
            <AlertTriangle size={40} color="#f97316" />
          </div>
          <h2 style={{ fontSize: '20px', color: '#1e293b', margin: 0 }}>Troca Antecipada</h2>
          <p style={{ fontSize: '14px', color: '#64748b', marginTop: '10px', lineHeight: '1.5' }}>
            Última entrega: <strong>{item.dataAnterior} às {item.horaAnterior}</strong>.<br/>
            Usado por <strong>{item.diasPassados} dias</strong>, deveria durar <strong>{item.durabilidadePrevista} dias</strong>.
          </p>
        </div>

        <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '10px' }}>QUAL O MOTIVO DA TROCA?</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
          {JUSTIFICATIVAS_PADRAO.map(j => (
            <button key={j} onClick={() => setSelecao(j)} style={{ textAlign: 'left', padding: '14px', borderRadius: '10px', border: selecao === j ? '2px solid #f97316' : '1px solid #e2e8f0', backgroundColor: selecao === j ? '#fff7ed' : 'white', fontSize: '14px', fontWeight: selecao === j ? 'bold' : 'normal', transition: '0.2s', cursor: 'pointer' }}>
              {j}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '30px' }}>
          <Button onClick={onClose} style={{ backgroundColor: '#f1f5f9', color: '#475569' }}>Cancelar</Button>
          <Button onClick={() => onConfirm(selecao)} disabled={!selecao} style={{ backgroundColor: '#f97316' }}>Autorizar</Button>
        </div>

      </div>
    </div>
  );
}