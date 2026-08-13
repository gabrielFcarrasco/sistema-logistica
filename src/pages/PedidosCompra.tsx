// src/pages/PedidosCompra.tsx
import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { collection, onSnapshot, query, where, addDoc, serverTimestamp, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoCarvalho from '../assets/logopdf.png'; 

import { 
  ShoppingCart, Plus, Trash2, Search, 
  FileDown, ListPlus, Tag, ShieldCheck, Hash, History,
  AlertTriangle, UserCheck, CheckCircle2, ShieldAlert, ListChecks, Shirt 
} from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import ModalAssinaturaEntrega from '../components/entrega/ModalAssinaturaEntrega';

interface ItemPedido {
  id: string;
  nome: string;
  quantidade: number;
  unidade: string;
  marca?: string;
  ca?: string;
  ncm?: string;
}

export default function PedidosCompra() {
  const { setorAtivo } = useOutletContext<{ setorAtivo: string }>();
  
  const [estoque, setEstoque] = useState<any[]>([]);
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [itens, setItens] = useState<ItemPedido[]>([]);
  const [historico, setHistorico] = useState<any[]>([]);
  const [nomeUnidade, setNomeUnidade] = useState('Carregando...');

  const [busca, setBusca] = useState('');
  const [qtdsBusca, setQtdsBusca] = useState<{[key: string]: number}>({});
  const [nomeManual, setNomeManual] = useState('');
  const [qtdManual, setQtdManual] = useState(1);
  const [marcaManual, setMarcaManual] = useState('');
  const [caManual, setCaManual] = useState('');
  const [ncmManual, setNcmManual] = useState('');
  const [unidManual, setUnidManual] = useState('UN');

  const [loading, setLoading] = useState(false);
  const [modalEscolhaAberto, setModalEscolhaAberto] = useState(false);
  
  const [colaboradorSelecionado, setColaboradorSelecionado] = useState('');
  const [modalAssinaturaAberta, setModalAssinaturaAberta] = useState(false);
  const [colaboradorUniforme, setColaboradorUniforme] = useState('');

  const [qtdUniforme, setQtdUniforme] = useState(1);
  const [qtdCalcado, setQtdCalcado] = useState(1);

  useEffect(() => {
    if (!setorAtivo) return;
    getDoc(doc(db, 'setores', setorAtivo)).then(d => { if (d.exists()) setNomeUnidade(d.data().nome); });

    const unsubEstoque = onSnapshot(query(collection(db, 'estoque'), where('setorId', '==', setorAtivo)), 
      snap => setEstoque(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    const unsubHist = onSnapshot(query(collection(db, 'pedidos_compra_logs'), where('setorId', '==', setorAtivo)), snap => {
      const logs = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      logs.sort((a, b) => (b.data?.toMillis() || 0) - (a.data?.toMillis() || 0));
      setHistorico(logs);
    });

    const unsubFunc = onSnapshot(collection(db, 'funcionarios'), snap => {
      setFuncionarios(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter((f:any) => f.status !== 'desligado'));
    });

    return () => { unsubEstoque(); unsubHist(); unsubFunc(); };
  }, [setorAtivo]);

  const sugestoesDeCompra = estoque.filter(item => {
    const qtdAtual = Number(item.quantidade) || 0;
    const qtdMinima = Number(item.estoqueMinimo) || 5; 
    return qtdAtual <= qtdMinima;
  });

  const addItemAoCarrinho = (item: any, qtdPersonalizada?: number) => {
    const qtd = qtdPersonalizada || qtdsBusca[item.id] || 1;
    setItens([...itens, { id: item.id, nome: item.nome, quantidade: qtd, unidade: item.unidade || 'UN', marca: item.marca || '', ca: item.ca || '', ncm: item.ncm || '' }]);
    setBusca('');
  };

  const addManual = () => {
    if (!nomeManual) return;
    setItens([...itens, { id: `man-${Date.now()}`, nome: nomeManual, quantidade: qtdManual, unidade: unidManual, marca: marcaManual, ca: caManual, ncm: ncmManual }]);
    setNomeManual(''); setMarcaManual(''); setCaManual(''); setNcmManual(''); setQtdManual(1);
  };

  const addKitUniforme = () => {
    const func = funcionarios.find(f => f.id === colaboradorUniforme);
    if (!func) return;

    const novosItens: ItemPedido[] = [];
    
    if (func.tamanhoUniforme && func.tamanhoUniforme !== 'Não informado' && qtdUniforme > 0) {
      novosItens.push({ 
        id: `kit-uni-${Date.now()}`, 
        nome: `Uniforme (Tamanho: ${func.tamanhoUniforme}) - ${func.nome}`, 
        quantidade: qtdUniforme, 
        unidade: 'UN' 
      });
    }
    
    if (func.tamanhoCalcado && func.tamanhoCalcado !== 'Não informado' && qtdCalcado > 0) {
      novosItens.push({ 
        id: `kit-cal-${Date.now()}`, 
        nome: `Calçado de Segurança (Tamanho: ${func.tamanhoCalcado}) - ${func.nome}`, 
        quantidade: qtdCalcado, 
        unidade: 'PAR' 
      });
    }

    if (novosItens.length === 0) {
      alert(`Coloque uma quantidade maior que zero num item com tamanho registado para adicionar.`);
      return;
    }

    setItens([...itens, ...novosItens]);
    setColaboradorUniforme(''); 
  };

  // ✨ NOVO: Função para atualizar a quantidade diretamente no carrinho
  const atualizarQtdItemCarrinho = (index: number, novaQtd: number) => {
    if (novaQtd < 1) return; // Garante que a quantidade nunca seja zero ou negativa
    const novosItens = [...itens];
    novosItens[index].quantidade = novaQtd;
    setItens(novosItens);
  };

  const gerarPDF = (dados: any, estilo: 'simples' | 'personalizado' | 'entrega_epi', assinaturaBase64?: string) => {
    try {
      const docPdf = new jsPDF(estilo === 'entrega_epi' ? 'p' : 'landscape');
      const azulCarvalho: [number, number, number] = [30, 41, 59];
      const numero = dados.id ? dados.id.slice(-6).toUpperCase() : "SOLIC";
      const dataDoc = dados.data?.toDate ? dados.data.toDate().toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR');
      
      try { docPdf.addImage(logoCarvalho, 'PNG', 14, 10, 35, 12); } catch (e) {}

      if (estilo === 'entrega_epi') {
        docPdf.setFontSize(16); docPdf.setFont("helvetica", "bold");
        docPdf.text("TERMO DE RECEBIMENTO DE EPI / UNIFORME", 105, 20, { align: 'center' });
        docPdf.setLineWidth(0.5); docPdf.line(14, 25, 196, 25);
        
        docPdf.setFontSize(11); docPdf.setFont("helvetica", "normal");
        const textoTermo = `Eu, ${dados.nomeColaborador.toUpperCase()}, declaro ter recebido da empresa CARVALHO FUNILARIA E PINTURAS LTDA os equipamentos e uniformes abaixo listados, de forma gratuita, assumindo a responsabilidade por sua guarda, conservação e uso correto durante a jornada de trabalho, conforme previsto na legislação trabalhista vigente.`;
        const splitTexto = docPdf.splitTextToSize(textoTermo, 170);
        docPdf.text(splitTexto, 14, 35);
      } else if (estilo === 'personalizado') {
        docPdf.setFillColor(...azulCarvalho); docPdf.rect(230, 10, 56, 25, "F");
        docPdf.setTextColor(255, 255, 255); docPdf.setFontSize(10); docPdf.text("SOLICITAÇÃO DE COMPRA", 233, 18);
        docPdf.setFontSize(14); docPdf.text(`#${numero}`, 233, 28);
        docPdf.setTextColor(30, 41, 59); docPdf.setFontSize(12); docPdf.setFont("helvetica", "bold");
        docPdf.text("CARVALHO FUNILARIA E PINTURAS LTDA", 14, 30);
        docPdf.setFontSize(9); docPdf.text("CNPJ: 31.362.302/0001-33", 14, 35);
        docPdf.text(`UNIDADE: ${nomeUnidade.toUpperCase()} | DATA: ${dataDoc}`, 14, 40);
      } else {
        docPdf.setTextColor(0, 0, 0); docPdf.setFontSize(16); docPdf.setFont("helvetica", "bold");
        docPdf.text("LISTA DE MATERIAIS", 100, 20); docPdf.line(14, 38, 282, 38);
      }

      const rows = dados.itens.map((i: any) => [`${i.quantidade} ${i.unidade}`, i.nome, i.marca || '-', i.ca || '-', i.ncm || '-']);
      const yTabela = estilo === 'entrega_epi' ? 65 : 45;
      
      const renderTable = typeof autoTable === 'function' ? autoTable : (autoTable as any).default;
      renderTable(docPdf, {
        startY: yTabela, 
        head: [["QTD", "DESCRIÇÃO", "MARCA/REF", "C.A.", "NCM"]], 
        body: rows,
        theme: estilo === 'simples' ? 'plain' : 'grid',
        headStyles: { fillColor: estilo === 'simples' ? [241, 245, 249] : azulCarvalho, textColor: estilo === 'simples' ? 0 : 255 },
        styles: { fontSize: 9, cellPadding: 5 }
      });

      if (estilo === 'entrega_epi' && assinaturaBase64) {
        const finalY = (docPdf as any).lastAutoTable.finalY + 30;
        docPdf.text(`${dados.nomeColaborador}`, 105, finalY - 5, { align: 'center' });
        docPdf.line(60, finalY, 150, finalY);
        try { docPdf.addImage(assinaturaBase64, 'JPEG', 85, finalY - 25, 40, 20); } catch(e){}
        docPdf.setFontSize(9); docPdf.text("Assinatura do Colaborador", 105, finalY + 5, { align: 'center' });
        docPdf.text(`Data: ${dataDoc}`, 105, finalY + 10, { align: 'center' });
      }

      docPdf.save(`${estilo === 'entrega_epi' ? 'Termo_EPI' : 'Pedido_Compra'}_${numero}.pdf`);
    } catch (err) { alert("Erro ao gerar PDF."); }
  };

  const handleFinalizarCompra = async (tipo: 'simples' | 'personalizado') => {
    if (itens.length === 0) return;
    setLoading(true);
    try {
      const novoPedido = { setorId: setorAtivo, setorNome: nomeUnidade, data: serverTimestamp(), itens, modelo: tipo, status: 'pendente', tipoRegistro: 'compra' };
      const docRef = await addDoc(collection(db, 'pedidos_compra_logs'), novoPedido);
      gerarPDF({ ...novoPedido, id: docRef.id, data: { toDate: () => new Date() } }, tipo);
      setItens([]); setModalEscolhaAberto(false);
    } catch (error) { alert("Erro ao salvar o pedido."); } 
    finally { setLoading(false); }
  };

  const handleFinalizarEntrega = async (base64: string) => {
    if (itens.length === 0 || !colaboradorSelecionado) return;
    
    const funcNome = funcionarios.find(f => f.id === colaboradorSelecionado)?.nome || 'Colaborador';
    
    try {
      const novoTermo = { 
        setorId: setorAtivo, 
        setorNome: nomeUnidade, 
        data: serverTimestamp(), 
        itens, 
        modelo: 'entrega_epi', 
        status: 'entregue',
        tipoRegistro: 'entrega_colaborador',
        funcionarioId: colaboradorSelecionado,
        nomeColaborador: funcNome,
        assinatura: base64
      };
      
      const docRef = await addDoc(collection(db, 'pedidos_compra_logs'), novoTermo);
      gerarPDF({ ...novoTermo, id: docRef.id, data: { toDate: () => new Date() } }, 'entrega_epi', base64);
      
      setItens([]); 
      setColaboradorSelecionado('');
      setModalAssinaturaAberta(false);
      setModalEscolhaAberto(false);
      alert("Termo de entrega registado e assinado com sucesso!");
    } catch (error) { alert("Erro ao registar a entrega."); }
  };

  const filtrados = estoque.filter(i => i.nome.toLowerCase().includes(busca.toLowerCase())).slice(0, 5);
  
  const funcDetalhesSelecionado = funcionarios.find(f => f.id === colaboradorSelecionado);
  const funcUniformeSelecionado = funcionarios.find(f => f.id === colaboradorUniforme);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '15px' }}>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '25px' }}>
        <div style={{ backgroundColor: '#eff6ff', padding: '10px', borderRadius: '12px' }}>
          <ShoppingCart size={28} color="#3b82f6" />
        </div>
        <div>
          <h1 style={{ fontSize: '24px', color: '#1e293b', margin: 0, fontWeight: '800' }}>Suprimentos e Entregas</h1>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Faça pedidos de compras ou registe entregas de EPI aos colaboradores.</p>
        </div>
      </div>

      {sugestoesDeCompra.length > 0 && (
        <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '16px', padding: '20px', marginBottom: '25px', boxShadow: '0 4px 6px -1px rgba(217, 119, 6, 0.1)' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b45309', margin: '0 0 15px 0', fontSize: '15px', fontWeight: 'bold' }}>
            <AlertTriangle size={18} /> Atenção: Itens com Estoque Baixo (Sugestão de Compra)
          </h3>
          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px' }}>
            {sugestoesDeCompra.map(item => (
              <div key={item.id} style={{ minWidth: '220px', backgroundColor: 'white', border: '1px solid #fcd34d', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontWeight: 'bold', color: '#1e293b', fontSize: '14px' }}>{item.nome}</span>
                <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: 'bold' }}>Estoque Atual: {item.quantidade || 0}</span>
                <Button onClick={() => addItemAoCarrinho(item, 5)} style={{ backgroundColor: '#f59e0b', fontSize: '12px', height: '30px', padding: '0 10px', marginTop: '5px' }}>
                  <Plus size={14} style={{ marginRight: '4px' }}/> Sugerir +5
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', borderTop: '4px solid #8b5cf6', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '15px', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px', color: '#475569' }}>
              <Shirt size={18} /> Pedido Rápido de Uniformes
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '15px' }}>Consulte os tamanhos de um colaborador e ajuste as quantidades necessárias.</p>
            
            <select 
              value={colaboradorUniforme} 
              onChange={e => {
                const id = e.target.value;
                setColaboradorUniforme(id);
                const func = funcionarios.find(f => f.id === id);
                if (func) {
                  setQtdUniforme(func.tamanhoUniforme && func.tamanhoUniforme !== 'Não informado' ? 1 : 0);
                  setQtdCalcado(func.tamanhoCalcado && func.tamanhoCalcado !== 'Não informado' ? 1 : 0);
                }
              }}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '10px', outline: 'none' }}
            >
              <option value="">Selecione o Colaborador...</option>
              {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>

            {funcUniformeSelecionado && (
              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '15px', marginTop: '10px' }}>
                <h4 style={{ margin: '0 0 15px 0', fontSize: '13px', color: '#1e293b' }}>Selecione as Quantidades:</h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: '#475569' }}>
                      <strong>Uniforme</strong> (Tam: {funcUniformeSelecionado.tamanhoUniforme || 'N/A'})
                    </span>
                    <input 
                      type="number" min="0" 
                      value={qtdUniforme} 
                      onChange={e => setQtdUniforme(Number(e.target.value))}
                      style={{ width: '60px', padding: '6px', border: '1px solid #cbd5e1', borderRadius: '6px', textAlign: 'center', outline: 'none' }}
                      disabled={!funcUniformeSelecionado.tamanhoUniforme || funcUniformeSelecionado.tamanhoUniforme === 'Não informado'}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: '#475569' }}>
                      <strong>Calçado</strong> (Tam: {funcUniformeSelecionado.tamanhoCalcado || 'N/A'})
                    </span>
                    <input 
                      type="number" min="0" 
                      value={qtdCalcado} 
                      onChange={e => setQtdCalcado(Number(e.target.value))}
                      style={{ width: '60px', padding: '6px', border: '1px solid #cbd5e1', borderRadius: '6px', textAlign: 'center', outline: 'none' }}
                      disabled={!funcUniformeSelecionado.tamanhoCalcado || funcUniformeSelecionado.tamanhoCalcado === 'Não informado'}
                    />
                  </div>
                </div>

                <Button onClick={addKitUniforme} style={{ width: '100%', backgroundColor: '#8b5cf6' }}>
                  <Plus size={16} style={{ marginRight: '6px' }}/> Adicionar Kit ao Carrinho
                </Button>
              </div>
            )}
          </div>

          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: '15px', marginBottom: '15px', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Search size={18} /> Adicionar Item do Estoque
            </h3>
            <Input placeholder="Pesquisar material, EPI ou Uniforme..." value={busca} onChange={e => setBusca(e.target.value)} />
            {busca && (
              <div style={{ marginTop: '10px', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                {filtrados.map(item => (
                  <div key={item.id} style={{ padding: '12px 15px', borderBottom: '1px solid #f1f5f9', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{fontSize: '14px', fontWeight: '500', color: '#334155'}}>{item.nome}</span>
                    <div style={{display:'flex', gap:'8px'}}>
                      <input type="number" min="1" defaultValue="1" onChange={e => setQtdsBusca({...qtdsBusca, [item.id]: Number(e.target.value)})} style={{width:'50px', border:'1px solid #cbd5e1', borderRadius:'6px', textAlign: 'center'}}/>
                      {/* ✨ CORREÇÃO: O botão agora chama a função correta (addItemAoCarrinho) */}
                      <Button onClick={() => addItemAoCarrinho(item)} style={{padding:'8px', backgroundColor: '#3b82f6'}}><Plus size={16}/></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', borderTop: '4px solid #64748b', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '15px', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px', color: '#475569' }}>
              <ListPlus size={18} /> Novo Item / Fora do Estoque
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Input label="Descrição do Item *" value={nomeManual} onChange={e => setNomeManual(e.target.value)} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                 <Input label="Marca / Ref." value={marcaManual} onChange={e => setMarcaManual(e.target.value)} icone={<Tag size={14}/>} />
                 <Input label="Quantidade" type="number" value={qtdManual} onChange={e => setQtdManual(Number(e.target.value))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                 <Input label="C.A. (Se for EPI)" value={caManual} onChange={e => setCaManual(e.target.value)} icone={<ShieldCheck size={14}/>} />
                 <Input label="NCM" value={ncmManual} onChange={e => setNcmManual(e.target.value)} icone={<Hash size={14}/>} />
              </div>
              <Button onClick={addManual} style={{ backgroundColor: '#475569', marginTop: '5px' }}>Incluir na Lista</Button>
            </div>
          </div>
        </div>

        {/* Carrinho / Lista Final */}
        <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '16px', boxShadow: '0 10px 20px -5px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ borderBottom: '2px solid #f1f5f9', paddingBottom: '15px', margin: '0 0 15px 0', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ListChecks size={20} color="#10b981" /> Lista Atual ({itens.length} itens)
          </h3>
          
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '400px' }}>
            {itens.length > 0 ? (
              itens.map((i, idx) => (
                <div key={idx} style={{ padding: '12px 15px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  
                  {/* ✨ NOVO: Interface de edição de quantidade dentro do carrinho */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input 
                      type="number" 
                      min="1" 
                      value={i.quantidade} 
                      onChange={(e) => atualizarQtdItemCarrinho(idx, Number(e.target.value))}
                      style={{ width: '60px', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '8px', textAlign: 'center', outline: 'none', fontWeight: 'bold', color: '#0f172a', backgroundColor: 'white' }}
                      title="Alterar quantidade"
                    />
                    <div>
                      <span style={{fontSize:'14px', color: '#0f172a', fontWeight: '600'}}>{i.nome}</span>
                      {(i.ca || i.marca) && <span style={{display: 'block', fontSize: '11px', color: '#64748b', marginTop: '4px'}}>CA: {i.ca || 'N/A'} | Ref: {i.marca || 'N/A'}</span>}
                    </div>
                  </div>

                  <button onClick={() => setItens(itens.filter((_, x) => x !== idx))} style={{ color: '#ef4444', border: 'none', background: '#fee2e2', padding: '8px', borderRadius: '8px', cursor: 'pointer', flexShrink: 0 }}><Trash2 size={16}/></button>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 20px' }}>
                <ShoppingCart size={40} style={{ margin: '0 auto 10px auto', opacity: 0.5 }} />
                <p>Sua lista está vazia. Adicione itens do estoque, fardamentos ou manualmente.</p>
              </div>
            )}
          </div>

          {itens.length > 0 && (
            <Button onClick={() => setModalEscolhaAberto(true)} style={{ width: '100%', height: '60px', marginTop: '20px', backgroundColor: '#10b981', fontSize: '16px', fontWeight: 'bold' }}>
              AVANÇAR COM A LISTA
            </Button>
          )}
        </div>
      </div>

      <div style={{ marginTop: '50px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#475569', marginBottom: '15px' }}><History size={20}/> Histórico de Registos</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
          {historico.map(h => (
            <div key={h.id} style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
              <div>
                <strong style={{ display: 'block', fontSize: '15px', color: '#1e293b' }}>
                  {h.tipoRegistro === 'entrega_colaborador' ? `Termo de Entrega` : `Pedido de Compra`}
                </strong>
                <span style={{ fontSize: '12px', color: '#64748b', display: 'block', margin: '4px 0' }}>
                  {h.data?.toDate ? h.data.toDate().toLocaleDateString('pt-BR') : ''} • {h.itens?.length || 0} itens
                </span>
                
                {h.tipoRegistro === 'entrega_colaborador' ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', backgroundColor: '#e0e7ff', color: '#4338ca', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
                    <UserCheck size={12}/> {h.nomeColaborador}
                  </span>
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', backgroundColor: h.status === 'recebido' ? '#dcfce7' : '#fef3c7', color: h.status === 'recebido' ? '#166534' : '#b45309', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
                    {h.status === 'recebido' ? <CheckCircle2 size={12}/> : <Clock size={12}/>} {h.status === 'recebido' ? 'Recebido' : 'Aguardando'}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button onClick={() => gerarPDF(h, h.tipoRegistro === 'entrega_colaborador' ? 'entrega_epi' : 'personalizado', h.assinatura)} style={{ padding: '8px', borderRadius: '8px', color: '#3b82f6', border: '1px solid #bfdbfe', background: '#eff6ff', cursor: 'pointer' }} title="Descarregar PDF">
                  <FileDown size={18}/>
                </button>
                <button onClick={async () => { if(confirm("Excluir registo permanentemente?")) await deleteDoc(doc(db, 'pedidos_compra_logs', h.id)) }} style={{ padding: '8px', borderRadius: '8px', color: '#ef4444', border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer' }} title="Apagar">
                  <Trash2 size={18}/>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {modalEscolhaAberto && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.85)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', padding: '20px' }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '24px', width: '100%', maxWidth: '450px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
             <h3 style={{ margin: '0 0 20px 0', fontSize: '20px', color: '#1e293b' }}>O que deseja fazer com esta lista?</h3>
             
             <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                
                <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', padding: '20px', borderRadius: '16px' }}>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#8b5cf6', margin: '0 0 10px 0' }}><ShieldAlert size={18}/> Entregar a Colaborador</h4>
                  <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '10px' }}>Gera um Termo de Responsabilidade (EPI/Uniforme) e solicita a assinatura digital na hora.</p>
                  
                  <select 
                    value={colaboradorSelecionado} 
                    onChange={e => setColaboradorSelecionado(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '10px', outline: 'none' }}
                  >
                    <option value="">Selecione o Colaborador...</option>
                    {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>

                  {funcDetalhesSelecionado && (
                    <div style={{ backgroundColor: 'white', border: '1px dashed #cbd5e1', padding: '10px', borderRadius: '8px', marginBottom: '10px', fontSize: '11px', color: '#475569' }}>
                      <strong>Lembrete de Tamanhos:</strong><br/>
                      Uniforme: {funcDetalhesSelecionado.tamanhoUniforme || 'Não informado'} | Calçado: {funcDetalhesSelecionado.tamanhoCalcado || 'Não informado'}
                    </div>
                  )}
                  
                  <Button 
                    disabled={!colaboradorSelecionado} 
                    onClick={() => { setModalEscolhaAberto(false); setModalAssinaturaAberta(true); }} 
                    style={{ width: '100%', backgroundColor: '#8b5cf6' }}
                  >
                    Assinar e Gerar Termo
                  </Button>
                </div>

                <div style={{ borderTop: '1px dashed #cbd5e1', margin: '5px 0' }}></div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <h4 style={{ color: '#475569', margin: 0, fontSize: '14px' }}>Gerar Pedido para Fornecedor</h4>
                  <Button onClick={() => handleFinalizarCompra('simples')} style={{ backgroundColor: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1' }}>Lista Simples (Apenas Itens)</Button>
                  <Button onClick={() => handleFinalizarCompra('personalizado')} disabled={loading} style={{ backgroundColor: '#0f172a' }}>
                    {loading ? 'A Processar...' : 'Orçamento Formal em PDF'}
                  </Button>
                </div>

                <button onClick={() => setModalEscolhaAberto(false)} style={{ marginTop: '10px', background: 'none', border: 'none', color: '#94a3b8', fontWeight: 'bold', cursor: 'pointer' }}>
                  Voltar ao Carrinho
                </button>
             </div>
          </div>
        </div>
      )}

      <ModalAssinaturaEntrega 
        aberto={modalAssinaturaAberta} 
        onClose={() => { setModalAssinaturaAberta(false); setModalEscolhaAberto(true); }} 
        onConfirm={(base64) => handleFinalizarEntrega(base64)} 
      />

    </div>
  );
}
