// src/components/dashboard/GerenciadorSetores.tsx
import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { Building2, Edit3, Trash2, X, Plus, Save, UserPlus, Users, Loader2 } from 'lucide-react';

interface UsuarioInfo {
  id: string;
  nome: string;
  email: string;
}

interface Setor {
  id: string;
  nome: string;
  responsaveis?: UsuarioInfo[];
  responsavel?: string;
  responsavelEmail?: string;
}

export default function GerenciadorSetores() {
  const [setores, setSetores] = useState<Setor[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados do Formulário
  const [nome, setNome] = useState('');
  const [responsaveisSelecionados, setResponsaveisSelecionados] = useState<UsuarioInfo[]>([]);
  const [usuarioSelecionadoId, setUsuarioSelecionadoId] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);

  useEffect(() => {
    const pararEscutaSetores = onSnapshot(collection(db, 'setores'), (snapshot) => {
      setSetores(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Setor)));
      setLoading(false);
    });

    const pararEscutaUsuarios = onSnapshot(collection(db, 'usuarios'), (snapshot) => {
      setUsuarios(snapshot.docs.map(doc => ({ id: doc.id, nome: doc.data().nome, email: doc.data().email })));
    });

    return () => {
      pararEscutaSetores();
      pararEscutaUsuarios();
    };
  }, []);

  const adicionarResponsavel = () => {
    if (!usuarioSelecionadoId) return;
    
    const user = usuarios.find(u => u.id === usuarioSelecionadoId);
    if (user && !responsaveisSelecionados.some(r => r.id === user.id)) {
      setResponsaveisSelecionados([...responsaveisSelecionados, user]);
    }
    setUsuarioSelecionadoId(''); // Reseta o select após adicionar
  };

  const removerResponsavel = (idToRemove: string) => {
    setResponsaveisSelecionados(responsaveisSelecionados.filter(r => r.id !== idToRemove));
  };

  const salvarSetor = async (e: React.FormEvent) => {
    e.preventDefault();
    const dados = { nome, responsaveis: responsaveisSelecionados };

    if (editandoId) {
      await updateDoc(doc(db, 'setores', editandoId), dados);
    } else {
      await addDoc(collection(db, 'setores'), dados);
    }
    cancelarEdicao();
  };

  const prepararEdicao = (s: Setor) => { 
    setEditandoId(s.id); 
    setNome(s.nome); 
    
    let resps = s.responsaveis || [];
    if (resps.length === 0 && s.responsavel) {
      resps = [{ id: 'legado', nome: s.responsavel, email: s.responsavelEmail || '' }];
    }
    setResponsaveisSelecionados(resps);
    window.scrollTo({ top: 0, behavior: 'smooth' }); // Rola pro topo no celular
  };

  const cancelarEdicao = () => { 
    setEditandoId(null); 
    setNome(''); 
    setResponsaveisSelecionados([]);
    setUsuarioSelecionadoId('');
  };

  const renderizarResponsaveis = (s: Setor) => {
    if (s.responsaveis && s.responsaveis.length > 0) {
      return s.responsaveis.map(r => r.nome).join(', ');
    }
    return s.responsavel || 'Sem responsável vinculado';
  };

  return (
    <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '30px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
      
      {/* 🌟 BARRA DE TÍTULO PREMIUM */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', paddingBottom: '20px', borderBottom: '2px solid #f8fafc', marginBottom: '25px' }}>
        <div style={{ backgroundColor: '#eff6ff', padding: '12px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Building2 size={26} color="#3b82f6" />
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: '18px', color: '#1e293b', fontWeight: 'bold' }}>
            {editandoId ? 'Editando Unidade' : 'Gestão de Unidades'}
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
            Cadastre novas filiais e defina os responsáveis por cada uma.
          </p>
        </div>
      </div>
      
      {/* 📱 FORMULÁRIO RESPONSIVO */}
      <form onSubmit={salvarSetor} style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '35px' }}>
        
        {/* Grid Flexível: Fica lado a lado no PC, empilha no Celular */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          
          <Input 
            label="Nome da Unidade *" 
            value={nome} 
            onChange={(e) => setNome(e.target.value)} 
            required 
            placeholder="Ex: Matriz Carvalho" 
          />
          
          {/* Grupo Select + Botão de Adicionar */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569', marginBottom: '8px' }}>Adicionar Responsáveis</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <select 
                value={usuarioSelecionadoId} 
                onChange={(e) => setUsuarioSelecionadoId(e.target.value)} 
                style={{ flex: 1, padding: '0 12px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', height: '48px', fontSize: '14px', outline: 'none' }}
              >
                <option value="">Selecione do sistema...</option>
                {usuarios.map(u => (
                  <option key={u.id} value={u.id}>{u.nome}</option>
                ))}
              </select>
              <Button type="button" onClick={adicionarResponsavel} style={{ height: '48px', padding: '0 20px', backgroundColor: '#3b82f6', borderRadius: '8px' }}>
                <UserPlus size={20} />
              </Button>
            </div>
          </div>

        </div>

        {/* Tags dos Responsáveis */}
        {responsaveisSelecionados.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '15px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
            <div style={{ width: '100%', fontSize: '13px', color: '#64748b', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
              <Users size={16} /> Responsáveis vinculados:
            </div>
            {responsaveisSelecionados.map(r => (
              <span key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'white', padding: '8px 14px', borderRadius: '50px', fontSize: '13px', border: '1px solid #e2e8f0', color: '#1e293b', fontWeight: '500', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                {r.nome} 
                <button type="button" onClick={() => removerResponsavel(r.id)} style={{ border: 'none', background: '#fee2e2', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', padding: '4px', transition: '0.2s' }}>
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Botões de Ação */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '5px', flexWrap: 'wrap' }}>
          {editandoId && (
            <Button type="button" onClick={cancelarEdicao} style={{ flex: '1 1 120px', height: '50px', backgroundColor: '#64748b', fontSize: '14px', fontWeight: 'bold' }}>
              <X size={18} style={{ marginRight: '8px' }}/> Cancelar
            </Button>
          )}
          <Button type="submit" variante="primario" disabled={!nome || responsaveisSelecionados.length === 0} style={{ flex: '2 1 200px', height: '50px', fontSize: '14px', fontWeight: 'bold' }}>
            {editandoId ? <><Save size={18} style={{ marginRight: '8px' }}/> Atualizar Unidade</> : <><Plus size={18} style={{ marginRight: '8px' }}/> Cadastrar Unidade</>}
          </Button>
        </div>
      </form>

      {/* 📱 LISTAGEM EM CARDS RESPONSIVOS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <h4 style={{ fontSize: '14px', color: '#475569', fontWeight: 'bold', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px', margin: '0 0 5px 0' }}>
          Unidades Cadastradas ({setores.length})
        </h4>
        
        {loading ? (
          <div style={{ textAlign: 'center', padding: '30px' }}><Loader2 className="animate-spin" size={28} color="#3b82f6" /></div>
        ) : setores.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '14px', padding: '20px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
            Nenhuma unidade registrada no sistema.
          </p>
        ) : (
          setores.map((s) => (
            <div key={s.id} style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h4 style={{ margin: 0, fontSize: '16px', color: '#1e293b', fontWeight: '900' }}>{s.nome}</h4>
                
                {/* Ações: Editar e Excluir */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => prepararEdicao(s)} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px', borderRadius: '8px', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Edit3 size={18} />
                  </button>
                  <button onClick={() => { if(window.confirm(`Deseja mesmo excluir a unidade ${s.nome}?`)) deleteDoc(doc(db, 'setores', s.id)) }} style={{ background: '#fef2f2', border: '1px solid #fee2e2', padding: '10px', borderRadius: '8px', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {/* Lista de Responsáveis do Card */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: '#475569', backgroundColor: '#f1f5f9', padding: '12px', borderRadius: '10px' }}>
                <Users size={16} style={{ color: '#3b82f6', marginTop: '2px', flexShrink: 0 }} />
                <span style={{ lineHeight: '1.5' }}>
                  <strong style={{ color: '#1e293b' }}>Responsáveis:</strong> {renderizarResponsaveis(s)}
                </span>
              </div>
              
            </div>
          ))
        )}
      </div>

    </div>
  );
}