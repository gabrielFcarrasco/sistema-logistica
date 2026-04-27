// src/pages/Auditoria.tsx
import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { 
  History, Search, Filter, Package, ClipboardCheck, 
  ShieldAlert, User, Calendar, Eye, ArrowRight, CheckCircle2 
} from 'lucide-react';
import Button from '../components/ui/Button';

interface LogAtividade {
  id: string;
  tipo: 'estoque' | 'entrega' | 'advertencia';
  usuarioNome: string;
  descricao: string;
  detalhes?: any;
  dataHora: any;
  setorId: string;
}

export default function Auditoria() {
  const [logs, setLogs] = useState<LogAtividade[]>([]);
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [busca, setBusca] = useState('');

  useEffect(() => {
    // Busca os logs mais recentes de múltiplas coleções ou de uma coleção central de logs
    // Para performance, vamos ouvir a coleção 'logs_sistema' (que criaremos nos gatilhos)
    const q = query(
      collection(db, 'logs_sistema'), 
      orderBy('dataHora', 'desc'),
      limit(100)
    );

    const unsub = onSnapshot(q, (snap) => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as LogAtividade)));
    });

    return () => unsub();
  }, []);

  const formatarData = (timestamp: any) => {
    if (!timestamp) return '...';
    const d = timestamp.toDate();
    return d.toLocaleString('pt-BR');
  };

  const filtrarLogs = logs.filter(log => {
    const matchTipo = filtroTipo === 'todos' || log.tipo === filtroTipo;
    const matchBusca = log.usuarioNome.toLowerCase().includes(busca.toLowerCase()) || 
                       log.descricao.toLowerCase().includes(busca.toLowerCase());
    return matchTipo && matchBusca;
  });

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '10px' }}>
      
      <div style={{ marginBottom: '25px', marginTop: '10px' }}>
        <h1 style={{ fontSize: '24px', color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <History size={28} color="var(--cor-primaria)" /> Auditoria do Sistema
        </h1>
        <p style={{ color: '#64748b', fontSize: '14px' }}>Rastreabilidade total de movimentações e registros.</p>
      </div>

      {/* FILTROS MOBILE-FRIENDLY */}
      <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '12px', boxShadow: 'var(--sombra-card)', marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ flex: '1 1 200px', position: 'relative' }}>
          <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '12px' }} />
          <input 
            type="text" 
            placeholder="Buscar por usuário ou ação..." 
            value={busca}
            onChange={e => setBusca(e.target.value)}
            style={{ width: '100%', padding: '10px 10px 10px 40px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none' }}
          />
        </div>
        <select 
          value={filtroTipo} 
          onChange={e => setFiltroTipo(e.target.value)}
          style={{ padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', outline: 'none' }}
        >
          <option value="todos">Todas as Atividades</option>
          <option value="estoque">Movimentação de Estoque</option>
          <option value="entrega">Entregas Realizadas</option>
          <option value="advertencia">Advertências/Ocorrências</option>
        </select>
      </div>

      {/* TIMELINE DE AUDITORIA */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filtrarLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Nenhuma atividade registrada.</div>
        ) : (
          filtrarLogs.map(log => (
            <div key={log.id} style={{ backgroundColor: 'white', padding: '15px', borderRadius: '12px', borderLeft: `4px solid ${getCorTipo(log.tipo)}`, boxShadow: '0 2px 4px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {getIconeTipo(log.tipo)}
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>{log.tipo}</span>
                </div>
                <span style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={12} /> {formatarData(log.dataHora)}
                </span>
              </div>

              <p style={{ margin: 0, fontSize: '14px', color: '#1e293b', lineHeight: '1.4' }}>
                <strong>{log.usuarioNome}</strong> {log.descricao}
              </p>

              {log.detalhes && log.tipo === 'estoque' && (
                <div style={{ backgroundColor: '#f8fafc', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '10px', color: '#475569' }}>
                   <span>De: <strong>{log.detalhes.antigo}</strong></span>
                   <ArrowRight size={14} />
                   <span>Para: <strong>{log.detalhes.novo}</strong></span>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginTop: '4px' }}>
                <span style={{ fontSize: '11px', color: '#3b82f6', backgroundColor: '#eff6ff', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>
                  Unidade: {log.setorId}
                </span>
              </div>

            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Funções auxiliares visuais
function getCorTipo(tipo: string) {
  switch(tipo) {
    case 'estoque': return '#3b82f6';
    case 'entrega': return '#10b981';
    case 'advertencia': return '#ef4444';
    default: return '#cbd5e1';
  }
}

function getIconeTipo(tipo: string) {
  switch(tipo) {
    case 'estoque': return <Package size={16} color="#3b82f6" />;
    case 'entrega': return <ClipboardCheck size={16} color="#10b981" />;
    case 'advertencia': return <ShieldAlert size={16} color="#ef4444" />;
    default: return <History size={16} />;
  }
}