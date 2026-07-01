// src/pages/Entrega.tsx
import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { collection, onSnapshot, query, where, addDoc, doc, updateDoc, getDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';

import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { ClipboardSignature, CheckCircle2, AlertCircle, PenTool, Plus, ShoppingCart, Trash2, Shirt, UserCheck, HardHat, Building2, Smartphone } from 'lucide-react';

import ModalJustificativa from '../components/entrega/ModalJustificativa';
import ModalAssinaturaEntrega from '../components/entrega/ModalAssinaturaEntrega';

interface ItemCarrinho {
  id: string; nome: string; quantidade: number; durabilidade: number;
  justificativa?: string; isPendencia?: boolean; pendenciaId?: string;
  isExterno?: boolean; caExterno?: string; nomeOriginalExterno?: string;
}

export default function Entrega() {
  const { setorAtivo } = useOutletContext<{ setorAtivo: string }>();
  
  const [recebedores, setRecebedores] = useState<any[]>([]); 
  const [estoque, setEstoque] = useState<any[]>([]);
  const [recebedorSelecionado, setRecebedorSelecionado] = useState('');
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  
  // Gestão de EPIs Externos
  const [origemEpi, setOrigemEpi] = useState<'interno' | 'externo'>('interno');
  const [episExternosSugeridos, setEpisExternosSugeridos] = useState<any[]>([]);
  const [nomeExterno, setNomeExterno] = useState('');
  const [caExterno, setCaExterno] = useState('');

  const [itemSelecionado, setItemSelecionado] = useState('');
  const [quantidadeDesejada, setQuantidadeDesejada] = useState('1');
  const [durabilidadeManual, setDurabilidadeManual] = useState('');
  const [pendenciasFuncionario, setPendenciasFuncionario] = useState<any[]>([]);

  const [itemPendenteJustificativa, setItemPendenteJustificativa] = useState<any>(null);
  const [modalAssinaturaAberto, setModalAssinaturaAberto] = useState(false);
  const [assinaturaBase64, setAssinaturaBase64] = useState('');

  const [notificacao, setNotificacao] = useState<{msg: string, tipo: 'sucesso' | 'erro'} | null>(null);
  const [salvando, setSalvando] = useState(false);

  const avisar = (msg: string, tipo: 'sucesso' | 'erro' = 'sucesso') => {
    setNotificacao({ msg, tipo }); setTimeout(() => setNotificacao(null), 4000);
  };

  useEffect(() => {
    if (!setorAtivo) return;
    const unsubFunc = onSnapshot(query(collection(db, 'funcionarios'), where('setorId', '==', setorAtivo)), (snapFunc) => {
      const funcs = snapFunc.docs.map(d => ({ id: d.id, ...d.data(), tipo: 'funcionario' })).filter((f: any) => f.status !== 'desligado'); 
      onSnapshot(query(collection(db, 'usuarios'), where('nivel', '==', 'socio')), (snapSocios) => {
        const socios = snapSocios.docs.map(d => ({ id: d.id, ...d.data(), tipo: 'socio' }));
        setRecebedores([...funcs, ...socios]);
      });
    });
    
    const unsubEstoque = onSnapshot(query(collection(db, 'estoque'), where('setorId', '==', setorAtivo)), (snap) => {
      const itensFiltrados = snap.docs.map(d => ({ id: d.id, ...d.data() } as any)).filter(i => i.quantidade > 0 && i.categoria?.toLowerCase() !== 'pintura'); 
      setEstoque(itensFiltrados);
    });

    const unsubExternos = onSnapshot(collection(db, 'epis_externos'), (snap) => {
      setEpisExternosSugeridos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubFunc(); unsubEstoque(); unsubExternos(); }
  }, [setorAtivo]);

  useEffect(() => {
    const selecao = recebedores.find(r => r.id === recebedorSelecionado);
    if (selecao?.tipo === 'socio') setAssinaturaBase64('ASSINATURA DIGITAL (SÓCIO)');
    else setAssinaturaBase64('');
  }, [recebedorSelecionado, recebedores]);

  useEffect(() => {
    if (!recebedorSelecionado) return setPendenciasFuncionario([]);
    const selecao = recebedores.find(r => r.id === recebedorSelecionado);
    if (selecao?.tipo !== 'funcionario') return;

    const q = query(collection(db, 'entregas_pendentes'), where('funcionarioId', '==', recebedorSelecionado), where('status', '==', 'aguardando_chegada'));
    const unsub = onSnapshot(q, (snap) => setPendenciasFuncionario(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, [recebedorSelecionado, recebedores]);

  useEffect(() => {
    if (itemSelecionado && origemEpi === 'interno') {
      const item = estoque.find(i => i.id === itemSelecionado);
      setDurabilidadeManual(item?.durabilidadeSugerida?.toString() || '');
    }
  }, [itemSelecionado, estoque, origemEpi]);

  const handleSelectExterno = (nome: string) => {
    setNomeExterno(nome);
    const existente = episExternosSugeridos.find(e => e.nome.toLowerCase() === nome.toLowerCase());
    if (existente) setCaExterno(existente.ca || '');
  };

  const calcularDiasDeUso = (dataAnterior: Date) => {
    const diffMs = new Date().getTime() - dataAnterior.getTime();
    const diffHoras = diffMs / (1000 * 60 * 60);
    return diffHoras < 7 ? 0 : Math.ceil(diffHoras / 24);
  };

  const verificarEAdicionar = async () => {
    if (!recebedorSelecionado) return avisar("Selecione o recebedor.", "erro");
    if (Number(quantidadeDesejada) <= 0) return avisar("A quantidade deve ser maior que zero.", "erro");
    
    // LÓGICA PARA EPI EXTERNO
    if (origemEpi === 'externo') {
      if (!nomeExterno.trim()) return avisar("Digite o nome do EPI do cliente.", "erro");
      
      setCarrinho([...carrinho, {
        id: `ext-${Date.now()}`,
        nome: `[HYUNDAI] ${nomeExterno}`,
        quantidade: Number(quantidadeDesejada) || 1,
        durabilidade: Number(durabilidadeManual) || 0,
        isExterno: true,
        caExterno: caExterno,
        nomeOriginalExterno: nomeExterno
      }]);
      
      setNomeExterno(''); setCaExterno(''); setQuantidadeDesejada('1'); setDurabilidadeManual('');
      return;
    }

    // LÓGICA PARA ESTOQUE INTERNO
    if (!itemSelecionado) return avisar("Selecione o material.", "erro");
    const itemData = estoque.find(i => i.id === itemSelecionado);
    const durabilidadeDesejada = Number(durabilidadeManual) || 0;
    const selecao = recebedores.find(r => r.id === recebedorSelecionado);

    if (selecao?.tipo === 'socio') return adicionarAoCarrinho(itemData, durabilidadeDesejada);

    try {
      const q = query(collection(db, 'entregas'), where('funcionarioId', '==', recebedorSelecionado), where('itemId', '==', itemSelecionado));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        const entregas = snap.docs.map(d => d.data()).sort((a, b) => (b.dataHora?.toMillis() || 0) - (a.dataHora?.toMillis() || 0));
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
    } catch (error) { adicionarAoCarrinho(itemData, durabilidadeDesejada); }
  };

  const adicionarAoCarrinho = (itemData: any, dur: number, just?: string, isPendencia = false, pendId?: string) => {
    setCarrinho([...carrinho, { 
      id: itemData.id || `p-${Date.now()}`, nome: itemData.nome || itemData.itemNome, 
      quantidade: isPendencia ? 1 : (Number(quantidadeDesejada) || 1), durabilidade: dur, justificativa: just, isPendencia, pendenciaId: pendId
    }]);
    setItemSelecionado(''); setDurabilidadeManual(''); setQuantidadeDesejada('1');
    setItemPendenteJustificativa(null);
  };

  // ✨ ATUALIZADO: Agora aceita método Local ou via Link e corrige o erro do Firebase (undefined)
  const finalizarEntregaTotal = async (metodo: 'local' | 'link') => {
    if (metodo === 'local' && !assinaturaBase64) return avisar("Por favor, assine no quadro acima.", "erro");
    if (carrinho.length === 0) return avisar("O carrinho está vazio.", "erro");
    
    setSalvando(true);
    try {
      const horarioAgora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const selecao = recebedores.find(r => r.id === recebedorSelecionado);
      
      // Gera um Lote Único para agrupar os itens desta entrega
      const loteUnicoId = `LOTE-${Date.now()}`;

      for (const item of carrinho) {
        
        if (item.isExterno) {
          const existe = episExternosSugeridos.find(e => e.nome.toLowerCase() === item.nomeOriginalExterno?.toLowerCase());
          if (!existe) {
            await addDoc(collection(db, 'epis_externos'), { nome: item.nomeOriginalExterno, ca: item.caExterno || '' });
          }
        }

        // Registo da Entrega no Banco de Dados
        await addDoc(collection(db, 'entregas'), {
          setorId: setorAtivo, 
          funcionarioId: recebedorSelecionado, 
          funcionarioNome: selecao.nome,
          itemId: item.id, 
          itemNome: item.nome, 
          quantidade: item.quantidade, 
          durabilidade: item.durabilidade,
          ca: item.isExterno ? (item.caExterno || '') : '', // Corrige o erro de "undefined"
          origem: item.isExterno ? 'externa_cliente' : 'estoque_interno',
          justificativa: item.justificativa || (item.isExterno ? "EPI Cedido pelo Cliente" : "Retirada Normal"),
          assinatura: metodo === 'local' ? assinaturaBase64 : 'pendente', // Define como pendente se for por link
          loteId: loteUnicoId, 
          dataHora: serverTimestamp(), 
          horarioEntrega: horarioAgora, 
          recebedorTipo: selecao.tipo
        });

        if (!item.isExterno) {
          if (item.isPendencia && item.pendenciaId) {
            await updateDoc(doc(db, 'entregas_pendentes', item.pendenciaId), { status: 'entregue', entregueEm: serverTimestamp() });
          } else {
            const itemRef = doc(db, 'estoque', item.id);
            const itemDoc = await getDoc(itemRef);
            if (itemDoc.exists()) {
               await updateDoc(itemRef, { quantidade: (itemDoc.data()?.quantidade || 0) - item.quantidade, durabilidadeSugerida: item.durabilidade });
            }
          }
        }
      }

      // Se for via link, gera a URL pública e abre o WhatsApp
      if (metodo === 'link') {
        const url = `${window.location.origin}/assinar-epi/${loteUnicoId}`;
        const texto = `Olá ${selecao.nome}! A Carvalho Pintura registou a entrega de EPIs para si.\n\nPor favor, acesse o link abaixo pelo seu telemóvel para conferir os itens e realizar a assinatura digital (obrigatório):\n\n🔗 *Acessar Ficha de EPI:*\n${url}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
      }

      avisar(metodo === 'link' ? "Entrega registada! Link gerado." : "Processo finalizado com sucesso!"); 
      setCarrinho([]); setAssinaturaBase64(''); setRecebedorSelecionado('');
    } catch (e) { 
      console.error(e);
      avisar("Erro ao salvar lote.", "erro"); 
    }
    setSalvando(false);
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
            <select value={recebedorSelecionado} onChange={e => setRecebedorSelecionado(e.target.value)} style={{ width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', fontSize: '15px', outline: 'none' }}>
              <option value="">Selecione o colaborador ou sócio...</option>
              {recebedores.map(r => <option key={r.id} value={r.id}>{r.tipo === 'socio' ? `[SÓCIO] ${r.nome}` : r.nome}</option>)}
            </select>

            {pendenciasFuncionario.length > 0 && (
              <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#9a3412', marginBottom: '10px' }}>
                  <Shirt size={20} /> <strong style={{fontSize: '12px'}}>UNIFORME(S) DISPONÍVEL!</strong>
                </div>
                {pendenciasFuncionario.map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: '10px 12px', borderRadius: '6px', marginBottom: '5px', border: '1px solid #fed7aa' }}>
                    <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{p.itemNome} ({p.tamanho})</span>
                    <button onClick={() => adicionarAoCarrinho(p, 180, 'Entrega de Pedido Especial', true, p.id)} style={{ backgroundColor: '#f97316', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Incluir</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <button 
                onClick={() => setOrigemEpi('interno')} 
                style={{ flex: 1, padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', border: origemEpi === 'interno' ? '2px solid #3b82f6' : '1px solid #e2e8f0', backgroundColor: origemEpi === 'interno' ? '#eff6ff' : '#f8fafc', color: origemEpi === 'interno' ? '#1d4ed8' : '#64748b', cursor: 'pointer' }}
              >
                <HardHat size={16}/> Estoque Interno
              </button>
              <button 
                onClick={() => setOrigemEpi('externo')} 
                style={{ flex: 1, padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', border: origemEpi === 'externo' ? '2px solid #8b5cf6' : '1px solid #e2e8f0', backgroundColor: origemEpi === 'externo' ? '#faf5ff' : '#f8fafc', color: origemEpi === 'externo' ? '#6d28d9' : '#64748b', cursor: 'pointer' }}
              >
                <Building2 size={16}/> EPI Hyundai
              </button>
            </div>

            {origemEpi === 'interno' ? (
              <select value={itemSelecionado} onChange={e => setItemSelecionado(e.target.value)} style={{ width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', fontSize: '15px', marginBottom: '15px', outline: 'none' }}>
                <option value="">Buscar material no estoque da Carvalho...</option>
                {estoque.map(i => <option key={i.id} value={i.id}>{i.nome} ({i.quantidade} em estoque)</option>)}
              </select>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px', marginBottom: '15px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#6d28d9', display: 'block', marginBottom: '5px' }}>Nome do EPI Cedido</label>
                  <input 
                    list="lista-epis-externos" 
                    value={nomeExterno} 
                    onChange={e => handleSelectExterno(e.target.value)} 
                    placeholder="Ex: Luva Anticorte..." 
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #c4b5fd', outline: 'none' }} 
                  />
                  <datalist id="lista-epis-externos">
                    {episExternosSugeridos.map(e => <option key={e.id} value={e.nome} />)}
                  </datalist>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#6d28d9', display: 'block', marginBottom: '5px' }}>C.A.</label>
                  <input 
                    value={caExterno} 
                    onChange={e => setCaExterno(e.target.value)} 
                    placeholder="Opcional" 
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #c4b5fd', outline: 'none' }} 
                  />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
              <div style={{ flex: '1' }}><Input label="Qtd" type="number" value={quantidadeDesejada} onChange={e => setQuantidadeDesejada(e.target.value)} /></div>
              <div style={{ flex: '1.5' }}><Input label="Durabilidade" type="number" value={durabilidadeManual} onChange={e => setDurabilidadeManual(e.target.value)} placeholder="Dias" /></div>
              <Button onClick={verificarEAdicionar} style={{ backgroundColor: origemEpi === 'interno' ? '#3b82f6' : '#8b5cf6', height: '48px', padding: '0 20px', flexShrink: 0 }}><Plus size={24} /></Button>
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
                  <div key={idx} style={{ padding: '12px', border: item.isExterno ? '1px solid #c4b5fd' : '1px solid #e2e8f0', backgroundColor: item.isExterno ? '#faf5ff' : (item.justificativa ? '#fff7ed' : '#ffffff'), borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ fontSize: '14px', display: 'block', color: item.isExterno ? '#6d28d9' : '#1e293b' }}>{item.nome} (x{item.quantidade})</strong>
                      <span style={{ fontSize: '12px', color: item.justificativa ? '#ea580c' : '#64748b', display: 'block', marginTop: '2px' }}>
                        {item.justificativa ? `⚠️ Motivo: ${item.justificativa}` : `Dura aprox: ${item.durabilidade} dias`}
                        {item.isExterno && item.caExterno && ` | C.A: ${item.caExterno}`}
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
          
          <div 
            onClick={() => {
              const selecao = recebedores.find(r => r.id === recebedorSelecionado);
              if (selecao?.tipo !== 'socio') setModalAssinaturaAberto(true);
            }} 
            style={{ height: '220px', border: '2px dashed #cbd5e1', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: recebedores.find(r => r.id === recebedorSelecionado)?.tipo === 'socio' ? 'default' : 'pointer', backgroundColor: '#f8fafc', overflow: 'hidden' }}
          >
            {assinaturaBase64.startsWith('data:image') ? (
              <img src={assinaturaBase64} style={{ maxHeight: '100%', maxWidth: '100%' }} /> 
            ) : assinaturaBase64 === 'ASSINATURA DIGITAL (SÓCIO)' ? (
              <div style={{ textAlign: 'center', color: '#10b981' }}><UserCheck size={50} style={{ margin: '0 auto' }} /><p style={{ fontSize: '14px', marginTop: '10px', fontWeight: 'bold' }}>Assinatura Digital Ativada</p></div>
            ) : (
              <div style={{ textAlign: 'center', color: '#64748b' }}><PenTool size={40} style={{ margin: '0 auto' }} /><p style={{ fontSize: '14px', marginTop: '10px', fontWeight: 'bold' }}>Toque para Assinar na Tela</p></div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <Button 
              disabled={salvando || !assinaturaBase64 || carrinho.length === 0} 
              onClick={() => finalizarEntregaTotal('local')} 
              style={{ height: '50px', fontSize: '14px', fontWeight: 'bold', backgroundColor: assinaturaBase64 && carrinho.length > 0 ? '#10b981' : '#94a3b8' }}
            >
              <PenTool size={18} style={{ marginRight: '8px' }}/> {salvando ? 'PROCESSANDO...' : 'Salvar Assinatura Local'}
            </Button>

            <Button 
              disabled={salvando || carrinho.length === 0 || !!assinaturaBase64} 
              onClick={() => finalizarEntregaTotal('link')} 
              style={{ height: '50px', fontSize: '14px', fontWeight: 'bold', backgroundColor: carrinho.length > 0 && !assinaturaBase64 ? '#3b82f6' : '#cbd5e1' }}
              title="Salva os itens e envia um link para o funcionário assinar depois."
            >
              <Smartphone size={18} style={{ marginRight: '8px' }}/> Enviar Link (WhatsApp)
            </Button>
          </div>
        </div>
      </div>

      <ModalJustificativa 
        item={itemPendenteJustificativa} 
        onClose={() => setItemPendenteJustificativa(null)} 
        onConfirm={(just) => adicionarAoCarrinho(itemPendenteJustificativa, itemPendenteJustificativa.dur, just)} 
      />

      <ModalAssinaturaEntrega 
        aberto={modalAssinaturaAberto} 
        onClose={() => setModalAssinaturaAberto(false)} 
        onConfirm={(base64) => { setAssinaturaBase64(base64); setModalAssinaturaAberto(false); }} 
      />

    </div>
  );
}
