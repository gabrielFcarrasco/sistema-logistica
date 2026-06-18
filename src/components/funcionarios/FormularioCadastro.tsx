// src/components/funcionarios/FormularioCadastro.tsx
import { useState, useRef } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { UserPlus, Camera } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';

interface Props {
  setores: any[];
  avisar: (msg: string, tipo?: 'sucesso' | 'erro') => void;
}

export default function FormularioCadastro({ setores, avisar }: Props) {
  const [nome, setNome] = useState('');
  const [matricula, setMatricula] = useState('');
  const [cpf, setCpf] = useState('');
  const [rg, setRg] = useState('');
  const [setorId, setSetorId] = useState('');
  const [fotoBase64, setFotoBase64] = useState(''); 
  const [tamanhoUniforme, setTamanhoUniforme] = useState('');
  const [tamanhoCalcado, setTamanhoCalcado] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processarFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 300; let width = img.width; let height = img.height;
        if (width > height && width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } 
        else if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d'); ctx?.drawImage(img, 0, 0, width, height);
        setFotoBase64(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const cadastrarFuncionario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !matricula || !setorId) return avisar("Preencha Nome, Matrícula e Unidade.", "erro");
    try {
      await addDoc(collection(db, 'funcionarios'), {
        nome, matricula, cpf, rg, setorId, fotoBase64,
        tamanhoUniforme: tamanhoUniforme || 'Não informado', tamanhoCalcado: tamanhoCalcado || 'Não informado', 
        status: 'ativo',
        createdAt: serverTimestamp()
      });
      avisar("Colaborador cadastrado!");
      setNome(''); setMatricula(''); setCpf(''); setRg(''); setTamanhoUniforme(''); setTamanhoCalcado(''); setFotoBase64('');
    } catch (error) { avisar("Erro ao cadastrar.", "erro"); }
  };

  return (
    <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: 'var(--sombra-card)', height: 'fit-content' }}>
      <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px' }}>
        <UserPlus size={20} color="var(--cor-primaria)"/> Novo Colaborador
      </h3>
      <form onSubmit={cadastrarFuncionario} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', backgroundColor: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
            {fotoBase64 ? <img src={fotoBase64} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Camera size={24} color="#94a3b8" />}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>Foto do Colaborador</p>
            <input type="file" accept="image/*" ref={fileInputRef} onChange={processarFoto} style={{ display: 'none' }} />
            <Button type="button" onClick={() => fileInputRef.current?.click()} style={{ padding: '6px 12px', fontSize: '12px', backgroundColor: 'white', color: '#3b82f6', border: '1px solid #bfdbfe' }}>
              {fotoBase64 ? 'Trocar Foto' : 'Tirar Foto / Anexar'}
            </Button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '15px' }}>
          <Input label="Nome Completo *" value={nome} onChange={e => setNome(e.target.value)} />
          <Input label="Matrícula *" value={matricula} onChange={e => setMatricula(e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '15px' }}>
          <Input label="CPF (Opcional)" value={cpf} onChange={e => setCpf(e.target.value)} placeholder="000.000.000-00" />
          <Input label="RG (Opcional)" value={rg} onChange={e => setRg(e.target.value)} placeholder="00.000.000-X" />
        </div>
        <div>
          <label style={{ fontSize: '13px', color: '#64748b', fontWeight: 'bold' }}>Unidade de Trabalho *</label>
          <select value={setorId} onChange={e => setSetorId(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '5px', backgroundColor: 'white', outline: 'none' }}>
            <option value="">Selecione...</option>
            {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </div>
        <Button type="submit" style={{ height: '50px', fontWeight: 'bold' }} variante="primario">Salvar Colaborador</Button>
      </form>
    </div>
  );
}