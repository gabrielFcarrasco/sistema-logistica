// src/components/dashboard/FeedAtividades.tsx
import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { AlertTriangle, Package, Edit, Clock, ShieldAlert } from 'lucide-react';

interface LogAuditoria {
  id: string;
  usuarioNome: string;
  unidadeOrigem: string;
  unidadeAfetada: string;
  acao: string;
  descricao: string;
  interferenciaExterna: boolean;
  alertaDesvio: boolean;
  dataHora: any;
}

export default function FeedAtividades() {
  const [logs, setLogs] = useState<LogAuditoria[]>([]);

  useEffect(() => {
    // Busca as últimas 10 ações no sistema, da mais recente para a mais antiga
    const q = query(
      collection(db, 'auditoria'), 
      orderBy('dataHora', 'desc'), 
      limit(10)
    );

    const cancelarEscuta = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as LogAuditoria));
      setLogs(lista);
    });

    return () => cancelarEscuta();
  }, []);

  // Função para escolher o ícone baseado no tipo de ação
  const renderIcone = (acao: string, alertaDesvio: boolean) => {
    if (alertaDesvio) return <ShieldAlert size={18} color="#ef4444" />; // Vermelho para alertas
    switch (acao) {
      case 'ENTREGA_EPI': return <Package size={18} color="#10b981" />; // Verde
      case 'EDICAO_ESTOQUE': return <Edit size={18} color="#f59e0b" />; // Amarelo
      case 'ADVERTENCIA': return <AlertTriangle size={18} color="#ef4444" />; // Vermelho
      default: return <Clock size={18} color="#64748b" />; // Cinza padrão
    }
  };

  // Formata a data (se existir) para algo como "14:30" ou "12/05"
  const formatarData = (timestamp: any) => {
    if (!timestamp) return 'Agora';
    const data = timestamp.toDate();
    return data.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: 'var(--sombra-card)', height: '100%' }}>
      <h3 style={{ marginBottom: '15px', fontSize: '16px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Clock size={20} color="var(--cor-primaria)" />
        Feed de Atividades Recentes
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {logs.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
            Nenhuma atividade registrada ainda.
          </p>
        ) : (
          logs.map(log => (
            <div 
              key={log.id} 
              style={{ 
                display: 'flex', 
                gap: '12px', 
                paddingBottom: '12px', 
                borderBottom: '1px solid #f1f5f9',
                backgroundColor: log.interferenciaExterna ? '#fffbeb' : 'transparent', // Fundo amarelado se alguém mexeu no setor do outro
                padding: log.interferenciaExterna ? '10px' : '0 0 12px 0',
                borderRadius: log.interferenciaExterna ? '8px' : '0'
              }}
            >
              <div style={{ marginTop: '2px' }}>
                {renderIcone(log.acao, log.alertaDesvio)}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: '13px', color: '#334155' }}>
                  <strong>{log.usuarioNome}</strong> {log.descricao}
                </p>
                <div style={{ display: 'flex', gap: '10px', marginTop: '4px', fontSize: '11px', color: '#94a3b8' }}>
                  <span>{formatarData(log.dataHora)}</span>
                  {log.interferenciaExterna && (
                    <span style={{ color: '#d97706', fontWeight: 'bold' }}>
                      ⚠️ Ação Externa (Setor: {log.unidadeAfetada})
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
