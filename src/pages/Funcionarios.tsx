// src/pages/Funcionarios.tsx
import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

import { Users, CheckCircle2, GraduationCap, ShieldCheck, FileText, UserPlus } from 'lucide-react';
import Button from '../components/ui/Button';

// Nossos Componentes Descentralizados que deixam o código limpo!
import FormularioCadastro from '../components/funcionarios/FormularioCadastro';
import ModalFicha from '../components/funcionarios/ModalFicha';
import ModalTreinamentos from '../components/treinamentos/ModalTreinamentos';
import ModalDSS from '../components/dss/ModalDSS';

export default function Funcionarios() {
  // Estados de Dados
  const [setores, setSetores] = useState<any[]>([]);
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [estoque, setEstoque] = useState<any[]>([]); 
  const [treinamentosGlobais, setTreinamentosGlobais] = useState<any[]>([]);
  const [dssGlobais, setDssGlobais] = useState<any[]>([]);
  
  // Estados de Interface
  const [filtroStatus, setFiltroStatus] = useState<'ativo' | 'desligado'>('ativo');
  const [fichaAberta, setFichaAberta] = useState<any | null>(null);
  const [modalTreinamento, setModalTreinamento] = useState(false);
  const [modalDSS, setModalDSS] = useState(false);
  const [notificacao, setNotificacao] = useState<{msg: string, tipo: 'sucesso' | 'erro'} | null>(null);

  const avisar = (msg: string, tipo: 'sucesso' | 'erro' = 'sucesso') => {
    setNotificacao({ msg, tipo });
    setTimeout(() => setNotificacao(null), 4000);
  };

  useEffect(() => {
    // Carregamento global de dados para alimentar todos os sub-módulos
    const unsubSetores = onSnapshot(collection(db, 'setores'), (s) => setSetores(s.docs.map(d => ({ id: d.id, nome: d.data().nome }))));
    const unsubEstoque = onSnapshot(collection(db, 'estoque'), (s) => setEstoque(s.docs.map(d => d.data())));
    const unsubFuncionarios = onSnapshot(collection(db, 'funcionarios'), (s) => setFuncionarios(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    
    const unsubTreinos = onSnapshot(collection(db, 'treinamentos'), (s) => {
      const docs = s.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a:any, b:any) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setTreinamentosGlobais(docs);
    });

    const unsubDSS = onSnapshot(collection(db, 'dss'), (s) => {
      const docs = s.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a:any, b:any) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setDssGlobais(docs);
    });
    
    return () => { unsubSetores(); unsubFuncionarios(); unsubEstoque(); unsubTreinos(); unsubDSS(); };
  }, []);

  // Filtra a lista principal ignorando os desligados, a não ser que a aba "Desligados" esteja ativa
  const funcionariosExibidos = funcionarios.filter(f => filtroStatus === 'ativo' ? f.status !== 'desligado' : f.status === 'desligado');

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', paddingBottom: '40px', padding: '10px' }}>
      
      {/* Sistema de Notificações */}
      {notificacao && (
        <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 12000, backgroundColor: notificacao.tipo === 'sucesso' ? '#10b981' : '#ef4444', color: 'white', padding: '12px 24px', borderRadius: '50px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold' }}>
          <CheckCircle2 size={20} /> <span style={{ fontSize: '14px' }}>{notificacao.msg}</span>
        </div>
      )}

      {/* HEADER PRINCIPAL */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', marginTop: '10px', flexWrap: 'wrap', gap: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Users size={28} color="#8b5cf6" />
          <h1 style={{ fontSize: '24px', color: '#1e293b', margin: 0, fontWeight: '800' }}>Equipe e Qualificação</h1>
        </div>
        
        {/* BOTÕES DOS MÓDULOS DE SEGURANÇA */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Button onClick={() => setModalDSS(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#0ea5e9', boxShadow: '0 4px 6px rgba(14, 165, 233, 0.2)' }}>
            <ShieldCheck size={20} /> Diálogos de Segurança (DSS)
          </Button>
          <Button onClick={() => setModalTreinamento(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#8b5cf6', boxShadow: '0 4px 6px rgba(139, 92, 246, 0.2)' }}>
            <GraduationCap size={20} /> Treinamentos e NRs
          </Button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        
        {/* 1. MÓDULO DE CADASTRO */}
        <FormularioCadastro setores={setores} avisar={avisar} />

        {/* 2. LISTA DE EQUIPE */}
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 10px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '18px', margin: 0, color: '#1e293b', fontWeight: 'bold' }}>Colaboradores Cadastrados</h3>
          </div>

          {/* Abas de Navegação (Ativos / Desligados) */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', backgroundColor: '#f8fafc', padding: '5px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <button onClick={() => setFiltroStatus('ativo')} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s', backgroundColor: filtroStatus === 'ativo' ? 'white' : 'transparent', color: filtroStatus === 'ativo' ? '#3b82f6' : '#64748b', boxShadow: filtroStatus === 'ativo' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}>
              Time Ativo
            </button>
            <button onClick={() => setFiltroStatus('desligado')} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s', backgroundColor: filtroStatus === 'desligado' ? 'white' : 'transparent', color: filtroStatus === 'desligado' ? '#ef4444' : '#64748b', boxShadow: filtroStatus === 'desligado' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}>
              Desligados
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {funcionariosExibidos.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#94a3b8', padding: '30px 0', fontSize: '14px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px dashed #e2e8f0' }}>Nenhum colaborador nesta lista.</p>
            ) : (
              funcionariosExibidos.map(func => (
                <div key={func.id} style={{ border: '1px solid #e2e8f0', padding: '15px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: '0.2s', backgroundColor: func.status === 'desligado' ? '#fef2f2' : '#f8fafc', opacity: func.status === 'desligado' ? 0.8 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ width: '45px', height: '45px', borderRadius: '50%', backgroundColor: 'white', overflow: 'hidden', border: '2px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {func.fotoBase64 ? <img src={func.fotoBase64} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: func.status === 'desligado' ? 'grayscale(100%)' : 'none' }} /> : <UserPlus size={20} color="#94a3b8" />}
                    </div>
                    <div>
                      <strong style={{ display: 'block', fontSize: '15px', color: func.status === 'desligado' ? '#991b1b' : '#1e293b' }}>{func.nome}</strong>
                      <span style={{ fontSize: '11px', backgroundColor: func.status === 'desligado' ? '#fecaca' : '#e2e8f0', padding: '4px 8px', borderRadius: '6px', color: func.status === 'desligado' ? '#dc2626' : '#475569', fontWeight: 'bold', display: 'inline-block', marginTop: '4px' }}>
                        MAT: {func.matricula}
                      </span>
                    </div>
                  </div>
                  <Button onClick={() => setFichaAberta(func)} style={{ padding: '8px 15px', fontSize: '13px', backgroundColor: 'white', color: '#8b5cf6', border: '1px solid #ddd6fe', borderRadius: '8px' }}>
                    <FileText size={16} style={{marginRight: '5px'}} /> Ficha
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* RENDERIZAÇÃO DOS MODAIS (FICAM INVISÍVEIS ATÉ SEREM CLICADOS) */}
      
      {/* 1. Modal da Ficha do Funcionário (É ele quem abre o ModalTermo internamente!) */}
      <ModalFicha 
        funcionarioAberta={fichaAberta} 
        onClose={() => setFichaAberta(null)} 
        estoque={estoque} 
        treinamentosGlobais={treinamentosGlobais} 
        dssGlobais={dssGlobais}
        avisar={avisar} 
      />

      {/* 2. Modal do Módulo de Treinamentos Globais */}
      <ModalTreinamentos 
        aberto={modalTreinamento} 
        onClose={() => setModalTreinamento(false)} 
        funcionarios={funcionarios} 
        treinamentosGlobais={treinamentosGlobais}
        avisar={avisar}
      />

      {/* 3. Modal do Módulo de DSS Globais */}
      <ModalDSS 
        aberto={modalDSS} 
        onClose={() => setModalDSS(false)} 
        funcionarios={funcionarios} 
        avisar={avisar} 
      />

    </div>
  );
}