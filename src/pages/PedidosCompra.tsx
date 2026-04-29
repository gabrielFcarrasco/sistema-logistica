// src/pages/PedidosCompra.tsx
import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { collection, onSnapshot, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { 
  ShoppingCart, Plus, Trash2, Printer, 
  X, Shirt, Save, Search, ListPlus, 
  CheckCircle2, AlertCircle, Footprints, Scissors
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
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  
  const [itensPedido, setItensPedido] = useState<ItemPedido[]>([]);
  const [buscaEstoque, setBuscaEstoque] = useState('');
  
  // Estados para Uniforme Individual
  const [idFuncSelected, setIdFuncSelected] = useState('');
  const [tipoVestuario, setTipoVestuario] = useState<'Camisa' | 'Calça' | 'Bota'>('Camisa');
  const [qtdVestuario, setQtdVestuario] = useState('1');

  // Estados para Entrada Manual
  const [nomeManual, setNomeManual] = useState('');
  const [qtdManual, setQtdManual] = useState('1');
  const [unidManual, setUnidManual] = useState('UN');

  const [mostrarPreview, setMostrarPreview] = useState(false);
  const [estiloProfissional, setEstiloProfissional] = useState(true);
  const [notificacao, setNotificacao] = useState<{msg: string, tipo: 'sucesso' | 'erro'} | null>(null);
  const [salvando, setSalvando] = useState(false);

  const avisar = (msg: string, tipo: 'sucesso' | 'erro' = 'sucesso') => {
    setNotificacao({ msg, tipo });
    setTimeout(() => setNotificacao(null), 4000);
  };

  useEffect(() => {
    if (!setorAtivo) return;
    const qEstoque = query(collection(db, 'estoque'), where('setorId', '==', setorAtivo));
    const unsubEstoque = onSnapshot(qEstoque, (snap) => {
      setEstoqueCompleto(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    });

    const qFunc = query(collection(db, 'funcionarios'), where('setorId', '==', setorAtivo));
    const unsubFunc = onSnapshot(qFunc, (snap) => setFuncionarios(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { unsubEstoque(); unsubFunc(); };
  }, [setorAtivo]);

  const adicionarAoPedido = (item: any, tipo: 'estoque' | 'uniforme' | 'manual', qtdExtra?: number) => {
    let novoItem: ItemPedido;

    if (tipo === 'uniforme') {
      if (!item) return avisar("Selecione um colaborador primeiro.", "erro");
      if (Number(qtdVestuario) <= 0) return avisar("Quantidade inválida.", "erro");

      const isBota = tipoVestuario === 'Bota';
      const tamanhoDefinido = isBota ? (item.tamanhoCalcado || 'N/I') : (item.tamanhoUniforme || 'N/I');
      const unidadeDefinida = isBota ? 'PAR' : 'UN';

      novoItem = {
        id: `uni-${Date.now()}`,
        nome: `${tipoVestuario} de Segurança`,
        quantidade: Number(qtdVestuario),
        unidade: unidadeDefinida,
        funcionarioId: item.id,
        funcionarioNome: item.nome,
        tamanho: tamanhoDefinido
      };
      
      setIdFuncSelected(''); 
      setQtdVestuario('1');
      setTipoVestuario('Camisa');
      
    } else if (tipo === 'manual') {
      if (!nomeManual) return avisar("Preencha o nome do material.", "erro");
      novoItem = {
        id: `man-${Date.now()}`,
        nome: nomeManual,
        quantidade: Number(qtdManual),
        unidade: unidManual
      };
      setNomeManual(''); setQtdManual('1');
    } else {
      const qtdFinal = qtdExtra || 1;
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
    avisar("Adicionado ao pedido!");
  };

  const finalizarPedido = async () => {
    setSalvando(true);
    try {
      const pedidoRef = await addDoc(collection(db, 'pedidos_compra_logs'), {
        setorId: setorAtivo,
        data: serverTimestamp(),
        itens: itensPedido,
        empresa: "CARVALHO FUNILARIA E PINTURAS LTDA",
        cnpj: "31.362.302/0001-33"
      });

      for (const item of itensPedido) {
        if (item.funcionarioId) {
          await addDoc(collection(db, 'entregas_pendentes'), {
            funcionarioId: item.funcionarioId,
            funcionarioNome: item.funcionarioNome,
            itemNome: item.nome,
            tamanho: item.tamanho,
            setorId: setorAtivo,
            pedidoLogId: pedidoRef.id,
            status: 'aguardando_chegada',
            dataSolicitacao: serverTimestamp()
          });
        }
      }
      setMostrarPreview(true);
    } catch (e) { avisar("Erro ao salvar.", "erro"); }
    setSalvando(false);
  };

  const estoqueFiltrado = estoqueCompleto.filter(i => 
    i.nome.toLowerCase().includes(buscaEstoque.toLowerCase()) || 
    (i.categoria && i.categoria.toLowerCase().includes(buscaEstoque.toLowerCase()))
  ).slice(0, 3);

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '15px', paddingBottom: '80px' }}>
      
      {notificacao && (
        <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 11000, backgroundColor: notificacao.tipo === 'sucesso' ? '#10b981' : '#ef4444', color: 'white', padding: '12px 24px', borderRadius: '50px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold' }}>
          {notificacao.tipo === 'sucesso' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />} {notificacao.msg}
        </div>
      )}

      {/* 🚀 OTIMIZAÇÃO MAXIMA DO PDF */}
      <style>{`
        @media print { 
          body { margin: 0; padding: 0; background: white; }
          body * { visibility: hidden; } 
          #print-area, #print-area * { visibility: visible; } 
          #print-area { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 100%; 
            margin: 0; 
            padding: 20px !important; 
            box-sizing: border-box; 
            min-height: 0 !important; /* Evita folha extra */
          } 
          .no-print { display: none !important; } 
          table { width: 100%; border-collapse: collapse; page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; } /* Não corta linha no meio */
          thead { display: table-header-group; } /* Repete o cabeçalho se houver página 2 */
        }
      `}</style>

      <div className="no-print" style={{ marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <ShoppingCart size={28} color="var(--cor-primaria)" />
        <div>
          <h1 style={{ fontSize: '22px', color: '#1e293b', margin: 0, fontWeight: '800' }}>Pedidos de Compra</h1>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Monte sua lista e gere o orçamento em PDF</p>
        </div>
      </div>

      <div className="no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        
        {/* COLUNA ESQUERDA: ADICIONAR ITENS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', borderTop: '4px solid #3b82f6' }}>
            <h3 style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 15px 0', color: '#1d4ed8', fontWeight: 'bold' }}>
              <Search size={18} /> BUSCAR DO ESTOQUE
            </h3>
            <input 
              type="text" placeholder="Nome do material ou categoria..." 
              value={buscaEstoque} onChange={e => setBuscaEstoque(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '10px', fontSize: '14px', outline: 'none' }}
            />
            {buscaEstoque && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {estoqueFiltrado.length === 0 ? (
                  <p style={{ fontSize: '13px', color: '#94a3b8', textAlign: 'center' }}>Item não encontrado.</p>
                ) : (
                  estoqueFiltrado.map(item => (
                    <div key={item.id} style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <strong style={{ fontSize: '14px', color: '#1e293b' }}>{item.nome}</strong>
                        <span style={{ fontSize: '12px', color: '#3b82f6', fontWeight: 'bold', backgroundColor: '#eff6ff', padding: '2px 8px', borderRadius: '50px' }}>Em mãos: {item.quantidade}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '10px' }}>
                         <input type="number" defaultValue="1" min="1" id={`qtd-${item.id}`} style={{ width: '80px', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
                         <Button onClick={() => {
                           const val = (document.getElementById(`qtd-${item.id}`) as HTMLInputElement).value;
                           adicionarAoPedido(item, 'estoque', Number(val));
                         }} style={{ flex: 1, backgroundColor: '#3b82f6', fontWeight: 'bold' }}><Plus size={18} style={{marginRight: '5px'}}/> Adicionar</Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', borderTop: '4px solid #8b5cf6' }}>
            <h3 style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 15px 0', color: '#6d28d9', fontWeight: 'bold' }}>
              <Shirt size={18} /> VESTUÁRIO E EPI INDIVIDUAL
            </h3>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '5px' }}>PARA QUEM?</label>
            <select value={idFuncSelected} onChange={e => setIdFuncSelected(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '15px', fontSize: '14px', outline: 'none', backgroundColor: '#f8fafc' }}>
              <option value="">Selecione o Colaborador...</option>
              {funcionarios.map(f => (
                <option key={f.id} value={f.id}>
                  {f.nome} (Roupa: {f.tamanhoUniforme || '?'} | Bota: {f.tamanhoCalcado || '?'})
                </option>
              ))}
            </select>

            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '5px' }}>O QUE ELE PRECISA?</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '15px' }}>
              <button type="button" onClick={() => setTipoVestuario('Camisa')} style={{ padding: '10px', borderRadius: '8px', border: tipoVestuario === 'Camisa' ? '2px solid #8b5cf6' : '1px solid #cbd5e1', backgroundColor: tipoVestuario === 'Camisa' ? '#f5f3ff' : 'white', color: tipoVestuario === 'Camisa' ? '#6d28d9' : '#64748b', fontWeight: 'bold', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', transition: '0.2s' }}>
                <Shirt size={20} /> Camisa
              </button>
              <button type="button" onClick={() => setTipoVestuario('Calça')} style={{ padding: '10px', borderRadius: '8px', border: tipoVestuario === 'Calça' ? '2px solid #8b5cf6' : '1px solid #cbd5e1', backgroundColor: tipoVestuario === 'Calça' ? '#f5f3ff' : 'white', color: tipoVestuario === 'Calça' ? '#6d28d9' : '#64748b', fontWeight: 'bold', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', transition: '0.2s' }}>
                <Scissors size={20} /> Calça
              </button>
              <button type="button" onClick={() => setTipoVestuario('Bota')} style={{ padding: '10px', borderRadius: '8px', border: tipoVestuario === 'Bota' ? '2px solid #8b5cf6' : '1px solid #cbd5e1', backgroundColor: tipoVestuario === 'Bota' ? '#f5f3ff' : 'white', color: tipoVestuario === 'Bota' ? '#6d28d9' : '#64748b', fontWeight: 'bold', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', transition: '0.2s' }}>
                <Footprints size={20} /> Bota
              </button>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <Input label="Qtd" type="number" value={qtdVestuario} onChange={e => setQtdVestuario(e.target.value)} />
              <Button onClick={() => adicionarAoPedido(funcionarios.find(f => f.id === idFuncSelected), 'uniforme')} style={{ backgroundColor: '#8b5cf6', flex: 1, height: '48px', alignSelf: 'flex-end', fontWeight: 'bold' }}>
                Adicionar ao Carrinho
              </Button>
            </div>
          </div>

          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', borderTop: '4px solid #64748b' }}>
            <h3 style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 15px 0', color: '#475569', fontWeight: 'bold' }}>
              <ListPlus size={18} /> ADICIONAR ITEM AVULSO
            </h3>
            <Input label="Nome / Descrição" placeholder="Material que não está no estoque..." value={nomeManual} onChange={e => setNomeManual(e.target.value)} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '10px', marginTop: '10px', alignItems: 'end' }}>
               <Input label="Qtd" type="number" value={qtdManual} onChange={e => setQtdManual(e.target.value)} />
               <div>
                 <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '5px' }}>Unidade</label>
                 <select value={unidManual} onChange={e => setUnidManual(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: 'white', outline: 'none' }}>
                    <option value="UN">UN</option><option value="PAR">PAR</option><option value="CX">CX</option><option value="M">METROS</option><option value="L">LITROS</option>
                 </select>
               </div>
               <Button onClick={() => adicionarAoPedido(null, 'manual')} style={{ backgroundColor: '#64748b', height: '48px', padding: '0 15px' }}><Plus size={20}/></Button>
            </div>
          </div>

        </div>

        {/* COLUNA DIREITA: CARRINHO FINAL */}
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <h3 style={{ fontSize: '16px', margin: '0 0 15px 0', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Sua Lista</span>
            <span style={{ backgroundColor: '#e2e8f0', padding: '4px 10px', borderRadius: '50px', fontSize: '13px', color: '#475569' }}>{itensPedido.length} itens</span>
          </h3>
          
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
            {itensPedido.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 20px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                <ShoppingCart size={40} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: '14px' }}>Seu carrinho está vazio.</p>
              </div>
            ) : (
              itensPedido.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', backgroundColor: item.funcionarioId ? '#f5f3ff' : '#f8fafc', borderRadius: '12px', border: `1px solid ${item.funcionarioId ? '#ddd6fe' : '#e2e8f0'}` }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#1e293b', marginBottom: '4px' }}>{item.nome}</div>
                    <div style={{ fontSize: '13px', color: '#64748b', display: 'flex', gap: '10px' }}>
                      <span style={{ backgroundColor: 'white', padding: '2px 6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}>{item.quantidade} {item.unidade}</span>
                      {item.funcionarioNome && <span style={{ color: '#6d28d9' }}>👤 {item.funcionarioNome} (Tam: <strong>{item.tamanho}</strong>)</span>}
                    </div>
                  </div>
                  <button onClick={() => setItensPedido(itensPedido.filter((_, i) => i !== idx))} style={{ color: '#ef4444', background: '#fef2f2', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer', display: 'flex' }}><Trash2 size={18} /></button>
                </div>
              ))
            )}
          </div>

          <Button onClick={finalizarPedido} disabled={itensPedido.length === 0 || salvando} style={{ width: '100%', height: '60px', fontSize: '16px', backgroundColor: '#10b981', fontWeight: 'bold' }}>
            {salvando ? 'PROCESSANDO...' : <><Save size={20} style={{ marginRight: '10px' }} /> FINALIZAR E GERAR PDF</>}
          </Button>
        </div>

      </div>

      {/* 🖨️ MODAL DE PREVIEW E IMPRESSÃO (OTIMIZADO) */}
      {mostrarPreview && (
        <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.98)', zIndex: 10000, display: 'flex', flexDirection: 'column', padding: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px' }}>
             <button onClick={() => setMostrarPreview(false)} style={{ color: 'white', background: 'none', border: 'none', cursor: 'pointer' }}><X size={32}/></button>
             <div style={{ display: 'flex', gap: '10px' }}>
                <Button onClick={() => setEstiloProfissional(!estiloProfissional)} style={{ backgroundColor: '#3b82f6' }}>Mudar p/ {estiloProfissional ? 'Lista Simples' : 'Orçamento Formal'}</Button>
                <Button onClick={() => window.print()} style={{ backgroundColor: '#10b981' }}><Printer size={20} style={{marginRight: '8px'}} /> Imprimir / Salvar PDF</Button>
             </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', justifyContent: 'center' }}>
            {/* O ID print-area agora foca apenas no conteúdo limpo */}
            <div id="print-area" style={{ backgroundColor: 'white', width: '100%', maxWidth: '900px', padding: '30px', color: 'black', fontFamily: estiloProfissional ? 'serif' : 'sans-serif' }}>
              {estiloProfissional ? (
                <div>
                  <h1 style={{ fontSize: '24px', margin: 0, fontWeight: '900' }}>CARVALHO FUNILARIA E PINTURAS LTDA</h1>
                  <p style={{ fontSize: '13px', borderBottom: '2px solid black', paddingBottom: '15px', color: '#333' }}>CNPJ: 31.362.302/0001-33 | Araraquara/SP | Unidade: {setorAtivo}</p>
                  <h2 style={{ textAlign: 'center', fontSize: '18px', margin: '20px 0' }}>SOLICITAÇÃO DE ORÇAMENTO / COMPRA</h2>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc' }}>
                        <th style={tHead}>QTD</th>
                        <th style={tHead}>DESCRIÇÃO DO ITEM</th>
                        <th style={tHead}>MARCA / C.A.</th>
                        <th style={tHead}>DESTINADO A / TAMANHO</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itensPedido.map((item, idx) => (
                        <tr key={idx}>
                          <td style={{...tCell, fontWeight: 'bold', textAlign: 'center', width: '80px'}}>{item.quantidade} {item.unidade}</td>
                          <td style={{...tCell, fontWeight: 'bold'}}>{item.nome.split(' (')[0]}</td>
                          <td style={tCell}>{item.marca || '-'} {item.ca ? `/ CA: ${item.ca}` : ''}</td>
                          <td style={tCell}>{item.funcionarioNome ? `${item.funcionarioNome} (Tam: ${item.tamanho})` : 'ESTOQUE GERAL'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ marginTop: '50px', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid black', paddingTop: '10px', fontSize: '12px' }}>
                    <span>Data do Pedido: {new Date().toLocaleDateString('pt-BR')}</span>
                    <span>Assinatura do Responsável: ___________________________________</span>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '20px' }}>
                  <h2 style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '10px' }}>LISTA DE COMPRAS RÁPIDA</h2>
                  <div style={{ marginTop: '30px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {itensPedido.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '10px 0', borderBottom: '1px dashed #ccc' }}>
                        <div style={{ width: '25px', height: '25px', border: '2px solid black', borderRadius: '4px' }}></div>
                        <span style={{ fontSize: '18px' }}>
                          <strong>{item.quantidade} {item.unidade}</strong> — {item.nome}
                          {item.funcionarioNome && <span style={{ fontSize: '14px', color: '#555', fontStyle: 'italic' }}> (Para: {item.funcionarioNome} - Tam: {item.tamanho})</span>}
                        </span>
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

const tHead: React.CSSProperties = { border: '1px solid black', padding: '12px', fontSize: '13px', textAlign: 'left', fontWeight: 'bold' };
const tCell: React.CSSProperties = { border: '1px solid black', padding: '12px', fontSize: '14px' };
