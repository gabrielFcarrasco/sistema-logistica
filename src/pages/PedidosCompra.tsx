// src/pages/PedidosCompra.tsx
import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { collection, onSnapshot, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Importando a logo
import logoCarvalho from '../assets/LogoLimpa.webp'; 

import { 
  ShoppingCart, Plus, Trash2, Save, Search, 
  Shirt, FileDown, Package, FileText, ListChecks, X,
  ListPlus // ✨ Ícone adicionado aqui para corrigir o erro
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
  funcionarioNome?: string;
  tamanho?: string;
}

export default function PedidosCompra() {
  const { setorAtivo } = useOutletContext<{ setorAtivo: string }>();

  const [estoque, setEstoque] = useState<any[]>([]);
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [itens, setItens] = useState<ItemPedido[]>([]);

  const [busca, setBusca] = useState('');
  const [qtdsBusca, setQtdsBusca] = useState<{[key: string]: number}>({});
  
  const [nomeManual, setNomeManual] = useState('');
  const [qtdManual, setQtdManual] = useState(1);

  const [funcId, setFuncId] = useState('');
  const [tipoVestuario, setTipoVestuario] = useState('Camisa');
  
  const [loading, setLoading] = useState(false);
  const [modalEscolhaAberto, setModalEscolhaAberto] = useState(false);

  // 📄 GERADOR DE PDF MULTI-ESTILO (Corrigido para Produção/Vite)
  const gerarPDF = (estilo: 'simples' | 'personalizado') => {
    try {
      const doc = new jsPDF();
      const azulCarvalho: [number, number, number] = [30, 41, 59];
      const pedidoNumero = Date.now().toString().slice(-6);

      // 1. Logotipo e Identificação
      try {
        doc.addImage(logoCarvalho, 'WEBP', 14, 10, 40, 15);
      } catch (e) {
        console.error("Logo não carregada no PDF", e);
      }

      if (estilo === 'personalizado') {
        doc.setFillColor(...azulCarvalho);
        doc.rect(140, 10, 56, 25, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.text("PEDIDO DE COMPRA", 145, 18);
        doc.setFontSize(14);
        doc.text(`#${pedidoNumero}`, 145, 28);

        doc.setTextColor(30, 41, 59);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("CARVALHO FUNILARIA E PINTURAS LTDA", 14, 35);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text("CNPJ: 31.362.302/0001-33", 14, 40);
        doc.text(`UNIDADE: ${setorAtivo.toUpperCase()} | DATA: ${new Date().toLocaleDateString()}`, 14, 45);
      } else {
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text("LISTA DE COMPRAS - CARVALHO", 60, 20);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Data: ${new Date().toLocaleDateString()} | Pedido: ${pedidoNumero}`, 14, 35);
        doc.line(14, 38, 196, 38);
      }

      // 2. Tabela de Itens
      const rows = itens.map(i => [
        `${i.quantidade} ${i.unidade}`,
        i.nome + (i.tamanho ? ` (Tam: ${i.tamanho})` : ''),
        i.marca || '-',
        i.funcionarioNome || 'ESTOQUE GERAL'
      ]);

      // 🛡️ Segurança para o autoTable no Build do Vite
      const renderTable = typeof autoTable === 'function' ? autoTable : (autoTable as any).default;
      
      renderTable(doc, {
        startY: estilo === 'personalizado' ? 55 : 45,
        head: [["QTD", "DESCRIÇÃO DO MATERIAL", "MARCA/REF", "DESTINO FINAL"]],
        body: rows,
        theme: estilo === 'personalizado' ? 'grid' : 'plain',
        headStyles: { 
          fillColor: estilo === 'personalizado' ? azulCarvalho : [241, 245, 249],
          textColor: estilo === 'personalizado' ? [255, 255, 255] : [0, 0, 0],
          fontStyle: 'bold'
        },
        styles: { fontSize: 9, cellPadding: 5 },
        alternateRowStyles: { fillColor: [248, 250, 252] }
      });

      const finalY = (doc as any).lastAutoTable.finalY + 20;
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(8);
      doc.text("Documento gerado via Sistema Interno de Gestão de EPIs - Carvalho", 105, 285, { align: 'center' });

      if (estilo === 'personalizado') {
        doc.setDrawColor(200, 200, 200);
        doc.line(14, finalY + 15, 80, finalY + 15);
        doc.text("Assinatura do Solicitante", 14, finalY + 20);
      }

      doc.save(`Pedido_Carvalho_${pedidoNumero}.pdf`);
    } catch (err) {
      console.error(err);
      alert("Erro ao gerar PDF.");
    }
  };

  useEffect(() => {
    if (!setorAtivo) return;
    const q1 = query(collection(db, 'estoque'), where('setorId', '==', setorAtivo));
    const q2 = query(collection(db, 'funcionarios'), where('setorId', '==', setorAtivo));
    const unsub1 = onSnapshot(q1, snap => setEstoque(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsub2 = onSnapshot(q2, snap => setFuncionarios(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { unsub1(); unsub2(); };
  }, [setorAtivo]);

  const addItem = (item: any) => {
    const qtdEscolhida = qtdsBusca[item.id] || 1;
    setItens([...itens, {
      id: Date.now().toString(),
      nome: item.nome,
      quantidade: qtdEscolhida,
      unidade: item.unidade || 'UN',
      marca: item.marca,
      ca: item.ca
    }]);
    setBusca('');
    setQtdsBusca(prev => ({ ...prev, [item.id]: 1 }));
  };

  const addManual = () => {
    if (!nomeManual) return;
    setItens([...itens, { id: Date.now().toString(), nome: nomeManual, quantidade: qtdManual, unidade: 'UN' }]);
    setNomeManual(''); setQtdManual(1);
  };

  const addUniforme = () => {
    const f = funcionarios.find(x => x.id === funcId);
    if (!f) return;
    const isBota = tipoVestuario === 'Bota';
    setItens([...itens, {
      id: Date.now().toString(),
      nome: `${tipoVestuario} de Segurança`,
      quantidade: 1,
      unidade: isBota ? 'PAR' : 'UN',
      funcionarioNome: f.nome,
      tamanho: isBota ? f.tamanhoCalcado : f.tamanhoUniforme
    }]);
    setFuncId('');
  };

  const handleFinalizarEProcessar = async (tipo: 'simples' | 'personalizado') => {
    setLoading(true);
    try {
      await addDoc(collection(db, 'pedidos_compra_logs'), {
        setorId: setorAtivo,
        data: serverTimestamp(),
        itens,
        modelo: tipo
      });
      gerarPDF(tipo);
      setItens([]);
      setModalEscolhaAberto(false);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filtrados = estoque.filter(i => i.nome.toLowerCase().includes(busca.toLowerCase())).slice(0, 5);

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '15px' }}>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '25px' }}>
        <ShoppingCart size={28} color="var(--cor-primaria)" />
        <h1 style={{ fontSize: '24px', color: '#1e293b', margin: 0, fontWeight: 'bold' }}>Pedidos de Compra</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* BUSCA */}
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '15px', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px', color: '#3b82f6' }}>
              <Search size={18} /> Adicionar do Estoque
            </h3>
            <Input placeholder="O que deseja pedir?" value={busca} onChange={e => setBusca(e.target.value)} />
            {busca && (
              <div style={{ marginTop: '10px', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                {filtrados.map(item => (
                  <div key={item.id} style={{ padding: '12px 15px', borderBottom: '1px solid #f1f5f9', backgroundColor: '#f8fafc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{item.nome}</span>
                      <span style={{ fontSize: '12px', color: '#3b82f6', fontWeight: 'bold' }}>Saldo: {item.quantidade}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input type="number" min="1" value={qtdsBusca[item.id] || 1} onChange={e => setQtdsBusca({ ...qtdsBusca, [item.id]: Number(e.target.value) })} style={{ width: '70px', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                      <Button onClick={() => addItem(item)} style={{ flex: 1, height: '40px' }}><Plus size={16} /> Incluir</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* UNIFORME */}
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '15px', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px', color: '#8b5cf6' }}>
              <Shirt size={18} /> Uniforme Individual
            </h3>
            <select value={funcId} onChange={e => setFuncId(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', marginBottom: '10px', outline: 'none' }}>
              <option value="">Selecione o Colaborador</option>
              {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
            <div style={{ display: 'flex', gap: '10px' }}>
              <select value={tipoVestuario} onChange={e => setTipoVestuario(e.target.value)} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', outline: 'none' }}>
                <option value="Camisa">Camisa</option><option value="Calça">Calça</option><option value="Bota">Bota</option>
              </select>
              <Button onClick={addUniforme} style={{ backgroundColor: '#8b5cf6' }}><Plus size={20}/></Button>
            </div>
          </div>

          {/* MANUAL */}
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '15px', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b' }}>
              <ListPlus size={18} /> Entrada Manual
            </h3>
            <Input placeholder="Nome do material..." value={nomeManual} onChange={e => setNomeManual(e.target.value)} />
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <input type="number" value={qtdManual} onChange={e => setQtdManual(Number(e.target.value))} style={{ width: '80px', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
              <Button onClick={addManual} style={{ flex: 1, backgroundColor: '#64748b' }}>Adicionar</Button>
            </div>
          </div>
        </div>

        {/* RESUMO E FINALIZAÇÃO */}
        <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', height: 'fit-content' }}>
          <h3 style={{ fontSize: '18px', marginBottom: '20px', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px', fontWeight: 'bold' }}>Itens Separados ({itens.length})</h3>
          
          {itens.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
              <ShoppingCart size={48} style={{ margin: '0 auto 15px', opacity: 0.2 }} />
              <p>O lote de pedido está vazio.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {itens.map((i, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '14px', fontWeight: 'bold', display: 'block' }}>{i.quantidade}x {i.nome}</span>
                    {i.funcionarioNome && <span style={{ fontSize: '11px', color: '#8b5cf6', fontWeight: 'bold' }}>Destino: {i.funcionarioNome}</span>}
                  </div>
                  <button onClick={() => setItens(itens.filter((_, x) => x !== idx))} style={{ color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer' }}><Trash2 size={18}/></button>
                </div>
              ))}
              <Button 
                onClick={() => setModalEscolhaAberto(true)} 
                style={{ width: '100%', height: '60px', marginTop: '15px', backgroundColor: '#10b981', fontSize: '16px', fontWeight: 'bold' }}
              >
                <Save size={20} style={{marginRight: '8px'}}/> FINALIZAR LOTE
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* 🛠️ MODAL DE ESCOLHA DE PDF */}
      {modalEscolhaAberto && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.9)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(4px)' }}>
          <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '400px', borderRadius: '24px', padding: '30px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>Gerar PDF</h3>
              <button onClick={() => setModalEscolhaAberto(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={24}/></button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <button 
                onClick={() => handleFinalizarEProcessar('simples')}
                style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', cursor: 'pointer', textAlign: 'left' }}
              >
                <div style={{ backgroundColor: '#e2e8f0', padding: '10px', borderRadius: '12px' }}><ListChecks size={24} color="#64748b"/></div>
                <div>
                  <strong style={{ display: 'block', fontSize: '15px' }}>Lista Simples</strong>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Conferência interna.</span>
                </div>
              </button>

              <button 
                onClick={() => handleFinalizarEProcessar('personalizado')}
                style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '20px', borderRadius: '16px', border: '2px solid #dcfce7', backgroundColor: '#f0fdf4', cursor: 'pointer', textAlign: 'left' }}
              >
                <div style={{ backgroundColor: '#10b981', padding: '10px', borderRadius: '12px' }}><FileText size={24} color="white"/></div>
                <div>
                  <strong style={{ display: 'block', fontSize: '15px', color: '#065f46' }}>Orçamento Formal</strong>
                  <span style={{ fontSize: '12px', color: '#059669' }}>Com logo e CNPJ.</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}