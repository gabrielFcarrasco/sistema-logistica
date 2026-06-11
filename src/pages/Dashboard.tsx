// src/pages/Dashboard.tsx
import { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, where, doc, updateDoc, orderBy, limit, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

import Saudacao from '../components/dashboard/Saudacao';
import GerenciadorSetores from '../components/dashboard/GerenciadorSetores';
import FeedAtividade from '../components/dashboard/FeedAtividades';
import StatCard from '../components/ui/StatCard';
import Button from '../components/ui/Button';

import { 
  Settings, Package, AlertTriangle, Layers, Activity, 
  ArrowRight, PieChart, Check, X, BellOff, ShoppingCart,
  Paintbrush, TrainFront
} from 'lucide-react';

export default function Dashboard() {
  const { setorAtivo } = useOutletContext<{ setorAtivo: string }>();
  const navigate = useNavigate();
  
  const [userLevel] = useState(localStorage.getItem('userLevel'));
  const [mostrarConfig, setMostrarConfig] = useState(false);
  
  // Dados Analíticos de Estoque
  const [nomeSetor, setNomeSetor] = useState('Geral');
  const [totalTipos, setTotalTipos] = useState(0);
  const [totalMateriais, setTotalMateriais] = useState(0); 
  const [itensAlerta, setItensAlerta] = useState<any[]>([]);
  const [ultimasEntregas, setUltimasEntregas] = useState<any[]>([]);
  const [resumoCategorias, setResumoCategorias] = useState<{nome: string, qtd: number}[]>([]);

  // ✨ NOVOS ESTADOS PARA O KANBAN DE PRODUÇÃO (Truques)
  const [preparacaoCount, setPreparacaoCount] = useState(0);
  const [pmCount, setPmCount] = useState(0);
  const [galpaoCount, setGalpaoCount] = useState(0);

  useEffect(() => {
    if (!setorAtivo && userLevel !== 'socio') return;

    if (setorAtivo) {
      getDoc(doc(db, 'setores', setorAtivo)).then(d => {
        if(d.exists()) setNomeSetor(d.data().nome);
      });
    }

    // 1. Escuta de Estoque Inteligente
    const estoqueRef = collection(db, 'estoque');
    const qEstoque = userLevel === 'socio' ? estoqueRef : query(estoqueRef, where('setorId', '==', setorAtivo));

    const unsubEstoque = onSnapshot(qEstoque, (snapshot) => {
      const itens = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setTotalTipos(itens.length);
      setTotalMateriais(itens.reduce((acc, item) => acc + Number(item.quantidade || 0), 0));
      
      const alertas = itens
        .filter(i => Number(i.quantidade) <= Number(i.minimo || 5) && !i.ignorarAlerta)
        .sort((a, b) => a.quantidade - b.quantidade);
      setItensAlerta(alertas);

      const cats: any = {};
      itens.forEach(i => {
        const c = i.categoria || 'Outros';
        cats[c] = (cats[c] || 0) + 1;
      });
      setResumoCategorias(Object.entries(cats).map(([nome, qtd]) => ({ nome, qtd: qtd as number })).slice(0, 4));
    });

    // 2. Escuta de Entregas Recentes para o Feed
    const entregasRef = collection(db, 'entregas');
    const qEntregas = query(
      entregasRef, 
      userLevel === 'socio' ? orderBy('dataHora', 'desc') : query(entregasRef, where('setorId', '==', setorAtivo), orderBy('dataHora', 'desc')),
      limit(5)
    );

    const unsubEntregas = onSnapshot(qEntregas, (snapshot) => {
      setUltimasEntregas(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
    });

    // ✨ 3. ESCUTA DO KANBAN DE PRODUÇÃO (Truques)
    const qProducao = query(collection(db, 'truques_producao'), where('setorId', '==', setorAtivo));
    const unsubProducao = onSnapshot(qProducao, (snapshot) => {
      const truques = snapshot.docs.map(d => d.data() as any);
      
      setPreparacaoCount(truques.filter(t => t.status === 'pronto_jateamento').length);
      setPmCount(truques.filter(t => t.status === 'analisado_pm').length);
      setGalpaoCount(truques.filter(t => t.status === 'pintado').length);
    });

    return () => { unsubEstoque(); unsubEntregas(); unsubProducao(); };
  }, [setorAtivo, userLevel]);

  const ajustarPadraoItem = async (itemId: string) => {
    try {
      const itemRef = doc(db, 'estoque', itemId);
      await updateDoc(itemRef, { ignorarAlerta: true });
    } catch (e) {
      console.error("Erro ao ajustar padrão", e);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '10px', paddingBottom: '40px' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <Saudacao />
        {userLevel === 'socio' && (
          <button 
            onClick={() => setMostrarConfig(!mostrarConfig)} 
            style={{ background: '#f1f5f9', border: 'none', padding: '10px', borderRadius: '10px', color: '#64748b', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', cursor: 'pointer' }}
          >
            <Settings size={22} />
          </button>
        )}
      </div>

      <div style={{ marginBottom: '25px', paddingBottom: '10px', borderBottom: '1px solid #e2e8f0' }}>
        <h2 style={{ fontSize: '18px', color: '#334155', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <Activity size={20} color="var(--cor-primaria)" /> Visão Geral: {nomeSetor}
        </h2>
      </div>

      {mostrarConfig && <GerenciadorSetores />}

      {/* MÉTRICAS PRINCIPAIS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
        <div style={{ gridColumn: '1 / span 2' }}>
          <StatCard titulo="Materiais e EPIs" valor={totalMateriais} corDestaque="#3b82f6" icone={<Layers size={24} />} />
        </div>
        <StatCard titulo="Modelos" valor={totalTipos} corDestaque="#10b981" icone={<Package size={24} />} />
        <StatCard titulo="Alertas" valor={itensAlerta.length} corDestaque={itensAlerta.length > 0 ? "#ef4444" : "#94a3b8"} icone={<AlertTriangle size={24} />} />
      </div>

      {/* ✨ NOVA SECÇÃO: KANBAN DO PÁTIO DE PRODUÇÃO */}
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', boxShadow: 'var(--sombra-card)', marginBottom: '25px', borderTop: '4px solid #3b82f6' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 style={{ margin: 0, fontSize: '15px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
            <TrainFront size={18} color="#3b82f6" /> Resumo do Pátio (Truques)
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '15px' }}>
          
          <div style={{ padding: '15px', backgroundColor: '#f1f5f9', borderRadius: '12px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
            <span style={{ fontSize: '10px', color: '#475569', fontWeight: 'bold', display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>1. Lavagem / Jat.</span>
            <strong style={{ fontSize: '22px', color: '#1e293b' }}>{preparacaoCount} <small style={{ fontSize: '11px', fontWeight: 'normal' }}>peças</small></strong>
          </div>
          
          <div style={{ padding: '15px', backgroundColor: '#fffbeb', borderRadius: '12px', border: '1px solid #fde68a', textAlign: 'center' }}>
            <span style={{ fontSize: '10px', color: '#b45309', fontWeight: 'bold', display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>2. Ensaio PM</span>
            <strong style={{ fontSize: '22px', color: '#9a3412' }}>{pmCount} <small style={{ fontSize: '11px', fontWeight: 'normal' }}>peças</small></strong>
          </div>
          
          <div style={{ padding: '15px', backgroundColor: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0', textAlign: 'center' }}>
            <span style={{ fontSize: '10px', color: '#166534', fontWeight: 'bold', display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>3. Galpão (Concluído)</span>
            <strong style={{ fontSize: '22px', color: '#15803d' }}>{galpaoCount} <small style={{ fontSize: '11px', fontWeight: 'normal' }}>peças</small></strong>
          </div>

        </div>

        <Button onClick={() => navigate('/prestacao-servicos')} style={{ width: '100%', marginTop: '15px', backgroundColor: '#3b82f6', height: '42px', fontSize: '13px', fontWeight: 'bold' }}>
          Acessar Controle de Produção <ArrowRight size={16} style={{ marginLeft: '6px' }} />
        </Button>
      </div>

      {/* ASSISTENTE DE ESTOQUE */}
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', boxShadow: 'var(--sombra-card)', marginBottom: '25px', borderLeft: '4px solid #f59e0b' }}>
        <h3 style={{ margin: '0 0 15px 0', fontSize: '15px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={18} color="#f59e0b" /> Verificar Reposição
        </h3>
        
        {itensAlerta.length === 0 ? (
          <p style={{ color: '#10b981', fontSize: '13px', margin: 0 }}>Tudo conforme o padrão! ✅</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {itensAlerta.slice(0, 2).map((item) => (
              <div key={item.id} style={{ backgroundColor: '#fff7ed', padding: '15px', borderRadius: '12px', border: '1px solid #fed7aa' }}>
                <strong style={{ fontSize: '14px', color: '#9a3412', display: 'block', marginBottom: '4px' }}>{item.nome} ({item.quantidade} un)</strong>
                <p style={{ fontSize: '12px', color: '#c2410c', margin: '0 0 12px 0' }}>Quantidade baixa. Repor ou é o normal deste item?</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button onClick={() => navigate('/pedidos-compra')} style={{ backgroundColor: '#f59e0b', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', cursor: 'pointer' }}>
                    <ShoppingCart size={14} /> Repor
                  </button>
                  <button onClick={() => ajustarPadraoItem(item.id)} style={{ backgroundColor: 'white', color: '#64748b', border: '1px solid #e2e8f0', padding: '10px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', cursor: 'pointer' }}>
                    <BellOff size={14} /> É o Normal
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* GRÁFICO VISUAL EM BARRAS */}
      <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', boxShadow: 'var(--sombra-card)', marginBottom: '25px' }}>
        <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', color: '#1e293b' }}>Análise de Nível Crítico</h3>
        {itensAlerta.length === 0 ? (
          <p style={{ color: '#10b981', fontWeight: '500', margin: 0 }}>Estoque saudável.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {itensAlerta.slice(0, 5).map((item, index) => {
              const porcentagem = Math.min((item.quantidade / (item.minimo || 10)) * 100, 100);
              const corBarra = item.quantidade < (item.minimo / 2) ? '#ef4444' : '#f59e0b';
              return (
                <div key={index}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px', fontWeight: '500', color: '#475569' }}>
                    <span>{item.nome}</span>
                    <span style={{ color: corBarra }}>{item.quantidade} {item.unidade} restando</span>
                  </div>
                  <div style={{ width: '100%', backgroundColor: '#f1f5f9', borderRadius: '4px', height: '10px', overflow: 'hidden' }}>
                    <div style={{ width: `${porcentagem}%`, backgroundColor: corBarra, height: '100%', borderRadius: '4px', transition: 'width 0.5s ease-out' }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
        {/* GRÁFICO DE CATEGORIAS */}
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', boxShadow: 'var(--sombra-card)' }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: '15px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PieChart size={18} color="#8b5cf6" /> Distribuição de Categoria
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {resumoCategorias.map((cat, idx) => (
              <div key={idx}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px', color: '#64748b' }}>
                  <span>{cat.nome}</span>
                  <span>{Math.round((cat.qtd / (totalTipos || 1)) * 100)}%</span>
                </div>
                <div style={{ width: '100%', height: '6px', backgroundColor: '#f1f5f9', borderRadius: '10px' }}>
                  <div style={{ width: `${(cat.qtd / (totalTipos || 1)) * 100}%`, height: '100%', backgroundColor: ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b'][idx % 4], borderRadius: '10px' }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FEED DE ATIVIDADE COMPONENTIZADO */}
        <FeedAtividade entregas={ultimasEntregas} />
      </div>
    </div>
  );
}
