import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { collection, onSnapshot, query, where, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';

import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { UserPlus, Trash2, Building2, Users, CheckCircle2, AlertCircle } from 'lucide-react';

interface Funcionario {
  id: string;
  setorId: string;
  nome: string;
  cargo: string;
  matricula: string;
  status: string;
}

export default function Funcionarios() {
  const { setorAtivo } = useOutletContext<{ setorAtivo: string }>();
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [notificacao, setNotificacao] = useState<{msg: string, tipo: 'sucesso' | 'erro'} | null>(null);

  const [nome, setNome] = useState('');
  const [cargo, setCargo] = useState('');
  const [matricula, setMatricula] = useState('');

  const avisar = (msg: string, tipo: 'sucesso' | 'erro' = 'sucesso') => {
    setNotificacao({ msg, tipo });
    setTimeout(() => setNotificacao(null), 3000);
  };

  useEffect(() => {
    if (!setorAtivo) return;
    const q = query(collection(db, 'funcionarios'), where('setorId', '==', setorAtivo));
    return onSnapshot(q, (snapshot) => {
      setFuncionarios(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Funcionario)));
    });
  }, [setorAtivo]);

  const salvarFuncionario = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'funcionarios'), {
        setorId: setorAtivo,
        nome,
        cargo,
        matricula,
        status: 'Ativo'
      });
      avisar("Funcionário cadastrado!");
      setNome(''); setCargo(''); setMatricula('');
    } catch (erro) {
      avisar("Erro ao cadastrar.", "erro");
    }
  };

  if (!setorAtivo) return (
    <div style={{ textAlign: 'center', padding: '100px 20px' }}>
      <Building2 size={60} color="#cbd5e1" style={{ marginBottom: '20px' }} />
      <h2 style={{ color: '#1e293b' }}>Selecione uma Unidade</h2>
      <p style={{ color: '#64748b' }}>Use o menu lateral para gerenciar a equipe.</p>
    </div>
  );

  return (
    <div style={{ position: 'relative' }}>
      {notificacao && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999, backgroundColor: notificacao.tipo === 'sucesso' ? '#10b981' : '#ef4444', color: 'white', padding: '12px 24px', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '500' }}>
          {notificacao.tipo === 'sucesso' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          {notificacao.msg}
        </div>
      )}

      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ color: '#1e293b', margin: 0, fontSize: '26px' }}>Equipe da Unidade</h1>
        <p style={{ color: '#64748b', marginTop: '4px' }}>Gestão de colaboradores para entrega de EPIs.</p>
      </div>

      <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: 'var(--sombra-card)', marginBottom: '30px' }}>
        <h3 style={{ margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '8px', color: '#1e293b' }}>
          <UserPlus size={20} color="var(--cor-primaria)" /> Cadastrar Colaborador
        </h3>
        <form onSubmit={salvarFuncionario} style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr auto', gap: '15px', alignItems: 'end' }}>
          <Input label="Nome Completo *" value={nome} onChange={(e) => setNome(e.target.value)} required />
          <Input label="Função / Cargo *" value={cargo} onChange={(e) => setCargo(e.target.value)} required />
          <Input label="Matrícula" value={matricula} onChange={(e) => setMatricula(e.target.value)} />
          <Button type="submit" variante="sucesso" style={{ height: '45px' }}>Cadastrar</Button>
        </form>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: 'var(--sombra-card)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ backgroundColor: '#f8fafc' }}>
            <tr>
              <th style={{ padding: '16px', color: '#64748b', fontSize: '13px' }}>Nome do Colaborador</th>
              <th style={{ padding: '16px', color: '#64748b', fontSize: '13px' }}>Cargo</th>
              <th style={{ padding: '16px', color: '#64748b', fontSize: '13px' }}>Matrícula</th>
              <th style={{ padding: '16px', color: '#64748b', fontSize: '13px', width: '80px' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {funcionarios.map((func) => (
              <tr key={func.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '16px', fontWeight: 'bold', color: '#1e293b' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ backgroundColor: '#eff6ff', padding: '8px', borderRadius: '50%' }}><Users size={16} color="#2563eb" /></div>
                    {func.nome}
                  </div>
                </td>
                <td style={{ padding: '16px', color: '#334155' }}>{func.cargo}</td>
                <td style={{ padding: '16px', color: '#64748b' }}>{func.matricula || '-'}</td>
                <td style={{ padding: '16px' }}>
                  <button onClick={() => { if(window.confirm("Excluir?")) deleteDoc(doc(db, 'funcionarios', func.id)) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}