// src/pages/PedidosCompra.tsx

import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { collection, onSnapshot, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
  const [idFuncSelected, setIdFuncSelected] = useState('');
  const [tipoVestuario, setTipoVestuario] = useState<'Camisa' | 'Calça' | 'Bota'>('Camisa');
  const [qtdVestuario, setQtdVestuario] = useState('1');

  const [nomeManual, setNomeManual] = useState('');
  const [qtdManual, setQtdManual] = useState('1');
  const [unidManual, setUnidManual] = useState('UN');

  const [salvando, setSalvando] = useState(false);

  // 🔥 GERAR PDF (NOVO MÉTODO)
  const gerarPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text("CARVALHO FUNILARIA E PINTURAS LTDA", 14, 15);

    doc.setFontSize(10);
    doc.text("CNPJ: 31.362.302/0001-33", 14, 22);
    doc.text("RUA VISCONDE DE PARNAÍBA, 1235 - MOOCA - SP", 14, 27);
    doc.text(`Data: ${new Date().toLocaleDateString("pt-BR")}`, 150, 22);

    doc.setFontSize(13);
    doc.text("SOLICITAÇÃO DE COMPRA / ORÇAMENTO", 14, 40);

    const linhas = itensPedido.map((item) => [
      `${item.quantidade} ${item.unidade}`,
      item.nome,
      item.marca || "-",
      item.ca || "-",
      item.funcionarioNome
        ? `${item.funcionarioNome} (Tam: ${item.tamanho})`
        : "ESTOQUE",
    ]);

    autoTable(doc, {
      startY: 45,
      head: [["QTD", "DESCRIÇÃO", "MARCA", "C.A", "DESTINO"]],
      body: linhas,
    });

    const finalY = (doc as any).lastAutoTable.finalY + 20;

    doc.text("Assinatura: ___________________________", 14, finalY);

    doc.save("pedido-compra.pdf");
  };

  useEffect(() => {
    if (!setorAtivo) return;

    const qEstoque = query(collection(db, 'estoque'), where('setorId', '==', setorAtivo));
    const unsubEstoque = onSnapshot(qEstoque, (snap) => {
      setEstoqueCompleto(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const qFunc = query(collection(db, 'funcionarios'), where('setorId', '==', setorAtivo));
    const unsubFunc = onSnapshot(qFunc, (snap) => {
      setFuncionarios(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubEstoque(); unsubFunc(); };
  }, [setorAtivo]);

  const adicionarAoPedido = (item: any) => {
    const novoItem: ItemPedido = {
      id: Date.now().toString(),
      nome: item.nome,
      quantidade: 1,
      unidade: item.unidade || 'UN'
    };

    setItensPedido([...itensPedido, novoItem]);
  };

  const finalizarPedido = async () => {
    setSalvando(true);

    try {
      await addDoc(collection(db, 'pedidos_compra_logs'), {
        setorId: setorAtivo,
        data: serverTimestamp(),
        itens: itensPedido
      });

      // 🚀 GERA PDF DIRETO (SEM PRINT)
      gerarPDF();

    } catch (e) {
      console.error(e);
    }

    setSalvando(false);
  };

  return (
    <div style={{ padding: '20px' }}>

      <h1>Pedidos de Compra</h1>

      <input
        placeholder="Buscar..."
        value={buscaEstoque}
        onChange={e => setBuscaEstoque(e.target.value)}
      />

      {estoqueCompleto
        .filter(i => i.nome.toLowerCase().includes(buscaEstoque.toLowerCase()))
        .map(item => (
          <div key={item.id}>
            {item.nome}
            <button onClick={() => adicionarAoPedido(item)}>Adicionar</button>
          </div>
        ))}

      <h2>Carrinho</h2>

      {itensPedido.map((item, idx) => (
        <div key={idx}>
          {item.nome} - {item.quantidade}
          <button onClick={() => setItensPedido(itensPedido.filter((_, i) => i !== idx))}>
            Remover
          </button>
        </div>
      ))}

      <button onClick={finalizarPedido} disabled={salvando}>
        {salvando ? "Gerando..." : "Finalizar e Gerar PDF"}
      </button>

    </div>
  );
}