// src/pages/Orcamentos.tsx
import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { collection, onSnapshot, query, where, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoCarvalho from '../assets/logopdf.png';

import { 
  FileSignature, CheckCircle2, AlertCircle, 
  Plus, Trash2, Calculator, Download, Briefcase, Users
} from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

interface ItemOrcamento {
  quantidade: number;
  descricao: string;
  valorUnitario: number;
}

export default function Orcamentos() {
  const { setorAtivo } = useOutletContext<{ setorAtivo: string }>();

  const [abaAtiva, setAbaAtiva] = useState<'novo' | 'historico'>('novo');
  const [notificacao, setNotificacao] = useState<{msg: string, tipo: 'sucesso' | 'erro'} | null>(null);

  // Estados do Formulário do Cliente
  const [clientesSalvos, setClientesSalvos] = useState<any[]>([]);
  const [clienteNome, setClienteNome] = useState('');
  const [clienteDoc, setClienteDoc] = useState(''); 
  const [clienteContato, setClienteContato] = useState('');

  // Estados Comerciais (Simplificados)
  const [prazoEntrega, setPrazoEntrega] = useState('');
  const [observacoes, setObservacoes] = useState('');

  // Carrinho de Itens
  const [itens, setItens] = useState<ItemOrcamento[]>([{ quantidade: 1, descricao: '', valorUnitario: 0 }]);
  const [historicoOrcamentos, setHistoricoOrcamentos] = useState<any[]>([]);

  const avisar = (msg: string, tipo: 'sucesso' | 'erro' = 'sucesso') => {
    setNotificacao({ msg, tipo });
    setTimeout(() => setNotificacao(null), 4000);
  };

  useEffect(() => {
    if (!setorAtivo) return;
    
    // Escuta os Orçamentos
    const qOrcamentos = query(collection(db, 'orcamentos'), where('setorId', '==', setorAtivo));
    const unsubOrcamentos = onSnapshot(qOrcamentos, (snap) => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      lista.sort((a: any, b: any) => (b.dataEmissao?.toMillis() || 0) - (a.dataEmissao?.toMillis() || 0));
      setHistoricoOrcamentos(lista);
    });

    // Escuta os Clientes Salvos
    const unsubClientes = onSnapshot(collection(db, 'clientes'), (snap) => {
      setClientesSalvos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubOrcamentos(); unsubClientes(); };
  }, [setorAtivo]);

  // Lógica de Auto-Completar Inteligente
  const handleNomeClienteChange = (nomeDigitado: string) => {
    setClienteNome(nomeDigitado);
    
    const clienteEncontrado = clientesSalvos.find(c => c.nome.toLowerCase() === nomeDigitado.toLowerCase());
    
    if (clienteEncontrado) {
      setClienteDoc(clienteEncontrado.documento || '');
      setClienteContato(clienteEncontrado.contato || '');
    } else if (nomeDigitado.toLowerCase() === 'hyundai rotem brasil') {
      setClienteDoc('17.866.875/0004-16');
      setClienteContato('Comprador Oficial');
    }
  };

  // Manipulação de Itens
  const adicionarItem = () => setItens([...itens, { quantidade: 1, descricao: '', valorUnitario: 0 }]);
  const removerItem = (index: number) => setItens(itens.filter((_, i) => i !== index));
  const atualizarItem = (index: number, campo: keyof ItemOrcamento, valor: any) => {
    const novos = [...itens];
    novos[index] = { ...novos[index], [campo]: valor };
    setItens(novos);
  };

  const calcularTotalGeral = () => itens.reduce((acc, item) => acc + (item.quantidade * item.valorUnitario), 0);
  const formatarMoeda = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // GERADOR DE PDF OFICIAL
  const gerarPDF = (dados: any) => {
    const docPdf = new jsPDF('p', 'mm', 'a4');
    const azulEscuro = [30, 41, 59];
    const dataDoc = dados.dataEmissao?.toDate ? dados.dataEmissao.toDate().toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR');
    const numeroOrcamento = dados.id ? dados.id.slice(-6).toUpperCase() : "NOVO";

    try { docPdf.addImage(logoCarvalho, 'PNG', 15, 10, 45, 15); } catch(e){}
    docPdf.setFont("helvetica", "bold"); docPdf.setFontSize(18); docPdf.setTextColor(...azulEscuro);
    docPdf.text("PROPOSTA COMERCIAL", 105, 18, { align: 'center' });
    docPdf.setFontSize(10); docPdf.setTextColor(100, 100, 100);
    docPdf.text(`Orçamento Nº: ${numeroOrcamento}`, 195, 15, { align: 'right' });
    docPdf.text(`Data: ${dataDoc}`, 195, 20, { align: 'right' });
    
    // INFORMAÇÕES DA CARVALHO
    docPdf.setFontSize(9);
    docPdf.text("CARVALHO FUNILARIA E PINTURAS LTDA", 195, 25, { align: 'right' });
    docPdf.text("CNPJ: 31.362.302/0001-33", 195, 29, { align: 'right' });
    docPdf.text("Email: acarloscarvalho71@gmail.com", 195, 33, { align: 'right' });
    docPdf.text("Tel: (16) 99720-2288", 195, 37, { align: 'right' }); 
    
    docPdf.setLineWidth(0.5); docPdf.line(15, 41, 195, 41);

    // DADOS DO CLIENTE
    docPdf.setFillColor(241, 245, 249); docPdf.rect(15, 46, 180, 25, "F");
    docPdf.setFontSize(9); docPdf.setTextColor(0, 0, 0);
    docPdf.setFont("helvetica", "bold"); docPdf.text("DADOS DO CLIENTE", 18, 51);
    docPdf.setFont("helvetica", "normal");
    docPdf.text(`Razão Social / Nome: ${dados.clienteNome}`, 18, 57);
    docPdf.text(`CNPJ / CPF: ${dados.clienteDoc || 'Não informado'}`, 18, 62);
    docPdf.text(`Contato / Email: ${dados.clienteContato || 'Não informado'}`, 18, 67);

    // TABELA DE ITENS
    const renderTable = typeof autoTable === 'function' ? autoTable : (autoTable as any).default;
    renderTable(docPdf, {
      startY: 78,
      head: [["QTD", "DESCRIÇÃO DO PRODUTO / SERVIÇO", "V. UNITÁRIO", "V. TOTAL"]],
      body: dados.itens.map((i: any) => [
        `${i.quantidade}`, 
        i.descricao, 
        formatarMoeda(i.valorUnitario), 
        formatarMoeda(i.quantidade * i.valorUnitario)
      ]),
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], halign: 'center' },
      columnStyles: { 0: { halign: 'center', cellWidth: 15 }, 1: { cellWidth: 95 }, 2: { halign: 'right', cellWidth: 35 }, 3: { halign: 'right', cellWidth: 35 } },
      styles: { fontSize: 9, cellPadding: 5 }
    });

    const finalY = (docPdf as any).lastAutoTable.finalY;

    // TOTAL GERAL
    docPdf.setFillColor(241, 245, 249);
    docPdf.rect(125, finalY + 5, 70, 12, "F");
    docPdf.setFontSize(12); docPdf.setFont("helvetica", "bold");
    docPdf.text("TOTAL GERAL:", 130, finalY + 13);
    docPdf.setTextColor(22, 163, 74); 
    docPdf.text(formatarMoeda(dados.total), 190, finalY + 13, { align: 'right' });
    docPdf.setTextColor(0, 0, 0);

    // OBSERVAÇÕES E PRAZOS (Dinâmico e Limpo)
    docPdf.setFontSize(10); docPdf.setFont("helvetica", "bold");
    docPdf.text("PRAZOS E OBSERVAÇÕES", 15, finalY + 30);
    docPdf.setFont("helvetica", "normal"); docPdf.setFontSize(9);
    
    let currentY = finalY + 36;

    if (dados.prazoEntrega) {
      docPdf.text(`Prazo de Entrega / Execução: ${dados.prazoEntrega}`, 15, currentY);
      currentY += 6;
    }

    if (dados.observacoes) {
      const splitObs = docPdf.splitTextToSize(dados.observacoes, 180);
      docPdf.text(splitObs, 15, currentY);
    }

    // ASSINATURA CLIENTE
    const yAssinatura = 260;
    docPdf.setDrawColor(0,0,0); docPdf.setLineWidth(0.5);
    docPdf.line(65, yAssinatura, 145, yAssinatura);
    docPdf.setFontSize(9); docPdf.setFont("helvetica", "bold");
    docPdf.text("De Acordo / Aprovação do Cliente", 105, yAssinatura + 5, { align: 'center' });

    docPdf.save(`Orcamento_Carvalho_${numeroOrcamento}.pdf`);
  };

  const salvarEGerarOrcamento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteNome) return avisar("Preencha o nome do cliente.", "erro");
    if (itens.some(i => !i.descricao || i.valorUnitario <= 0)) return avisar("Preencha as descrições e valores maiores que zero.", "erro");

    try {
      const total = calcularTotalGeral();
      const novoOrcamento = {
        setorId: setorAtivo, clienteNome, clienteDoc, clienteContato,
        prazoEntrega, observacoes,
        itens, total, dataEmissao: serverTimestamp()
      };

      // 1. Salva o Orçamento
      const docRef = await addDoc(collection(db, 'orcamentos'), novoOrcamento);
      
      // 2. INTELIGÊNCIA CRM: Verifica o Cliente
      const clienteExistente = clientesSalvos.find(c => c.nome.toLowerCase() === clienteNome.toLowerCase());
      
      if (!clienteExistente) {
        await addDoc(collection(db, 'clientes'), {
          nome: clienteNome,
          documento: clienteDoc,
          contato: clienteContato,
          createdAt: serverTimestamp()
        });
      } else {
        if (clienteExistente.documento !== clienteDoc || clienteExistente.contato !== clienteContato) {
          await updateDoc(doc(db, 'clientes', clienteExistente.id), {
            documento: clienteDoc,
            contato: clienteContato
          });
        }
      }
      
      // 3. Gera o PDF na hora
      gerarPDF({ id: docRef.id, ...novoOrcamento, dataEmissao: { toDate: () => new Date() } });
      
      avisar("Orçamento salvo e PDF gerado!");
      
      // Limpar form
      setClienteNome(''); setClienteDoc(''); setClienteContato(''); setObservacoes(''); setPrazoEntrega('');
      setItens([{ quantidade: 1, descricao: '', valorUnitario: 0 }]);
      setAbaAtiva('historico');
    } catch (error) { avisar("Erro ao salvar.", "erro"); }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '15px', paddingBottom: '80px' }}>
      
      {notificacao && (
        <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 12000, backgroundColor: notificacao.tipo === 'sucesso' ? '#10b981' : '#ef4444', color: 'white', padding: '12px 24px', borderRadius: '50px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold' }}>
          {notificacao.tipo === 'sucesso' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />} {notificacao.msg}
        </div>
      )}

      {/* HEADER */}
      <div style={{ marginBottom: '25px' }}>
        <h1 style={{ fontSize: '24px', color: '#1e293b', margin: '0 0 5px 0', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FileSignature color="#3b82f6" /> Orçamentos e Propostas
        </h1>
        <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Crie propostas comerciais em PDF e salve sua carteira de clientes automaticamente.</p>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', flexWrap: 'wrap' }}>
        <Button onClick={() => setAbaAtiva('novo')} style={{ flex: 1, backgroundColor: abaAtiva === 'novo' ? '#3b82f6' : '#e2e8f0', color: abaAtiva === 'novo' ? 'white' : '#475569' }}>
          <Plus size={18} style={{marginRight: '5px'}}/> Novo Orçamento
        </Button>
        <Button onClick={() => setAbaAtiva('historico')} style={{ flex: 1, backgroundColor: abaAtiva === 'historico' ? '#1e293b' : '#e2e8f0', color: abaAtiva === 'historico' ? 'white' : '#475569' }}>
          <Briefcase size={18} style={{marginRight: '5px'}}/> Histórico de Propostas
        </Button>
      </div>

      {abaAtiva === 'novo' && (
        <form onSubmit={salvarEGerarOrcamento} style={{ backgroundColor: 'white', padding: '25px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          
          {/* DADOS DO CLIENTE (COM AUTOCOMPLETE INTELIGENTE) */}
          <h3 style={{ fontSize: '15px', color: '#1e293b', margin: '0 0 15px 0', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Users size={18} color="#3b82f6"/> 1. Dados do Cliente
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px', marginBottom: '30px' }}>
            <div>
              <label style={{ fontSize: '13px', color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Razão Social / Nome *</label>
              <input 
                list="lista-clientes"
                value={clienteNome} 
                onChange={e => handleNomeClienteChange(e.target.value)}
                placeholder="Digite para buscar ou adicionar..." 
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
              />
              <datalist id="lista-clientes">
                <option value="Hyundai Rotem Brasil" />
                {clientesSalvos.map(c => <option key={c.id} value={c.nome} />)}
              </datalist>
              <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>Altere os dados de contato abaixo e nós atualizamos o cadastro!</span>
            </div>
            
            <Input label="CNPJ / CPF" placeholder="Apenas números" value={clienteDoc} onChange={e => setClienteDoc(e.target.value)} />
            <Input label="Contato (Email ou Telefone)" placeholder="Ex: contato@xpto.com" value={clienteContato} onChange={e => setClienteContato(e.target.value)} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px' }}>
            <h3 style={{ fontSize: '15px', color: '#1e293b', margin: 0 }}>2. Itens e Valores</h3>
            <button type="button" onClick={adicionarItem} style={{ backgroundColor: '#e0e7ff', color: '#4f46e5', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Plus size={14}/> Add Linha
            </button>
          </div>

          {/* Carrinho de Itens */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px' }}>
            {itens.map((item, index) => (
              <div key={index} style={{ display: 'flex', gap: '10px', alignItems: 'center', backgroundColor: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
                <div style={{ width: '80px' }}>
                  <Input label="Qtd" type="number" value={item.quantidade} onChange={e => atualizarItem(index, 'quantidade', Number(e.target.value))} required />
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <Input label="Descrição do Serviço / Peça" placeholder="Ex: Pintura Poliuretano" value={item.descricao} onChange={e => atualizarItem(index, 'descricao', e.target.value)} required />
                </div>
                <div style={{ width: '120px' }}>
                  <Input label="Valor Un. (R$)" type="number" step="0.01" placeholder="0.00" value={item.valorUnitario || ''} onChange={e => atualizarItem(index, 'valorUnitario', Number(e.target.value))} required />
                </div>
                <div style={{ width: '120px', padding: '10px', backgroundColor: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe', textAlign: 'center' }}>
                  <span style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>Total da Linha</span>
                  <strong style={{ color: '#1d4ed8', fontSize: '14px' }}>{formatarMoeda(item.quantidade * item.valorUnitario)}</strong>
                </div>
                <button type="button" onClick={() => removerItem(index)} disabled={itens.length === 1} style={{ background: 'none', border: 'none', color: itens.length === 1 ? '#cbd5e1' : '#ef4444', cursor: itens.length === 1 ? 'not-allowed' : 'pointer' }}>
                  <Trash2 size={20}/>
                </button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '30px' }}>
            <div style={{ backgroundColor: '#f0fdf4', padding: '15px 30px', borderRadius: '12px', border: '2px solid #bbf7d0', textAlign: 'right' }}>
              <span style={{ fontSize: '13px', color: '#166534', fontWeight: 'bold', display: 'block' }}>TOTAL DO ORÇAMENTO</span>
              <strong style={{ fontSize: '24px', color: '#15803d' }}>{formatarMoeda(calcularTotalGeral())}</strong>
            </div>
          </div>

          <h3 style={{ fontSize: '15px', color: '#1e293b', margin: '0 0 15px 0', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px' }}>3. Prazos e Observações</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px', marginBottom: '20px' }}>
            <Input label="Prazo de Entrega/Execução (Opcional)" placeholder="Ex: 10 dias úteis" value={prazoEntrega} onChange={e => setPrazoEntrega(e.target.value)} />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '13px', color: '#475569', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Observações (Aparecerão no PDF)</label>
            <textarea rows={3} value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Ex: Impostos inclusos. Frete por conta do cliente..." style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
          </div>

          <Button type="submit" style={{ width: '100%', height: '55px', backgroundColor: '#3b82f6', fontSize: '16px', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
            <Calculator size={20}/> Salvar e Gerar PDF Oficial
          </Button>

        </form>
      )}

      {abaAtiva === 'historico' && (
        <div style={{ display: 'grid', gap: '15px' }}>
          {historicoOrcamentos.length === 0 ? (
             <div style={{ textAlign: 'center', padding: '40px', backgroundColor: 'white', borderRadius: '16px', color: '#94a3b8' }}>Nenhum orçamento gerado ainda.</div>
          ) : (
            historicoOrcamentos.map(orc => (
              <div key={orc.id} style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '4px solid #3b82f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                <div>
                  <strong style={{ fontSize: '16px', color: '#1e293b', display: 'block' }}>{orc.clienteNome}</strong>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Orçamento Nº {orc.id.slice(-6).toUpperCase()} • {orc.dataEmissao?.toDate().toLocaleDateString('pt-BR')}</span>
                  <p style={{ margin: '5px 0 0 0', fontSize: '13px', color: '#475569' }}><strong>Total:</strong> {formatarMoeda(orc.total)} ({orc.itens?.length} itens)</p>
                </div>
                <Button onClick={() => gerarPDF(orc)} style={{ backgroundColor: '#e0e7ff', color: '#4f46e5', border: 'none' }}>
                  <Download size={18} style={{marginRight: '5px'}}/> Baixar PDF
                </Button>
              </div>
            ))
          )}
        </div>
      )}

    </div>
  );
}