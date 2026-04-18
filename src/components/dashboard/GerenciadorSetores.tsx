import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { Building2, Edit3, Trash2, X, Plus, Save } from 'lucide-react';

interface Setor {
  id: string;
  nome: string;
  responsavel: string;
  responsavelEmail: string;
}

export default function GerenciadorSetores() {
  const [setores, setSetores] = useState<Setor[]>([]);
  const [nome, setNome] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [email, setEmail] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);

  useEffect(() => {
    const pararEscuta = onSnapshot(collection(db, 'setores'), (snapshot) => {
      setSetores(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Setor)));
    });
    return () => pararEscuta();
  }, []);

  const salvarSetor = async (e: React.FormEvent) => {
    e.preventDefault();
    const dados = { nome, responsavel, responsavelEmail: email };
    if (editandoId) {
      await updateDoc(doc(db, 'setores', editandoId), dados);
    } else {
      await addDoc(collection(db, 'setores'), dados);
    }
    cancelarEdicao();
  };

  const prepararEdicao = (s: Setor) => { setEditandoId(s.id); setNome(s.nome); setResponsavel(s.responsavel); setEmail(s.responsavelEmail); };
  const cancelarEdicao = () => { setEditandoId(null); setNome(''); setResponsavel(''); setEmail(''); };

  return (
    <div style={{ backgroundColor: '#f8fafc', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '30px' }}>
      <h3 style={{ margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '8px', color: '#1e293b' }}>
        <Building2 size={20} color="var(--cor-primaria)" /> Configurações de Unidades
      </h3>
      
      <form onSubmit={salvarSetor} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr auto', gap: '15px', alignItems: 'end', marginBottom: '30px' }}>
        <Input label="Nome da Unidade *" value={nome} onChange={(e) => setNome(e.target.value)} required />
        <Input label="Responsável *" value={responsavel} onChange={(e) => setResponsavel(e.target.value)} required />
        <Input label="E-mail *" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <div style={{ display: 'flex', gap: '10px' }}>
          {editandoId && <Button type="button" variante="perigo" onClick={cancelarEdicao} style={{ height: '45px' }}><X size={18} /></Button>}
          <Button type="submit" variante="primario" style={{ height: '45px' }}>{editandoId ? <Save size={18} /> : <Plus size={18} />}</Button>
        </div>
      </form>

      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', backgroundColor: 'white', borderRadius: '8px', overflow: 'hidden' }}>
        <thead style={{ backgroundColor: '#f1f5f9' }}>
          <tr>
            <th style={{ padding: '12px', color: '#64748b', fontSize: '13px' }}>Unidade</th>
            <th style={{ padding: '12px', color: '#64748b', fontSize: '13px' }}>Responsável</th>
            <th style={{ padding: '12px', color: '#64748b', fontSize: '13px', width: '100px' }}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {setores.map((s) => (
            <tr key={s.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '12px', fontWeight: 'bold', fontSize: '14px' }}>{s.nome}</td>
              <td style={{ padding: '12px', fontSize: '14px' }}>{s.responsavel}</td>
              <td style={{ padding: '12px', display: 'flex', gap: '8px' }}>
                <button onClick={() => prepararEdicao(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><Edit3 size={16} /></button>
                <button onClick={() => { if(window.confirm("Excluir?")) deleteDoc(doc(db, 'setores', s.id)) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={16} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}