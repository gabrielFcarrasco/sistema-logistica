// src/components/prestacao-servicos/FormularioLancarTruque.tsx
import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { TrainFront, Printer, CalendarDays } from 'lucide-react';
import Button from '../ui/Button';

interface Props {
  setorAtivo: string;
  avisar: (msg: string, tipo?: 'sucesso'|'erro') => void;
  onGerarRelatorio: () => void;
  onBaixarChecklistsSemana: () => void;
}

export default function FormularioLancarTruque({ setorAtivo, avisar, onGerarRelatorio, onBaixarChecklistsSemana }: Props) {
  const [truqueId, setTruqueId] = useState('');

  const registrarTruque = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!truqueId) return avisar("Preencha os números da Plaquinha.", "erro");
    if (!/^M\d{3}$/.test(truqueId)) return avisar("A plaquinha deve conter M e 3 números. Ex: M001.", "erro");

    try {
      await addDoc(collection(db, 'truques_producao'), {
        setorId: setorAtivo,
        identificacao: truqueId,
        colaboradorJateouId: 'pendente', 
        colaboradorJateouNome: 'A Definir',
        status: 'pronto_jateamento',
        dataCadastro: serverTimestamp()
      });
      avisar("Truque cadastrado para Lavagem.");
      setTruqueId('');
    } catch (error) { avisar("Erro ao registrar.", "erro"); }
  };

  return (
    <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', height: 'fit-content' }}>
      <h3 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 20px 0', color: '#1e293b' }}>
        <TrainFront size={18} color="#3b82f6" /> Lançar Truque
      </h3>
      <form onSubmit={registrarTruque} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div>
          <label style={{ fontSize: '13px', color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Código da Plaquinha *</label>
          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
            <span style={{ padding: '12px 15px', backgroundColor: '#e2e8f0', fontWeight: 'bold' }}>M</span>
            <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={3} value={truqueId.replace('M', '')} onChange={e => setTruqueId(e.target.value.replace(/\D/g, '') ? `M${e.target.value.replace(/\D/g, '')}` : '')} placeholder="000" style={{ width: '100%', padding: '12px', border: 'none', background: 'transparent', outline: 'none', fontSize: '16px', fontWeight: 'bold' }} />
          </div>
        </div>
        <Button type="submit" style={{ height: '50px', backgroundColor: '#3b82f6' }}>Iniciar Preparação</Button>
        
        <div style={{ borderTop: '1px solid #e2e8f0', marginTop: '10px', paddingTop: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <Button type="button" onClick={onGerarRelatorio} style={{ backgroundColor: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <Printer size={16}/> Resumo do Galpão
          </Button>
          <Button type="button" onClick={onBaixarChecklistsSemana} style={{ backgroundColor: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <CalendarDays size={16}/> Checklists da Semana
          </Button>
        </div>
      </form>
    </div>
  );
}