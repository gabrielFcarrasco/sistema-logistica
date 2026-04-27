// src/pages/Estoque.tsx
import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { collection, onSnapshot, query, where, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { 
  Package, Search, Plus, Filter, Edit, Trash2, 
  AlertTriangle, CheckCircle2, X, AlertCircle,
  ShieldCheck, Factory, Timer, BellOff
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
  const [estoque, setEstoque] = useState<ItemEstoque[]>([]);
  const [nomeSetor, setNomeSetor] = useState('Carregando...'); // Estado para guardar o nome real da unidade
  
  // Filtros
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');

  // Modal e Form
  const [modalAberto, setModalAberto] = useState(false);
  const [itemEditando, setItemEditando] = useState<ItemEstoque | null>(null);

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

  const avisar = (msg: string, tipo: 'sucesso' | 'erro' = 'sucesso') => {
    setNotificacao({ msg, tipo });
    setTimeout(() => setNotificacao(null), 3000);
  };

  // Busca o NOME REAL do setor e os Itens
  useEffect(() => {
    if (!setorAtivo) return;

    // 1. Busca o nome da unidade para tirar o código criptografado
    getDoc(doc(db, 'setores', setorAtivo)).then(d => {
      if (d.exists()) setNomeSetor(d.data().nome);
    });

    // 2. Busca o estoque
    const q = query(collection(db, 'estoque'), where('setorId', '==', setorAtivo));
    const unsub = onSnapshot(q, (snapshot) => {
      setEstoque(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ItemEstoque)));
    });
    
    return () => unsub();
  }, [setorAtivo]);

  const abrirModalNovo = () => {
    setItemEditando(null);
    setNome(''); setCategoria(''); setSubcategoria(''); setQuantidade(''); 
    setMinimo(''); setDurabilidade(''); setCa(''); setMarca(''); setNcm(''); setUnidade('UN');
    setModalAberto(true);
  };

  const abrirModalEdicao = (item: ItemEstoque) => {
    setItemEditando(item);
    setNome(item.nome || '');
    setCategoria(item.categoria || '');
    setSubcategoria(item.subcategoria || '');
    setQuantidade(item.quantidade?.toString() || '0');
    setMinimo(item.minimo?.toString() || '0');
    setDurabilidade(item.durabilidadeSugerida?.toString() || '');
    setCa(item.ca || '');
    setMarca(item.marca || '');
    setNcm(item.ncm || '');
    setUnidade(item.unidade || 'UN');
    setModalAberto(true);
  };

  const salvarItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !categoria) return avisar("Nome e Categoria são obrigatórios.", "erro");

    const qtdNova = Number(quantidade);
    const minNovo = Number(minimo);

    const dadosForm: any = {
      setorId: setorAtivo,
      nome, categoria, subcategoria, ca, marca, ncm, unidade,
      quantidade: qtdNova, 
      minimo: minNovo, 
      durabilidadeSugerida: Number(durabilidade) || 0,
      atualizadoEm: serverTimestamp()
    };

    // INTELIGÊNCIA: Se a quantidade nova for maior que o mínimo, remove o Mute do Dashboard
    if (qtdNova > minNovo) {
      dadosForm.ignorarAlerta = false;
    }

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

  if (!setorAtivo) return <div style={{textAlign: 'center', padding: '100px', color: '#64748b'}}><h2>Selecione uma Unidade no menu lateral</h2></div>;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '15px', paddingBottom: '80px' }}>
      
      {notificacao && (
        <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, backgroundColor: notificacao.tipo === 'sucesso' ? '#10b981' : '#ef4444', color: 'white', padding: '12px 24px', borderRadius: '50px', boxShadow: '0 10px 15px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold' }}>
          {notificacao.tipo === 'sucesso' ? <CheckCircle2 /> : <AlertCircle />} {notificacao.msg}
        </div>
      )}

      {/* HEADER CORRIGIDO: Agora mostra o NOME DA UNIDADE em vez do Código */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h1 style={{ fontSize: '24px', color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Package color="var(--cor-primaria)" /> Estoque: {nomeSetor}
          </h1>
          <p style={{ color: '#64748b', margin: '4px 0 0 0', fontSize: '14px' }}>Gerencie o estoque e a vida útil dos equipamentos.</p>
        </div>
        <Button onClick={abrirModalNovo} style={{ display: 'flex', gap: '8px', height: '44px' }}>
          <Plus size={20} /> Novo Item
        </Button>
      </div>

      {/* BUSCA E FILTROS */}
      <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '10px', border: '1px solid #e2e8f0' }}>
        <div style={{ flex: '1 1 300px', position: 'relative' }}>
          <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '12px' }} />
          <input type="text" placeholder="Buscar por nome ou categoria..." value={busca} onChange={e => setBusca(e.target.value)} style={{ width: '100%', padding: '10px 10px 10px 40px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px' }} />
        </div>
        <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)} style={{ padding: '10px 15px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', backgroundColor: '#f8fafc', fontSize: '14px' }}>
          <option value="">Todas Categorias</option>
          {categoriasUnicas.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={{ padding: '10px 15px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', backgroundColor: '#f8fafc', fontSize: '14px' }}>
          <option value="todos">Status: Todos</option>
          <option value="baixo">Abaixo do Mínimo</option>
          <option value="ignorado">Padrão Baixo (Mudo)</option>
        </select>
      </div>

      {/* GRID DE ITENS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
        {estoqueFiltrado.map(item => {
          const isBaixo = item.quantidade <= item.minimo;
          const corBorda = item.ignorarAlerta ? '#f59e0b' : (isBaixo ? '#ef4444' : '#10b981');
          
          return (
            <div key={item.id} style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', borderTop: `4px solid ${corBorda}`, display: 'flex', flexDirection: 'column' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'flex-start' }}>
                 <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#3b82f6', backgroundColor: '#eff6ff', padding: '4px 10px', borderRadius: '50px', border: '1px solid #bfdbfe' }}>
                   {item.categoria}
                 </span>
                 <div style={{ display: 'flex', gap: '5px' }}>
                    <button onClick={() => abrirModalEdicao(item)} style={{ background: '#f1f5f9', border: 'none', color: '#64748b', cursor: 'pointer', padding: '6px', borderRadius: '6px' }}><Edit size={16}/></button>
                    <button onClick={async () => { if(confirm(`Deseja mesmo excluir ${item.nome}?`)) await deleteDoc(doc(db, 'estoque', item.id)) }} style={{ background: '#fef2f2', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '6px', borderRadius: '6px' }}><Trash2 size={16}/></button>
                 </div>
              </div>

              <h3 style={{ fontSize: '16px', margin: '0 0 15px 0', color: '#1e293b', fontWeight: '800', lineHeight: '1.3' }}>
                {item.nome}
              </h3>
              
              {/* Informações Técnicas */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '20px' }}>
                 <div style={badgeStyle} title="Certificado de Aprovação"><ShieldCheck size={14} color="#64748b"/> {item.ca || 'Sem C.A'}</div>
                 <div style={badgeStyle} title="Marca do Produto"><Factory size={14} color="#64748b"/> {item.marca || 'Diversas'}</div>
                 {item.durabilidadeSugerida ? (
                   <div style={{...badgeStyle, gridColumn: '1 / -1', backgroundColor: '#f5f3ff', borderColor: '#ede9fe', color: '#7c3aed'}}>
                     <Timer size={14} /> Vida Útil: Aprox. {item.durabilidadeSugerida} dias
                   </div>
                 ) : null}
              </div>

              {/* Rodapé: Quantidade e Status */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '15px', marginTop: 'auto' }}>
                 <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>Em Estoque</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                      <span style={{ fontSize: '24px', fontWeight: '900', color: isBaixo && !item.ignorarAlerta ? '#ef4444' : '#1e293b' }}>
                        {item.quantidade}
                      </span>
                      <small style={{fontSize: '12px', color: '#64748b', fontWeight: 'bold'}}>{item.unidade}</small>
                    </div>
                 </div>
                 
                 {/* Alertas Visuais */}
                 {item.ignorarAlerta ? (
                   <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#f59e0b', fontSize: '11px', fontWeight: 'bold', backgroundColor: '#fffbeb', padding: '6px 10px', borderRadius: '50px' }}>
                     <BellOff size={14} /> Padrão Baixo
                   </div>
                 ) : isBaixo ? (
                   <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#ef4444', fontSize: '11px', fontWeight: 'bold', backgroundColor: '#fef2f2', padding: '6px 10px', borderRadius: '50px' }}>
                     <AlertTriangle size={14} /> Repor!
                   </div>
                 ) : (
                   <div style={{ color: '#10b981' }}>
                     <CheckCircle2 size={24} />
                   </div>
                 )}
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL ADICIONAR/EDITAR RESPONSIVO */}
      {modalAberto && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.85)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '15px', backdropFilter: 'blur(4px)' }}>
          <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '650px', borderRadius: '20px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            
            <div style={{ padding: '20px 25px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 10 }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#1e293b' }}>{itemEditando ? '✏️ Editar Material' : '📦 Cadastrar Novo'}</h3>
              <button onClick={() => setModalAberto(false)} style={{ background: '#f1f5f9', border: 'none', cursor: 'pointer', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={20}/></button>
            </div>

            <form onSubmit={salvarItem} style={{ padding: '25px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              <Input label="Nome do Material / EPI *" value={nome} onChange={e => setNome(e.target.value)} required placeholder="Ex: Bota de Segurança" />
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                <div>
                  <label style={{fontSize: '13px', fontWeight: 'bold', color: '#475569', marginBottom: '6px', display: 'block'}}>Categoria *</label>
                  <input list="cats" value={categoria} onChange={e => setCategoria(e.target.value)} style={inputStyle} required placeholder="Ex: EPI, Ferramentas..." />
                  <datalist id="cats">{categoriasUnicas.map(c => <option key={c} value={c} />)}</datalist>
                </div>
                <div>
                  <label style={{fontSize: '13px', fontWeight: 'bold', color: '#475569', marginBottom: '6px', display: 'block'}}>Subcategoria</label>
                  <input list="subcats" value={subcategoria} onChange={e => setSubcategoria(e.target.value)} style={inputStyle} placeholder="Opcional" />
                  <datalist id="subcats">{subcategoriasUnicas.map(c => <option key={c} value={c} />)}</datalist>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', backgroundColor: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                <Input label="Marca" value={marca} onChange={e => setMarca(e.target.value)} placeholder="Fabricante" />
                <Input label="C.A." value={ca} onChange={e => setCa(e.target.value)} placeholder="Nº Certificado" />
                <Input label="NCM" value={ncm} onChange={e => setNcm(e.target.value)} placeholder="Cód. Fiscal" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '15px', alignItems: 'end' }}>
                <Input label="Qtd Atual *" type="number" value={quantidade} onChange={e => setQuantidade(e.target.value)} required />
                <Input label="Qtd Mínima (Alerta) *" type="number" value={minimo} onChange={e => setMinimo(e.target.value)} required />
                <div>
                  <label style={{fontSize: '13px', fontWeight: 'bold', color: '#475569', marginBottom: '6px', display: 'block'}}>Unidade</label>
                  <select value={unidade} onChange={e => setUnidade(e.target.value)} style={{...inputStyle, marginTop: 0}}>
                    <option value="UN">UN</option>
                    <option value="PAR">PAR</option>
                    <option value="KIT">KIT</option>
                    <option value="CX">CX</option>
                    <option value="M">METROS</option>
                    <option value="L">LITROS</option>
                  </select>
                </div>
                <Input label="Vida Útil (Dias)" type="number" value={durabilidade} onChange={e => setDurabilidade(e.target.value)} placeholder="Ex: 90" />
              </div>

              <Button type="submit" style={{ height: '54px', marginTop: '10px', fontSize: '16px', fontWeight: 'bold', backgroundColor: '#10b981' }}>
                {itemEditando ? 'Salvar Alterações' : 'Cadastrar Material'}
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const badgeStyle = { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#475569', backgroundColor: '#f8fafc', padding: '8px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', whiteSpace: 'nowrap' as any, overflow: 'hidden', textOverflow: 'ellipsis' };
const inputStyle = { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px', backgroundColor: 'white' };