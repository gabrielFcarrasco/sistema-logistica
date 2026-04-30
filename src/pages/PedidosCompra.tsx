// src/pages/PedidosCompra.tsx

import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { collection, onSnapshot, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { ShoppingCart, Plus, Trash2, Save, Search } from 'lucide-react';

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

  // 🔥 GERAR PDF PROFISSIONAL
  const gerarPDF = () => {
    const doc = new jsPDF();

    const cor: [number, number, number] = [16, 185, 129];

    // HEADER
    doc.setFillColor(...cor);
    doc.rect(0, 0, 210, 20, "F");

    doc.setTextColor(255,255,255);
    doc.setFontSize(14);
    doc.text("PEDIDO DE COMPRA", 14, 13);

    // INFO
    doc.setTextColor(0,0,0);
    doc.setFontSize(11);
    doc.text("CARVALHO FUNILARIA E PINTURAS LTDA", 14, 30);
    doc.setFontSize(9);
    doc.text("CNPJ: 31.362.302/0001-33", 14, 35);
    doc.text(`Setor: ${setorAtivo}`, 150, 30);
    doc.text(`Data: ${new Date().toLocaleDateString()}`, 150, 35);

    const pedidoNumero = Date.now().toString().slice(-6);
    doc.text(`Pedido Nº: ${pedidoNumero}`, 150, 40);

    // TABLE
    const rows = itens.map(i => [
      `${i.quantidade} ${i.unidade}`,
      i.nome,
      i.marca || '-',
      i.ca || '-',
      i.funcionarioNome || 'ESTOQUE'
    ]);

    autoTable(doc, {
      startY: 50,
      head: [["QTD", "ITEM", "MARCA", "CA", "DESTINO"]],
      body: rows,
      headStyles: { fillColor: cor },
      alternateRowStyles: { fillColor: [240,255,244] }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;

    doc.text(`Total de itens: ${itens.length}`, 14, finalY);

    doc.text("Assinatura:", 14, finalY + 10);
    doc.line(14, finalY + 15, 100, finalY + 15);

    doc.save(`pedido-${pedidoNumero}.pdf`);
  };

  useEffect(() => {
    if (!setorAtivo) return;

    const q1 = query(collection(db, 'estoque'), where('setorId', '==', setorAtivo));
    const q2 = query(collection(db, 'funcionarios'), where('setorId', '==', setorAtivo));

    const unsub1 = onSnapshot(q1, snap => {
      setEstoque(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsub2 = onSnapshot(q2, snap => {
      setFuncionarios(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsub1(); unsub2(); };
  }, [setorAtivo]);

  const addItem = (item:any) => {
    setItens([...itens, {
      id: Date.now().toString(),
      nome: item.nome,
      quantidade: 1,
      unidade: item.unidade || 'UN'
    }]);
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
  };

  const addUniforme = () => {
    const f = funcionarios.find(x => x.id === funcId);
    if (!f) return;

    setItens([...itens, {
      id: Date.now().toString(),
      nome: tipoVestuario,
      quantidade: 1,
      unidade: tipoVestuario === 'Bota' ? 'PAR' : 'UN',
      funcionarioNome: f.nome,
      tamanho: tipoVestuario === 'Bota' ? f.tamanhoCalcado : f.tamanhoUniforme
    }]);
  };

  const finalizar = async () => {
    await addDoc(collection(db, 'pedidos_compra_logs'), {
      setorId: setorAtivo,
      data: serverTimestamp(),
      itens
    });

    gerarPDF();
  };

  const filtrados = estoque.filter(i =>
    i.nome.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div style={{ padding: 20, maxWidth: 1000, margin: 'auto' }}>

      <h2>Pedidos de Compra</h2>

      {/* BUSCA */}
      <input
        placeholder="Buscar item..."
        value={busca}
        onChange={e => setBusca(e.target.value)}
      />

      {filtrados.map(item => (
        <div key={item.id}>
          {item.nome}
          <button onClick={() => addItem(item)}>+</button>
        </div>
      ))}

      {/* MANUAL */}
      <h3>Item Manual</h3>
      <input
        placeholder="Nome"
        value={nomeManual}
        onChange={e => setNomeManual(e.target.value)}
      />
      <input
        type="number"
        value={qtdManual}
        onChange={e => setQtdManual(Number(e.target.value))}
      />
      <button onClick={addManual}>Adicionar</button>

      {/* UNIFORME */}
      <h3>Uniforme</h3>
      <select onChange={e => setFuncId(e.target.value)}>
        <option>Selecione</option>
        {funcionarios.map(f => (
          <option key={f.id} value={f.id}>{f.nome}</option>
        ))}
      </select>

      <select onChange={e => setTipoVestuario(e.target.value)}>
        <option>Camisa</option>
        <option>Calça</option>
        <option>Bota</option>
      </select>

      <button onClick={addUniforme}>Adicionar Uniforme</button>

      {/* CARRINHO */}
      <h3>Carrinho</h3>
      {itens.map((i, idx) => (
        <div key={idx}>
          {i.nome} - {i.quantidade}
          <button onClick={() => setItens(itens.filter((_, x) => x !== idx))}>
            <Trash2 size={14}/>
          </button>
        </div>
      ))}

      <button onClick={finalizar}>
        <Save size={16}/> Finalizar e Gerar PDF
      </button>

    </div>
  );
}