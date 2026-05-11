// src/pages/Estoque.tsx
import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { 
  collection, onSnapshot, query, where, addDoc, doc, 
  updateDoc, deleteDoc, serverTimestamp, getDoc 
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { 
  Package, Search, Plus, Filter, Edit, Trash2, 
  AlertTriangle, CheckCircle2, X, AlertCircle,
  ShieldCheck, Factory, Timer, BellOff, RefreshCw, Check
} from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

interface ItemEstoque {
  id: string;
  nome: string;
  categoria: string;
  subcategoria: string;
  quantidade: number;
  minimo: number;
  ca: string;
  marca: string;
  ncm: string;
  unidade: string;
  durabilidadeSugerida?: number;
  ignorarAlerta?: boolean;
}

export default function Estoque() {
  const { setorAtivo } = useOutletContext<{ setorAtivo: string }>();
  
  // --- ESTADOS ORIGINAIS ---
  const [estoque, setEstoque] = useState<ItemEstoque[]>([]);
  const [nomeSetor, setNomeSetor] = useState('Carregando...');
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [modalAberto, setModalAberto] = useState(false);
  const [itemEditando, setItemEditando] = useState<ItemEstoque | null>(null);

  // --- ESTADOS DO FORMULÁRIO ---
  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState('');
  const [subcategoria, setSubcategoria] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [minimo, setMinimo] = useState('');
  const [durabilidade, setDurabilidade] = useState('');
  const [ca, setCa] = useState('');
  const [marca, setMarca] = useState('');
  const [ncm, setNcm] = useState('');
  const [unidade, setUnidade] = useState('UN');
  const [notificacao, setNotificacao] = useState<{msg: string, tipo: 'sucesso' | 'erro'} | null>(null);

  // --- NOVOS ESTADOS DE RECEBIMENTO ---
  const [pedidosPendentes, setPedidosPendentes] = useState<any[]>([]);
  const [pedidoRecebendo, setPedidoRecebendo] = useState<any>(null);
  const [itensConferencia, setItensConferencia] = useState<any[]>([]);

  const avisar = (msg: string, tipo: 'sucesso' | 'erro' = 'sucesso') => {
    setNotificacao({ msg, tipo });
    setTimeout(() => setNotificacao(null), 3000);
  };

  // 1. CARREGAMENTO DE DADOS (NOME SETOR, ESTOQUE E PEDIDOS PENDENTES)
  useEffect(() => {
    if (!setorAtivo) return;

    getDoc(doc(db, 'setores', setorAtivo)).then(d => {
      if (d.exists()) setNomeSetor(d.data().nome);
    });

    const qEstoque = query(collection(db, 'estoque'), where('setorId', '==', setorAtivo));
    const unsubEstoque = onSnapshot(qEstoque, (snap) => {
      setEstoque(snap.docs.map(d => ({ id: d.id, ...d.data() } as ItemEstoque)));
    });

    const qPedidos = query(
      collection(db, 'pedidos_compra_logs'), 
      where('setorId', '==', setorAtivo), 
      where('status', '==', 'pendente')
    );
    const unsubPedidos = onSnapshot(qPedidos, snap => {
      setPedidosPendentes(snap.docs.map(d => ({id: d.id, ...d.data()})));
    });
    
    return () => { unsubEstoque(); unsubPedidos(); };
  }, [setorAtivo]);

  // 2. LÓGICA DE RECEBIMENTO DE PEDIDOS
  const iniciarRecebimento = (pedido: any) => {
    setPedidoRecebendo(pedido);
    const conferindo = pedido.itens.map((item: any) => {
      const match = estoque.find(e => 
        (item.ca && e.ca === item.ca) || 
        (item.ncm && e.ncm === item.ncm) || 
        (e.nome.toLowerCase() === item.nome.toLowerCase())
      );
      return {
        ...item,
        estoqueId: match?.id || null,
        categoria: match?.categoria || '',
        subcategoria: match?.subcategoria || '',
        unidade: item.unidade || match?.unidade || 'UN',
        quantidadeRecebida: item.quantidade
      };
    });
    setItensConferencia(conferindo);
  };

  const finalizarEntrada = async () => {
    try {
      for (const item of itensConferencia) {
        if (item.estoqueId) {
          const itemRef = doc(db, 'estoque', item.estoqueId);
          const snap = await getDoc(itemRef);
          const qtdAtual = snap.data()?.quantidade || 0;
          await updateDoc(itemRef, {
            quantidade: qtdAtual + Number(item.quantidadeRecebida),
            atualizadoEm: serverTimestamp()
          });
        } else {
          await addDoc(collection(db, 'estoque'), {
            setorId: setorAtivo,
            nome: item.nome,
            categoria: item.categoria || 'Diversos',
            subcategoria: item.subcategoria || '',
            ca: item.ca || '',
            marca: item.marca || '',
            ncm: item.ncm || '',
            unidade: item.unidade,
            quantidade: Number(item.quantidadeRecebida),
            minimo: 5,
            criadoEm: serverTimestamp()
          });
        }
      }
      await updateDoc(doc(db, 'pedidos_compra_logs', pedidoRecebendo.id), { status: 'recebido', recebidoEm: serverTimestamp() });
      setPedidoRecebendo(null);
      avisar("Estoque abastecido com sucesso!");
    } catch (e) { avisar("Erro no recebimento", "erro"); }
  };

  // 3. FUNÇÕES ORIGINAIS DE CADASTRO/EDIÇÃO
  const abrirModalNovo = () => {
    setItemEditando(null);
    setNome(''); setCategoria(''); setSubcategoria(''); setQuantidade(''); 
    setMinimo(''); setDurabilidade(''); setCa(''); setMarca(''); setNcm(''); setUnidade('UN');
    setModalAberto(true);
  };

  const abrirModalEdicao = (item: ItemEstoque) => {
    setItemEditando(item);
    setNome(item.nome || ''); setCategoria(item.categoria || ''); setSubcategoria(item.subcategoria || '');
    setQuantidade(item.quantidade?.toString() || '0'); setMinimo(item.minimo?.toString() || '0');
    setDurabilidade(item.durabilidadeSugerida?.toString() || '');
    setCa(item.ca || ''); setMarca(item.marca || ''); setNcm(item.ncm || '');
    setUnidade(item.unidade || 'UN'); setModalAberto(true);
  };

  const salvarItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !categoria) return avisar("Nome e Categoria são obrigatórios.", "erro");
    const qtdNova = Number(quantidade);
    const minNovo = Number(minimo);
    const dadosForm: any = {
      setorId: setorAtivo, nome, categoria, subcategoria, ca, marca, ncm, unidade,
      quantidade: qtdNova, minimo: minNovo, durabilidadeSugerida: Number(durabilidade) || 0,
      atualizadoEm: serverTimestamp()
    };
    if (qtdNova > minNovo) dadosForm.ignorarAlerta = false;

    try {
      if (itemEditando) {
        await updateDoc(doc(db, 'estoque', itemEditando.id), dadosForm);
        avisar("Item atualizado!");
      } else {
        await addDoc(collection(db, 'estoque'), { ...dadosForm, criadoEm: serverTimestamp() });
        avisar("Item cadastrado!");
      }
      setModalAberto(false);
    } catch (error) { avisar("Erro ao salvar.", "erro"); }
  };

  // FILTROS
  const categoriasUnicas = Array.from(new Set(estoque.map(i => i.categoria).filter(Boolean)));
  const subcategoriasUnicas = Array.from(new Set(estoque.map(i => i.subcategoria).filter(Boolean)));
  const estoqueFiltrado = estoque.filter(item => {
    const matchBusca = item.nome?.toLowerCase().includes(busca.toLowerCase()) || item.categoria?.toLowerCase().includes(busca.toLowerCase());
    const matchCat = filtroCategoria === '' || item.categoria === filtroCategoria;
    let matchStatus = true;
    if (filtroStatus === 'baixo') matchStatus = item.quantidade <= item.minimo && !item.ignorarAlerta;
    if (filtroStatus === 'ignorado') matchStatus = !!item.ignorarAlerta;
    return matchBusca && matchCat && matchStatus;
  });

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '15px', paddingBottom: '80px' }}>
      
      {notificacao && (
        <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, backgroundColor: notificacao.tipo === 'sucesso' ? '#10b981' : '#ef4444', color: 'white', padding: '12px 24px', borderRadius: '50px', boxShadow: '0 10px 15px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold' }}>
          {notificacao.tipo === 'sucesso' ? <CheckCircle2 /> : <AlertCircle />} {notificacao.msg}
        </div>
      )}

      {/* BANNER DE PEDIDOS PENDENTES */}
      {pedidosPendentes.length > 0 && (
        <div style={{ backgroundColor: '#fff7ed', border: '2px solid #fb923c', padding: '15px', borderRadius: '12px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <RefreshCw className="animate-spin-slow" color="#f97316" />
            <div>
              <strong style={{ color: '#9a3412' }}>{pedidosPendentes.length} Pedido(s) aguardando chegada!</strong>
              <p style={{ margin: 0, fontSize: '12px', color: '#c2410c' }}>Confirme o recebimento para abastecer o estoque automaticamente.</p>
            </div>
          </div>
          <div style={{display:'flex', gap:'5px', flexWrap:'wrap'}}>
            {pedidosPendentes.map(p => (
              <Button key={p.id} onClick={() => iniciarRecebimento(p)} style={{ backgroundColor: '#f97316', fontSize: '11px', padding: '6px 10px' }}>
                Receber #{p.id.slice(-5).toUpperCase()}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h1 style={{ fontSize: '24px', color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Package color="var(--cor-primaria)" /> Estoque: {nomeSetor}
          </h1>
        </div>
        <Button onClick={abrirModalNovo} style={{ display: 'flex', gap: '8px', height: '44px' }}>
          <Plus size={20} /> Novo Item
        </Button>
      </div>

      {/* BUSCA E FILTROS */}
      <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '10px', border: '1px solid #e2e8f0' }}>
        <div style={{ flex: '1 1 300px', position: 'relative' }}>
          <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '12px' }} />
          <input type="text" placeholder="Buscar..." value={busca} onChange={e => setBusca(e.target.value)} style={{ width: '100%', padding: '10px 10px 10px 40px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
        </div>
        <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
          <option value="">Todas Categorias</option>
          {categoriasUnicas.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
          <option value="todos">Status: Todos</option>
          <option value="baixo">Abaixo do Mínimo</option>
          <option value="ignorado">Padrão Baixo</option>
        </select>
      </div>

      {/* GRID DE ITENS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
        {estoqueFiltrado.map(item => {
          const isBaixo = item.quantidade <= item.minimo;
          const corBorda = item.ignorarAlerta ? '#f59e0b' : (isBaixo ? '#ef4444' : '#10b981');
          return (
            <div key={item.id} style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', borderTop: `4px solid ${corBorda}`, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                 <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#3b82f6', backgroundColor: '#eff6ff', padding: '4px 8px', borderRadius: '50px' }}>{item.categoria}</span>
                 <div style={{ display: 'flex', gap: '5px' }}>
                    <button onClick={() => abrirModalEdicao(item)} style={{ background: '#f1f5f9', border: 'none', padding: '5px', borderRadius: '4px' }}><Edit size={14}/></button>
                    <button onClick={async () => { if(confirm(`Excluir ${item.nome}?`)) await deleteDoc(doc(db, 'estoque', item.id)) }} style={{ background: '#fef2f2', border: 'none', padding: '5px', borderRadius: '4px', color: '#ef4444' }}><Trash2 size={14}/></button>
                 </div>
              </div>
              <h3 style={{ fontSize: '15px', margin: '0 0 10px 0', fontWeight: '800' }}>{item.nome}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', marginBottom: '15px' }}>
                 <div style={badgeStyle}><ShieldCheck size={12}/> {item.ca || 'S/ CA'}</div>
                 <div style={badgeStyle}><Factory size={12}/> {item.marca || 'Diversas'}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                 <div>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>Saldo</span>
                    <div style={{ fontSize: '20px', fontWeight: '900' }}>{item.quantidade} <small style={{fontSize:'10px'}}>{item.unidade}</small></div>
                 </div>
                 {isBaixo && !item.ignorarAlerta && <span style={{color:'#ef4444', fontSize:'11px', fontWeight:'bold'}}>REPOR!</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL ADICIONAR/EDITAR ORIGINAL */}
      {modalAberto && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '15px' }}>
          <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '600px', borderRadius: '20px', maxHeight: '90vh', overflowY: 'auto', padding: '25px' }}>
            <h3 style={{ marginBottom: '20px' }}>{itemEditando ? 'Editar Material' : 'Novo Material'}</h3>
            <form onSubmit={salvarItem} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <Input label="Nome *" value={nome} onChange={e => setNome(e.target.value)} required />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <Input label="Categoria *" value={categoria} onChange={e => setCategoria(e.target.value)} required />
                <Input label="Subcategoria" value={subcategoria} onChange={e => setSubcategoria(e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <Input label="Marca" value={marca} onChange={e => setMarca(e.target.value)} />
                <Input label="C.A." value={ca} onChange={e => setCa(e.target.value)} />
                <Input label="NCM" value={ncm} onChange={e => setNcm(e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <Input label="Qtd Atual *" type="number" value={quantidade} onChange={e => setQuantidade(e.target.value)} required />
                <Input label="Qtd Mínima *" type="number" value={minimo} onChange={e => setMinimo(e.target.value)} required />
                <Input label="Vida Útil (Dias)" type="number" value={durabilidade} onChange={e => setDurabilidade(e.target.value)} />
              </div>
              <Button type="submit" style={{ backgroundColor: '#10b981', height: '50px' }}>Salvar</Button>
              <Button type="button" onClick={() => setModalAberto(false)} style={{ backgroundColor: '#f1f5f9', color: '#1e293b' }}>Cancelar</Button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFERÊNCIA DE RECEBIMENTO */}
      {pedidoRecebendo && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.9)', zIndex: 20000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '15px' }}>
          <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '800px', borderRadius: '20px', maxHeight: '90vh', overflowY: 'auto', padding: '25px' }}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px'}}>
              <h3>Conferência de Recebimento: Pedido #{pedidoRecebendo.id.slice(-5).toUpperCase()}</h3>
              <button onClick={() => setPedidoRecebendo(null)} style={{border:'none', background:'none'}}><X/></button>
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
              {itensConferencia.map((item, idx) => (
                <div key={idx} style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: item.estoqueId ? '#f0fdf4' : '#fffbeb' }}>
                  <div style={{display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:'10px', alignItems:'center'}}>
                    <strong>{item.nome}</strong>
                    <input type="number" value={item.quantidadeRecebida} onChange={e => {
                      const nova = [...itensConferencia]; nova[idx].quantidadeRecebida = e.target.value; setItensConferencia(nova);
                    }} style={{width:'100%', padding:'5px', borderRadius:'4px', border:'1px solid #ccc'}}/>
                    <span style={{fontSize:'10px', fontWeight:'bold', textAlign:'right'}}>{item.estoqueId ? 'ESTOQUE OK' : 'NOVO ITEM'}</span>
                  </div>
                  {!item.estoqueId && (
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginTop:'10px'}}>
                       <input placeholder="Categoria *" value={item.categoria} onChange={e => { const n = [...itensConferencia]; n[idx].categoria = e.target.value; setItensConferencia(n); }} style={{padding:'5px', fontSize:'12px'}}/>
                       <input placeholder="Subcategoria" value={item.subcategoria} onChange={e => { const n = [...itensConferencia]; n[idx].subcategoria = e.target.value; setItensConferencia(n); }} style={{padding:'5px', fontSize:'12px'}}/>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <Button onClick={finalizarEntrada} style={{width:'100%', height:'50px', marginTop:'20px', backgroundColor:'#10b981'}}>Confirmar Abastecimento</Button>
          </div>
        </div>
      )}
    </div>
  );
}

const badgeStyle = { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#475569', backgroundColor: '#f8fafc', padding: '6px 8px', borderRadius: '6px', border: '1px solid #e2e8f0' };