// src/pages/Entrega.tsx
import { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { 
  collection, onSnapshot, query, where, addDoc, doc, 
  updateDoc, getDoc, serverTimestamp, getDocs 
} from 'firebase/firestore';
import { db } from '../services/firebase';

import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { 
  ClipboardSignature, CheckCircle2, AlertCircle, 
  PenTool, Plus, ShoppingCart, Trash2, X, AlertTriangle, Shirt, Smartphone 
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
  
  const [itemSelecionado, setItemSelecionado] = useState('');
  const [quantidadeDesejada, setQuantidadeDesejada] = useState('1');
  const [durabilidadeManual, setDurabilidadeManual] = useState('');
  const [pendenciasFuncionario, setPendenciasFuncionario] = useState<any[]>([]);

  const [itemPendenteJustificativa, setItemPendenteJustificativa] = useState<any>(null);
  const [justificativaSelecionada, setJustificativaSelecionada] = useState('');

  // ✍️ ESTADOS DA ASSINATURA
  const [modalAssinaturaAberto, setModalAssinaturaAberto] = useState(false);
  const [assinaturaBase64, setAssinaturaBase64] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [estaDesenhandoUI, setEstaDesenhandoUI] = useState(false);
  const desenhandoRef = useRef(false);
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);

  const [notificacao, setNotificacao] = useState<{msg: string, tipo: 'sucesso' | 'erro'} | null>(null);
  const [salvando, setSalvando] = useState(false);

  const avisar = (msg: string, tipo: 'sucesso' | 'erro' = 'sucesso') => {
    setNotificacao({ msg, tipo });
    setTimeout(() => setNotificacao(null), 4000);
  };

  useEffect(() => {
    if (!setorAtivo) return;
    const unsubFunc = onSnapshot(query(collection(db, 'funcionarios'), where('setorId', '==', setorAtivo)), (snap) => setFuncionarios(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    
    const unsubEstoque = onSnapshot(query(collection(db, 'estoque'), where('setorId', '==', setorAtivo)), (snap) => {
      const itensFiltrados = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as any))
        .filter(i => i.quantidade > 0 && i.categoria?.toLowerCase() !== 'pintura'); 
      
      setEstoque(itensFiltrados);
    });

    return () => { unsubFunc(); unsubEstoque(); }
  }, [setorAtivo]);

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

  useEffect(() => {
    if (itemSelecionado) {
      const item = estoque.find(i => i.id === itemSelecionado);
      setDurabilidadeManual(item?.durabilidadeSugerida?.toString() || '');
    }
  }, [itemSelecionado, estoque]);

  useEffect(() => {
    const handleResize = () => setIsPortrait(window.innerHeight > window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const calcularDiasDeUso = (dataAnterior: Date) => {
    const agora = new Date();
    const diffMs = agora.getTime() - dataAnterior.getTime();
    const diffHoras = diffMs / (1000 * 60 * 60);
    if (diffHoras < 7) return 0; 
    return Math.ceil(diffHoras / 24);
  };

  const verificarEAdicionar = async () => {
    if (!funcionarioSelecionado || !itemSelecionado) return avisar("Selecione funcionário e material.", "erro");
    if (Number(quantidadeDesejada) <= 0) return avisar("A quantidade deve ser maior que zero.", "erro");
    
    const itemData = estoque.find(i => i.id === itemSelecionado);
    const durabilidadeDesejada = Number(durabilidadeManual) || 0;

    try {
      const q = query(collection(db, 'entregas'), where('funcionarioId', '==', funcionarioSelecionado), where('itemId', '==', itemSelecionado));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        const entregas = snap.docs.map(d => d.data());
        entregas.sort((a, b) => (b.dataHora?.toMillis() || 0) - (a.dataHora?.toMillis() || 0));

        const ultima = entregas[0];
        const dataUltima = ultima.dataHora?.toDate();
        
        if (dataUltima) {
          const diasUso = calcularDiasDeUso(dataUltima);
          const durabilidadePrevista = ultima.durabilidade || 0;

          if (durabilidadePrevista > 0 && diasUso < durabilidadePrevista) {
            setItemPendenteJustificativa({
              ...itemData, diasPassados: diasUso, durabilidadePrevista,
              quantidade: quantidadeDesejada, dur: durabilidadeDesejada,
              dataAnterior: dataUltima.toLocaleDateString('pt-BR'),
              horaAnterior: dataUltima.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            });
            return;
          }
        }
      }
      adicionarAoCarrinho(itemData, durabilidadeDesejada);

    } catch (error) {
      adicionarAoCarrinho(itemData, durabilidadeDesejada);
    }
  };

  const adicionarAoCarrinho = (itemData: any, dur: number, just?: string, isPendencia = false, pendId?: string) => {
    setCarrinho([...carrinho, { 
      id: itemData.id || `p-${Date.now()}`, 
      nome: itemData.nome || itemData.itemNome, 
      quantidade: isPendencia ? 1 : (Number(quantidadeDesejada) || 1),
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
      
      // Como a assinatura agora é minúscula, esse loop vai rodar na velocidade da luz
      for (const item of carrinho) {
        await addDoc(collection(db, 'entregas'), {
          setorId: setorAtivo,
          funcionarioId: funcionarioSelecionado,
          funcionarioNome: funcionarios.find(f => f.id === funcionarioSelecionado).nome,
          itemId: item.id,
          itemNome: item.nome,
          quantidade: item.quantidade,
          durabilidade: item.durabilidade,
          justificativa: item.justificativa || "Troca Normal",
          assinatura: assinaturaBase64, // Agora pesa só ~15kb
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
      setEstaDesenhandoUI(false); 
    } catch (e) { avisar("Erro ao salvar lote.", "erro"); }
    
    setSalvando(false);
  };

  // ✍️ --- LÓGICA DO CANVAS TELA CHEIA (SUPER OTIMIZADA) ---
  useEffect(() => {
    if (!modalAssinaturaAberto || isPortrait || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    setTimeout(() => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      
      // 🚀 MÁGICA 1: Preenche o fundo de branco (necessário para JPEG)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    }, 100);
    
    const getPos = (e: any) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const start = (e: any) => { 
      e.preventDefault(); 
      ctx.beginPath(); 
      ctx.moveTo(getPos(e).x, getPos(e).y); 
      desenhandoRef.current = true;
      setEstaDesenhandoUI(true); 
    };

    const move = (e: any) => { 
      if (!desenhandoRef.current) return; 
      e.preventDefault(); 
      ctx.lineTo(getPos(e).x, getPos(e).y); 
      ctx.stroke(); 
    };

    const stop = () => { desenhandoRef.current = false; };

    canvas.addEventListener('mousedown', start); canvas.addEventListener('mousemove', move); window.addEventListener('mouseup', stop);
    canvas.addEventListener('touchstart', start, { passive: false }); canvas.addEventListener('touchmove', move, { passive: false }); window.addEventListener('touchend', stop);
    
    return () => {
      canvas.removeEventListener('mousedown', start); canvas.removeEventListener('mousemove', move); window.removeEventListener('mouseup', stop);
      canvas.removeEventListener('touchstart', start); canvas.removeEventListener('touchmove', move); window.removeEventListener('touchend', stop);
    };
  }, [modalAssinaturaAberto, isPortrait]);

  const limparAssinatura = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) {
      // Preenche com branco de novo ao invés de deixar transparente
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      setAssinaturaBase64('');
      setEstaDesenhandoUI(false); 
      desenhandoRef.current = false;
    }
  };

  const confirmarAssinatura = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      // 🚀 MÁGICA 2: Salva em JPEG com 60% de qualidade. Reduz o peso em até 95%!
      setAssinaturaBase64(canvas.toDataURL('image/jpeg', 0.6));
      setModalAssinaturaAberto(false);
    }
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '15px' }}>
      
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
          
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px', color: '#475569', fontSize: '13px' }}>RECEBEDOR *</label>
            <select value={funcionarioSelecionado} onChange={e => setFuncionarioSelecionado(e.target.value)} style={{ width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', fontSize: '15px', outline: 'none' }}>
              <option value="">Selecione o colaborador...</option>
              {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>

          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px', color: '#475569', fontSize: '13px' }}>ITEM DO ESTOQUE</label>
            <select value={itemSelecionado} onChange={e => setItemSelecionado(e.target.value)} style={{ width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', fontSize: '15px', marginBottom: '15px', outline: 'none' }}>
              <option value="">Buscar material...</option>
              {estoque.map(i => <option key={i.id} value={i.id}>{i.nome} ({i.quantidade} em estoque)</option>)}
            </select>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
              <div style={{ flex: '1' }}><Input label="Qtd" type="number" value={quantidadeDesejada} onChange={e => setQuantidadeDesejada(e.target.value)} /></div>
              <div style={{ flex: '1.5' }}><Input label="Durabilidade" type="number" value={durabilidadeManual} onChange={e => setDurabilidadeManual(e.target.value)} placeholder="Dias" /></div>
              <Button onClick={verificarEAdicionar} style={{ backgroundColor: '#3b82f6', height: '48px', padding: '0 20px', flexShrink: 0 }}><Plus size={24} /></Button>
            </div>
          </div>

          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '15px', margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '8px', color: '#1e293b' }}>
              <ShoppingCart size={18} color="#3b82f6" /> Materiais Separados ({carrinho.length})
            </h3>
            {carrinho.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: '14px', textAlign: 'center', padding: '20px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>Nenhum item adicionado à entrega.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {carrinho.map((item, idx) => (
                  <div key={idx} style={{ padding: '12px', border: '1px solid #e2e8f0', backgroundColor: item.justificativa ? '#fff7ed' : '#ffffff', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ fontSize: '14px', display: 'block', color: '#1e293b' }}>{item.nome} (x{item.quantidade})</strong>
                      <span style={{ fontSize: '12px', color: item.justificativa ? '#ea580c' : '#64748b', display: 'block', marginTop: '2px' }}>
                        {item.justificativa ? `⚠️ Motivo: ${item.justificativa}` : `Dura aprox: ${item.durabilidade} dias`}
                      </span>
                    </div>
                    <button onClick={() => setCarrinho(carrinho.filter((_, i) => i !== idx))} style={{ color: '#ef4444', background: '#fef2f2', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '6px' }}><Trash2 size={18} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <h3 style={{ fontSize: '16px', color: '#1e293b', margin: 0 }}>Recibo e Assinatura</h3>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>A assinatura confirma o recebimento dos itens listados acima.</p>
          
          <div onClick={() => setModalAssinaturaAberto(true)} style={{ height: '220px', border: '2px dashed #cbd5e1', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backgroundColor: '#f8fafc', overflow: 'hidden' }}>
            {assinaturaBase64 ? (
              <img src={assinaturaBase64} style={{ maxHeight: '100%', maxWidth: '100%' }} /> 
            ) : (
              <div style={{ textAlign: 'center', color: '#64748b' }}>
                <PenTool size={40} style={{ margin: '0 auto' }} />
                <p style={{ fontSize: '14px', marginTop: '10px', fontWeight: 'bold' }}>Toque para Assinar</p>
              </div>
            )}
          </div>

          <Button disabled={salvando || !assinaturaBase64 || carrinho.length === 0} onClick={finalizarEntregaTotal} style={{ height: '60px', fontSize: '16px', fontWeight: 'bold', backgroundColor: assinaturaBase64 && carrinho.length > 0 ? '#10b981' : '#94a3b8' }}>
            {salvando ? 'PROCESSANDO...' : 'FINALIZAR E SALVAR'}
          </Button>
        </div>
      </div>

      {/* --- MODAL DA ASSINATURA --- */}
      {modalAssinaturaAberto && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'white', zIndex: 10000, display: 'flex', flexDirection: 'column' }}>
          
          {isPortrait ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e293b', color: 'white', padding: '20px', textAlign: 'center' }}>
              <Smartphone size={70} style={{ marginBottom: '20px', transform: 'rotate(-90deg)', opacity: 0.8, color: '#3b82f6' }} />
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '10px' }}>Gire o Celular</h2>
              <p style={{ color: '#cbd5e1', fontSize: '16px', marginBottom: '30px', maxWidth: '300px', lineHeight: '1.5' }}>
                Para garantir que a assinatura fique nas proporções corretas do documento, coloque o seu aparelho na <strong>horizontal</strong>.
              </p>
              <Button onClick={() => setModalAssinaturaAberto(false)} style={{ backgroundColor: '#475569', color: 'white', height: '50px', padding: '0 30px' }}>Voltar</Button>
            </div>
          ) : (
            <>
              <div style={{ padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                <h2 style={{ fontSize: '18px', margin: 0, fontWeight: '800', color: '#1e293b' }}>Assinatura do Colaborador</h2>
                <button onClick={() => setModalAssinaturaAberto(false)} style={{ background: '#e2e8f0', border: 'none', borderRadius: '50%', padding: '8px', cursor: 'pointer' }}><X size={20} color="#475569" /></button>
              </div>

              <div style={{ flex: 1, position: 'relative', touchAction: 'none' }}>
                <canvas ref={canvasRef} style={{ width: '100%', height: '100%', cursor: 'crosshair', display: 'block' }} />
                {!estaDesenhandoUI && (
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', opacity: 0.2, textAlign: 'center' }}>
                    <PenTool size={60} style={{ margin: '0 auto' }} />
                    <p style={{ fontSize: '18px', fontWeight: 'bold' }}>Assine Aqui</p>
                  </div>
                )}
              </div>

              <div style={{ padding: '15px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '15px', backgroundColor: '#f8fafc' }}>
                <Button onClick={limparAssinatura} style={{ flex: 1, height: '45px', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}>Limpar</Button>
                <Button onClick={confirmarAssinatura} style={{ flex: 2, height: '45px', backgroundColor: '#10b981', fontWeight: 'bold' }}>Confirmar Assinatura</Button>
              </div>
            </>
          )}
        </div>
      )}

    </div>
  );
}
