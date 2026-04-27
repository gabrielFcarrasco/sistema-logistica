// src/pages/Entrega.tsx
import { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { 
  collection, onSnapshot, query, where, addDoc, doc, 
  updateDoc, getDoc, serverTimestamp, getDocs, orderBy, limit 
} from 'firebase/firestore';
import { db } from '../services/firebase';

import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { 
  Building2, ClipboardSignature, CheckCircle2, AlertCircle, 
  PenTool, Eraser, Plus, ShoppingCart, Trash2, Package, X, Check, 
  Timer, AlertTriangle, Shirt 
} from 'lucide-react';

interface ItemCarrinho {
  id: string;
  nome: string;
  quantidade: number;
  estoqueDisponivel?: number;
  durabilidade: number;
  justificativa?: string;
  isPendencia?: boolean;
  pendenciaId?: string;
}

const JUSTIFICATIVAS_PADRAO = [
  "Dano em serviço (Rasgou/Quebrou)",
  "Extravio / Perda",
  "Desgaste prematuro (Material ruim)",
  "Tamanho incorreto / Troca",
  "Roubo / Furto",
  "Defeito de fábrica"
];

export default function Entrega() {
  const { setorAtivo } = useOutletContext<{ setorAtivo: string }>();
  
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [estoque, setEstoque] = useState<any[]>([]);
  const [funcionarioSelecionado, setFuncionarioSelecionado] = useState('');
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  
  // Estados de Seleção e Vigia
  const [itemSelecionado, setItemSelecionado] = useState('');
  const [quantidadeDesejada, setQuantidadeDesejada] = useState('1');
  const [durabilidadeManual, setDurabilidadeManual] = useState('');
  const [pendenciasFuncionario, setPendenciasFuncionario] = useState<any[]>([]);

  // Estados de Justificativa
  const [itemPendenteJustificativa, setItemPendenteJustificativa] = useState<any>(null);
  const [justificativaSelecionada, setJustificativaSelecionada] = useState('');

  // Estados da Assinatura
  const [modalAssinaturaAberto, setModalAssinaturaAberto] = useState(false);
  const [assinaturaBase64, setAssinaturaBase64] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [estaDesenhando, setEstaDesenhando] = useState(false);

  const [notificacao, setNotificacao] = useState<{msg: string, tipo: 'sucesso' | 'erro'} | null>(null);
  const [salvando, setSalvando] = useState(false);

  const avisar = (msg: string, tipo: 'sucesso' | 'erro' = 'sucesso') => {
    setNotificacao({ msg, tipo });
    setTimeout(() => setNotificacao(null), 4000);
  };

  // 1. Carrega Funcionários e Estoque
  useEffect(() => {
    if (!setorAtivo) return;
    onSnapshot(query(collection(db, 'funcionarios'), where('setorId', '==', setorAtivo)), (snap) => setFuncionarios(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    onSnapshot(query(collection(db, 'estoque'), where('setorId', '==', setorAtivo)), (snap) => {
      setEstoque(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter((i: any) => i.quantidade > 0));
    });
  }, [setorAtivo]);

  // 2. Busca Pendências de Uniformes quando seleciona o funcionário
  useEffect(() => {
    if (!funcionarioSelecionado) {
      setPendenciasFuncionario([]);
      return;
    }
    const q = query(
      collection(db, 'entregas_pendentes'),
      where('funcionarioId', '==', funcionarioSelecionado),
      where('status', '==', 'aguardando_chegada')
    );
    const unsub = onSnapshot(q, (snap) => setPendenciasFuncionario(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, [funcionarioSelecionado]);

  // 3. Sugere durabilidade salva no estoque ao selecionar item
  useEffect(() => {
    if (itemSelecionado) {
      const item = estoque.find(i => i.id === itemSelecionado);
      setDurabilidadeManual(item?.durabilidadeSugerida?.toString() || '');
    }
  }, [itemSelecionado, estoque]);

  // 🪄 LÓGICA DO VIGIA: Conta 1 dia se passaram 7 horas (Turno de entrada)
  const calcularDiasDeUso = (dataAnterior: Date) => {
    const agora = new Date();
    const diffMs = agora.getTime() - dataAnterior.getTime();
    const diffHoras = diffMs / (1000 * 60 * 60);

    if (diffHoras < 7) return 0; // Ainda no mesmo turno
    return Math.ceil(diffHoras / 24);
  };

  const verificarEAdicionar = async () => {
    if (!funcionarioSelecionado || !itemSelecionado) return avisar("Selecione funcionário e material.", "erro");
    
    const itemData = estoque.find(i => i.id === itemSelecionado);
    const durabilidadeDesejada = Number(durabilidadeManual) || 0;

    // Busca última entrega deste item para este funcionário
    const q = query(
      collection(db, 'entregas'),
      where('funcionarioId', '==', funcionarioSelecionado),
      where('itemId', '==', itemSelecionado),
      orderBy('dataHora', 'desc'),
      limit(1)
    );

    const snap = await getDocs(q);
    if (!snap.empty) {
      const ultima = snap.docs[0].data();
      const dataUltima = ultima.dataHora.toDate();
      const diasUso = calcularDiasDeUso(dataUltima);
      const durabilidadePrevista = ultima.durabilidade || 0;

      if (diasUso < durabilidadePrevista) {
        setItemPendenteJustificativa({
          ...itemData, diasPassados: diasUso, durabilidadePrevista,
          quantidade: quantidadeDesejada, dur: durabilidadeDesejada,
          dataAnterior: dataUltima.toLocaleDateString('pt-BR'),
          horaAnterior: dataUltima.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        });
        return;
      }
    }
    adicionarAoCarrinho(itemData, durabilidadeDesejada);
  };

  const adicionarAoCarrinho = (itemData: any, dur: number, just?: string, isPendencia = false, pendId?: string) => {
    setCarrinho([...carrinho, { 
      id: itemData.id || `p-${Date.now()}`, 
      nome: itemData.nome || itemData.itemNome, 
      quantidade: Number(quantidadeDesejada) || 1, 
      durabilidade: dur,
      justificativa: just,
      isPendencia,
      pendenciaId: pendId
    }]);
    setItemSelecionado(''); setDurabilidadeManual(''); setQuantidadeDesejada('1');
    setItemPendenteJustificativa(null); setJustificativaSelecionada('');
  };

  const finalizarEntregaTotal = async () => {
    if (!assinaturaBase64 || carrinho.length === 0) return avisar("Faltam dados.", "erro");
    setSalvando(true);
    try {
      const horarioAgora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      
      for (const item of carrinho) {
        // Grava a entrega com o horário automático
        await addDoc(collection(db, 'entregas'), {
          setorId: setorAtivo,
          funcionarioId: funcionarioSelecionado,
          funcionarioNome: funcionarios.find(f => f.id === funcionarioSelecionado).nome,
          itemId: item.id,
          itemNome: item.nome,
          quantidade: item.quantidade,
          durabilidade: item.durabilidade,
          justificativa: item.justificativa || "Troca Normal",
          assinatura: assinaturaBase64,
          dataHora: serverTimestamp(),
          horarioEntrega: horarioAgora
        });

        if (item.isPendencia && item.pendenciaId) {
          await updateDoc(doc(db, 'entregas_pendentes', item.pendenciaId), { status: 'entregue', entregueEm: serverTimestamp() });
        } else {
          const itemRef = doc(db, 'estoque', item.id);
          const itemDoc = await getDoc(itemRef);
          await updateDoc(itemRef, { 
            quantidade: (itemDoc.data()?.quantidade || 0) - item.quantidade,
            durabilidadeSugerida: item.durabilidade 
          });
        }
      }
      avisar("Processo finalizado!");
      setCarrinho([]); setAssinaturaBase64(''); setFuncionarioSelecionado('');
    } catch (e) { avisar("Erro ao salvar lote.", "erro"); }
    setSalvando(false);
  };

  // --- LÓGICA DO CANVAS TELA CHEIA ---
  useEffect(() => {
    if (!modalAssinaturaAberto || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = canvas.offsetWidth * window.devicePixelRatio;
    canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    
    const getPos = (e: any) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return { x: clientX - rect.left, y: clientY - rect.top };
    };
    const start = (e: any) => { e.preventDefault(); ctx.beginPath(); ctx.moveTo(getPos(e).x, getPos(e).y); setEstaDesenhando(true); };
    const move = (e: any) => { if (!estaDesenhando) return; e.preventDefault(); ctx.lineTo(getPos(e).x, getPos(e).y); ctx.stroke(); };
    const stop = () => setEstaDesenhando(false);

    canvas.addEventListener('mousedown', start); canvas.addEventListener('mousemove', move); window.addEventListener('mouseup', stop);
    canvas.addEventListener('touchstart', start, { passive: false }); canvas.addEventListener('touchmove', move, { passive: false }); canvas.addEventListener('touchend', stop);
    
    return () => {
      canvas.removeEventListener('mousedown', start); canvas.removeEventListener('mousemove', move); window.removeEventListener('mouseup', stop);
      canvas.removeEventListener('touchstart', start); canvas.removeEventListener('touchmove', move); canvas.removeEventListener('touchend', stop);
    };
  }, [modalAssinaturaAberto, estaDesenhando]);

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '10px' }}>
      
      {/* Notificação Toast */}
      {notificacao && (
        <div style={{ position: 'fixed', top: '15px', left: '50%', transform: 'translateX(-50%)', zIndex: 10002, backgroundColor: notificacao.tipo === 'sucesso' ? '#10b981' : '#ef4444', color: 'white', padding: '12px 24px', borderRadius: '50px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold' }}>
          {notificacao.tipo === 'sucesso' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />} {notificacao.msg}
        </div>
      )}

      <h1 style={{ fontSize: '24px', color: '#1e293b', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <ClipboardSignature color="var(--cor-primaria)" /> Entrega de EPI
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* 1. FUNCIONÁRIO E PENDÊNCIAS */}
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px', color: '#475569', fontSize: '13px' }}>RECEBEDOR</label>
            <select value={funcionarioSelecionado} onChange={e => setFuncionarioSelecionado(e.target.value)} style={{ width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
              <option value="">Selecione o colaborador...</option>
              {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>

            {pendenciasFuncionario.length > 0 && (
              <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '10px', animation: 'pulse 2s infinite' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#9a3412', marginBottom: '10px' }}>
                  <Shirt size={20} /> <strong style={{fontSize: '12px'}}>UNIFORME(S) DISPONÍVEL!</strong>
                </div>
                {pendenciasFuncionario.map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: '8px 12px', borderRadius: '6px', marginBottom: '5px', border: '1px solid #fed7aa' }}>
                    <span style={{ fontSize: '12px', fontWeight: 'bold' }}>{p.itemNome} ({p.tamanho})</span>
                    <button onClick={() => adicionarAoCarrinho(p, 180, 'Entrega de Pedido Especial', true, p.id)} style={{ backgroundColor: '#f97316', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>Incluir</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. ADIÇÃO DE ITEM GERAL */}
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px', color: '#475569', fontSize: '13px' }}>ITEM DO ESTOQUE</label>
            <select value={itemSelecionado} onChange={e => setItemSelecionado(e.target.value)} style={{ width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
              <option value="">Buscar material...</option>
              {estoque.map(i => <option key={i.id} value={i.id}>{i.nome} ({i.quantidade} un)</option>)}
            </select>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr auto', gap: '10px', marginTop: '10px' }}>
              <Input label="Qtd" type="number" value={quantidadeDesejada} onChange={e => setQuantidadeDesejada(e.target.value)} />
              <Input label="Vida Útil (Dias)" type="number" value={durabilidadeManual} onChange={e => setDurabilidadeManual(e.target.value)} placeholder="Ex: 15" />
              <Button onClick={verificarEAdicionar} style={{ backgroundColor: '#3b82f6', alignSelf: 'end', height: '46px' }}><Plus size={24} /></Button>
            </div>
          </div>

          {/* 3. RESUMO DO LOTE */}
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '15px', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShoppingCart size={18} /> Resumo do Lote ({carrinho.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {carrinho.map((item, idx) => (
                <div key={idx} style={{ padding: '12px', borderBottom: '1px solid #f1f5f9', backgroundColor: item.justificativa ? '#fff7ed' : (item.isPendencia ? '#f0f9ff' : 'transparent'), borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ fontSize: '14px', display: 'block' }}>{item.nome} x{item.quantidade}</strong>
                    <span style={{ fontSize: '11px', color: item.justificativa ? '#f97316' : '#64748b' }}>
                      {item.justificativa ? `⚠️ ${item.justificativa}` : (item.isPendencia ? '📦 Pedido Especial' : `Dura: ${item.durabilidade} dias`)}
                    </span>
                  </div>
                  <button onClick={() => setCarrinho(carrinho.filter((_, i) => i !== idx))} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={18} /></button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 4. CONFIRMAÇÃO E ASSINATURA */}
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <h3 style={{ fontSize: '16px', color: '#1e293b' }}>Recibo Digital</h3>
          <div onClick={() => setModalAssinaturaAberto(true)} style={{ height: '220px', border: '2px dashed #cbd5e1', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backgroundColor: '#f8fafc', overflow: 'hidden' }}>
            {assinaturaBase64 ? <img src={assinaturaBase64} style={{ maxHeight: '100%' }} /> : 
            <div style={{ textAlign: 'center', color: '#64748b' }}><PenTool size={40} /><p style={{ fontSize: '14px', marginTop: '10px' }}>Toque para Assinar em Tela Cheia</p></div>}
          </div>
          <Button disabled={salvando || !assinaturaBase64 || carrinho.length === 0} onClick={finalizarEntregaTotal} style={{ height: '60px', fontSize: '18px', fontWeight: 'bold', backgroundColor: assinaturaBase64 && carrinho.length > 0 ? '#10b981' : '#94a3b8' }}>
            {salvando ? 'Processando...' : 'FINALIZAR ENTREGA'}
          </Button>
        </div>
      </div>

      {/* --- MODAL DE JUSTIFICATIVA (O VIGIA) --- */}
      {itemPendenteJustificativa && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.95)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '450px', borderRadius: '20px', padding: '30px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ backgroundColor: '#fff7ed', width: '70px', height: '70px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px' }}>
                <AlertTriangle size={40} color="#f97316" />
              </div>
              <h2 style={{ fontSize: '20px', color: '#1e293b', margin: 0 }}>Troca Antecipada Detectada</h2>
              <p style={{ fontSize: '14px', color: '#64748b', marginTop: '10px', lineHeight: '1.5' }}>
                Última entrega: <strong>{itemPendenteJustificativa.dataAnterior} às {itemPendenteJustificativa.horaAnterior}</strong>.<br/>
                O item foi usado por <strong>{itemPendenteJustificativa.diasPassados} dias</strong>, mas deveria durar <strong>{itemPendenteJustificativa.durabilidadePrevista} dias</strong>.
              </p>
            </div>

            <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '10px' }}>POR QUE O ITEM ESTÁ SENDO REPOSTO AGORA?</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
              {JUSTIFICATIVAS_PADRAO.map(j => (
                <button key={j} onClick={() => setJustificativaSelecionada(j)} style={{ textAlign: 'left', padding: '14px', borderRadius: '10px', border: justificativaSelecionada === j ? '2px solid #f97316' : '1px solid #e2e8f0', backgroundColor: justificativaSelecionada === j ? '#fff7ed' : 'white', fontSize: '14px', fontWeight: justificativaSelecionada === j ? 'bold' : 'normal', transition: '0.2s' }}>{j}</button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '30px' }}>
              <Button onClick={() => setItemPendenteJustificativa(null)} style={{ backgroundColor: '#f1f5f9', color: '#475569' }}>Cancelar</Button>
              <Button onClick={() => adicionarAoCarrinho(itemPendenteJustificativa, itemPendenteJustificativa.dur, justificativaSelecionada)} disabled={!justificativaSelecionada} style={{ backgroundColor: '#f97316' }}>Confirmar Troca</Button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL DE ASSINATURA TELA CHEIA --- */}
      {modalAssinaturaAberto && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'white', zIndex: 10000, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0' }}>
            <h2 style={{ fontSize: '18px', margin: 0, fontWeight: '800' }}>ASSINATURA DO COLABORADOR</h2>
            <button onClick={() => setModalAssinaturaAberto(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={24} /></button>
          </div>
          <div style={{ flex: 1, position: 'relative', backgroundColor: '#fcfcfc', overflow: 'hidden' }}>
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%', touchAction: 'none' }} />
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#f1f5f9', pointerEvents: 'none', zIndex: 0, fontSize: '50px', fontWeight: '900', letterSpacing: '10px' }}>ASSINE AQUI</div>
          </div>
          <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', borderTop: '1px solid #e2e8f0', backgroundColor: 'white' }}>
            <Button onClick={() => {
              const ctx = canvasRef.current?.getContext('2d');
              ctx?.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
              setAssinaturaBase64('');
            }} style={{ backgroundColor: '#f1f5f9', color: '#475569', height: '50px' }}><Eraser size={20} /> LIMPAR</Button>
            <Button onClick={() => {
              if (canvasRef.current) { setAssinaturaBase64(canvasRef.current.toDataURL()); setModalAssinaturaAberto(false); }
            }} style={{ backgroundColor: '#10b981', height: '50px' }}><Check size={20} /> CONFIRMAR</Button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.02); } 100% { transform: scale(1); } }
      `}</style>
    </div>
  );
}