// src/pages/PrestacaoServicos.tsx
import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';

import { CheckCircle2, AlertCircle, TrainFront, ClipboardSignature, Briefcase } from 'lucide-react';
import Button from '../components/ui/Button';

// Importa os novos componentes modulares
import KanbanTruques from '../components/prestacao-servicos/KanbanTruques';
import GerenciadorOS from '../components/prestacao-servicos/GerenciadorOS';

export default function PrestacaoServicos() {
  const { setorAtivo } = useOutletContext<{ setorAtivo: string }>();

  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [abaAtiva, setAbaAtiva] = useState<'truques' | 'os'>('truques');
  const [notificacao, setNotificacao] = useState<{msg: string, tipo: 'sucesso' | 'erro'} | null>(null);
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);

  useEffect(() => {
    const handleResize = () => setIsPortrait(window.innerHeight > window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const avisar = (msg: string, tipo: 'sucesso' | 'erro' = 'sucesso') => {
    setNotificacao({ msg, tipo });
    setTimeout(() => setNotificacao(null), 4000);
  };

  useEffect(() => {
    if (!setorAtivo) return;
    const qFunc = query(collection(db, 'funcionarios'), where('setorId', '==', setorAtivo));
    const unsubFunc = onSnapshot(qFunc, (snap) => setFuncionarios(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsubFunc();
  }, [setorAtivo]);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '15px', paddingBottom: '80px' }}>
      
      {/* Sistema Global de Notificações */}
      {notificacao && (
        <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 12000, backgroundColor: notificacao.tipo === 'sucesso' ? '#10b981' : '#ef4444', color: 'white', padding: '12px 24px', borderRadius: '50px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold' }}>
          {notificacao.tipo === 'sucesso' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />} {notificacao.msg}
        </div>
      )}

      {/* CABEÇALHO E TABS */}
      <div style={{ marginBottom: '25px' }}>
        <h1 style={{ fontSize: '24px', color: '#1e293b', margin: '0 0 5px 0', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Briefcase color="var(--cor-primaria)" /> Operação e Serviços
        </h1>
        <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Gerencie a linha de produção e gere Ordens de Serviço.</p>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', flexWrap: 'wrap' }}>
        <Button onClick={() => setAbaAtiva('truques')} style={{ flex: 1, backgroundColor: abaAtiva === 'truques' ? '#3b82f6' : '#e2e8f0', color: abaAtiva === 'truques' ? 'white' : '#475569', height: '50px', display: 'flex', gap: '8px' }}>
          <TrainFront size={18}/> Truques (Kanban de Produção)
        </Button>
        <Button onClick={() => setAbaAtiva('os')} style={{ flex: 1, backgroundColor: abaAtiva === 'os' ? '#8b5cf6' : '#e2e8f0', color: abaAtiva === 'os' ? 'white' : '#475569', height: '50px', display: 'flex', gap: '8px' }}>
          <ClipboardSignature size={18}/> OS Hyundai Rotem
        </Button>
      </div>

      {/* RENDERIZA O COMPONENTE DE ACORDO COM A ABA ATIVA */}
      {abaAtiva === 'truques' ? (
        <KanbanTruques setorAtivo={setorAtivo} funcionarios={funcionarios} avisar={avisar} />
      ) : (
        <GerenciadorOS setorAtivo={setorAtivo} isPortrait={isPortrait} avisar={avisar} />
      )}

    </div>
  );
}