// src/pages/PedidosCompra.tsx

import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { collection, onSnapshot, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { 
  ShoppingCart, Plus, Trash2, Save, Search, 
  ListPlus, Shirt, User, FileDown, Package 
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
  const [nomeManual, setNomeManual] = useState('');
  const [qtdManual, setQtdManual] = useState(1);

  const [funcId, setFuncId] = useState('');
  const [tipoVestuario, setTipoVestuario] = useState('Camisa');
  const [loading, setLoading] = useState(false);

  // 🔥 GERAR PDF PROFISSIONAL (Lógica Preservada e Refinada)
  const gerarPDF = () => {
    const doc = new jsPDF();
    const cor: [number, number, number] = [30, 41, 59]; // Azul Marinho Carvalho

    // HEADER COLORIDO
    doc.setFillColor(...cor);
    doc.rect(0, 0, 210, 20, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("SOLICITAÇÃO DE COMPRA - CARVALHO", 14, 13);

    // INFO DA EMPRESA
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.text("CARVALHO FUNILARIA E PINTURAS LTDA", 14, 30);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("CNPJ: 31.362.302/0001-33", 14, 35);
    
    // INFO DO PEDIDO
    doc.text(`Unidade/Setor: ${setorAtivo.toUpperCase()}`, 140, 30);
    doc.text(`Data: ${new Date().toLocaleDateString()}`, 140, 35);
    const pedidoNumero = Date.now().toString().slice(-6);
    doc.text(`Pedido Nº: ${pedidoNumero}`, 140, 40);

    // TABLE
    const rows = itens.map(i => [
      `${i.quantidade} ${i.unidade}`,
      i.nome + (i.tamanho ? ` (Tam: ${i.tamanho})` : ''),
      i.marca || '-',
      i.ca || '-',
      i.funcionarioNome || 'ESTOQUE GERAL'
    ]);

    autoTable(doc, {
      startY: 50,
      head: [["QTD", "ITEM / TAMANHO", "MARCA", "CA", "DESTINO"]],
      body: rows,
      headStyles: { fillColor: cor, halign: 'center' },
      columnStyles: {
        0: { halign: 'center', fontStyle: 'bold' },
      },
      styles: { fontSize: 9, cellPadding: 4 },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(10);
    doc.text(`Total de itens no lote: ${itens.length}`, 14, finalY);
    doc.text("Assinatura do Responsável:", 14, finalY + 15);
    doc.line(14, finalY + 20, 100, finalY + 20);

    doc.save(`pedido-carvalho-${pedidoNumero}.pdf`);
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
    setItens([...itens, {
      id: Date.now().toString(),
      nome: item.nome,
      quantidade: 1,
      unidade: item.unidade || 'UN',
      marca: item.marca,
      ca: item.ca
    }]);
    setBusca('');
  };

  const addManual = () => {
    if (!nomeManual) return;
    setItens([...itens, {
      id: Date.now().toString(),
      nome: nomeManual,
      quantidade: qtdManual,
      unidade: 'UN'
    }]);
    setNomeManual('');
    setQtdManual(1);
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

  const finalizar = async () => {
    if (itens.length === 0) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'pedidos_compra_logs'), {
        setorId: setorAtivo,
        data: serverTimestamp(),
        itens,
        totalItens: itens.length
      });
      gerarPDF();
      setItens([]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filtrados = estoque.filter(i =>
    i.nome.toLowerCase().includes(busca.toLowerCase())
  ).slice(0, 5);

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '15px' }}>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '25px' }}>
        <ShoppingCart size={28} color="var(--cor-primaria)" />
        <h1 style={{ fontSize: '24px', color: '#1e293b', margin: 0 }}>Pedidos de Compra</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        
        {/* COLUNA DE SELEÇÃO */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* BUSCA NO ESTOQUE */}
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '15px', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Search size={18} color="#3b82f6" /> Adicionar do Estoque
            </h3>
            <Input
              placeholder="Buscar item no estoque..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
            
            {busca && (
              <div style={{ marginTop: '10px', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                {filtrados.map(item => (
                  <div key={item.id} style={{ padding: '10px 15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', backgroundColor: '#f8fafc' }}>
                    <span style={{ fontSize: '14px', fontWeight: '500' }}>{item.nome}</span>
                    <Button onClick={() => addItem(item)} style={{ padding: '4px 8px' }}><Plus size={16}/></Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* UNIFORME INTELIGENTE */}
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '15px', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shirt size={18} color="#8b5cf6" /> Uniforme Individual
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <select 
                value={funcId} 
                onChange={e => setFuncId(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}
              >
                <option value="">Selecione o Colaborador</option>
                {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>

              <div style={{ display: 'flex', gap: '10px' }}>
                <select 
                  value={tipoVestuario} 
                  onChange={e => setTipoVestuario(e.target.value)}
                  style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                >
                  <option value="Camisa">Camisa</option>
                  <option value="Calça">Calça</option>
                  <option value="Bota">Bota</option>
                </select>
                <Button onClick={addUniforme} style={{ backgroundColor: '#8b5cf6' }}><Plus size={20}/></Button>
              </div>
            </div>
          </div>

          {/* MANUAL */}
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '15px', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ListPlus size={18} color="#64748b" /> Item Manual / Outros
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <Input
                placeholder="Nome do item..."
                value={nomeManual}
                onChange={e => setNomeManual(e.target.value)}
              />
              <div style={{ display: 'flex', gap: '10px' }}>
                <Input
                  type="number"
                  value={qtdManual}
                  onChange={e => setQtdManual(Number(e.target.value))}
                  style={{ width: '80px' }}
                />
                <Button onClick={addManual} style={{ flex: 1, backgroundColor: '#64748b' }}>Adicionar</Button>
              </div>
            </div>
          </div>
        </div>

        {/* COLUNA DO CARRINHO (RESUMO) */}
        <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', height: 'fit-content' }}>
          <h3 style={{ fontSize: '18px', marginBottom: '20px', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Package size={20} /> Itens no Pedido
          </h3>
          
          {itens.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
              <ShoppingCart size={40} style={{ opacity: 0.2, marginBottom: '10px' }} />
              <p>Nenhum item adicionado.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {itens.map((i, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div>
                    <strong style={{ fontSize: '14px', display: 'block' }}>{i.nome}</strong>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      Qtd: {i.quantidade} {i.unidade} {i.funcionarioNome && ` | Para: ${i.funcionarioNome}`}
                    </span>
                  </div>
                  <button 
                    onClick={() => setItens(itens.filter((_, x) => x !== idx))}
                    style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '5px' }}
                  >
                    <Trash2 size={18}/>
                  </button>
                </div>
              ))}

              <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <Button 
                  onClick={finalizar} 
                  disabled={loading}
                  style={{ width: '100%', height: '55px', fontSize: '16px', fontWeight: 'bold', backgroundColor: '#10b981' }}
                >
                  {loading ? 'Processando...' : <><FileDown size={20} style={{marginRight: '8px'}}/> Finalizar e Gerar PDF</>}
                </Button>
                <Button 
                  variante="secundario" 
                  onClick={() => setItens([])}
                  style={{ width: '100%' }}
                >
                  Limpar Lote
                </Button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}