// src/pages/Funcionarios.tsx
import { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, query, where, Timestamp, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';

import jsPDF from "jspdf";
import logoCarvalho from '../assets/logo.webp';

import { 
  Users, UserPlus, CheckCircle2, AlertCircle, Shirt, FileText, 
  X, Camera, History, Package, Plus, Calendar, AlertTriangle, 
  Lock, Edit3, GraduationCap, Award, PenTool, Smartphone, Send
} from 'lucide-react';
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

  // Estados do Histórico Manual (EPIs)
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

  // 🎓 ESTADOS DO MÓDULO DE TREINAMENTOS
  const [treinamentosGlobais, setTreinamentosGlobais] = useState<any[]>([]);
  const [modalTreinamento, setModalTreinamento] = useState(false);
  const [tStep, setTStep] = useState(0); // 0: Lista, 1: Form Cadastro, 2: Assina Instrutor, 3: Assina Funcs
  
  const [tTitulo, setTTitulo] = useState('');
  const [tData, setTData] = useState('');
  const [tInstrutor, setTInstrutor] = useState('');
  const [tCargaHoraria, setTCargaHoraria] = useState('1');
  const [tSelecionados, setTSelecionados] = useState<string[]>([]);
  
  const [tAssinaturaInstrutor, setTAssinaturaInstrutor] = useState('');
  const [tAssinaturasFuncs, setTAssinaturasFuncs] = useState<Record<string, string>>({});
  const [tCurrentFuncIndex, setTCurrentFuncIndex] = useState(0);
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const desenhandoRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const avisar = (msg: string, tipo: 'sucesso' | 'erro' = 'sucesso') => {
    setNotificacao({ msg, tipo });
    setTimeout(() => setNotificacao(null), 4000);
  };

  useEffect(() => {
    const unsubSetores = onSnapshot(collection(db, 'setores'), (s) => setSetores(s.docs.map(d => ({ id: d.id, nome: d.data().nome }))));
    const unsubFuncionarios = onSnapshot(collection(db, 'funcionarios'), (s) => setFuncionarios(s.docs.map(d => ({ id: d.id, ...d.data() } as Funcionario))));
    const unsubEstoque = onSnapshot(collection(db, 'estoque'), (s) => setEstoque(s.docs.map(d => d.data())));
    const unsubTreinos = onSnapshot(collection(db, 'treinamentos'), (s) => {
      const docs = s.docs.map(d => ({ id: d.id, ...d.data() } as any));
      docs.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setTreinamentosGlobais(docs);
    });
    
    return () => { unsubSetores(); unsubFuncionarios(); unsubEstoque(); unsubTreinos(); };
  }, []);

  useEffect(() => {
    if (!fichaAberta) {
      setHistoricoEntregas([]); setAddHistAberto(false); setEditandoRestrito(false); return;
    }
    const q = query(collection(db, 'entregas'), where('funcionarioId', '==', fichaAberta.id));
    const unsubHistorico = onSnapshot(q, (snapshot) => {
      const entregas = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      entregas.sort((a, b) => (b.dataHora?.toMillis() || 0) - (a.dataHora?.toMillis() || 0));
      setHistoricoEntregas(entregas);
    });
    return () => unsubHistorico();
  }, [fichaAberta]);

  useEffect(() => {
    const handleResize = () => setIsPortrait(window.innerHeight > window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- LÓGICA DE FOTOS E CADASTRO ORIGINAL ---
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
  };

  const cadastrarFuncionario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !matricula || !setorId) return avisar("Preencha Nome, Matrícula e Unidade.", "erro");
    try {
      await addDoc(collection(db, 'funcionarios'), {
        nome, matricula, cpf, rg, setorId, fotoBase64,
        tamanhoUniforme: tamanhoUniforme || 'Não informado', tamanhoCalcado: tamanhoCalcado || 'Não informado', 
        createdAt: serverTimestamp()
      });
      avisar("Colaborador cadastrado!");
      setNome(''); setMatricula(''); setCpf(''); setRg(''); setTamanhoUniforme(''); setTamanhoCalcado(''); setFotoBase64('');
    } catch (error) { avisar("Erro ao cadastrar.", "erro"); }
  };

  const salvarEdicaoFicha = async () => {
    if (!fichaAberta) return;
    try {
      await updateDoc(doc(db, 'funcionarios', fichaAberta.id), { tamanhoUniforme: fichaAberta.tamanhoUniforme, tamanhoCalcado: fichaAberta.tamanhoCalcado });
      avisar("Medidas atualizadas!");
    } catch (error) { avisar("Erro ao atualizar.", "erro"); }
  };

  const validarSenhaSocio = async () => {
    setValidandoSenha(true);
    try {
      const senhaDev = import.meta.env.VITE_DEV_PASS;
      if (senhaSocio === senhaDev && senhaDev !== undefined) { desbloquearCofre(); return; }
      const q = query(collection(db, 'usuarios'), where('nivel', '==', 'socio'), where('senha', '==', senhaSocio));
      const snap = await getDocs(q);
      if (!snap.empty) desbloquearCofre(); else avisar("Senha incorreta.", "erro");
    } catch (error) { avisar("Erro ao validar senha.", "erro"); }
    setValidandoSenha(false);
  };

  const desbloquearCofre = () => { setCpfEdit(fichaAberta?.cpf || ''); setRgEdit(fichaAberta?.rg || ''); setEditandoRestrito(true); setModalSenhaAberto(false); setSenhaSocio(''); };

  const salvarDadosRestritos = async () => {
    if (!fichaAberta) return;
    try {
      await updateDoc(doc(db, 'funcionarios', fichaAberta.id), { cpf: cpfEdit, rg: rgEdit });
      setFichaAberta({ ...fichaAberta, cpf: cpfEdit, rg: rgEdit }); setEditandoRestrito(false); avisar("Documentos atualizados!");
    } catch (error) { avisar("Erro.", "erro"); }
  };

  const salvarRegistroAntigo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const dataFormatada = new Date(`${histData}T12:00:00`);
      await addDoc(collection(db, 'entregas'), {
        setorId: fichaAberta?.setorId, funcionarioId: fichaAberta?.id, funcionarioNome: fichaAberta?.nome,
        itemId: 'historico_manual', itemNome: histItem, quantidade: Number(histQtd), durabilidade: 0,
        justificativa: histMotivo, assinatura: 'Registro Manual Anterior', dataHora: Timestamp.fromDate(dataFormatada), isRegistroAntigo: true 
      });
      avisar("Histórico adicionado!"); setAddHistAberto(false); setHistData(''); setHistItem(''); setHistQtd('1'); setHistMotivo('Registro Anterior ao Sistema');
    } catch (error) { avisar("Erro.", "erro"); }
  };

  // 🎓 MÓDULO DE TREINAMENTOS - LÓGICA
  const iniciarNovoTreinamento = () => {
    setTTitulo(''); setTData(''); setTInstrutor(''); setTCargaHoraria('1');
    setTSelecionados([]); setTAssinaturaInstrutor(''); setTAssinaturasFuncs({});
    setTCurrentFuncIndex(0); setTStep(1);
  };

  const toggleFuncTreino = (id: string) => {
    if (tSelecionados.includes(id)) setTSelecionados(tSelecionados.filter(i => i !== id));
    else setTSelecionados([...tSelecionados, id]);
  };

  const setupCanvas = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setTimeout(() => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    }, 100);

    const getPos = (e: any) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const start = (e: any) => { e.preventDefault(); ctx.beginPath(); ctx.moveTo(getPos(e).x, getPos(e).y); desenhandoRef.current = true; };
    const move = (e: any) => { if (!desenhandoRef.current) return; e.preventDefault(); ctx.lineTo(getPos(e).x, getPos(e).y); ctx.stroke(); };
    const stop = () => { desenhandoRef.current = false; };

    canvas.addEventListener('mousedown', start); canvas.addEventListener('mousemove', move); window.addEventListener('mouseup', stop);
    canvas.addEventListener('touchstart', start, { passive: false }); canvas.addEventListener('touchmove', move, { passive: false }); window.addEventListener('touchend', stop);
    
    return () => {
      canvas.removeEventListener('mousedown', start); canvas.removeEventListener('mousemove', move); window.removeEventListener('mouseup', stop);
      canvas.removeEventListener('touchstart', start); canvas.removeEventListener('touchmove', move); window.removeEventListener('touchend', stop);
    };
  };

  useEffect(() => {
    if (tStep === 2 || tStep === 3) {
      if (!isPortrait) setupCanvas();
    }
  }, [tStep, isPortrait, tCurrentFuncIndex]);

  const limparCanvas = () => {
    const canvas = canvasRef.current; const ctx = canvas?.getContext('2d');
    if (ctx && canvas) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); desenhandoRef.current = false; }
  };

  const confirmarAssinaturaTreino = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const jpegBase64 = canvas.toDataURL('image/jpeg', 0.6); // Super leve

    if (tStep === 2) {
      // Instrutor Assinou
      setTAssinaturaInstrutor(jpegBase64);
      setTStep(3); // Vai para os funcionários
    } else if (tStep === 3) {
      // Funcionário Assinou
      const funcId = tSelecionados[tCurrentFuncIndex];
      setTAssinaturasFuncs(prev => ({ ...prev, [funcId]: jpegBase64 }));
      
      if (tCurrentFuncIndex + 1 < tSelecionados.length) {
        setTCurrentFuncIndex(tCurrentFuncIndex + 1); // Próximo funcionário
      } else {
        // TODOS ASSINARAM! Salvar no banco.
        try {
          const participantesData = tSelecionados.map(id => {
            const f = funcionarios.find(x => x.id === id);
            return {
              funcionarioId: id,
              nome: f?.nome || 'Desconhecido',
              cpf: f?.cpf || 'Não Informado',
              assinaturaFunc: tAssinaturasFuncs[id] || jpegBase64 // Pega a atual ou a do state
            };
          });

          await addDoc(collection(db, 'treinamentos'), {
            titulo: tTitulo, data: tData, instrutor: tInstrutor, cargaHoraria: tCargaHoraria,
            assinaturaInstrutor: tAssinaturaInstrutor, participantes: participantesData, createdAt: serverTimestamp()
          });
          avisar("Treinamento registrado com sucesso!");
          setTStep(0); // Volta pra lista
        } catch (e) { avisar("Erro ao salvar treinamento.", "erro"); }
      }
    }
  };

  // 📄 GERADOR DE CERTIFICADO PDF
  const gerarCertificadoPDF = (treino: any, part: any, viaWhatsApp: boolean) => {
    try {
      const doc = new jsPDF('landscape'); // A4 Deitado
      const azul = [30, 41, 59];
      const dourado = [218, 165, 32];

      // Bordas do Certificado
      doc.setDrawColor(azul[0], azul[1], azul[2]);
      doc.setLineWidth(3); doc.rect(10, 10, 277, 190);
      doc.setDrawColor(dourado[0], dourado[1], dourado[2]);
      doc.setLineWidth(1); doc.rect(13, 13, 271, 184);

      try { doc.addImage(logoCarvalho, 'WEBP', 125, 20, 45, 15); } catch(e){}

      doc.setTextColor(azul[0], azul[1], azul[2]);
      doc.setFont("helvetica", "bold"); doc.setFontSize(28);
      doc.text("CERTIFICADO DE CONCLUSÃO", 148, 55, { align: 'center' });

      doc.setTextColor(50, 50, 50);
      doc.setFont("helvetica", "normal"); doc.setFontSize(14);
      
      const texto = `Certificamos para os devidos fins que o(a) colaborador(a)`;
      doc.text(texto, 148, 80, { align: 'center' });
      
      doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(0, 0, 0);
      doc.text(part.nome.toUpperCase(), 148, 95, { align: 'center' });
      
      doc.setFont("helvetica", "normal"); doc.setFontSize(14); doc.setTextColor(50, 50, 50);
      const docFunc = part.cpf !== 'Não Informado' ? `inscrito(a) no CPF: ${part.cpf}` : `colaborador(a) desta empresa`;
      const dataFormatada = new Date(`${treino.data}T12:00:00`).toLocaleDateString('pt-BR');
      
      const textoCorpo = `${docFunc}, participou com êxito do treinamento\n"${treino.titulo.toUpperCase()}", realizado em ${dataFormatada},\ncom carga horária total de ${treino.cargaHoraria} hora(s).`;
      doc.text(textoCorpo, 148, 115, { align: 'center', lineHeightFactor: 1.5 });

      // Assinaturas
      try { doc.addImage(treino.assinaturaInstrutor, 'JPEG', 50, 150, 50, 20); } catch(e){}
      doc.setDrawColor(0,0,0); doc.setLineWidth(0.5); doc.line(40, 172, 110, 172);
      doc.setFontSize(12); doc.text(treino.instrutor, 75, 178, { align: 'center' });
      doc.setFontSize(10); doc.text("Instrutor Responsável", 75, 183, { align: 'center' });

      try { doc.addImage(part.assinaturaFunc, 'JPEG', 180, 150, 50, 20); } catch(e){}
      doc.line(170, 172, 240, 172);
      doc.setFontSize(12); doc.text(part.nome, 205, 178, { align: 'center' });
      doc.setFontSize(10); doc.text("Colaborador(a)", 205, 183, { align: 'center' });

      const fileName = `Certificado_${part.nome.replace(/\s+/g, '_')}.pdf`;
      doc.save(fileName);

      if (viaWhatsApp) {
        const msg = `Olá ${part.nome.split(' ')[0]}! Tudo bem?\n\nSegue em anexo o seu *Certificado de Conclusão* do treinamento de _"${treino.titulo}"_ que realizamos em ${dataFormatada}.\n\nPara visualizar, basta eu te enviar o PDF que acabei de baixar!`;
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
      }

    } catch (e) { alert("Erro ao gerar certificado."); }
  };

  const nomesEstoque = Array.from(new Set(estoque.map(i => i.nome).filter(Boolean)));

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', paddingBottom: '40px', padding: '10px' }}>
      
      {notificacao && (
        <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 12000, backgroundColor: notificacao.tipo === 'sucesso' ? '#10b981' : '#ef4444', color: 'white', padding: '12px 24px', borderRadius: '50px', display: 'flex', gap: '10px', alignItems: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
          <CheckCircle2 style={{ flexShrink: 0 }} /> <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{notificacao.msg}</span>
        </div>
      )}

      {/* HEADER PRINCIPAL */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', marginTop: '10px', flexWrap: 'wrap', gap: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Users size={28} color="var(--cor-primaria)" />
          <h1 style={{ fontSize: '22px', color: '#1e293b', margin: 0 }}>Equipe e Qualificação</h1>
        </div>
        <Button onClick={() => setModalTreinamento(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#8b5cf6' }}>
          <GraduationCap size={20} /> Módulo de Treinamentos
        </Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        
        {/* CADASTRO DE FUNCIONÁRIO */}
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

        {/* LISTA DE FUNCIONÁRIOS */}
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

      {/* 🌟 MODAL DA FICHA DO FUNCIONÁRIO (COM HISTÓRICO DE TREINAMENTOS) */}
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
              
              {/* ESQUERDA: MEDIDAS E DADOS */}
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
                        <Button onClick={salvarDadosRestritos} style={{ backgroundColor: '#10b981', height: '35px', padding: '0 15px' }}><Edit3 size={14} style={{marginRight: '5px'}}/> Salvar</Button>
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

              {/* DIREITA: HISTÓRICOS (EPI e TREINO) */}
              <div style={{ flex: '2 1 500px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* EPIs */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e2e8f0', paddingBottom: '12px', marginBottom: '15px' }}>
                    <h4 style={{ fontSize: '16px', color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <History size={20} color="#f59e0b" /> EPIs E MATERIAIS
                    </h4>
                    <Button onClick={() => setAddHistAberto(!addHistAberto)} style={{ backgroundColor: addHistAberto ? '#64748b' : '#3b82f6', fontSize: '12px', padding: '8px 12px' }}>
                      {addHistAberto ? 'Fechar' : <><Plus size={16} style={{marginRight: '5px'}}/> Adicionar Antigo</>}
                    </Button>
                  </div>

                  {addHistAberto && (
                    <form onSubmit={salvarRegistroAntigo} style={{ backgroundColor: '#eff6ff', padding: '15px', borderRadius: '12px', border: '1px dashed #93c5fd', marginBottom: '20px' }}>
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
                  
                  <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                    {historicoEntregas.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '20px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                        <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>Nenhuma entrega registrada.</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {historicoEntregas.map(ent => (
                          <div key={ent.id} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', backgroundColor: ent.isRegistroAntigo ? '#fefce8' : '#ffffff' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <strong style={{ fontSize: '14px', color: '#1e293b' }}>{ent.quantidade}x {ent.itemNome}</strong>
                              <span style={{ fontSize: '11px', color: ent.isRegistroAntigo ? '#ca8a04' : '#64748b', backgroundColor: ent.isRegistroAntigo ? '#fef08a' : '#f1f5f9', padding: '2px 8px', borderRadius: '50px', fontWeight: 'bold' }}>
                                {ent.dataHora?.toDate().toLocaleDateString('pt-BR')}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* HISTÓRICO DE TREINAMENTOS */}
                <div>
                  <div style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: '12px', marginBottom: '15px' }}>
                    <h4 style={{ fontSize: '16px', color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <GraduationCap size={20} color="#8b5cf6" /> TREINAMENTOS REALIZADOS
                    </h4>
                  </div>
                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {treinamentosGlobais.filter(t => t.participantes?.some((p:any) => p.funcionarioId === fichaAberta.id)).length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '20px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                        <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>Nenhum treinamento no currículo.</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {treinamentosGlobais
                          .filter(t => t.participantes?.some((p:any) => p.funcionarioId === fichaAberta.id))
                          .map(treino => {
                            const participacao = treino.participantes.find((p:any) => p.funcionarioId === fichaAberta.id);
                            return (
                              <div key={treino.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '10px', backgroundColor: '#faf5ff' }}>
                                <div>
                                  <strong style={{ display: 'block', fontSize: '14px', color: '#4c1d95' }}>{treino.titulo}</strong>
                                  <span style={{ fontSize: '12px', color: '#7c3aed' }}>{new Date(`${treino.data}T12:00:00`).toLocaleDateString('pt-BR')} - {treino.cargaHoraria}h</span>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button onClick={() => gerarCertificadoPDF(treino, participacao, false)} style={{ backgroundColor: '#8b5cf6', color: 'white', border: 'none', padding: '8px', borderRadius: '6px', cursor: 'pointer' }} title="Baixar PDF"><Award size={16}/></button>
                                  <button onClick={() => gerarCertificadoPDF(treino, participacao, true)} style={{ backgroundColor: '#10b981', color: 'white', border: 'none', padding: '8px', borderRadius: '6px', cursor: 'pointer' }} title="Enviar p/ WhatsApp"><Send size={16}/></button>
                                </div>
                              </div>
                            )
                          })}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🔐 MODAL DE SENHA DO SÓCIO */}
      {modalSenhaAberto && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.95)', zIndex: 11000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '20px', width: '100%', maxWidth: '350px', textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '20px', color: '#1e293b' }}>Acesso Restrito</h3>
            <Input label="" type="password" value={senhaSocio} onChange={e => setSenhaSocio(e.target.value)} placeholder="Digite a senha..." />
            <div style={{ display: 'flex', gap: '10px', marginTop: '25px' }}>
              <Button onClick={() => { setModalSenhaAberto(false); setSenhaSocio(''); }} style={{ flex: 1, backgroundColor: '#f1f5f9', color: '#475569' }}>Cancelar</Button>
              <Button onClick={validarSenhaSocio} disabled={validandoSenha || !senhaSocio} style={{ flex: 1, backgroundColor: '#ef4444' }}>Desbloquear</Button>
            </div>
          </div>
        </div>
      )}

      {/* 🎓 MÓDULO GIGANTE DE TREINAMENTOS */}
      {modalTreinamento && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'white', zIndex: 15000, display: 'flex', flexDirection: 'column' }}>
          
          <div style={{ padding: '15px 20px', backgroundColor: '#1e293b', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}><GraduationCap/> Gestão de Treinamentos</h2>
            <button onClick={() => setModalTreinamento(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X size={28}/></button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', backgroundColor: '#f8fafc' }}>
            
            {/* VIEW 0: LISTA GERAL */}
            {tStep === 0 && (
              <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', color: '#1e293b' }}>Treinamentos Realizados</h3>
                  <Button onClick={iniciarNovoTreinamento} style={{ backgroundColor: '#8b5cf6' }}><Plus size={18} style={{marginRight:'5px'}}/> Registrar Novo Treinamento</Button>
                </div>

                {treinamentosGlobais.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '50px', backgroundColor: 'white', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
                    <GraduationCap size={48} color="#cbd5e1" style={{ margin: '0 auto 15px' }} />
                    <p style={{ color: '#64748b' }}>Nenhum treinamento registrado na empresa.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {treinamentosGlobais.map(t => (
                      <div key={t.id} style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                          <div>
                            <strong style={{ fontSize: '18px', color: '#4c1d95', display: 'block' }}>{t.titulo}</strong>
                            <span style={{ fontSize: '13px', color: '#64748b' }}>Ministrado por: {t.instrutor} | Carga: {t.cargaHoraria}h | Data: {new Date(`${t.data}T12:00:00`).toLocaleDateString('pt-BR')}</span>
                          </div>
                          <span style={{ backgroundColor: '#f3e8ff', color: '#7c3aed', padding: '6px 12px', borderRadius: '50px', fontSize: '12px', fontWeight: 'bold' }}>
                            {t.participantes?.length || 0} Participantes
                          </span>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', borderTop: '1px solid #f1f5f9', paddingTop: '15px' }}>
                          {t.participantes?.map((p:any, idx:number) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#1e293b' }}>{p.nome.split(' ')[0]}</span>
                              <button onClick={() => gerarCertificadoPDF(t, p, false)} style={{ background: 'none', border: 'none', color: '#8b5cf6', cursor: 'pointer' }} title="Baixar"><Award size={16}/></button>
                              <button onClick={() => gerarCertificadoPDF(t, p, true)} style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer' }} title="WhatsApp"><Send size={16}/></button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* VIEW 1: DADOS E PARTICIPANTES */}
            {tStep === 1 && (
              <div style={{ maxWidth: '700px', margin: '0 auto', backgroundColor: 'white', padding: '30px', borderRadius: '20px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: '0 0 20px 0', fontSize: '20px', color: '#1e293b', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px' }}>Passo 1: Dados do Treinamento</h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '30px' }}>
                  <Input label="Título / Tema *" placeholder="Ex: NR-35 Trabalho em Altura" value={tTitulo} onChange={e => setTTitulo(e.target.value)} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    <Input label="Data *" type="date" value={tData} onChange={e => setTData(e.target.value)} />
                    <Input label="Carga Horária *" type="number" value={tCargaHoraria} onChange={e => setTCargaHoraria(e.target.value)} />
                  </div>
                  <Input label="Nome do Instrutor *" placeholder="Ex: João Engenheiro" value={tInstrutor} onChange={e => setTInstrutor(e.target.value)} />
                </div>

                <h4 style={{ fontSize: '14px', color: '#475569', marginBottom: '10px' }}>Selecione os Participantes ({tSelecionados.length})</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', maxHeight: '300px', overflowY: 'auto', padding: '10px', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                  {funcionarios.map(f => (
                    <label key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', backgroundColor: tSelecionados.includes(f.id) ? '#f3e8ff' : '#f8fafc', border: `1px solid ${tSelecionados.includes(f.id) ? '#c084fc' : '#e2e8f0'}`, borderRadius: '8px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={tSelecionados.includes(f.id)} onChange={() => toggleFuncTreino(f.id)} style={{ width: '18px', height: '18px' }} />
                      <span style={{ fontSize: '14px', fontWeight: tSelecionados.includes(f.id) ? 'bold' : 'normal' }}>{f.nome}</span>
                    </label>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '15px', marginTop: '30px' }}>
                  <Button onClick={() => setTStep(0)} style={{ flex: 1, backgroundColor: '#f1f5f9', color: '#475569' }}>Cancelar</Button>
                  <Button onClick={() => setTStep(2)} disabled={!tTitulo || !tData || !tInstrutor || tSelecionados.length === 0} style={{ flex: 2, backgroundColor: '#8b5cf6' }}>Avançar para Assinaturas</Button>
                </div>
              </div>
            )}

            {/* VIEW 2 e 3: CANVAS DE ASSINATURA (Obriga Rotação de Tela se celular) */}
            {(tStep === 2 || tStep === 3) && (
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'white', zIndex: 16000, display: 'flex', flexDirection: 'column' }}>
                {isPortrait ? (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e293b', color: 'white', padding: '20px', textAlign: 'center' }}>
                    <Smartphone size={70} style={{ marginBottom: '20px', transform: 'rotate(-90deg)', color: '#8b5cf6' }} />
                    <h2>Gire o Celular</h2>
                    <p style={{ color: '#cbd5e1', maxWidth: '300px' }}>Para coletar as assinaturas no formato perfeito para o certificado, coloque o aparelho na <strong>horizontal</strong>.</p>
                    <Button onClick={() => setTStep(1)} style={{ backgroundColor: '#475569', marginTop: '20px' }}>Voltar</Button>
                  </div>
                ) : (
                  <>
                    <div style={{ padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <div>
                        <h2 style={{ fontSize: '18px', margin: 0, color: '#1e293b' }}>
                          {tStep === 2 ? `Assinatura do Instrutor: ${tInstrutor}` : `Assinatura do Aluno: ${funcionarios.find(f => f.id === tSelecionados[tCurrentFuncIndex])?.nome}`}
                        </h2>
                        {tStep === 3 && <span style={{ fontSize: '12px', color: '#8b5cf6', fontWeight: 'bold' }}>Coletando: {tCurrentFuncIndex + 1} de {tSelecionados.length}</span>}
                      </div>
                      <button onClick={() => setTStep(1)} style={{ background: '#e2e8f0', border: 'none', borderRadius: '50%', padding: '8px' }}><X/></button>
                    </div>

                    <div style={{ flex: 1, position: 'relative', touchAction: 'none' }}>
                      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', cursor: 'crosshair', display: 'block' }} />
                      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', opacity: 0.1, textAlign: 'center' }}>
                        <PenTool size={60} style={{ margin: '0 auto' }} />
                        <p style={{ fontSize: '18px', fontWeight: 'bold' }}>Assine Aqui</p>
                      </div>
                    </div>

                    <div style={{ padding: '15px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '15px', backgroundColor: '#f8fafc' }}>
                      <Button onClick={limparCanvas} style={{ flex: 1, backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}>Limpar</Button>
                      <Button onClick={confirmarAssinaturaTreino} style={{ flex: 2, backgroundColor: '#10b981', fontWeight: 'bold' }}>
                        {tStep === 3 && tCurrentFuncIndex + 1 === tSelecionados.length ? 'Finalizar Treinamento' : 'Confirmar e Avançar'}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}