// src/pages/Advertencias.tsx
import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';

import { ShieldAlert, CheckCircle2 } from 'lucide-react';

import FormularioAdvertencia from '../components/advertencias/FormularioAdvertencia';
import HistoricoAdvertencias from '../components/advertencias/HistoricoAdvertencias';

export default function Advertencias() {
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [advertencias, setAdvertencias] = useState<any[]>([]);
  const [notificacao, setNotificacao] = useState<{msg: string, tipo: 'sucesso' | 'erro'} | null>(null);

  const avisar = (msg: string, tipo: 'sucesso' | 'erro' = 'sucesso') => {
    setNotificacao({ msg, tipo });
    setTimeout(() => setNotificacao(null), 4000);
  };

  useEffect(() => {
    // 1. Escuta a coleção de Funcionários COM tratamento de erros
    const qFunc = collection(db, 'funcionarios');
    const unsubFunc = onSnapshot(
      qFunc, 
      (snapshot) => {
        // Se der certo, faz o map normalmente
        setFuncionarios(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      },
      (error) => {
        // Se der erro de permissão, captura aqui e evita que o app quebre!
        console.error("Erro ao ler funcionários:", error);
        avisar("Sem permissão para aceder à lista de funcionários.", "erro");
      }
    );

    // 2. Escuta a coleção de Advertências COM tratamento de erros
    const qAdv = query(collection(db, 'advertencias'), orderBy('createdAt', 'desc'));
    const unsubAdv = onSnapshot(
      qAdv, 
      (snapshot) => {
        // Se der certo, faz o map
        setAdvertencias(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      },
      (error) => {
        // Evita o "Cannot read properties of undefined (reading 'map')"
        console.error("Erro ao ler advertências:", error);
        avisar("Sem permissão para aceder ao histórico de advertências.", "erro");
      }
    );

    return () => { 
      unsubFunc(); 
      unsubAdv(); 
    };
  }, []);

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '40px', padding: '10px' }}>
      
      {notificacao && (
        <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, backgroundColor: notificacao.tipo === 'sucesso' ? '#10b981' : '#ef4444', color: 'white', padding: '15px 25px', borderRadius: '50px', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', fontWeight: 'bold' }}>
          <CheckCircle2 size={20} /> <span>{notificacao.msg}</span>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <ShieldAlert size={28} color="#ef4444" />
        <h1 style={{ fontSize: '22px', color: '#1e293b', margin: 0 }}>Ocorrências e Advertências Disciplinares</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        <FormularioAdvertencia funcionarios={funcionarios} avisar={avisar} />
        <HistoricoAdvertencias advertencias={advertencias} />
      </div>

    </div>
  );
}
