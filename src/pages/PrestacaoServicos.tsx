// src/pages/PrestacaoServicos.tsx
import { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { collection, onSnapshot, query, where, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoCarvalho from '../assets/LogoLimpa.webp';

import { 
  Paintbrush, CheckCircle2, AlertCircle, 
  TrainFront, ClipboardSignature, PenTool, FileDown,
  X, Briefcase, FileText, Plus, Trash2, Clock, Check, Smartphone,
  Edit, ArrowRight, Printer
} from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

interface Truque {
  id: string;
  identificacao: string;
  colaboradorJateouId: string;
  colaboradorJateouNome: string;
  status: 'pronto_jateamento' | 'analisado_pm' | 'pintado';
  dataCadastro: any;
  dataPM?: any;
  dataPintura?: any;
}

interface ItemOS {
  quantidade: number;
  descricao: string;
  serial: string;
}

export default function PrestacaoServicos() {
  const { setorAtivo } = useOutletContext<{ setorAtivo: string }>();

  // 1. Estados Gerais
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [abaAtiva, setAbaAtiva] = useState<'truques' | 'os'>('truques');
  const [notificacao, setNotificacao] = useState<{msg: string, tipo: 'sucesso' | 'erro'} | null>(null);

  // 2. Estados - Aba Truques
  const [truques, setTruques] = useState<Truque[]>([]);
  const [truqueId, setTruqueId] = useState('');
  const [colaboradorJateouId, setColaboradorJateouId] = useState('');
  const [jaPintado, setJaPintado] = useState(false);

  // 3. Estados - Aba OS
  const [historicoOS, setHistoricoOS] = useState<any[]>([]);
  const [tipoEscopo, setTipoEscopo] = useState('Peças Avulsas / Componentes');
  const [itensOS, setItensOS] = useState<ItemOS[]>([{ quantidade: 1, descricao: '', serial: '' }]);
  const [descricaoServicoOS, setDescricaoServicoOS] = useState('');
  
  // 4. Estados - Edição e Assinatura
  const [osEditando, setOsEditando] = useState<any>(null);
  const [osAberta, setOsAberta] = useState<any>(null);
  const [modalAssinatura, setModalAssinatura] = useState<'fechado' | 'prestador' | 'cliente'>('fechado');
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const desenhandoRef = useRef(false);

  const avisar = (msg: string, tipo: 'sucesso' | 'erro' = 'sucesso') => {
    setNotificacao({ msg, tipo });
    setTimeout(() => setNotificacao(null), 4000);
  };

  useEffect(() => {
    const handleResize = () => setIsPortrait(window.innerHeight > window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (osAberta) {
      const osAtualizada = historicoOS.find(os => os.id === osAberta.id);
      if (osAtualizada) setOsAberta(osAtualizada);
    }
  }, [historicoOS]);

  // BUSCA DE DADOS (FIREBASE)
  useEffect(() => {
    if (!setorAtivo) return;

    const qFunc = query(collection(db, 'funcionarios'), where('setorId', '==', setorAtivo));
    const unsubFunc = onSnapshot(qFunc, (snap) => setFuncionarios(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    const qTruques = query(collection(db, 'truques_producao'), where('setorId', '==', setorAtivo));
    const unsubTruques = onSnapshot(qTruques, (snap) => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() } as Truque));
      lista.sort((a, b) => (b.dataCadastro?.toMillis() || 0) - (a.dataCadastro?.toMillis() || 0));
      setTruques(lista);
    });

    const qOS = query(collection(db, 'ordens_servico'), where('setorId', '==', setorAtivo));
    const unsubOS = onSnapshot(qOS, (snap) => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      lista.sort((a, b) => (b.dataEmissao?.toMillis() || 0) - (a.dataEmissao?.toMillis() || 0));
      setHistoricoOS(lista);
    });

    return () => { unsubFunc(); unsubTruques(); unsubOS(); };
  }, [setorAtivo]);

  // ==========================================
  // FUNÇÕES - TRUQUES E PRODUÇÃO
  // ==========================================
  const registrarTruque = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!truqueId) return avisar("Preencha o Código da Plaquinha.", "erro");
    
    // ✨ Validação Estrita do Código da Placa (M + 3 números)
    const idFormatado = truqueId.trim().toUpperCase();
    if (!/^M\d{3}$/.test(idFormatado)) {
      return avisar("A plaquinha deve começar com 'M' seguido de 3 números. Ex: M001, M045...", "erro");
    }

    if (!jaPintado && !colaboradorJateouId) {
      return avisar("Selecione o colaborador que realizará a preparação/jateamento.", "erro");
    }

    try {
      const funcNome = colaboradorJateouId 
        ? funcionarios.find(f => f.id === colaboradorJateouId)?.nome || 'Desconhecido'
        : 'Não Informado (Histórico)';
      
      await addDoc(collection(db, 'truques_producao'), {
        setorId: setorAtivo, 
        identificacao: idFormatado, 
        colaboradorJateouId: colaboradorJateouId || 'historico', 
        colaboradorJateouNome: funcNome,
        status: jaPintado ? 'pintado' : 'pronto_jateamento', 
        dataCadastro: serverTimestamp(),
        ...(jaPintado ? { dataPintura: serverTimestamp(), dataPM: serverTimestamp() } : {})
      });

      avisar(jaPintado ? "Truque registrado diretamente no Galpão (Pintado)!" : "Truque na fila de Lavagem e Jateamento.");
      
      setTruqueId(''); 
      setColaboradorJateouId('');
      setJaPintado(false);
    } catch (error) { 
      avisar("Erro ao registrar truque.", "erro"); 
    }
  };

  // Movimenta de "Jateamento" para "Ensaio PM (Pronto para Pintar)"
  const avancarParaPM = async (id: string) => {
    try {
      await updateDoc(doc(db, 'truques_producao', id), { status: 'analisado_pm', dataPM: serverTimestamp() });
      avisar("Ensaio PM concluído! Peça liberada para Pintura.");
    } catch (error) { avisar("Erro ao avançar etapa.", "erro"); }
  };

  // Movimenta de "Ensaio PM" para "Pintado (Galpão)"
  const marcarComoPintado = async (id: string) => {
    try {
      await updateDoc(doc(db, 'truques_producao', id), { status: 'pintado', dataPintura: serverTimestamp() });
      avisar("Pintura Concluída! Peça enviada ao Galpão.");
    } catch (error) { avisar("Erro ao atualizar.", "erro"); }
  };

  // 📄 GERADOR DE RELATÓRIO PDF DE PRODUÇÃO DOS TRUQUES
  const gerarRelatorioTruques = () => {
    const docPdf = new jsPDF('p', 'mm', 'a4');
    const azulEscuro = [30, 41, 59];
    const dataAtual = new Date().toLocaleDateString('pt-BR');

    try { docPdf.addImage(logoCarvalho, 'WEBP', 15, 10, 40, 14); } catch(e){}
    docPdf.setFont("helvetica", "bold"); docPdf.setFontSize(16); docPdf.setTextColor(...azulEscuro);
    docPdf.text("RELATÓRIO DE PRODUÇÃO - TRUQUES", 105, 18, { align: 'center' });
    docPdf.setFontSize(10); docPdf.setTextColor(100, 100, 100);
    docPdf.text(`Emissão: ${dataAtual}`, 195, 20, { align: 'right' });
    docPdf.setLineWidth(0.5); docPdf.line(15, 26, 195, 26);

    // Resumo
    docPdf.setFontSize(11); docPdf.setTextColor(0, 0, 0); docPdf.setFont("helvetica", "bold");
    docPdf.text("RESUMO DO PÁTIO / GALPÃO", 15, 35);
    
    docPdf.setFontSize(10); docPdf.setFont("helvetica", "normal");
    docPdf.text(`1. Lavagem e Jateamento (Preparação): ${truquesAguardandoJateamento.length} peça(s)`, 15, 42);
    docPdf.text(`2. Ensaio PM Finalizado (Prontos p/ Pintar): ${truquesAguardandoPintura.length} peça(s)`, 15, 48);
    docPdf.text(`3. Pintura Concluída (Prontos p/ Montagem): ${truquesConcluidos.length} peça(s)`, 15, 54);

    // Tabela Detalhada
    const renderTable = typeof autoTable === 'function' ? autoTable : (autoTable as any).default;
    
    // Junta todos os truques para a tabela, ordenando pelos que precisam de atenção primeiro
    const todosTruquesTabela = [
      ...truquesAguardandoJateamento.map(t => [t.identificacao, 'Lavagem / Jateamento', t.colaboradorJateouNome]),
      ...truquesAguardandoPintura.map(t => [t.identificacao, 'Aguardando Pintura', t.colaboradorJateouNome]),
      ...truquesConcluidos.map(t => [t.identificacao, 'Concluído (Galpão)', t.colaboradorJateouNome])
    ];

    docPdf.setFontSize(11); docPdf.setFont("helvetica", "bold");
    docPdf.text("LISTAGEM DETALHADA DAS PEÇAS", 15, 70);

    renderTable(docPdf, {
      startY: 75,
      head: [["PLAQUETA", "STATUS ATUAL DA PEÇA", "COLABORADOR (JATEAMENTO)"]],
      body: todosTruquesTabela,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], halign: 'center' },
      columnStyles: { 0: { halign: 'center', fontStyle: 'bold' }, 1: { halign: 'center' }, 2: { halign: 'center' } },
      styles: { fontSize: 9, cellPadding: 4 }
    });

    docPdf.save(`Relatorio_Producao_Truques_${dataAtual.replace(/\//g, '-')}.pdf`);
  };

  // Separação dos Truques para o Kanban
  const truquesAguardandoJateamento = truques.filter(t => t.status === 'pronto_jateamento');
  const truquesAguardandoPintura = truques.filter(t => t.status === 'analisado_pm');
  const truquesConcluidos = truques.filter(t => t.status === 'pintado');

  // ==========================================
  // FUNÇÕES - OS DINÂMICA (CARRINHO E ESCOPO)
  // ==========================================
  const adicionarItemOS = () => setItensOS([...itensOS, { quantidade: 1, descricao: '', serial: '' }]);
  const removerItemOS = (index: number) => setItensOS(itensOS.filter((_, i) => i !== index));
  const atualizarItemOS = (index: number, campo: keyof ItemOS, valor: any) => {
    const novos = [...itensOS];
    novos[index] = { ...novos[index], [campo]: valor };
    setItensOS(novos);
  };

  const iniciarEdicaoOS = (os: any) => {
    setOsEditando(os);
    setTipoEscopo(os.tipoEscopo || 'Peças Avulsas / Componentes');
    setItensOS(os.itens || [{ quantidade: 1, descricao: '', serial: '' }]);
    setDescricaoServicoOS(os.descricaoServico || '');
    setOsAberta(null); 
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
  };

  const cancelarEdicaoOS = () => {
    setOsEditando(null);
    setTipoEscopo('Peças Avulsas / Componentes');
    setItensOS([{ quantidade: 1, descricao: '', serial: '' }]);
    setDescricaoServicoOS('');
  };

  const registrarESalvarOS = async (e: React.FormEvent) => {
    e.preventDefault();
    if (itensOS.length === 0 || itensOS.some(i => !i.descricao)) return avisar("Preencha a descrição das peças no carrinho.", "erro");

    try {
      if (osEditando) {
        await updateDoc(doc(db, 'ordens_servico', osEditando.id), {
          tipoEscopo,
          itens: itensOS,
          descricaoServico: descricaoServicoOS
        });
        avisar("Ordem de Serviço atualizada com sucesso!");
        cancelarEdicaoOS();
      } else {
        await addDoc(collection(db, 'ordens_servico'), {
          setorId: setorAtivo,
          tipoEscopo,
          itens: itensOS,
          descricaoServico: descricaoServicoOS,
          assinaturaPrestador: '',
          assinaturaCliente: '',
          status: 'Aguardando Assinaturas',
          dataEmissao: serverTimestamp()
        });
        avisar("OS salva no banco! Aguardando coleta de assinaturas.");
        cancelarEdicaoOS();
      }
    } catch (e) { avisar("Erro ao salvar a OS.", "erro"); }
  };

  // ==========================================
  // FUNÇÕES - ASSINATURA CANVAS
  // ==========================================
  useEffect(() => {
    if (modalAssinatura === 'fechado' || !canvasRef.current || isPortrait) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    setTimeout(() => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
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
  }, [modalAssinatura, isPortrait]);

  const limparCanvas = () => {
    const canvas = canvasRef.current; const ctx = canvas?.getContext('2d');
    if (ctx && canvas) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); desenhandoRef.current = false; }
  };

  const salvarAssinaturaNaOS = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !osAberta) return;
    
    const base64 = canvas.toDataURL('image/jpeg', 0.6);
    
    try {
      const atualizacoes: any = {};
      if (modalAssinatura === 'prestador') atualizacoes.assinaturaPrestador = base64;
      if (modalAssinatura === 'cliente') atualizacoes.assinaturaCliente = base64;

      const presFinal = modalAssinatura === 'prestador' ? base64 : osAberta.assinaturaPrestador;
      const cliFinal = modalAssinatura === 'cliente' ? base64 : osAberta.assinaturaCliente;

      if (presFinal && cliFinal) atualizacoes.status = 'Concluída';

      await updateDoc(doc(db, 'ordens_servico', osAberta.id), atualizacoes);
      avisar("Assinatura anexada à OS com sucesso!");
      setModalAssinatura('fechado');
    } catch(e) { avisar("Erro ao salvar assinatura", "erro"); }
  };

  const imprimirPDF = () => {
    if (!osAberta) return;
    const docPdf = new jsPDF('p', 'mm', 'a4');
    
    // FUNÇÃO INTERNA PARA GERAR CADA VIA DA OS
    const gerarViaOS = (tituloVia: string) => {
      const azulEscuro = [30, 41, 59];
      const dataDoc = osAberta.dataEmissao?.toDate ? osAberta.dataEmissao.toDate().toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR');
      const numeroOS = osAberta.id ? osAberta.id.slice(-6).toUpperCase() : "NOVA";

      try { docPdf.addImage(logoCarvalho, 'WEBP', 15, 10, 40, 14); } catch(e){}
      docPdf.setFont("helvetica", "bold"); docPdf.setFontSize(16); docPdf.setTextColor(...azulEscuro);
      docPdf.text("ORDEM DE SERVIÇO", 105, 18, { align: 'center' });
      docPdf.setFontSize(10); docPdf.setTextColor(100, 100, 100);
      docPdf.text(tituloVia, 195, 15, { align: 'right' });
      docPdf.text(`OS Nº: ${numeroOS} | Data: ${dataDoc}`, 195, 20, { align: 'right' });
      docPdf.setLineWidth(0.5); docPdf.line(15, 26, 195, 26);

      docPdf.setFillColor(241, 245, 249); docPdf.rect(15, 30, 80, 25, "F");
      docPdf.setFontSize(9); docPdf.setTextColor(0, 0, 0);
      docPdf.setFont("helvetica", "bold"); docPdf.text("PRESTADOR", 18, 35);
      docPdf.setFont("helvetica", "normal"); docPdf.text("CARVALHO FUNILARIA E PINTURAS LTDA\nCNPJ: 31.362.302/0001-33", 18, 41);

      docPdf.setFillColor(241, 245, 249); docPdf.rect(115, 30, 80, 25, "F");
      docPdf.setFont("helvetica", "bold"); docPdf.text("CLIENTE", 118, 35);
      docPdf.setFont("helvetica", "normal"); 
      const infoCliente = docPdf.splitTextToSize("Hyundai Rotem Brasil Industria e Comercio de Trens Ltda.\nCNPJ: 17.866.875/0004-16", 74);
      docPdf.text(infoCliente, 118, 41);

      docPdf.setFont("helvetica", "bold"); docPdf.setFontSize(11);
      docPdf.text(`ESCOPO DA O.S.: ${osAberta.tipoEscopo.toUpperCase()}`, 15, 65);
      
      const renderTable = typeof autoTable === 'function' ? autoTable : (autoTable as any).default;
      renderTable(docPdf, {
        startY: 70,
        head: [["QTD", "DESCRIÇÃO DA PEÇA / SERVIÇO", "SERIAL / CÓDIGO"]],
        body: osAberta.itens.map((i: any) => [`${i.quantidade} un`, i.descricao, i.serial || 'S/ Registro']),
        theme: 'grid',
        headStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0], halign: 'center' },
        columnStyles: { 0: { halign: 'center', cellWidth: 20 }, 2: { halign: 'center', cellWidth: 50 } },
        styles: { fontSize: 9, cellPadding: 4 }
      });

      const finalY = (docPdf as any).lastAutoTable.finalY + 10;

      docPdf.setFont("helvetica", "bold"); docPdf.setFontSize(11);
      docPdf.text("OBSERVAÇÕES E ATIVIDADES ADICIONAIS", 15, finalY);
      docPdf.setFont("helvetica", "normal"); docPdf.setFontSize(10);
      const splitDesc = docPdf.splitTextToSize(osAberta.descricaoServico || 'Executado conforme as peças e quantidades detalhadas acima.', 180);
      docPdf.text(splitDesc, 15, finalY + 7);

      const yAssinatura = Math.max(finalY + 30, 240);
      docPdf.setDrawColor(0,0,0); docPdf.setLineWidth(0.5);

      if (osAberta.assinaturaPrestador) { try { docPdf.addImage(osAberta.assinaturaPrestador, 'JPEG', 30, yAssinatura - 25, 40, 20); } catch(e){} }
      docPdf.line(20, yAssinatura, 80, yAssinatura);
      docPdf.setFontSize(10); docPdf.setFont("helvetica", "bold");
      docPdf.text("Carvalho Funilaria e Pinturas", 50, yAssinatura + 5, { align: 'center' });
      docPdf.setFont("helvetica", "normal"); docPdf.text("Prestador do Serviço", 50, yAssinatura + 10, { align: 'center' });

      if (osAberta.assinaturaCliente) { try { docPdf.addImage(osAberta.assinaturaCliente, 'JPEG', 130, yAssinatura - 25, 40, 20); } catch(e){} }
      docPdf.line(120, yAssinatura, 180, yAssinatura);
      docPdf.setFontSize(10); docPdf.setFont("helvetica", "bold");
      docPdf.text("Hyundai Rotem Brasil", 150, yAssinatura + 5, { align: 'center' });
      docPdf.setFont("helvetica", "normal"); docPdf.text("De Acordo / Recebedor", 150, yAssinatura + 10, { align: 'center' });
    };

    gerarViaOS("1ª VIA - CLIENTE");
    docPdf.addPage();
    gerarViaOS("2ª VIA - CONTROLE INTERNO");
    docPdf.save(`OS_Carvalho_${osAberta.id.slice(-6).toUpperCase()}.pdf`);
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '15px', paddingBottom: '80px' }}>
      
      {notificacao && (
        <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 12000, backgroundColor: notificacao.tipo === 'sucesso' ? '#10b981' : '#ef4444', color: 'white', padding: '12px 24px', borderRadius: '50px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold' }}>
          {notificacao.tipo === 'sucesso' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />} {notificacao.msg}
        </div>
      )}

      {/* CABEÇALHO E TABS */}
      <div style={{ marginBottom: '25px' }}>
        <h1 style={{ fontSize: '24px', color: '#1e293b', margin: '0 0 5px 0', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Briefcase color="var(--cor-primaria)" /> Operação e Serviços
        </h1>
        <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Gerencie a linha de truques e crie Ordens de Serviço completas para a Hyundai.</p>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', flexWrap: 'wrap' }}>
        <Button onClick={() => setAbaAtiva('truques')} style={{ flex: 1, backgroundColor: abaAtiva === 'truques' ? '#3b82f6' : '#e2e8f0', color: abaAtiva === 'truques' ? 'white' : '#475569', height: '50px', display: 'flex', gap: '8px' }}>
          <TrainFront size={18}/>Truques (Kanban de Produção)
        </Button>
        <Button onClick={() => setAbaAtiva('os')} style={{ flex: 1, backgroundColor: abaAtiva === 'os' ? '#8b5cf6' : '#e2e8f0', color: abaAtiva === 'os' ? 'white' : '#475569', height: '50px', display: 'flex', gap: '8px' }}>
          <ClipboardSignature size={18}/> OS Hyundai Rotem
        </Button>
      </div>

      {/* ========================================================
          ABA 1: CONTROLE DE TRUQUES (COM PM E GERADOR DE PDF)
          ======================================================== */}
      {abaAtiva === 'truques' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', height: 'fit-content' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, color: '#1e293b', fontWeight: 'bold' }}>
                <TrainFront size={18} color="#3b82f6" /> Lançar Truque na Linha
              </h3>
            </div>
            
            <form onSubmit={registrarTruque} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              
              <Input label="Código da Plaquinha (Obrigatório 'M' e 3 números) *" placeholder="Ex: M001" value={truqueId} onChange={e => setTruqueId(e.target.value)} />
              
              <div>
                <label style={{ fontSize: '13px', color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>
                  Colaborador (Lavagem / Jateamento) {jaPintado ? <span style={{color: '#94a3b8', fontWeight: 'normal'}}>(Opcional)</span> : '*'}
                </label>
                <select value={colaboradorJateouId} onChange={e => setColaboradorJateouId(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', outline: 'none' }}>
                  <option value="">{jaPintado ? 'Nenhum / Não informado...' : 'Selecione...'}</option>
                  {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#1e293b', fontWeight: 'bold', cursor: 'pointer', backgroundColor: jaPintado ? '#dcfce7' : '#f8fafc', padding: '12px', borderRadius: '8px', border: `1px solid ${jaPintado ? '#86efac' : '#e2e8f0'}`, transition: 'all 0.2s' }}>
                <input type="checkbox" checked={jaPintado} onChange={e => setJaPintado(e.target.checked)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                O truque já está finalizado e pintado (Lançar direto no Galpão)
              </label>

              <Button type="submit" style={{ height: '50px', fontSize: '14px', fontWeight: 'bold', marginTop: '10px', backgroundColor: jaPintado ? '#10b981' : 'var(--cor-primaria)' }}>
                {jaPintado ? 'Registrar Truque Concluído' : 'Iniciar Preparação'}
              </Button>

              <div style={{ marginTop: '15px', borderTop: '2px dashed #e2e8f0', paddingTop: '15px' }}>
                <Button type="button" onClick={gerarRelatorioTruques} style={{ width: '100%', backgroundColor: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Printer size={16} /> Baixar Relatório de Produção (PDF)
                </Button>
              </div>
            </form>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* ETAPA 1: PREPARAÇÃO */}
            <div style={{ backgroundColor: '#f1f5f9', padding: '20px', borderRadius: '16px', border: '1px solid #cbd5e1' }}>
              <h4 style={{ margin: '0 0 15px 0', color: '#334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>1. Lavagem e Jateamento</span><span style={{ backgroundColor: '#cbd5e1', padding: '2px 8px', borderRadius: '50px', fontSize: '12px', color: '#0f172a' }}>{truquesAguardandoJateamento.length}</span>
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto' }}>
                {truquesAguardandoJateamento.map(t => (
                  <div key={t.id} style={{ backgroundColor: 'white', padding: '15px', borderRadius: '12px', border: '1px solid #94a3b8', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                    <div><strong style={{ display: 'block', color: '#1e293b', fontSize: '15px' }}>{t.identificacao}</strong><span style={{ fontSize: '11px', color: '#64748b' }}>Jateado por: {t.colaboradorJateouNome}</span></div>
                    <Button onClick={() => avancarParaPM(t.id)} style={{ backgroundColor: '#f59e0b', padding: '8px 12px', fontSize: '11px', display: 'flex', gap: '4px' }}>Avançar p/ PM <ArrowRight size={14}/></Button>
                  </div>
                ))}
              </div>
            </div>

            {/* ETAPA 2: ENSAIO PM */}
            <div style={{ backgroundColor: '#fffbeb', padding: '20px', borderRadius: '16px', border: '1px solid #fde68a' }}>
              <h4 style={{ margin: '0 0 15px 0', color: '#b45309', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>2. Analisados c/ PM (Pronto p/ Pintar)</span><span style={{ backgroundColor: '#fef08a', padding: '2px 8px', borderRadius: '50px', fontSize: '12px' }}>{truquesAguardandoPintura.length}</span>
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto' }}>
                {truquesAguardandoPintura.map(t => (
                  <div key={t.id} style={{ backgroundColor: 'white', padding: '15px', borderRadius: '12px', border: '1px solid #fde047', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                    <div><strong style={{ display: 'block', color: '#713f12', fontSize: '15px' }}>{t.identificacao}</strong></div>
                    <Button onClick={() => marcarComoPintado(t.id)} style={{ backgroundColor: '#10b981', padding: '8px 12px', fontSize: '11px', display: 'flex', gap: '4px' }}>Concluir Pintura <Check size={14}/></Button>
                  </div>
                ))}
              </div>
            </div>

            {/* ETAPA 3: GALPÃO (CONCLUÍDO) */}
            <div style={{ backgroundColor: '#f0fdf4', padding: '20px', borderRadius: '16px', border: '1px solid #bbf7d0' }}>
              <h4 style={{ margin: '0 0 15px 0', color: '#166534', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>3. Pintura Concluída (Galpão)</span><span style={{ backgroundColor: '#bbf7d0', padding: '2px 8px', borderRadius: '50px', fontSize: '12px' }}>{truquesConcluidos.length}</span>
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                {truquesConcluidos.map(t => (
                  <div key={t.id} style={{ backgroundColor: 'white', padding: '10px 15px', borderRadius: '8px', border: '1px solid #86efac', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '14px', color: '#14532d', fontWeight: 'bold' }}>{t.identificacao}</span>
                    <span style={{ fontSize: '11px', color: '#166534' }}>{t.dataPintura?.toDate().toLocaleDateString('pt-BR')}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================
          ABA 2: ORDEM DE SERVIÇO (OTIMIZADO PARA MOBILE)
          ======================================================== */}
      {abaAtiva === 'os' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          
          {/* CRIAÇÃO DA OS / EDIÇÃO */}
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', borderTop: osEditando ? '4px solid #3b82f6' : '4px solid #8b5cf6', height: 'fit-content', transition: 'all 0.3s' }}>
            <h3 style={{ fontSize: '16px', margin: '0 0 20px 0', color: '#1e293b', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={18} color={osEditando ? "#3b82f6" : "#8b5cf6"} /> 
              {osEditando ? `Editando OS Nº ${osEditando.id.slice(-6).toUpperCase()}` : 'Elaborar Nova Ordem de Serviço'}
            </h3>

            {/* Cabeçalho Fixo (Mobile-friendly) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              <div style={{ backgroundColor: '#f1f5f9', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold' }}>PRESTADOR</span>
                <strong style={{ display: 'block', fontSize: '12px', color: '#0f172a' }}>CARVALHO FUNILARIA LTDA</strong>
              </div>
              <div style={{ backgroundColor: '#f1f5f9', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold' }}>CLIENTE</span>
                <strong style={{ display: 'block', fontSize: '11px', color: '#0f172a', lineHeight: '1.2' }}>Hyundai Rotem Brasil Ltda.</strong>
              </div>
            </div>

            <form onSubmit={registrarESalvarOS} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              
              {/* ESCOPO GERAL */}
              <div>
                <label style={{ fontSize: '13px', color: '#475569', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Tipo de Serviço / Escopo *</label>
                <select value={tipoEscopo} onChange={e => setTipoEscopo(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}>
                  <option value="Trem Inteiro">Trem Inteiro</option>
                  <option value="Carro Específico">Carro Específico</option>
                  <option value="Peças Avulsas / Componentes">Peças Avulsas / Componentes</option>
                </select>
              </div>

              {/* LISTA DE PEÇAS / CARRINHO RESPONSIVO */}
              <div style={{ borderTop: '2px dashed #e2e8f0', paddingTop: '15px', marginTop: '5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <label style={{ fontSize: '13px', color: '#475569', fontWeight: 'bold' }}>Lista de Peças</label>
                  <button onClick={adicionarItemOS} type="button" style={{ display: 'flex', alignItems: 'center', gap: '5px', backgroundColor: '#e0e7ff', color: '#4f46e5', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                    <Plus size={14}/> Add Linha
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', backgroundColor: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  {itensOS.map((item, index) => (
                    <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '15px', borderBottom: index < itensOS.length - 1 ? '1px dashed #cbd5e1' : 'none' }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <div style={{ width: '70px' }}>
                           <Input label={index === 0 ? "Qtd" : ""} type="number" value={item.quantidade} onChange={e => atualizarItemOS(index, 'quantidade', Number(e.target.value))} required />
                        </div>
                        <div style={{ flex: 1 }}>
                           <Input label={index === 0 ? "Peça / Serviço" : ""} placeholder="Ex: Motor" value={item.descricao} onChange={e => atualizarItemOS(index, 'descricao', e.target.value)} required />
                        </div>
                        <button type="button" onClick={() => removerItemOS(index)} disabled={itensOS.length === 1} style={{ background: 'none', border: 'none', color: itensOS.length === 1 ? '#cbd5e1' : '#ef4444', cursor: itensOS.length === 1 ? 'not-allowed' : 'pointer', marginTop: index === 0 ? '20px' : '0' }}>
                          <Trash2 size={20}/>
                        </button>
                      </div>
                      <div style={{ width: '100%' }}>
                         <Input label="" placeholder="Serial / Plaquinha (Opcional)" value={item.serial} onChange={e => atualizarItemOS(index, 'serial', e.target.value)} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '13px', color: '#475569', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Observações Adicionais (Opcional)</label>
                <textarea rows={3} value={descricaoServicoOS} onChange={e => setDescricaoServicoOS(e.target.value)} placeholder="Detalhes técnicos, tintas usadas, etc..." style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', resize: 'vertical' }} />
              </div>

              {/* Botões Dinâmicos (Criar vs Editar) */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                {osEditando && (
                  <Button type="button" onClick={cancelarEdicaoOS} style={{ flex: 1, height: '55px', backgroundColor: '#e2e8f0', color: '#475569', fontSize: '14px', fontWeight: 'bold' }}>
                    Cancelar Edição
                  </Button>
                )}
                <Button type="submit" style={{ flex: 2, height: '55px', backgroundColor: osEditando ? '#3b82f6' : '#8b5cf6', fontSize: '14px', fontWeight: 'bold' }}>
                  {osEditando ? 'Salvar Alterações na OS' : 'Salvar OS (Assinar Depois)'}
                </Button>
              </div>
            </form>
          </div>

          {/* HISTÓRICO DE OS (Gestão de Assinaturas e PDFs) */}
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', height: 'fit-content' }}>
             <h3 style={{ fontSize: '16px', margin: '0 0 15px 0', color: '#1e293b', fontWeight: 'bold' }}>Emissões e Assinaturas Pendentes</h3>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '600px', overflowY: 'auto' }}>
                {historicoOS.length === 0 ? (
                  <p style={{ fontSize: '13px', color: '#94a3b8', textAlign: 'center', padding: '20px' }}>Nenhuma OS gerada nesta unidade.</p>
                ) : (
                  historicoOS.map(os => (
                    <div key={os.id} onClick={() => setOsAberta(os)} style={{ backgroundColor: os.status === 'Concluída' ? '#f0fdf4' : '#fffbeb', padding: '15px', borderRadius: '12px', border: `1px solid ${os.status === 'Concluída' ? '#bbf7d0' : '#fde68a'}`, cursor: 'pointer' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <strong style={{ fontSize: '14px', color: '#1e293b' }}>OS Nº {os.id.slice(-6).toUpperCase()}</strong>
                        <span style={{ fontSize: '10px', fontWeight: 'bold', padding: '4px 8px', borderRadius: '50px', backgroundColor: os.status === 'Concluída' ? '#dcfce7' : '#fef08a', color: os.status === 'Concluída' ? '#166534' : '#b45309', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {os.status === 'Concluída' ? <Check size={12}/> : <Clock size={12}/>} {os.status}
                        </span>
                      </div>
                      <span style={{ fontSize: '12px', color: '#64748b', display: 'block' }}>{os.tipoEscopo} • {os.itens?.length || 0} peças cadastradas</span>
                    </div>
                  ))
                )}
             </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL DE VISUALIZAÇÃO E ASSINATURA DE OS ABERTA
          ======================================================== */}
      {osAberta && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.9)', zIndex: 15000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '15px' }}>
          <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '600px', borderRadius: '24px', padding: '25px', maxHeight: '95vh', overflowY: 'auto' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '20px' }}>OS Nº {osAberta.id.slice(-6).toUpperCase()}</h2>
              <div style={{ display: 'flex', gap: '10px' }}>
                {osAberta.status !== 'Concluída' && (
                  <button onClick={() => iniciarEdicaoOS(osAberta)} style={{ background: '#e0e7ff', color: '#4f46e5', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer' }} title="Editar OS">
                    <Edit size={20}/>
                  </button>
                )}
                <button onClick={() => setOsAberta(null)} style={{ background: '#f1f5f9', color: '#64748b', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}>
                  <X size={20}/>
                </button>
              </div>
            </div>

            <div style={{ backgroundColor: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
              <h4 style={{ fontSize: '13px', margin: '0 0 10px 0', color: '#475569' }}>Escopo: {osAberta.tipoEscopo}</h4>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: '#1e293b' }}>
                {osAberta.itens?.map((i:any, idx:number) => (
                  <li key={idx} style={{ marginBottom: '6px' }}><strong>{i.quantidade}x</strong> {i.descricao} {i.serial ? <span style={{color: '#64748b'}}>(SN: {i.serial})</span> : ''}</li>
                ))}
              </ul>
            </div>

            <h4 style={{ fontSize: '14px', color: '#1e293b', marginBottom: '10px' }}>Assinaturas Presenciais</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              <Button onClick={() => setModalAssinatura('prestador')} style={{ height: '50px', backgroundColor: osAberta.assinaturaPrestador ? '#10b981' : 'white', color: osAberta.assinaturaPrestador ? 'white' : '#3b82f6', border: '2px solid #3b82f6' }}>
                {osAberta.assinaturaPrestador ? '✓ Prestador Assinou' : 'Assinar (Carvalho)'}
              </Button>
              <Button onClick={() => setModalAssinatura('cliente')} style={{ height: '50px', backgroundColor: osAberta.assinaturaCliente ? '#10b981' : 'white', color: osAberta.assinaturaCliente ? 'white' : '#8b5cf6', border: '2px solid #8b5cf6' }}>
                {osAberta.assinaturaCliente ? '✓ Cliente Assinou' : 'Assinar (Hyundai)'}
              </Button>
            </div>

            <div style={{ borderTop: '2px dashed #e2e8f0', paddingTop: '15px' }}>
              <Button onClick={imprimirPDF} disabled={osAberta.status !== 'Concluída'} style={{ width: '100%', height: '55px', fontSize: '14px', fontWeight: 'bold', backgroundColor: osAberta.status === 'Concluída' ? '#1e293b' : '#cbd5e1' }}>
                {osAberta.status === 'Concluída' ? 'GERAR PDF (2 VIAS)' : 'Faltam Assinaturas'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          CANVAS PARA ASSINATURA NA TELA (COM TRAVA DE ROTAÇÃO)
          ======================================================== */}
      {modalAssinatura !== 'fechado' && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.95)', zIndex: 20000, display: 'flex', flexDirection: 'column' }}>
           {isPortrait ? (
             <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e293b', color: 'white', padding: '20px', textAlign: 'center' }}>
               <Smartphone size={70} style={{ marginBottom: '20px', transform: 'rotate(-90deg)', color: '#8b5cf6' }} />
               <h2>Gire o Celular</h2>
               <p style={{ color: '#cbd5e1', maxWidth: '300px' }}>Para coletar a assinatura, coloque o aparelho na <strong>horizontal</strong>.</p>
               <Button onClick={() => setModalAssinatura('fechado')} style={{ backgroundColor: '#475569', marginTop: '20px' }}>Voltar</Button>
             </div>
           ) : (
             <>
               <div style={{ padding: '15px 20px', backgroundColor: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <h3 style={{ margin: 0, fontSize: '16px' }}>{modalAssinatura === 'prestador' ? 'Assinatura: Carvalho Funilaria' : 'Assinatura: Hyundai Rotem'}</h3>
                 <button onClick={() => setModalAssinatura('fechado')} style={{ background: 'none', border: 'none' }}><X/></button>
               </div>
               
               <div style={{ flex: 1, position: 'relative', touchAction: 'none' }}>
                 <canvas ref={canvasRef} style={{ width: '100%', height: '100%', backgroundColor: 'white', cursor: 'crosshair', display: 'block' }} />
                 <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', opacity: 0.1, textAlign: 'center' }}>
                   <PenTool size={60} style={{ margin: '0 auto' }} />
                   <p style={{ fontSize: '18px', fontWeight: 'bold' }}>Assine Aqui</p>
                 </div>
               </div>

               <div style={{ padding: '15px', backgroundColor: 'white', display: 'flex', gap: '10px' }}>
                 <Button onClick={limparCanvas} style={{ flex: 1, backgroundColor: '#f1f5f9', color: '#475569' }}>Limpar Fundo</Button>
                 <Button onClick={salvarAssinaturaNaOS} style={{ flex: 2, backgroundColor: '#10b981' }}>Salvar Assinatura e Voltar</Button>
               </div>
             </>
           )}
        </div>
      )}
    </div>
  );
}