// src/pages/Funcionarios.tsx
import { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, query, where, Timestamp, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Users, UserPlus, CheckCircle2, AlertCircle, Shirt, FileText, X, Camera, History, Package, Plus, Calendar, AlertTriangle, Lock, Edit3 } from 'lucide-react';
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
  const [estoque, setEstoque] = useState<any[]>([]); 
  const [historicoEntregas, setHistoricoEntregas] = useState<any[]>([]); 
  
  const [nome, setNome] = useState('');
  const [matricula, setMatricula] = useState('');
  const [cpf, setCpf] = useState('');
  const [rg, setRg] = useState('');
  const [setorId, setSetorId] = useState('');
  const [fotoBase64, setFotoBase64] = useState(''); 

  const [tamanhoUniforme, setTamanhoUniforme] = useState('');
  const [tamanhoCalcado, setTamanhoCalcado] = useState('');

  const [fichaAberta, setFichaAberta] = useState<Funcionario | null>(null);
  const [notificacao, setNotificacao] = useState<{msg: string, tipo: 'sucesso' | 'erro'} | null>(null);

  // Estados do Histórico Manual
  const [addHistAberto, setAddHistAberto] = useState(false);
  const [histData, setHistData] = useState('');
  const [histItem, setHistItem] = useState('');
  const [histQtd, setHistQtd] = useState('1');
  const [histMotivo, setHistMotivo] = useState('Registro Anterior ao Sistema');

  // 🔒 Estados do Cofre
  const [modalSenhaAberto, setModalSenhaAberto] = useState(false);
  const [senhaSocio, setSenhaSocio] = useState('');
  const [validandoSenha, setValidandoSenha] = useState(false);
  const [editandoRestrito, setEditandoRestrito] = useState(false);
  const [cpfEdit, setCpfEdit] = useState('');
  const [rgEdit, setRgEdit] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const avisar = (msg: string, tipo: 'sucesso' | 'erro' = 'sucesso') => {
    setNotificacao({ msg, tipo });
    setTimeout(() => setNotificacao(null), 4000);
  };

  useEffect(() => {
    const unsubSetores = onSnapshot(collection(db, 'setores'), (s) => setSetores(s.docs.map(d => ({ id: d.id, nome: d.data().nome }))));
    const unsubFuncionarios = onSnapshot(collection(db, 'funcionarios'), (s) => setFuncionarios(s.docs.map(d => ({ id: d.id, ...d.data() } as Funcionario))));
    const unsubEstoque = onSnapshot(collection(db, 'estoque'), (s) => setEstoque(s.docs.map(d => d.data())));
    
    return () => { unsubSetores(); unsubFuncionarios(); unsubEstoque(); };
  }, []);

  useEffect(() => {
    if (!fichaAberta) {
      setHistoricoEntregas([]);
      setAddHistAberto(false);
      setEditandoRestrito(false);
      return;
    }
    
    // 🛑 CORREÇÃO AQUI: Removemos o orderBy do Firebase e ordenamos no JavaScript
    const q = query(collection(db, 'entregas'), where('funcionarioId', '==', fichaAberta.id));
    
    const unsubHistorico = onSnapshot(q, (snapshot) => {
      const entregas = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      // Organiza da mais recente para a mais antiga
      entregas.sort((a, b) => (b.dataHora?.toMillis() || 0) - (a.dataHora?.toMillis() || 0));
      setHistoricoEntregas(entregas);
    });
    
    return () => unsubHistorico();
  }, [fichaAberta]);

  const processarFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
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

    try {
      await addDoc(collection(db, 'funcionarios'), {
        nome, matricula, cpf, rg, setorId, fotoBase64,
        tamanhoUniforme: tamanhoUniforme || 'Não informado', 
        tamanhoCalcado: tamanhoCalcado || 'Não informado', 
        createdAt: serverTimestamp()
      });
      avisar("Colaborador cadastrado com sucesso!");
      setNome(''); setMatricula(''); setCpf(''); setRg(''); setTamanhoUniforme(''); setTamanhoCalcado(''); setFotoBase64('');
    } catch (error) { avisar("Erro ao cadastrar.", "erro"); }
  };

  const salvarEdicaoFicha = async () => {
    if (!fichaAberta) return;
    try {
      await updateDoc(doc(db, 'funcionarios', fichaAberta.id), {
        tamanhoUniforme: fichaAberta.tamanhoUniforme,
        tamanhoCalcado: fichaAberta.tamanhoCalcado,
      });
      avisar("Medidas atualizadas!");
    } catch (error) { avisar("Erro ao atualizar ficha.", "erro"); }
  };

  const validarSenhaSocio = async () => {
    setValidandoSenha(true);
    try {
      const senhaDev = import.meta.env.VITE_DEV_PASS;
      
      if (senhaSocio === senhaDev && senhaDev !== undefined) {
        desbloquearCofre();
        return;
      }

      const q = query(collection(db, 'usuarios'), where('nivel', '==', 'socio'), where('senha', '==', senhaSocio));
      const snap = await getDocs(q);

      if (!snap.empty) {
        desbloquearCofre();
      } else {
        avisar("Senha incorreta ou sem permissão.", "erro");
      }
    } catch (error) {
      avisar("Erro ao validar senha.", "erro");
    }
    setValidandoSenha(false);
  };

  const desbloquearCofre = () => {
    setCpfEdit(fichaAberta?.cpf || '');
    setRgEdit(fichaAberta?.rg || '');
    setEditandoRestrito(true);
    setModalSenhaAberto(false);
    setSenhaSocio('');
  };

  const salvarDadosRestritos = async () => {
    if (!fichaAberta) return;
    try {
      await updateDoc(doc(db, 'funcionarios', fichaAberta.id), { cpf: cpfEdit, rg: rgEdit });
      setFichaAberta({ ...fichaAberta, cpf: cpfEdit, rg: rgEdit });
      setEditandoRestrito(false);
      avisar("Documentos atualizados!");
    } catch (error) {
      avisar("Erro ao atualizar documentos.", "erro");
    }
  };

  const salvarRegistroAntigo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!histData || !histItem) return avisar("Preencha a data e o item.", "erro");

    try {
      const dataFormatada = new Date(`${histData}T12:00:00`);
      await addDoc(collection(db, 'entregas'), {
        setorId: fichaAberta?.setorId,
        funcionarioId: fichaAberta?.id,
        funcionarioNome: fichaAberta?.nome,
        itemId: 'historico_manual',
        itemNome: histItem,
        quantidade: Number(histQtd),
        durabilidade: 0,
        justificativa: histMotivo,
        assinatura: 'Registro Manual Anterior',
        dataHora: Timestamp.fromDate(dataFormatada),
        isRegistroAntigo: true 
      });

      avisar("Histórico adicionado!");
      setAddHistAberto(false);
      setHistData(''); setHistItem(''); setHistQtd('1'); setHistMotivo('Registro Anterior ao Sistema');
    } catch (error) { avisar("Erro ao salvar histórico.", "erro"); }
  };

  const nomesEstoque = Array.from(new Set(estoque.map(i => i.nome).filter(Boolean)));

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', paddingBottom: '40px', padding: '10px' }}>
      
      {notificacao && (
        <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 12000, backgroundColor: notificacao.tipo === 'sucesso' ? '#10b981' : '#ef4444', color: 'white', padding: '12px 24px', borderRadius: '50px', display: 'flex', gap: '10px', alignItems: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
          <CheckCircle2 style={{ flexShrink: 0 }} /> <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{notificacao.msg}</span>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', marginTop: '10px' }}>
        <Users size={28} color="var(--cor-primaria)" />
        <h1 style={{ fontSize: '22px', color: '#1e293b', margin: 0 }}>Funcionários e Fichas</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        
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
                <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={processarFoto} style={{ display: 'none' }} />
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

        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: 'var(--sombra-card)' }}>
          <h3 style={{ marginBottom: '15px', fontSize: '16px' }}>Equipe Operacional</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {funcionarios.map(func => (
              <div key={func.id} style={{ border: '1px solid #e2e8f0', padding: '12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#f1f5f9', overflow: 'hidden' }}>
                    {func.fotoBase64 ? <img src={func.fotoBase64} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <UserPlus size={20} color="#94a3b8" style={{ margin: '10px' }} />}
                  </div>
                  <div>
                    <strong style={{ display: 'block', fontSize: '15px', color: '#1e293b' }}>{func.nome}</strong>
                    <span style={{ fontSize: '11px', backgroundColor: '#f1f5f9', padding: '4px 6px', borderRadius: '4px', color: '#64748b', fontWeight: 'bold' }}>MAT: {func.matricula}</span>
                  </div>
                </div>
                <Button onClick={() => setFichaAberta(func)} style={{ padding: '8px 12px', fontSize: '13px', backgroundColor: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe' }}>
                  <FileText size={16} style={{marginRight: '5px'}} /> Ficha
                </Button>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* 🌟 MODAL DA FICHA */}
      {fichaAberta && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.9)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px', backdropFilter: 'blur(4px)' }}>
          
          <div style={{ backgroundColor: '#f8fafc', width: '100%', maxWidth: '1000px', borderRadius: '20px', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '90vh', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            
            <div style={{ backgroundColor: '#1e293b', padding: '20px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                 <div style={{ width: '55px', height: '55px', borderRadius: '50%', backgroundColor: 'white', overflow: 'hidden', border: '2px solid #475569' }}>
                    {fichaAberta.fotoBase64 ? <img src={fichaAberta.fotoBase64} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <UserPlus size={25} color="#94a3b8" style={{ margin: '12px' }} />}
                 </div>
                 <div>
                  <h2 style={{ fontSize: '18px', margin: '0 0 5px 0', fontWeight: 'bold' }}>{fichaAberta.nome}</h2>
                  <span style={{ fontSize: '13px', color: '#cbd5e1', backgroundColor: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '50px' }}>Matrícula: {fichaAberta.matricula}</span>
                 </div>
              </div>
              <button onClick={() => setFichaAberta(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={28} /></button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', overflowY: 'auto', flex: 1 }}>
              
              {/* ESQUERDA: MEDIDAS E DADOS RESTRITOS */}
              <div style={{ flex: '1 1 300px', padding: '20px', backgroundColor: 'white', borderRight: '1px solid #e2e8f0' }}>
                
                <div style={{ display: 'flex', flexDirection: 'column', fontSize: '13px', color: '#475569', backgroundColor: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: editandoRestrito ? '15px' : '0' }}>
                    <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444' }}>
                      <AlertTriangle size={16} /> DADOS RESTRITOS
                    </strong>
                    {!editandoRestrito && (
                      <button onClick={() => setModalSenhaAberto(true)} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', fontSize: '11px', backgroundColor: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                        <Lock size={12} /> Editar
                      </button>
                    )}
                  </div>

                  {!editandoRestrito ? (
                    <div style={{ display: 'flex', gap: '20px', marginTop: '15px' }}>
                      <div><strong>CPF:</strong><br/>{fichaAberta.cpf ? '***.***.***-**' : 'Não informado'}</div>
                      <div><strong>RG:</strong><br/>{fichaAberta.rg ? '**.***.***-*' : 'Não informado'}</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <Input label="Novo CPF" value={cpfEdit} onChange={e => setCpfEdit(e.target.value)} />
                        <Input label="Novo RG" value={rgEdit} onChange={e => setRgEdit(e.target.value)} />
                      </div>
                      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '5px' }}>
                        <Button onClick={() => setEditandoRestrito(false)} style={{ backgroundColor: '#e2e8f0', color: '#475569', height: '35px', padding: '0 15px' }}>Cancelar</Button>
                        <Button onClick={salvarDadosRestritos} style={{ backgroundColor: '#10b981', height: '35px', padding: '0 15px' }}><Edit3 size={14} style={{marginRight: '5px'}}/> Salvar e Ocultar</Button>
                      </div>
                    </div>
                  )}
                </div>

                <h4 style={{ fontSize: '13px', color: '#1e293b', margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '6px' }}><Shirt size={16} color="#3b82f6" /> MEDIDAS DO COLABORADOR</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Tamanho Camisa / Calça</label>
                    <select value={fichaAberta.tamanhoUniforme} onChange={e => setFichaAberta({...fichaAberta, tamanhoUniforme: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}>
                      <option value="Não informado">Selecione...</option>
                      {['P', 'M', 'G', 'GG', 'XG', 'G1', 'G2', 'G3'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <Input label="Tamanho Calçado / Bota" placeholder="Ex: 40" value={fichaAberta.tamanhoCalcado} onChange={e => setFichaAberta({...fichaAberta, tamanhoCalcado: e.target.value})} />
                  </div>
                  <Button onClick={salvarEdicaoFicha} style={{ height: '45px', backgroundColor: '#3b82f6', marginTop: '5px' }}>Salvar Medidas</Button>
                </div>
              </div>

              {/* DIREITA: HISTÓRICO */}
              <div style={{ flex: '2 1 500px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e2e8f0', paddingBottom: '12px', marginBottom: '15px' }}>
                  <h4 style={{ fontSize: '16px', color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <History size={20} color="#f59e0b" /> HISTÓRICO DE MATERIAIS
                  </h4>
                  <Button onClick={() => setAddHistAberto(!addHistAberto)} style={{ backgroundColor: addHistAberto ? '#64748b' : '#3b82f6', fontSize: '12px', padding: '8px 12px' }}>
                    {addHistAberto ? 'Fechar' : <><Plus size={16} style={{marginRight: '5px'}}/> Adicionar Antigo</>}
                  </Button>
                </div>

                {addHistAberto && (
                  <form onSubmit={salvarRegistroAntigo} style={{ backgroundColor: '#eff6ff', padding: '15px', borderRadius: '12px', border: '1px dashed #93c5fd', marginBottom: '20px' }}>
                    <h5 style={{ margin: '0 0 10px 0', color: '#1e3a8a', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px' }}><Calendar size={14} /> Registrar Entrega Anterior ao Sistema</h5>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
                      <Input label="Data da Entrega *" type="date" value={histData} onChange={e => setHistData(e.target.value)} required />
                      
                      <div style={{ gridColumn: 'span 2' }}>
                        <label style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Item Entregue *</label>
                        <input list="itens-estoque" value={histItem} onChange={e => setHistItem(e.target.value)} placeholder="Ex: Bota de Segurança" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} required />
                        <datalist id="itens-estoque">{nomesEstoque.map(n => <option key={n} value={n} />)}</datalist>
                      </div>

                      <Input label="Qtd *" type="number" value={histQtd} onChange={e => setHistQtd(e.target.value)} required />
                    </div>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                      <Input label="Observação / Motivo" value={histMotivo} onChange={e => setHistMotivo(e.target.value)} />
                      <Button type="submit" style={{ alignSelf: 'flex-end', height: '42px', backgroundColor: '#2563eb' }}>Salvar Registro</Button>
                    </div>
                  </form>
                )}
                
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {historicoEntregas.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1', marginTop: '10px' }}>
                      <Package size={40} color="#cbd5e1" style={{ margin: '0 auto 10px' }} />
                      <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>Nenhuma entrega registrada.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {historicoEntregas.map(ent => (
                        <div key={ent.id} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '15px', backgroundColor: ent.isRegistroAntigo ? '#fefce8' : '#ffffff', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <strong style={{ fontSize: '15px', color: '#1e293b' }}>{ent.quantidade}x {ent.itemNome}</strong>
                            <span style={{ fontSize: '12px', color: ent.isRegistroAntigo ? '#ca8a04' : '#64748b', backgroundColor: ent.isRegistroAntigo ? '#fef08a' : '#f1f5f9', padding: '4px 10px', borderRadius: '50px', fontWeight: 'bold' }}>
                              {ent.dataHora?.toDate().toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                          <div style={{ fontSize: '13px', color: '#475569', display: 'flex', justifyContent: 'space-between' }}>
                            <span><strong>Motivo:</strong> {ent.justificativa || 'Normal'}</span>
                            {ent.isRegistroAntigo ? (
                              <span style={{ color: '#ca8a04', fontStyle: 'italic' }}>Registro Histórico</span>
                            ) : (
                              <span><strong>Duração:</strong> {ent.durabilidade} dias</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🔐 MODAL DE SENHA DO SÓCIO */}
      {modalSenhaAberto && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.95)', zIndex: 11000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '20px', width: '100%', maxWidth: '350px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', textAlign: 'center' }}>
            
            <div style={{ backgroundColor: '#fee2e2', width: '70px', height: '70px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px' }}>
              <Lock size={34} color="#ef4444" />
            </div>
            
            <h3 style={{ margin: '0 0 10px 0', fontSize: '20px', color: '#1e293b', fontWeight: 'bold' }}>Acesso Restrito</h3>
            <p style={{ margin: '0 0 25px 0', fontSize: '13px', color: '#64748b', lineHeight: '1.5' }}>
              Insira a senha de aprovação de um <strong>Sócio</strong> para editar documentos.
            </p>
            
            <Input 
              label="" type="password" 
              value={senhaSocio} onChange={e => setSenhaSocio(e.target.value)} 
              placeholder="Digite a senha..." 
            />
            
            <div style={{ display: 'flex', gap: '10px', marginTop: '25px' }}>
              <Button onClick={() => { setModalSenhaAberto(false); setSenhaSocio(''); }} style={{ flex: 1, backgroundColor: '#f1f5f9', color: '#475569', fontWeight: 'bold' }}>Cancelar</Button>
              <Button onClick={validarSenhaSocio} disabled={validandoSenha || !senhaSocio} style={{ flex: 1, backgroundColor: '#ef4444', fontWeight: 'bold' }}>
                {validandoSenha ? 'Validando...' : 'Desbloquear'}
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
