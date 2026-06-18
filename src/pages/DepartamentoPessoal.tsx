// src/pages/DepartamentoPessoal.tsx
import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

import { Briefcase, CheckCircle2, UserPlus, Users, FileText } from 'lucide-react';
import Button from '../components/ui/Button';

// Nossos Componentes Descentralizados de RH
import FormularioCadastro from '../components/funcionarios/FormularioCadastro';
import ModalFicha from '../components/funcionarios/ModalFicha';

export default function DepartamentoPessoal() {
  const [setores, setSetores] = useState<any[]>([]);
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [estoque, setEstoque] = useState<any[]>([]); 
  const [treinamentosGlobais, setTreinamentosGlobais] = useState<any[]>([]);
  const [dssGlobais, setDssGlobais] = useState<any[]>([]);
  
  const [filtroStatus, setFiltroStatus] = useState<'ativo' | 'desligado'>('ativo');
  const [fichaAberta, setFichaAberta] = useState<any | null>(null);
  const [notificacao, setNotificacao] = useState<{msg: string, tipo: 'sucesso' | 'erro'} | null>(null);

  const avisar = (msg: string, tipo: 'sucesso' | 'erro' = 'sucesso') => {
    setNotificacao({ msg, tipo });
    setTimeout(() => setNotificacao(null), 4000);
  };

  useEffect(() => {
    const unsubSetores = onSnapshot(collection(db, 'setores'), (s) => setSetores(s.docs.map(d => ({ id: d.id, nome: d.data().nome }))));
    const unsubEstoque = onSnapshot(collection(db, 'estoque'), (s) => setEstoque(s.docs.map(d => d.data())));
    const unsubFuncionarios = onSnapshot(collection(db, 'funcionarios'), (s) => setFuncionarios(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    
    const unsubTreinos = onSnapshot(collection(db, 'treinamentos'), (s) => {
      const docs = s.docs.map(d => ({ id: d.id, ...d.data() }));
      setTreinamentosGlobais(docs);
    });

    const unsubDSS = onSnapshot(collection(db, 'dss'), (s) => {
      const docs = s.docs.map(d => ({ id: d.id, ...d.data() }));
      setDssGlobais(docs);
    });
    
    return () => { unsubSetores(); unsubFuncionarios(); unsubEstoque(); unsubTreinos(); unsubDSS(); };
  }, []);

  const funcionariosExibidos = funcionarios.filter(f => filtroStatus === 'ativo' ? f.status !== 'desligado' : f.status === 'desligado');

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', paddingBottom: '40px', padding: '10px' }}>
      
      {notificacao && (
        <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 12000, backgroundColor: notificacao.tipo === 'sucesso' ? '#10b981' : '#ef4444', color: 'white', padding: '12px 24px', borderRadius: '50px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold' }}>
          <CheckCircle2 size={20} /> <span style={{ fontSize: '14px' }}>{notificacao.msg}</span>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', marginTop: '10px' }}>
        <Briefcase size={28} color="#0ea5e9" />
        <h1 style={{ fontSize: '22px', color: '#1e293b', margin: 0 }}>Departamento Pessoal (RH)</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        
        {/* COMPONENTE ISOLADO DE CADASTRO */}
        <FormularioCadastro setores={setores} avisar={avisar} />

        {/* LISTA DE FUNCIONÁRIOS (COM GESTÃO DE DESLIGADOS) */}
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: 'var(--sombra-card)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ fontSize: '16px', margin: 0 }}>Gestão de Colaboradores</h3>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
            <button onClick={() => setFiltroStatus('ativo')} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', backgroundColor: filtroStatus === 'ativo' ? '#0ea5e9' : '#f1f5f9', color: filtroStatus === 'ativo' ? 'white' : '#64748b' }}>Ativos</button>
            <button onClick={() => setFiltroStatus('desligado')} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', backgroundColor: filtroStatus === 'desligado' ? '#ef4444' : '#f1f5f9', color: filtroStatus === 'desligado' ? 'white' : '#64748b' }}>Desligados / Inativos</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {funcionariosExibidos.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#94a3b8', padding: '20px 0', fontSize: '14px' }}>Nenhum colaborador nesta lista.</p>
            ) : (
              funcionariosExibidos.map(func => (
                <div key={func.id} style={{ border: '1px solid #e2e8f0', padding: '12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: func.status === 'desligado' ? '#fef2f2' : 'white', opacity: func.status === 'desligado' ? 0.8 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#f1f5f9', overflow: 'hidden' }}>
                      {func.fotoBase64 ? <img src={func.fotoBase64} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: func.status === 'desligado' ? 'grayscale(100%)' : 'none' }} /> : <Users size={20} color="#94a3b8" style={{ margin: '10px' }} />}
                    </div>
                    <div>
                      <strong style={{ display: 'block', fontSize: '15px', color: func.status === 'desligado' ? '#991b1b' : '#1e293b' }}>{func.nome}</strong>
                      <span style={{ fontSize: '11px', backgroundColor: func.status === 'desligado' ? '#fecaca' : '#f1f5f9', padding: '4px 6px', borderRadius: '4px', color: func.status === 'desligado' ? '#dc2626' : '#64748b', fontWeight: 'bold' }}>MAT: {func.matricula}</span>
                    </div>
                  </div>
                  <Button onClick={() => setFichaAberta(func)} style={{ padding: '8px 12px', fontSize: '13px', backgroundColor: '#f0f9ff', color: '#0ea5e9', border: '1px solid #bae6fd' }}>
                    <FileText size={16} style={{marginRight: '5px'}} /> Ficha Completa
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* COMPONENTE ISOLADO DA FICHA / HISTÓRICO */}
      <ModalFicha 
        funcionarioAberta={fichaAberta} 
        onClose={() => setFichaAberta(null)} 
        estoque={estoque} 
        treinamentosGlobais={treinamentosGlobais} 
        dssGlobais={dssGlobais}
        avisar={avisar} 
      />
    </div>
  );
}