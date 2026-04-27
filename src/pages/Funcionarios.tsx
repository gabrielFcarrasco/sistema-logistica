// src/pages/Funcionarios.tsx
import { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Users, UserPlus, CheckCircle2, AlertCircle, Building2, Shirt, FileText, X, Camera } from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

interface Setor { id: string; nome: string; }
interface Funcionario { 
  id: string; nome: string; matricula: string; cpf: string; rg: string; setorId: string; 
  tamanhoUniforme: string; tamanhoCalcado: string; qtdUniforme: string; fotoBase64?: string;
}

export default function Funcionarios() {
  const [setores, setSetores] = useState<Setor[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  
  const [nome, setNome] = useState('');
  const [matricula, setMatricula] = useState('');
  const [cpf, setCpf] = useState('');
  const [rg, setRg] = useState('');
  const [setorId, setSetorId] = useState('');
  const [fotoBase64, setFotoBase64] = useState(''); // Foto comprimida

  const [tamanhoUniforme, setTamanhoUniforme] = useState('');
  const [tamanhoCalcado, setTamanhoCalcado] = useState('');
  const [qtdUniforme, setQtdUniforme] = useState('');

  const [fichaAberta, setFichaAberta] = useState<Funcionario | null>(null);
  const [notificacao, setNotificacao] = useState<{msg: string, tipo: 'sucesso' | 'erro'} | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const avisar = (msg: string, tipo: 'sucesso' | 'erro' = 'sucesso') => {
    setNotificacao({ msg, tipo });
    setTimeout(() => setNotificacao(null), 4000);
  };

  useEffect(() => {
    const unsubSetores = onSnapshot(collection(db, 'setores'), (s) => setSetores(s.docs.map(d => ({ id: d.id, nome: d.data().nome }))));
    const unsubFuncionarios = onSnapshot(collection(db, 'funcionarios'), (s) => setFuncionarios(s.docs.map(d => ({ id: d.id, ...d.data() } as Funcionario))));
    return () => { unsubSetores(); unsubFuncionarios(); };
  }, []);

  // 🪄 O MOTOR DE COMPRESSÃO DE FOTOS
  const processarFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Redimensiona mantendo a proporção (Máx 300px)
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 300;
        let width = img.width;
        let height = img.height;

        if (width > height && width > MAX_SIZE) {
          height *= MAX_SIZE / width;
          width = MAX_SIZE;
        } else if (height > MAX_SIZE) {
          width *= MAX_SIZE / height;
          height = MAX_SIZE;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Comprime para JPEG com 70% de qualidade (A mágica acontece aqui)
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
        setFotoBase64(compressedBase64);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const cadastrarFuncionario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !matricula || !setorId) return avisar("Preencha Nome, Matrícula e Unidade.", "erro");
    if (!cpf && !rg) return avisar("Preencha pelo menos o CPF ou o RG.", "erro");

    try {
      await addDoc(collection(db, 'funcionarios'), {
        nome, matricula, cpf, rg, setorId, fotoBase64,
        tamanhoUniforme: tamanhoUniforme || 'Não informado', 
        tamanhoCalcado: tamanhoCalcado || 'Não informado', 
        qtdUniforme: qtdUniforme || '0',
        createdAt: serverTimestamp()
      });
      avisar("Colaborador cadastrado com sucesso!");
      setNome(''); setMatricula(''); setCpf(''); setRg(''); setTamanhoUniforme(''); setTamanhoCalcado(''); setQtdUniforme(''); setFotoBase64('');
    } catch (error) {
      avisar("Erro ao cadastrar colaborador.", "erro");
    }
  };

  const salvarEdicaoFicha = async () => {
    if (!fichaAberta) return;
    try {
      await updateDoc(doc(db, 'funcionarios', fichaAberta.id), {
        tamanhoUniforme: fichaAberta.tamanhoUniforme,
        tamanhoCalcado: fichaAberta.tamanhoCalcado,
        qtdUniforme: fichaAberta.qtdUniforme
      });
      avisar("Medidas atualizadas!");
    } catch (error) { avisar("Erro ao atualizar ficha.", "erro"); }
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', paddingBottom: '40px', padding: '10px' }}>
      
      {notificacao && (
        <div style={{ position: 'fixed', top: '10px', left: '10px', right: '10px', zIndex: 100, backgroundColor: notificacao.tipo === 'sucesso' ? '#10b981' : '#ef4444', color: 'white', padding: '15px', borderRadius: '8px', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <CheckCircle2 shrink={0} /> <span style={{ fontSize: '14px' }}>{notificacao.msg}</span>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', marginTop: '10px' }}>
        <Users size={28} color="var(--cor-primaria)" />
        <h1 style={{ fontSize: '22px', color: '#1e293b', margin: 0 }}>Funcionários e Fichas</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        
        {/* LADO ESQUERDO: CADASTRO */}
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: 'var(--sombra-card)', height: 'fit-content' }}>
          <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px' }}>
            <UserPlus size={20} color="var(--cor-primaria)"/> Novo Colaborador
          </h3>
          
          <form onSubmit={cadastrarFuncionario} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            
            {/* COMPONENTE DE FOTO */}
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center', backgroundColor: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
              <div 
                style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}
              >
                {fotoBase64 ? <img src={fotoBase64} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Camera size={24} color="#94a3b8" />}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>Foto do Colaborador (Opcional)</p>
                <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={processarFoto} style={{ display: 'none' }} />
                <Button type="button" onClick={() => fileInputRef.current?.click()} style={{ padding: '6px 12px', fontSize: '12px', backgroundColor: 'white', color: '#3b82f6', border: '1px solid #bfdbfe' }}>
                  {fotoBase64 ? 'Trocar Foto' : 'Tirar Foto / Anexar'}
                </Button>
              </div>
            </div>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
              <div style={{ flex: '1 1 200px' }}><Input label="Nome Completo *" value={nome} onChange={e => setNome(e.target.value)} /></div>
              <div style={{ flex: '1 1 100px' }}><Input label="Matrícula *" value={matricula} onChange={e => setMatricula(e.target.value)} /></div>
            </div>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
              <div style={{ flex: '1 1 120px' }}><Input label="CPF" value={cpf} onChange={e => setCpf(e.target.value)} /></div>
              <div style={{ flex: '1 1 120px' }}><Input label="RG" value={rg} onChange={e => setRg(e.target.value)} /></div>
            </div>

            <div>
              <label style={{ fontSize: '13px', color: '#64748b', fontWeight: 'bold' }}>Unidade de Trabalho *</label>
              <select value={setorId} onChange={e => setSetorId(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '5px' }}>
                <option value="">Selecione...</option>
                {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </div>

            <Button type="submit" style={{ height: '50px' }} variante="primaria">Salvar Colaborador</Button>
          </form>
        </div>

        {/* LADO DIREITO: LISTA */}
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: 'var(--sombra-card)' }}>
          <h3 style={{ marginBottom: '15px', fontSize: '16px' }}>Equipe Operacional</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {funcionarios.map(func => (
              <div key={func.id} style={{ border: '1px solid #e2e8f0', padding: '12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {/* Mostra a foto em miniatura */}
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#f1f5f9', overflow: 'hidden' }}>
                    {func.fotoBase64 ? <img src={func.fotoBase64} alt="Foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <UserPlus size={20} color="#94a3b8" style={{ margin: '10px' }} />}
                  </div>
                  <div>
                    <strong style={{ display: 'block', fontSize: '15px' }}>{func.nome}</strong>
                    <span style={{ fontSize: '11px', backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>MAT: {func.matricula}</span>
                  </div>
                </div>
                <Button onClick={() => setFichaAberta(func)} style={{ padding: '8px 12px', fontSize: '13px' }}><FileText size={16} /> Ficha</Button>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* MODAL: FICHA DO COLABORADOR */}
      {fichaAberta && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '15px' }}>
          <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '500px', borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            
            <div style={{ backgroundColor: '#1e293b', padding: '20px', color: 'white', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                 <div style={{ width: '50px', height: '50px', borderRadius: '50%', backgroundColor: 'white', overflow: 'hidden' }}>
                    {fichaAberta.fotoBase64 ? <img src={fichaAberta.fotoBase64} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <UserPlus size={25} color="#94a3b8" style={{ margin: '12px' }} />}
                 </div>
                 <div>
                  <h2 style={{ fontSize: '20px', margin: '0 0 5px 0' }}>{fichaAberta.nome}</h2>
                  <span style={{ fontSize: '13px', color: '#94a3b8' }}>Matrícula: {fichaAberta.matricula}</span>
                 </div>
              </div>
              <button onClick={() => setFichaAberta(null)} style={{ background: 'none', border: 'none', color: '#94a3b8' }}><X size={24} /></button>
            </div>

            <div style={{ padding: '20px', overflowY: 'auto' }}>
              <h4 style={{ fontSize: '13px', color: '#64748b', marginBottom: '10px' }}>DADOS RESTRITOS</h4>
              <p style={{ fontSize: '14px' }}><strong>CPF:</strong> {fichaAberta.cpf || '-'} | <strong>RG:</strong> {fichaAberta.rg || '-'}</p>

              <div style={{ marginTop: '20px', backgroundColor: '#f8fafc', padding: '15px', borderRadius: '8px' }}>
                <h4 style={{ fontSize: '13px', color: '#64748b', marginBottom: '10px' }}><Shirt size={16} /> MEDIDAS E UNIFORMES</h4>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <select value={fichaAberta.tamanhoUniforme} onChange={e => setFichaAberta({...fichaAberta, tamanhoUniforme: e.target.value})} style={{ padding: '10px', borderRadius: '6px' }}>
                    <option value="Não informado">Não informado</option>
                    {['P', 'M', 'G', 'GG', 'XG', 'G1', 'G2', 'G3'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <Input label="" placeholder="Calçado" value={fichaAberta.tamanhoCalcado} onChange={e => setFichaAberta({...fichaAberta, tamanhoCalcado: e.target.value})} />
                  <Button onClick={salvarEdicaoFicha}>Salvar</Button>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}