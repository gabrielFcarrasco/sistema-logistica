// src/pages/PedidosCompra.tsx
import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { collection, onSnapshot, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { 
  ShoppingCart, Plus, Trash2, Printer, FileText, 
  FileSpreadsheet, PackageSearch, X, User, Shirt, Save, 
  Search, Package, ListPlus, CheckCircle2, AlertCircle
} from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

interface ItemPedido {
  id: string;
  nome: string;
  quantidade: number;
  unidade: string;
  ca?: string;
  marca?: string;
  ncm?: string;
  funcionarioId?: string;
  funcionarioNome?: string;
  tamanho?: string;
}

export default function PedidosCompra() {
  const { setorAtivo } = useOutletContext<{ setorAtivo: string }>();
  
  const [estoqueCompleto, setEstoqueCompleto] = useState<any[]>([]);
  const [estoqueBaixo, setEstoqueBaixo] = useState<any[]>([]);
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  
  const [itensPedido, setItensPedido] = useState<ItemPedido[]>([]);
  const [buscaEstoque, setBuscaEstoque] = useState('');
  
  // Estados para Uniforme Individual
  const [idFuncSelected, setIdFuncSelected] = useState('');
  const [itemUniforme, setItemUniforme] = useState('');

  // Estados para Entrada Manual
  const [nomeManual, setNomeManual] = useState('');
  const [qtdManual, setQtdManual] = useState('1');
  const [unidManual, setUnidManual] = useState('UN');

  const [mostrarPreview, setMostrarPreview] = useState(false);
  const [estiloProfissional, setEstiloProfissional] = useState(true);
  const [notificacao, setNotificacao] = useState<{msg: string, tipo: 'sucesso' | 'erro'} | null>(null);

  const avisar = (msg: string, tipo: 'sucesso' | 'erro' = 'sucesso') => {
    setNotificacao({ msg, tipo });
    setTimeout(() => setNotificacao(null), 4000);
  };

  useEffect(() => {
    if (!setorAtivo) return;
    const qEstoque = query(collection(db, 'estoque'), where('setorId', '==', setorAtivo));
    const unsubEstoque = onSnapshot(qEstoque, (snap) => {
      const todos = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setEstoqueCompleto(todos);
      setEstoqueBaixo(todos.filter(i => i.quantidade <= (i.minimo || 0)));
    });

    const qFunc = query(collection(db, 'funcionarios'), where('setorId', '==', setorAtivo));
    const unsubFunc = onSnapshot(qFunc, (snap) => setFuncionarios(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { unsubEstoque(); unsubFunc(); };
  }, [setorAtivo]);

  const adicionarAoPedido = (item: any, tipo: 'estoque' | 'uniforme' | 'manual', qtdExtra?: number) => {
    let novoItem: ItemPedido;

    if (tipo === 'uniforme') {
      novoItem = {
        id: `uni-${Date.now()}`,
        nome: `${itemUniforme} (Para: ${item.nome})`,
        quantidade: 1,
        unidade: 'UN',
        funcionarioId: item.id,
        funcionarioNome: item.nome,
        tamanho: item.tamanhoUniforme || 'N/A'
      };
      setIdFuncSelected(''); setItemUniforme('');
    } else if (tipo === 'manual') {
      novoItem = {
        id: `man-${Date.now()}`,
        nome: nomeManual,
        quantidade: Number(qtdManual),
        unidade: unidManual
      };
      setNomeManual(''); setQtdManual('1');
    } else {
      // Padrão do estoque ou quantidade editada na busca
      const qtdFinal = qtdExtra || Math.max((item.minimo * 2) - item.quantidade, 1);
      novoItem = {
        id: item.id,
        nome: item.nome,
        quantidade: qtdFinal,
        unidade: item.unidade || 'UN',
        ca: item.ca || '',
        marca: item.marca || '',
        ncm: item.ncm || ''
      };
      setBuscaEstoque('');
    }

    setItensPedido([...itensPedido, novoItem]);
    avisar("Item adicionado!");
  };

  const finalizarPedido = async () => {
    try {
      const pedidoRef = await addDoc(collection(db, 'pedidos_compra_logs'), {
        setorId: setorAtivo,
        data: serverTimestamp(),
        itens: itensPedido,
        empresa: "CARVALHO FUNILARIA E PINTURAS LTDA",
        cnpj: "31.362.302/0001-33"
      });

      // Cria pendências para itens com dono
      for (const item of itensPedido) {
        if (item.funcionarioId) {
          await addDoc(collection(db, 'entregas_pendentes'), {
            funcionarioId: item.funcionarioId,
            funcionarioNome: item.funcionarioNome,
            itemNome: item.nome.split(' (')[0],
            tamanho: item.tamanho,
            setorId: setorAtivo,
            pedidoLogId: pedidoRef.id,
            status: 'aguardando_chegada',
            dataSolicitacao: serverTimestamp()
          });
        }
      }
      setMostrarPreview(true);
      avisar("Pedido salvo!");
    } catch (e) { avisar("Erro ao salvar.", "erro"); }
  };

  const estoqueFiltrado = estoqueCompleto.filter(i => 
    i.nome.toLowerCase().includes(buscaEstoque.toLowerCase())
  ).slice(0, 3);

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '10px', paddingBottom: '80px' }}>
      
      {notificacao && (
        <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 11000, backgroundColor: notificacao.tipo === 'sucesso' ? '#10b981' : '#ef4444', color: 'white', padding: '12px 24px', borderRadius: '50px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold' }}>
          {notificacao.tipo === 'sucesso' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />} {notificacao.msg}
        </div>
      )}

      <style>{`
        @media print { body * { visibility: hidden; } #print-area, #print-area * { visibility: visible; } #print-area { position: absolute; left: 0; top: 0; width: 100%; } .no-print { display: none !important; } }
      `}</style>

      <div className="no-print" style={{ marginBottom: '20px', marginTop: '10px' }}>
        <h1 style={{ fontSize: '22px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ShoppingCart size={28} color="var(--cor-primaria)" /> Central de Pedidos
        </h1>
      </div>

      <div className="no-print" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
        
        {/* GRID DE ENTRADAS (RESPONSIVO) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
          
          {/* 1. BUSCA E EDIÇÃO (AZUL) */}
          <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '12px', boxShadow: 'var(--sombra-card)', borderTop: '4px solid #3b82f6' }}>
            <h3 style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#3b82f6', fontWeight: 'bold' }}>
              <Search size={16} /> BUSCAR E EDITAR ESTOQUE
            </h3>
            <input 
              type="text" placeholder="Pesquisar material..." 
              value={buscaEstoque} onChange={e => setBuscaEstoque(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '10px', fontSize: '14px' }}
            />
            {buscaEstoque && estoqueFiltrado.map(item => (
              <div key={item.id} style={{ padding: '10px', backgroundColor: '#f0f7ff', borderRadius: '8px', border: '1px solid #dbeafe', marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <strong style={{ fontSize: '12px' }}>{item.nome}</strong>
                  <span style={{ fontSize: '11px', color: '#3b82f6' }}>Saldo: {item.quantidade}</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                   <input type="number" placeholder="Pedir" id={`qtd-${item.id}`} style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                   <Button onClick={() => {
                     const val = (document.getElementById(`qtd-${item.id}`) as HTMLInputElement).value;
                     adicionarAoPedido(item, 'estoque', Number(val));
                   }} style={{ height: '35px', padding: '0 10px' }}><Plus size={16}/></Button>
                </div>
              </div>
            ))}
          </div>

          {/* 2. UNIFORMES (ROXO) */}
          <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '12px', boxShadow: 'var(--sombra-card)', borderTop: '4px solid #8b5cf6' }}>
            <h3 style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#8b5cf6', fontWeight: 'bold' }}>
              <Shirt size={16} /> PEDIDO INDIVIDUAL
            </h3>
            <select value={idFuncSelected} onChange={e => setIdFuncSelected(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '8px', fontSize: '14px' }}>
              <option value="">Selecione o Colaborador...</option>
              {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome} ({f.tamanhoUniforme || '?'})</option>)}
            </select>
            <Input label="" placeholder="O que pedir? (Ex: Bota)" value={itemUniforme} onChange={e => setItemUniforme(e.target.value)} />
            <Button onClick={() => adicionarAoPedido(funcionarios.find(f => f.id === idFuncSelected), 'uniforme')} style={{ backgroundColor: '#8b5cf6', width: '100%', marginTop: '10px' }}>Vincular ao Pedido</Button>
          </div>

          {/* 3. ADIÇÃO MANUAL (CINZA) */}
          <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '12px', boxShadow: 'var(--sombra-card)', borderTop: '4px solid #64748b' }}>
            <h3 style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#64748b', fontWeight: 'bold' }}>
              <ListPlus size={16} /> ADICIONAR MANUAL
            </h3>
            <Input label="" placeholder="Descrição do material..." value={nomeManual} onChange={e => setNomeManual(e.target.value)} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
               <Input label="" type="number" value={qtdManual} onChange={e => setQtdManual(e.target.value)} />
               <select value={unidManual} onChange={e => setUnidManual(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: 'white' }}>
                  <option value="UN">UN</option><option value="PAR">PAR</option><option value="CX">CX</option>
               </select>
            </div>
            <Button onClick={() => adicionarAoPedido(null, 'manual')} style={{ backgroundColor: '#64748b', width: '100%', marginTop: '10px' }}>Incluir Manual</Button>
          </div>

        </div>

        {/* LISTA FINAL / CARRINHO */}
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: 'var(--sombra-card)' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '15px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>Itens no Pedido ({itensPedido.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
            {itensPedido.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: item.funcionarioId ? '#f5f3ff' : '#f8fafc', borderRadius: '10px', border: `1px solid ${item.funcionarioId ? '#ddd6fe' : '#e2e8f0'}` }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{item.nome}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Qtd: {item.quantidade} {item.unidade} {item.tamanho && `| Tam: ${item.tamanho}`}</div>
                </div>
                <button onClick={() => setItensPedido(itensPedido.filter((_, i) => i !== idx))} style={{ color: '#ef4444', background: 'none', border: 'none' }}><Trash2 size={18} /></button>
              </div>
            ))}
          </div>
          <Button onClick={finalizarPedido} disabled={itensPedido.length === 0} style={{ width: '100%', height: '54px', fontSize: '16px', backgroundColor: '#10b981' }}>
            <Save size={20} style={{ marginRight: '8px' }} /> Finalizar e Gerar PDF
          </Button>
        </div>

      </div>

      {/* MODAL DE PREVIEW PDF */}
      {mostrarPreview && (
        <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.98)', zIndex: 10000, display: 'flex', flexDirection: 'column', padding: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px' }}>
             <button onClick={() => setMostrarPreview(false)} style={{ color: 'white', background: 'none', border: 'none' }}><X size={32}/></button>
             <div style={{ display: 'flex', gap: '10px' }}>
                <Button onClick={() => setEstiloProfissional(!estiloProfissional)} style={{ backgroundColor: '#3b82f6' }}>Mudar p/ {estiloProfissional ? 'Lista' : 'Orçamento'}</Button>
                <Button onClick={() => window.print()} style={{ backgroundColor: '#10b981' }}><Printer size={20} /> Imprimir</Button>
             </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
            <div id="print-area" style={{ backgroundColor: 'white', width: '100%', minHeight: '100%', padding: '40px', color: 'black', borderRadius: '8px', fontFamily: estiloProfissional ? 'serif' : 'sans-serif' }}>
              {estiloProfissional ? (
                <div>
                  <h1 style={{ fontSize: '22px', margin: 0 }}>CARVALHO FUNILARIA E PINTURAS LTDA</h1>
                  <p style={{ fontSize: '13px', borderBottom: '2px solid black', paddingBottom: '10px' }}>CNPJ: 31.362.302/0001-33 | Araraquara/SP | Unidade: {setorAtivo}</p>
                  <h2 style={{ textAlign: 'center', fontSize: '18px', margin: '20px 0' }}>SOLICITAÇÃO DE ORÇAMENTO</h2>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f0f0f0' }}>
                        <th style={tHead}>DESCRIÇÃO</th>
                        <th style={tHead}>MARCA/CA</th>
                        <th style={tHead}>NCM</th>
                        <th style={tHead}>QTD</th>
                        <th style={tHead}>PARA QUEM?</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itensPedido.map((item, idx) => (
                        <tr key={idx}>
                          <td style={tCell}>{item.nome.split(' (')[0]}</td>
                          <td style={tCell}>{item.marca || '-'} {item.ca ? `/ CA: ${item.ca}` : ''}</td>
                          <td style={tCell}>{item.ncm || '-'}</td>
                          <td style={{...tCell, fontWeight: 'bold'}}>{item.quantidade} {item.unidade}</td>
                          <td style={tCell}>{item.funcionarioNome ? `${item.funcionarioNome} (${item.tamanho})` : 'ESTOQUE'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: '20px' }}>
                  <h2 style={{ textAlign: 'center', borderBottom: '1px solid #000', paddingBottom: '10px' }}>LISTA DE COMPRAS - CARVALHO</h2>
                  <div style={{ marginTop: '20px' }}>
                    {itensPedido.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '12px 0', borderBottom: '1px dashed #ccc' }}>
                        <div style={{ width: '20px', height: '20px', border: '1.5px solid black' }}></div>
                        <span style={{ fontSize: '16px' }}><strong>{item.quantidade} {item.unidade}</strong> — {item.nome}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const tHead: React.CSSProperties = { border: '1px solid black', padding: '10px', fontSize: '11px', textAlign: 'left' };
const tCell: React.CSSProperties = { border: '1px solid black', padding: '10px', fontSize: '12px' };