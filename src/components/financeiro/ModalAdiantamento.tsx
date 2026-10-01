import React from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';

interface Props {
  visivel: boolean;
  dados: { funcId: string; nome: string; idVale: string; valor: string; motivo: string; dataIso: string };
  setDados: React.Dispatch<React.SetStateAction<any>>;
  onSalvar: () => void;
  onCancelar: () => void;
}

export default function ModalAdiantamento({ visivel, dados, setDados, onSalvar, onCancelar }: Props) {
  if (!visivel) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(3px)' }}>
      <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '16px', width: '100%', maxWidth: '400px', animation: 'fadeIn 0.3s' }}>
        <h3 style={{ margin: '0 0 5px 0', fontSize: '18px' }}>{dados.idVale ? 'Editar Vale/Adiantamento' : 'Lançar Novo Vale'}</h3>
        <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748b' }}>Colaborador: {dados.nome}</p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px' }}>
          <Input label="Data do Vale" type="date" value={dados.dataIso} onChange={e => setDados((prev: any) => ({ ...prev, dataIso: e.target.value }))} />
          <Input label="Valor (R$)" type="number" placeholder="Ex: 50.00" value={dados.valor} onChange={e => setDados((prev: any) => ({ ...prev, valor: e.target.value }))} />
          <Input label="Motivo / Descrição" type="text" placeholder="Ex: Vale farmácia, Almoço..." value={dados.motivo} onChange={e => setDados((prev: any) => ({ ...prev, motivo: e.target.value }))} />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Button onClick={onCancelar} style={{ flex: 1, backgroundColor: '#f1f5f9', color: '#475569' }}>Cancelar</Button>
          <Button onClick={onSalvar} style={{ flex: 1, backgroundColor: '#3b82f6' }}>{dados.idVale ? 'Atualizar Vale' : 'Confirmar'}</Button>
        </div>
      </div>
    </div>
  );
}