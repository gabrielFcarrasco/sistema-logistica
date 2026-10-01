import React from 'react';
import { Route, PlusCircle, Trash2, ArrowRight } from 'lucide-react';
import Button from '../ui/Button';

interface Props {
  visivel: boolean;
  dados: { funcId: string; nome: string; rotas: any[] };
  onAdicionarRota: () => void;
  onRemoverRota: (id: string) => void;
  onAtualizarRota: (id: string, campo: string, valor: any) => void;
  onSalvar: () => void;
  onCancelar: () => void;
}

export default function ModalTransporte({
  visivel,
  dados,
  onAdicionarRota,
  onRemoverRota,
  onAtualizarRota,
  onSalvar,
  onCancelar
}: Props) {
  if (!visivel) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px', backdropFilter: 'blur(3px)' }}>
      <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '24px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', animation: 'fadeIn 0.3s' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div style={{ backgroundColor: '#e0f2fe', padding: '10px', borderRadius: '50%' }}><Route size={24} color="#0284c7" /></div>
          <div>
            <h3 style={{ margin: '0 0 2px 0', fontSize: '18px', color: '#0f172a' }}>Configurar Transporte Padrão</h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>A configuração abaixo aplica-se a todos os meses para: {dados.nome}</p>
          </div>
        </div>

        <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '15px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {dados.rotas.map(rota => (
              <div key={rota.id} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input type="text" placeholder="Nome (Ex: Ônibus)" value={rota.nomeConducao} onChange={e => onAtualizarRota(rota.id, 'nomeConducao', e.target.value)} style={{ flex: 2, padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                <input type="number" placeholder="Valor (R$)" value={rota.valor} onChange={e => onAtualizarRota(rota.id, 'valor', e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                <select value={rota.qtdDiaria} onChange={e => onAtualizarRota(rota.id, 'qtdDiaria', parseInt(e.target.value))} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                  <option value={1}>1x ao dia</option>
                  <option value={2}>2x ao dia</option>
                  <option value={3}>3x ao dia</option>
                  <option value={4}>4x ao dia</option>
                </select>
                <button onClick={() => onRemoverRota(rota.id)} style={{ backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer' }}><Trash2 size={18} /></button>
              </div>
            ))}
          </div>
          <Button onClick={onAdicionarRota} style={{ marginTop: '15px', backgroundColor: 'white', color: '#3b82f6', border: '1px dashed #3b82f6', width: '100%', display: 'flex', justifyContent: 'center', gap: '8px' }}><PlusCircle size={16} /> Adicionar Nova Condução</Button>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Button onClick={onCancelar} style={{ flex: 1, backgroundColor: '#f1f5f9', color: '#475569' }}>Cancelar</Button>
          <Button onClick={onSalvar} style={{ flex: 1, backgroundColor: '#0ea5e9' }}>Salvar Configuração <ArrowRight size={16}/></Button>
        </div>
      </div>
    </div>
  );
}