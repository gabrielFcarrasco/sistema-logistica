import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { collection, onSnapshot, query, where, getDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';

import Saudacao from '../components/dashboard/Saudacao';
import GerenciadorSetores from '../components/dashboard/GerenciadorSetores';
import StatCard from '../components/ui/StatCard';
import Button from '../components/ui/Button';

import { Settings, Package, AlertTriangle, Layers, Activity } from 'lucide-react';

export default function Dashboard() {
  const { setorAtivo } = useOutletContext<{ setorAtivo: string }>();
  const [mostrarConfig, setMostrarConfig] = useState(false);
  
  // Dados Analíticos
  const [nomeSetor, setNomeSetor] = useState('Geral');
  const [totalTipos, setTotalTipos] = useState(0);
  const [totalPecas, setTotalPecas] = useState(0);
  const [itensAlerta, setItensAlerta] = useState<any[]>([]);

  useEffect(() => {
    if (!setorAtivo) return;

    // Busca o nome da unidade atual
    getDoc(doc(db, 'setores', setorAtivo)).then(d => {
      if(d.exists()) setNomeSetor(d.data().nome);
    });

    // Busca as métricas de estoque desta unidade
    const q = query(collection(db, 'estoque'), where('setorId', '==', setorAtivo));
    const pararEscuta = onSnapshot(q, (snapshot) => {
      const itens = snapshot.docs.map(doc => doc.data());
      
      setTotalTipos(itens.length);
      setTotalPecas(itens.reduce((acc, item) => acc + Number(item.quantidade), 0));
      
      // Filtra itens com menos de 10 unidades e ordena dos menores para os maiores
      const alertas = itens.filter(i => Number(i.quantidade) < 10).sort((a, b) => a.quantidade - b.quantidade);
      setItensAlerta(alertas);
    });

    return () => pararEscuta();
  }, [setorAtivo]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Saudacao />
        
        <Button 
          onClick={() => setMostrarConfig(!mostrarConfig)} 
          variante="secundario" 
          style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'white', color: '#64748b', border: '1px solid #e2e8f0' }}
        >
          <Settings size={18} /> {mostrarConfig ? 'Fechar Configurações' : 'Gerenciar Unidades'}
        </Button>
      </div>

      {/* Renderiza o gerenciador apenas se o botão for clicado */}
      {mostrarConfig && <GerenciadorSetores />}

      <div style={{ marginBottom: '30px', paddingBottom: '10px', borderBottom: '1px solid #e2e8f0' }}>
        <h2 style={{ fontSize: '18px', color: '#334155', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={20} color="var(--cor-primaria)" /> Visão Geral: {nomeSetor}
        </h2>
      </div>

      {/* Cards de Métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '40px' }}>
        <StatCard 
          titulo="Total de Peças Físicas" 
          valor={totalPecas} 
          corDestaque="#3b82f6" 
          icone={<Layers size={36} />} 
        />
        <StatCard 
          titulo="Tipos de Materiais" 
          valor={totalTipos} 
          corDestaque="#10b981" 
          icone={<Package size={36} />} 
        />
        <StatCard 
          titulo="Alertas de Estoque Baixo" 
          valor={itensAlerta.length} 
          corDestaque={itensAlerta.length > 0 ? "#ef4444" : "#94a3b8"} 
          icone={<AlertTriangle size={36} />} 
        />
      </div>

      {/* Gráfico Visual em Barras CSS */}
      <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: 'var(--sombra-card)' }}>
        <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', color: '#1e293b' }}>Atenção: Itens em Nível Crítico (Menos de 10 unid.)</h3>
        
        {itensAlerta.length === 0 ? (
          <p style={{ color: '#10b981', fontWeight: '500', margin: 0 }}>Excelente! Nenhum item com estoque baixo no momento.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {itensAlerta.slice(0, 5).map((item, index) => {
              // Calcula a porcentagem para preencher a barra (considerando 10 como 100% da meta mínima)
              const porcentagem = Math.min((item.quantidade / 10) * 100, 100);
              const corBarra = item.quantidade < 5 ? '#ef4444' : '#f59e0b';

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

    </div>
  );
}