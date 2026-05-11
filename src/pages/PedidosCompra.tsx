// src/pages/PedidosCompra.tsx
import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { collection, onSnapshot, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { 
  ShoppingCart, Plus, Trash2, Save, Search, 
  ListPlus, Shirt, FileDown, Package 
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
  const [qtdsBusca, setQtdsBusca] = useState<{[key: string]: number}>({}); // Controla as quantidades da pesquisa
  
  const [nomeManual, setNomeManual] = useState('');
  const [qtdManual, setQtdManual] = useState(1);

  const [funcId, setFuncId] = useState('');
  const [tipoVestuario, setTipoVestuario] = useState('Camisa');
  const [loading, setLoading] = useState(false);

  // 🔥 GERAR PDF (Lógica simplificada para máxima compatibilidade)
  const gerarPDF = (itensAtuais: ItemPedido[]) => {
    try {
      const doc = new jsPDF();
      const azulMarinho: [number, number, number] = [30, 41, 59];

      doc.setFillColor(...azulMarinho);
      doc.rect(0, 0, 210, 20, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.text("SOLICITAÇÃO DE COMPRA - CARVALHO", 14, 13);

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      doc.text("CARVALHO FUNILARIA E PINTURAS LTDA", 14, 30);
      doc.setFontSize(9);
      doc.text(`Unidade: ${setorAtivo.toUpperCase()} | Data: ${new Date().toLocaleDateString()}`, 14, 36);

      const rows = itensAtuais.map(i => [
        `${i.quantidade} ${i.unidade}`,
        i.nome + (i.tamanho ? ` (Tam: ${i.tamanho})` : ''),
        i.marca || '-',
        i.ca || '-',
        i.funcionarioNome || 'ESTOQUE GERAL'
      ]);

      autoTable(doc, {
        startY: 45,
        head: [["QTD", "ITEM / TAMANHO", "MARCA", "CA", "DESTINO"]],
        body: rows,
        headStyles: { fillColor: azulMarinho },
        styles: { fontSize: 9 },
      });

      doc.save(`Pedido_${Date.now()}.pdf`);
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      alert("Erro ao gerar PDF. Verifique o console.");
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

  // Função para adicionar item da busca com a quantidade escolhida
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
    setQtdsBusca(prev => ({ ...prev, [item.id]: 1 })); // Reseta qtd do campo
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
      gerarPDF(itens);
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
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* BUSCA COM SALDO E QUANTIDADE EDITÁVEL */}
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '15px', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Search size={18} color="#3b82f6" /> Pesquisar no Estoque
            </h3>
            <Input
              placeholder="Digite o nome do material..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
            
            {busca && (
              <div style={{ marginTop: '10px', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                {filtrados.map(item => (
                  <div key={item.id} style={{ padding: '12px 15px', borderBottom: '1px solid #f1f5f9', backgroundColor: '#f8fafc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{item.nome}</span>
                      <span style={{ fontSize: '12px', color: '#3b82f6', fontWeight: 'bold' }}>Saldo: {item.quantidade}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input 
                        type="number"
                        min="1"
                        value={qtdsBusca[item.id] || 1}
                        onChange={e => setQtdsBusca({ ...qtdsBusca, [item.id]: Number(e.target.value) })}
                        style={{ width: '70px', padding: '5px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      />
                      <Button onClick={() => addItem(item)} style={{ flex: 1, height: '35px' }}>
                        <Plus size={16} /> Adicionar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* UNIFORME */}
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '15px', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shirt size={18} color="#8b5cf6" /> Uniforme Individual
            </h3>
            <select 
              value={funcId} 
              onChange={e => setFuncId(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', marginBottom: '10px' }}
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

          {/* MANUAL */}
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '15px', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ListPlus size={18} color="#64748b" /> Item Manual
            </h3>
            <Input placeholder="Nome do item..." value={nomeManual} onChange={e => setNomeManual(e.target.value)} />
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <Input type="number" value={qtdManual} onChange={e => setQtdManual(Number(e.target.value))} style={{ width: '80px' }} />
              <Button onClick={addManual} style={{ flex: 1, backgroundColor: '#64748b' }}>Adicionar</Button>
            </div>
          </div>
        </div>

        {/* RESUMO DO PEDIDO */}
        <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', height: 'fit-content' }}>
          <h3 style={{ fontSize: '18px', marginBottom: '20px', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px' }}>Itens no Pedido ({itens.length})</h3>
          
          {itens.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#94a3b8' }}>Nenhum item adicionado.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {itens.map((i, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '14px' }}><strong>{i.quantidade}x</strong> {i.nome} {i.funcionarioNome && `(${i.funcionarioNome})`}</span>
                  <button onClick={() => setItens(itens.filter((_, x) => x !== idx))} style={{ color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer' }}><Trash2 size={16}/></button>
                </div>
              ))}
              <Button 
                onClick={finalizar} 
                disabled={loading}
                style={{ width: '100%', height: '55px', marginTop: '15px', backgroundColor: '#10b981', fontWeight: 'bold' }}
              >
                {loading ? 'Salvando...' : <><Save size={20} style={{marginRight: '8px'}}/> Finalizar e Baixar PDF</>}
              </Button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}