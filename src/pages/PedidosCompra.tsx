// src/pages/PedidosCompra.tsx
import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { collection, onSnapshot, query, where, addDoc, serverTimestamp, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoCarvalho from '../assets/LogoLimpa.webp'; 
import { 
  ShoppingCart, Plus, Trash2, Save, Search, 
  FileDown, Package, FileText, ListChecks, X,
  ListPlus, Tag, ShieldCheck, Hash, History
} from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

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

  useEffect(() => {
    if (!setorAtivo) return;
    getDoc(doc(db, 'setores', setorAtivo)).then(d => { if (d.exists()) setNomeUnidade(d.data().nome); });

    const qEstoque = query(collection(db, 'estoque'), where('setorId', '==', setorAtivo));
    const unsubEstoque = onSnapshot(qEstoque, snap => setEstoque(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    // 🛡️ CORREÇÃO DE ÍNDICE: Filtramos aqui, mas ordenamos na memória abaixo
    const qHist = query(collection(db, 'pedidos_compra_logs'), where('setorId', '==', setorAtivo));
    const unsubHist = onSnapshot(qHist, snap => {
      const logs = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      // Ordenação manual para evitar erro de índice do Firebase
      logs.sort((a, b) => (b.data?.toMillis() || 0) - (a.data?.toMillis() || 0));
      setHistorico(logs);
    });

    return () => { unsubEstoque(); unsubHist(); };
  }, [setorAtivo]);

  // Função de PDF (Sua lógica landscape com logo)
  const gerarPDF = (dados: any, estilo: 'simples' | 'personalizado') => {
    try {
      const doc = new jsPDF('landscape');
      const azulCarvalho: [number, number, number] = [30, 41, 59];
      const numero = dados.id ? dados.id.slice(-6).toUpperCase() : "NOVO";
      try { doc.addImage(logoCarvalho, 'WEBP', 14, 10, 35, 12); } catch (e) {}

      if (estilo === 'personalizado') {
        doc.setFillColor(...azulCarvalho); doc.rect(230, 10, 56, 25, "F");
        doc.setTextColor(255, 255, 255); doc.setFontSize(10); doc.text("SOLICITAÇÃO DE COMPRA", 233, 18);
        doc.setFontSize(14); doc.text(`#${numero}`, 233, 28);
        doc.setTextColor(30, 41, 59); doc.setFontSize(12); doc.setFont("helvetica", "bold");
        doc.text("CARVALHO FUNILARIA E PINTURAS LTDA", 14, 30);
        doc.setFontSize(9); doc.text("CNPJ: 31.362.302/0001-33", 14, 35);
        doc.text(`UNIDADE: ${nomeUnidade.toUpperCase()} | DATA: ${new Date().toLocaleDateString()}`, 14, 40);
      } else {
        doc.setTextColor(0, 0, 0); doc.setFontSize(16); doc.setFont("helvetica", "bold");
        doc.text("LISTA DE COTAÇÃO", 100, 20); doc.line(14, 38, 282, 38);
      }

      const rows = dados.itens.map((i: any) => [`${i.quantidade} ${i.unidade}`, i.nome, i.marca || '-', i.ca || '-', i.ncm || '-']);
      const renderTable = typeof autoTable === 'function' ? autoTable : (autoTable as any).default;
      renderTable(doc, {
        startY: 45, head: [["QTD", "DESCRIÇÃO", "MARCA/REF", "C.A.", "NCM"]], body: rows,
        theme: estilo === 'personalizado' ? 'grid' : 'plain',
        headStyles: { fillColor: estilo === 'personalizado' ? azulCarvalho : [241, 245, 249], textColor: estilo === 'personalizado' ? 255 : 0 },
        styles: { fontSize: 9, cellPadding: 5 }
      });
      doc.save(`Pedido_Carvalho_${numero}.pdf`);
    } catch (err) { alert("Erro ao gerar PDF."); }
  };

  const handleFinalizar = async (tipo: 'simples' | 'personalizado') => {
    setLoading(true);
    try {
      await addDoc(collection(db, 'pedidos_compra_logs'), {
        setorId: setorAtivo, setorNome: nomeUnidade, data: serverTimestamp(),
        itens, modelo: tipo, status: 'pendente'
      });
      gerarPDF({ itens }, tipo);
      setItens([]); setModalEscolhaAberto(false);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const addItemEstoque = (item: any) => {
    const qtd = qtdsBusca[item.id] || 1;
    setItens([...itens, { id: item.id, nome: item.nome, quantidade: qtd, unidade: item.unidade || 'UN', marca: item.marca, ca: item.ca, ncm: item.ncm }]);
    setBusca('');
  };

  const addManual = () => {
    if (!nomeManual) return;
    setItens([...itens, { id: `man-${Date.now()}`, nome: nomeManual, quantidade: qtdManual, unidade: unidManual, marca: marcaManual, ca: caManual, ncm: ncmManual }]);
    setNomeManual(''); setMarcaManual(''); setCaManual(''); setNcmManual('');
  };

  // ✨ CORREÇÃO DEFINITIVA: Variável filtrados definida aqui
  const filtrados = estoque.filter(i => i.nome.toLowerCase().includes(busca.toLowerCase())).slice(0, 5);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '15px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '25px' }}>
        <ShoppingCart size={28} color="var(--cor-primaria)" />
        <h1 style={{ fontSize: '24px', color: '#1e293b', margin: 0, fontWeight: 'bold' }}>Solicitação de Compra</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '15px', marginBottom: '15px', color: '#3b82f6' }}><Search size={18} /> Adicionar do Estoque</h3>
            <Input placeholder="Pesquisar material..." value={busca} onChange={e => setBusca(e.target.value)} />
            {busca && (
              <div style={{ marginTop: '10px', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                {filtrados.map(item => (
                  <div key={item.id} style={{ padding: '12px 15px', borderBottom: '1px solid #f1f5f9', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{fontSize: '14px'}}>{item.nome}</span>
                    <div style={{display:'flex', gap:'5px'}}>
                      <input type="number" min="1" defaultValue="1" onChange={e => setQtdsBusca({...qtdsBusca, [item.id]: Number(e.target.value)})} style={{width:'50px', border:'1px solid #ccc', borderRadius:'4px'}}/>
                      <Button onClick={() => addItemEstoque(item)} style={{padding:'5px'}}><Plus size={16}/></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', borderTop: '4px solid #64748b' }}>
            <h3 style={{ fontSize: '15px', marginBottom: '15px' }}><ListPlus size={18} /> Novo Item / Cotação</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <Input label="Descrição *" value={nomeManual} onChange={e => setNomeManual(e.target.value)} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                 <Input label="Marca" value={marcaManual} onChange={e => setMarcaManual(e.target.value)} icone={<Tag size={14}/>} />
                 <Input label="Qtd" type="number" value={qtdManual} onChange={e => setQtdManual(Number(e.target.value))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                 <Input label="C.A." value={caManual} onChange={e => setCaManual(e.target.value)} icone={<ShieldCheck size={14}/>} />
                 <Input label="NCM" value={ncmManual} onChange={e => setNcmManual(e.target.value)} icone={<Hash size={14}/>} />
              </div>
              <Button onClick={addManual} style={{ backgroundColor: '#475569' }}>Adicionar à Lista</Button>
            </div>
          </div>
        </div>

        <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ borderBottom: '2px solid #f1f5f9', paddingBottom: '10px' }}>Itens Solicitados ({itens.length})</h3>
          {itens.length > 0 ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px' }}>
                {itens.map((i, idx) => (
                  <div key={idx} style={{ padding: '10px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{fontSize:'13px'}}><strong>{i.quantidade}x</strong> {i.nome}</span>
                    <button onClick={() => setItens(itens.filter((_, x) => x !== idx))} style={{ color: '#ef4444', border: 'none', background: 'none' }}><Trash2 size={16}/></button>
                  </div>
                ))}
              </div>
              <Button onClick={() => setModalEscolhaAberto(true)} style={{ width: '100%', height: '60px', marginTop: '20px', backgroundColor: '#10b981' }}>GERAR PDF</Button>
            </>
          ) : <p style={{textAlign: 'center', color: '#94a3b8', padding: '20px'}}>Vazio</p>}
        </div>
      </div>

      <div style={{ marginTop: '50px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#475569', marginBottom: '15px' }}><History size={20}/> Histórico</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
          {historico.map(h => (
            <div key={h.id} style={{ backgroundColor: 'white', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ display: 'block', fontSize: '14px' }}>Pedido #{h.id.slice(-5).toUpperCase()}</strong>
                <span style={{ fontSize: '11px', color: '#64748b' }}>{h.data?.toDate().toLocaleDateString('pt-BR')} - {h.itens.length} itens</span>
                <div style={{fontSize:'10px', marginTop: '5px', color: h.status === 'recebido' ? '#10b981' : '#f59e0b', fontWeight: 'bold'}}>
                  {h.status === 'recebido' ? '✅ RECEBIDO' : '⏳ AGUARDANDO'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '5px' }}>
                <button onClick={() => gerarPDF(h, 'personalizado')} style={{ padding: '8px', borderRadius: '8px', color: '#3b82f6', border: '1px solid #e2e8f0', background: 'none' }}><FileDown size={18}/></button>
                <button onClick={async () => { if(confirm("Excluir?")) await deleteDoc(doc(db, 'pedidos_compra_logs', h.id)) }} style={{ padding: '8px', borderRadius: '8px', color: '#ef4444', border: '1px solid #fee2e2', background: 'none' }}><Trash2 size={18}/></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {modalEscolhaAberto && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.9)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '24px', width: '400px' }}>
             <h3 style={{marginBottom:'20px'}}>Tipo de PDF</h3>
             <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                <Button onClick={() => handleFinalizar('simples')} style={{backgroundColor:'#f1f5f9', color:'#1e293b'}}>Lista Simples</Button>
                <Button onClick={() => handleFinalizar('personalizado')}>Orçamento Formal</Button>
                <button onClick={() => setModalEscolhaAberto(false)} style={{marginTop:'10px', background:'none', border:'none', color:'#94a3b8'}}>Cancelar</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}