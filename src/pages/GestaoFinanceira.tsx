// src/pages/GestaoFinanceira.tsx
import { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, doc, setDoc, query, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase'; 
import { dbFolha } from '../services/firebaseFolha'; 
import { Wallet, Banknote, PlusCircle, ArrowRight, User, Bus, Route, Trash2, QrCode, Download, Edit3, PenTool, CheckCircle, FileText } from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import logoCarvalho from '../assets/logopdf.png';

// Função utilitária para formatar CPF no padrão 000.000.000-00
const formatarCPF = (cpf: string) => {
  if (!cpf) return 'Não informado';
  const apenasNumeros = cpf.replace(/\D/g, '');
  if (apenasNumeros.length !== 11) return cpf; 
  return apenasNumeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
};

// Motor de Cálculo de Dias Úteis
const calcularDiasUteis = (mesAnoFiltro: string) => {
  const ano = parseInt(mesAnoFiltro.split('-')[0]);
  const mes = parseInt(mesAnoFiltro.split('-')[1]);
  const diasNoMes = new Date(ano, mes, 0).getDate();
  const FERIADOS_SP = ['01-01', '01-25', '04-21', '05-01', '07-09', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25'];
  let diasUteis = 0;
  for (let dia = 1; dia <= diasNoMes; dia++) {
    const dataObj = new Date(ano, mes - 1, dia);
    const diaSemana = dataObj.getDay(); 
    const mesDiaStr = `${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    if (diaSemana !== 0 && diaSemana !== 6 && !FERIADOS_SP.includes(mesDiaStr)) diasUteis++;
  }
  return diasUteis;
};

const formatarDataPtBR = (dataIso: string) => dataIso.split('-').reverse().join('/');

export default function GestaoFinanceira() {
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [dadosFinanceiros, setDadosFinanceiros] = useState<Record<string, any>>({});
  const [mesFiltro, setMesFiltro] = useState(new Date().toISOString().substring(0, 7));
  const [termoBusca, setTermoBusca] = useState('');
  const [diasUteis, setDiasUteis] = useState<number>(calcularDiasUteis(new Date().toISOString().substring(0, 7)));

  useEffect(() => { setDiasUteis(calcularDiasUteis(mesFiltro)); }, [mesFiltro]);

  const [modalAdiantamento, setModalAdiantamento] = useState({ 
    visivel: false, funcId: '', nome: '', idVale: '', valor: '', motivo: '', dataIso: '' 
  });
  const [modalTransporte, setModalTransporte] = useState<{ visivel: boolean, funcId: string, nome: string, rotas: any[] }>({ visivel: false, funcId: '', nome: '', rotas: [] });
  const [modalAssinatura, setModalAssinatura] = useState({ visivel: false, funcId: '', idVale: '' });
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [desenhando, setDesenhando] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'funcionarios'), (snap) => {
      setFuncionarios(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter((f: any) => f.status !== 'desligado'));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const carregarFinancas = async () => {
      const q = query(collection(dbFolha, 'financeiro_mes'));
      const snap = await getDocs(q);
      const financasMap: Record<string, any> = {};
      snap.docs.forEach(doc => {
        if (doc.id.includes(mesFiltro)) financasMap[doc.data().funcionarioId] = doc.data();
      });
      setDadosFinanceiros(financasMap);
    };
    carregarFinancas();
  }, [mesFiltro]);

  const salvarChavePix = async (funcId: string, chave: string) => {
    await setDoc(doc(db, 'funcionarios', funcId), { chavePixPadrao: chave }, { merge: true });
  };

  const salvarDiasPersonalizados = async (funcId: string, dias: number) => {
    const idDoc = `${funcId}_${mesFiltro}`;
    if (isNaN(dias)) return;
    await setDoc(doc(dbFolha, 'financeiro_mes', idDoc), { diasUteisPersonalizado: dias }, { merge: true });
    setDadosFinanceiros(prev => ({ ...prev, [funcId]: { ...prev[funcId], diasUteisPersonalizado: dias } }));
  };

  const abrirModalTransporte = (funcId: string, nome: string) => {
    const funcGlobal = funcionarios.find(f => f.id === funcId);
    const rotasAtuais = funcGlobal?.transportesPadrao || [];
    setModalTransporte({ visivel: true, funcId, nome, rotas: [...rotasAtuais] });
  };
  const adicionarLinhaRota = () => setModalTransporte(prev => ({ ...prev, rotas: [...prev.rotas, { id: Date.now().toString(), nomeConducao: '', valor: '', qtdDiaria: 1 }] }));
  const removerLinhaRota = (idLinha: string) => setModalTransporte(prev => ({ ...prev, rotas: prev.rotas.filter(r => r.id !== idLinha) }));
  const atualizarLinhaRota = (idLinha: string, campo: string, valor: any) => setModalTransporte(prev => ({ ...prev, rotas: prev.rotas.map(r => r.id === idLinha ? { ...r, [campo]: valor } : r) }));

  const salvarConfiguracaoRotas = async () => {
    const { funcId, rotas } = modalTransporte;
    let totalDiario = 0;
    rotas.forEach(rota => totalDiario += ((parseFloat(rota.valor) || 0) * (parseInt(rota.qtdDiaria) || 0)));

    await setDoc(doc(db, 'funcionarios', funcId), { 
      transportesPadrao: rotas, 
      valorPassagemDiarioPadrao: totalDiario 
    }, { merge: true });
    
    setModalTransporte({ visivel: false, funcId: '', nome: '', rotas: [] });
  };

  const abrirModalAdiantamento = (funcId: string, nome: string, valeExistente?: any) => {
    if (valeExistente) {
      const partesData = valeExistente.data.split('/');
      const dataIso = partesData.length === 3 ? `${partesData[2]}-${partesData[1]}-${partesData[0]}` : new Date().toISOString().split('T')[0];
      setModalAdiantamento({ visivel: true, funcId, nome, idVale: valeExistente.id, valor: String(valeExistente.valor), motivo: valeExistente.motivo, dataIso });
    } else {
      setModalAdiantamento({ visivel: true, funcId, nome, idVale: '', valor: '', motivo: '', dataIso: new Date().toISOString().split('T')[0] });
    }
  };

  const salvarAdiantamento = async () => {
    if (!modalAdiantamento.valor || !modalAdiantamento.dataIso) return;
    const { funcId, nome, idVale, valor, motivo, dataIso } = modalAdiantamento;
    const idDoc = `${funcId}_${mesFiltro}`;
    const valorNum = parseFloat(valor) || 0;
    const dataFormatada = formatarDataPtBR(dataIso);
    
    const dadosAtuais = dadosFinanceiros[funcId] || {};
    let adiantamentosAtuais = [...(dadosAtuais.adiantamentos || [])];

    if (idVale) {
      adiantamentosAtuais = adiantamentosAtuais.map(ad => 
        ad.id === idVale ? { ...ad, data: dataFormatada, valor: valorNum, motivo: motivo || 'Adiantamento / Vale' } : ad
      );
    } else {
      adiantamentosAtuais.push({ id: Date.now().toString(), data: dataFormatada, valor: valorNum, motivo: motivo || 'Adiantamento / Vale' });
    }

    await setDoc(doc(dbFolha, 'financeiro_mes', idDoc), { funcionarioId: funcId, nomeFuncionario: nome, mesReferencia: mesFiltro, adiantamentos: adiantamentosAtuais }, { merge: true });
    setDadosFinanceiros(prev => ({ ...prev, [funcId]: { ...prev[funcId], adiantamentos: adiantamentosAtuais } }));
    setModalAdiantamento({ visivel: false, funcId: '', nome: '', idVale: '', valor: '', motivo: '', dataIso: '' });
  };

  const excluirAdiantamento = async (funcId: string, idAdiantamento: string) => {
    const idDoc = `${funcId}_${mesFiltro}`;
    const dadosAtuais = dadosFinanceiros[funcId] || {};
    const novaLista = (dadosAtuais.adiantamentos || []).filter((ad: any) => ad.id !== idAdiantamento);
    await setDoc(doc(dbFolha, 'financeiro_mes', idDoc), { adiantamentos: novaLista }, { merge: true });
    setDadosFinanceiros(prev => ({ ...prev, [funcId]: { ...prev[funcId], adiantamentos: novaLista } }));
  };

  const iniciarDesenho = (e: any) => {
    setDesenhando(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const desenhar = (e: any) => {
    if (!desenhando) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;
    ctx.lineTo(x, y);
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.stroke();
  };
  const pararDesenho = () => setDesenhando(false);
  const limparAssinatura = () => {
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
  };

  const salvarAssinatura = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const imagemBase64 = canvas.toDataURL('image/png');
    const { funcId, idVale } = modalAssinatura;
    const idDoc = `${funcId}_${mesFiltro}`;
    const dadosAtuais = dadosFinanceiros[funcId] || {};
    const adiantamentosAtualizados = (dadosAtuais.adiantamentos || []).map((ad: any) => ad.id === idVale ? { ...ad, assinatura: imagemBase64 } : ad);
    await setDoc(doc(dbFolha, 'financeiro_mes', idDoc), { adiantamentos: adiantamentosAtualizados }, { merge: true });
    setDadosFinanceiros(prev => ({ ...prev, [funcId]: { ...prev[funcId], adiantamentos: adiantamentosAtualizados } }));
    setModalAssinatura({ visivel: false, funcId: '', idVale: '' });
  };

  // PDF GERAL PARA O ESCRITÓRIO
  const exportarPdfValesEscritorio = () => {
    const docPdf = new jsPDF('p', 'mm', 'a4');
    const vermelhoCorporativo = [185, 28, 28];

    try { docPdf.addImage(logoCarvalho, 'PNG', 14, 10, 30, 8); } catch(e){}

    docPdf.setFont("helvetica", "bold"); docPdf.setFontSize(14); docPdf.setTextColor(vermelhoCorporativo[0], vermelhoCorporativo[1], vermelhoCorporativo[2]);
    docPdf.text("RELATÓRIO DE DESCONTOS (VALES)", 105, 14, { align: 'center' });
    
    docPdf.setFontSize(9); docPdf.setTextColor(100);
    docPdf.text(`Competência: ${mesFiltro.split('-').reverse().join('/')}`, 105, 19, { align: 'center' });
    
    docPdf.setLineWidth(0.4); docPdf.setDrawColor(vermelhoCorporativo[0], vermelhoCorporativo[1], vermelhoCorporativo[2]);
    docPdf.line(14, 22, 196, 22);

    const corpoTabela = funcionarios.map(func => {
      const dados = dadosFinanceiros[func.id] || {};
      const adiantamentos = dados.adiantamentos || [];
      const totalFunc = adiantamentos.reduce((acc: number, curr: any) => acc + curr.valor, 0);

      if (totalFunc > 0) {
        const descricaoVales = adiantamentos.map((ad: any) => `• [${ad.data}] ${ad.motivo}: R$ ${ad.valor.toFixed(2)}`).join('\n');
        return [func.nome.toUpperCase(), descricaoVales, `R$ ${totalFunc.toFixed(2)}`];
      }
      return null;
    }).filter(Boolean);

    (docPdf as any).autoTable({ 
      startY: 28, 
      head: [["Colaborador", "Discriminação dos Adiantamentos", "Total a Descontar"]], 
      body: corpoTabela, 
      theme: 'grid', 
      styles: { fontSize: 8.5, cellPadding: 4, valign: 'middle' }, 
      headStyles: { fillColor: vermelhoCorporativo, textColor: 255 }, 
      columnStyles: { 0: { fontStyle: 'bold', halign: 'left' }, 1: { halign: 'left' }, 2: { halign: 'center', fontStyle: 'bold', textColor: vermelhoCorporativo } } 
    });
    
    docPdf.save(`Relatorio_Descontos_${mesFiltro}.pdf`);
  };

  // 🚀 2. PDF DE TERMO E VALES INDIVIDUAL (Perfeitamente dimensionado para caber numa única página A4 com margens seguras)
  const exportarPdfTermoIndividual = (func: any) => {
    const docPdf = new jsPDF('p', 'mm', 'a4');
    const vermelhoCorporativo = [185, 28, 28];
    const cpfFormatado = formatarCPF(func.cpf);

    // Margem superior otimizada (começa nos 12mm)
    try { docPdf.addImage(logoCarvalho, 'PNG', 14, 10, 28, 7); } catch(e){}

    docPdf.setFont("helvetica", "bold"); docPdf.setFontSize(12); docPdf.setTextColor(vermelhoCorporativo[0], vermelhoCorporativo[1], vermelhoCorporativo[2]);
    docPdf.text("TERMO DE CONSENTIMENTO E ADIANTAMENTO SALARIAL", 105, 13, { align: 'center' });
    
    docPdf.setFontSize(7.5); docPdf.setTextColor(90, 90, 90);
    docPdf.text("CARVALHO FUNILARIA E PINTURAS LTDA | CNPJ: 31.362.302/0001-39", 105, 17, { align: 'center' });
    
    docPdf.setLineWidth(0.3); docPdf.setDrawColor(vermelhoCorporativo[0], vermelhoCorporativo[1], vermelhoCorporativo[2]);
    docPdf.line(14, 20, 196, 20);

    // Bloco de Identificação Formal do Colaborador
    let yText = 24;
    docPdf.setFillColor(248, 250, 252);
    docPdf.setDrawColor(203, 213, 225);
    docPdf.rect(14, yText, 182, 11, "FD");

    docPdf.setFontSize(7.5); docPdf.setTextColor(0, 0, 0);
    docPdf.setFont("helvetica", "bold"); docPdf.text("COLABORADOR:", 17, yText + 4.5);
    docPdf.setFont("helvetica", "normal"); docPdf.text((func.nome || "NÃO INFORMADO").toUpperCase(), 43, yText + 4.5);

    docPdf.setFont("helvetica", "bold"); docPdf.text("CPF:", 132, yText + 4.5);
    docPdf.setFont("helvetica", "normal"); docPdf.text(cpfFormatado, 141, yText + 4.5);

    docPdf.setFont("helvetica", "bold"); docPdf.text("COMPETÊNCIA:", 17, yText + 8.5);
    docPdf.setFont("helvetica", "normal"); docPdf.text(mesFiltro.split('-').reverse().join('/'), 43, yText + 8.5);

    yText += 15;

    // Declaração Formal Justificada com tamanho otimizado (7.5pt) para nunca passar da página
    docPdf.setFont("helvetica", "bold"); docPdf.setFontSize(7.5); docPdf.setTextColor(vermelhoCorporativo[0], vermelhoCorporativo[1], vermelhoCorporativo[2]);
    docPdf.text("DECLARAÇÃO DE ANUÊNCIA E AUTORIZAÇÃO DE DESCONTO", 14, yText); yText += 3.5;
    
    docPdf.setFont("helvetica", "normal"); docPdf.setFontSize(7.5); docPdf.setTextColor(40, 40, 40);
    const termoConsentimento = `Eu, ${func.nome.toUpperCase()}, portador(a) do CPF nº ${cpfFormatado}, declaro para os devidos fins legais que recebi da empresa CARVALHO FUNILARIA E PINTURAS LTDA os valores em espécie ou adiantamentos discriminados na tabela abaixo. Por meio deste termo, autorizo expressamente a empresa a efetuar o desconto correspondente ao montante total em minha folha de pagamento ou verbas rescisórias referentes ao mês de competência ${mesFiltro.split('-').reverse().join('/')}, em conformidade com as normativas vigentes.`;
    
    const linhasTermo = docPdf.splitTextToSize(termoConsentimento, 182);
  docPdf.text(termoConsentimento, 14, yText, { align: 'justify', maxWidth: 182, lineHeightFactor: 1.2 });
  yText += (linhasTermo.length * 3.5) + 4;

    const dados = dadosFinanceiros[func.id] || {};
    const adiantamentos = dados.adiantamentos || [];

    const corpoTabela = adiantamentos.map((ad: any) => [
      ad.data,
      ad.motivo,
      `R$ ${ad.valor.toFixed(2)}`,
      '' 
    ]);

    (docPdf as any).autoTable({ 
      startY: yText, 
      head: [["Data do Vale", "Descrição / Motivo", "Valor (R$)", "Assinatura do Colaborador"]], 
      body: corpoTabela, 
      theme: 'grid', 
      rowPageBreak: 'avoid',
      styles: { fontSize: 7.5, cellPadding: 2, valign: 'middle' }, 
      headStyles: { fillColor: vermelhoCorporativo, textColor: 255, halign: 'center', fontStyle: 'bold' }, 
      columnStyles: { 
        0: { halign: 'center', cellWidth: 26 }, 
        1: { halign: 'left' }, 
        2: { halign: 'center', fontStyle: 'bold', textColor: vermelhoCorporativo, cellWidth: 28 },
        3: { halign: 'center', cellWidth: 46, minCellHeight: 10 } 
      },
      didDrawCell: (data: any) => {
        if (data.column.index === 3 && data.cell.section === 'body') {
          const rowIndex = data.row.index;
          const assinaturaBase64 = adiantamentos[rowIndex]?.assinatura;
          
          if (typeof assinaturaBase64 === 'string' && assinaturaBase64.includes('data:image')) {
            try {
              const imgWidth = 36;
              const imgHeight = 8;
              const xPos = data.cell.x + (data.cell.width - imgWidth) / 2;
              const yPos = data.cell.y + (data.cell.height - imgHeight) / 2;
              docPdf.addImage(assinaturaBase64, 'PNG', xPos, yPos, imgWidth, imgHeight);
            } catch (e) {
              docPdf.setFontSize(6);
              docPdf.text("Erro na Imagem", data.cell.x + (data.cell.width / 2), data.cell.y + 5, { align: 'center' });
            }
          } else {
            docPdf.setFontSize(6.5);
            docPdf.setFont("helvetica", "italic");
            docPdf.setTextColor(150, 150, 150);
            docPdf.text("Não Assinado", data.cell.x + (data.cell.width / 2), data.cell.y + 5, { align: 'center' });
            docPdf.setTextColor(0, 0, 0);
          }
        }
      },
      didDrawPage: (data: any) => {
        const str = `Página ${docPdf.internal.getNumberOfPages()}`;
        docPdf.setFontSize(6);
        docPdf.setTextColor(120);
        docPdf.text(`Carvalho Funilaria e Pinturas Ltda - Sistema de Gestão | Impresso em ${new Date().toLocaleString('pt-BR')}`, data.settings.margin.left, docPdf.internal.pageSize.height - 6);
        docPdf.text(str, docPdf.internal.pageSize.width - data.settings.margin.right, docPdf.internal.pageSize.height - 6, { align: 'right' });
      }
    });

    docPdf.save(`Termo_Adiantamento_${func.nome.split(' ')[0]}_${mesFiltro}.pdf`);
  };

  // PDF TRANSPORTE
  const exportarPdfPixTransporte = () => {
    const docPdf = new jsPDF('p', 'mm', 'a4');
    const azulCorporativo = [30, 41, 59];

    try { docPdf.addImage(logoCarvalho, 'PNG', 14, 10, 30, 8); } catch(e){}
    
    docPdf.setFont("helvetica", "bold"); docPdf.setFontSize(14); docPdf.setTextColor(azulCorporativo[0], azulCorporativo[1], azulCorporativo[2]);
    docPdf.text("RELATÓRIO DE VALE TRANSPORTE", 105, 14, { align: 'center' });
    
    docPdf.setFontSize(9); docPdf.setTextColor(100);
    docPdf.text(`Competência: ${mesFiltro.split('-').reverse().join('/')} | Dias Úteis Base: ${diasUteis}`, 105, 19, { align: 'center' });
    
    docPdf.setLineWidth(0.4); docPdf.setDrawColor(azulCorporativo[0], azulCorporativo[1], azulCorporativo[2]);
    docPdf.line(14, 22, 196, 22);

    const corpoTabela = funcionarios.map(func => {
      const dadosMes = dadosFinanceiros[func.id] || {};
      const diasFuncionario = dadosMes.diasUteisPersonalizado !== undefined ? dadosMes.diasUteisPersonalizado : diasUteis;
      const totalDiario = func.valorPassagemDiarioPadrao || 0;
      const chavePix = func.chavePixPadrao || 'Não informada';
      const totalPass = totalDiario * diasFuncionario; 
      
      if (totalPass > 0) {
        return [func.nome.toUpperCase(), chavePix, diasFuncionario.toString(), `R$ ${totalPass.toFixed(2)}`];
      }
      return null;
    }).filter(Boolean);

    (docPdf as any).autoTable({ 
      startY: 28, 
      head: [["Colaborador", "Chave PIX", "Dias Úteis Pagos", "Total (VT)"]], 
      body: corpoTabela, 
      theme: 'grid', 
      styles: { fontSize: 8.5, cellPadding: 3, halign: 'center', valign: 'middle' }, 
      headStyles: { fillColor: azulCorporativo, textColor: 255 }, 
      columnStyles: { 0: { halign: 'left' }, 1: { halign: 'left' }, 3: { fontStyle: 'bold', textColor: [22, 101, 52] } } 
    });
    
    docPdf.save(`Relatorio_VT_${mesFiltro}.pdf`);
  };

  const funcionariosFiltrados = funcionarios.filter(f => f.nome.toLowerCase().includes(termoBusca.toLowerCase()));

  return (
    <div style={{ padding: '30px', backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: 'system-ui' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '30px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div style={{ backgroundColor: '#f0fdf4', padding: '15px', borderRadius: '16px' }}><Wallet size={30} color="#16a34a" /></div>
              <div>
                <h1 style={{ margin: 0, fontSize: '24px', color: '#0f172a' }}>Gestão Financeira e Vales</h1>
                <p style={{ margin: 0, color: '#64748b' }}>Cálculo de Rotas de Transporte e Caixinha da Empresa</p>
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'white', padding: '8px 15px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  Dias Úteis Base: 
                  <input type="number" value={diasUteis} onChange={e => setDiasUteis(parseInt(e.target.value) || 0)} style={{ border: '1px solid #e2e8f0', borderRadius: '6px', outline: 'none', fontWeight: 'bold', color: '#0ea5e9', fontSize: '15px', width: '45px', textAlign: 'center', padding: '2px' }} />
                  <Edit3 size={14} color="#94a3b8"/>
                </span>
                <span style={{ borderLeft: '1px solid #e2e8f0', height: '20px', margin: '0 5px' }}></span>
                <input type="month" value={mesFiltro} onChange={e => setMesFiltro(e.target.value)} style={{ border: 'none', outline: 'none', fontWeight: 'bold' }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <Button onClick={exportarPdfPixTransporte} style={{ backgroundColor: '#0f172a', display: 'flex', gap: '8px' }}><Download size={18}/> PDF - PIX e Transporte</Button>
            <Button onClick={exportarPdfValesEscritorio} style={{ backgroundColor: '#b91c1c', display: 'flex', gap: '8px' }}><Download size={18}/> PDF - Vales Escritório (Geral)</Button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {funcionariosFiltrados.map(func => {
            const dadosFunc = dadosFinanceiros[func.id] || {};
            const adiantamentos = dadosFunc.adiantamentos || [];
            const totalAdiantado = adiantamentos.reduce((acc: number, curr: any) => acc + curr.valor, 0);
            
            const rotasFunc = func.transportesPadrao || [];
            const totalPassagemDiario = func.valorPassagemDiarioPadrao || 0;
            const chavePixExibida = func.chavePixPadrao || '';
            
            const diasFuncionario = dadosFunc.diasUteisPersonalizado !== undefined ? dadosFunc.diasUteisPersonalizado : diasUteis;
            const totalPassagemCalculado = totalPassagemDiario * diasFuncionario;

            return (
              <div key={func.id} style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '15px', flexWrap: 'wrap', gap: '15px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', backgroundColor: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><User size={20} color="#475569" /></div>
                    <strong style={{ fontSize: '18px', color: '#1e293b' }}>{func.nome}</strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    {adiantamentos.length > 0 && (
                      <Button onClick={() => exportarPdfTermoIndividual(func)} style={{ backgroundColor: '#ef4444', color: 'white', fontSize: '12px', height: '35px', padding: '0 12px', gap: '6px' }}>
                        <FileText size={14} /> Termo Individual PDF
                      </Button>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#f8fafc', padding: '6px 12px', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                      <QrCode size={16} color="#64748b" />
                      <input type="text" placeholder="Chave PIX..." defaultValue={chavePixExibida} onBlur={(e) => salvarChavePix(func.id, e.target.value)} style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', width: '180px' }} />
                    </div>
                  </div>
                </div>

                <div style={{ backgroundColor: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px dashed #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                  <div>
                    <h4 style={{ margin: '0 0 5px 0', fontSize: '13px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase' }}><Bus size={14}/> Vale Transporte</h4>
                    {rotasFunc.length > 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155' }}>
                        Custo Diário: <strong>R$ {totalPassagemDiario.toFixed(2)}</strong> | Previsto no Mês (Dias: 
                        <input 
                          type="number" 
                          value={diasFuncionario} 
                          onChange={(e) => salvarDiasPersonalizados(func.id, parseInt(e.target.value))} 
                          style={{ width: '40px', padding: '2px', textAlign: 'center', borderRadius: '4px', border: '1px solid #cbd5e1', fontWeight: 'bold' }} 
                        />
                        ): <strong style={{ color: '#0ea5e9', fontSize: '15px' }}>R$ {totalPassagemCalculado.toFixed(2)}</strong>
                      </div>
                    ) : <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', fontStyle: 'italic' }}>Nenhuma rota configurada.</p>}
                  </div>
                  <Button onClick={() => abrirModalTransporte(func.id, func.nome)} style={{ backgroundColor: 'white', color: '#0f172a', border: '1px solid #cbd5e1', fontSize: '13px', height: '40px', gap: '8px' }}><Route size={16} /> Configurar Rotas</Button>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h4 style={{ margin: 0, fontSize: '14px', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}><Banknote size={16} /> Adiantamentos (Caixinha)</h4>
                    <button onClick={() => abrirModalAdiantamento(func.id, func.nome)} style={{ backgroundColor: '#eff6ff', color: '#3b82f6', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><PlusCircle size={14} /> Novo Vale</button>
                  </div>

                  {adiantamentos.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {adiantamentos.map((ad: any) => (
                        <div key={ad.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fef2f2', padding: '10px 15px', borderRadius: '8px', fontSize: '13px', border: '1px solid #fee2e2' }}>
                          <span style={{ color: '#991b1b', flex: 1 }}>{ad.data} - {ad.motivo}</span>
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <strong style={{ color: '#b91c1c' }}>R$ {ad.valor.toFixed(2)}</strong>
                            
                            <div style={{ display: 'flex', gap: '8px', borderLeft: '1px solid #fca5a5', paddingLeft: '15px' }}>
                              {ad.assinatura ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#16a34a', fontSize: '11px', fontWeight: 'bold', backgroundColor: '#dcfce7', padding: '4px 8px', borderRadius: '6px' }}>
                                  <CheckCircle size={14} /> Assinado
                                </div>
                              ) : (
                                <button onClick={() => setModalAssinatura({ visivel: true, funcId: func.id, idVale: ad.id })} title="Recolher Assinatura" style={{ background: 'none', border: '1px solid #cbd5e1', backgroundColor: 'white', color: '#0f172a', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                                  <PenTool size={14} /> Assinar
                                </button>
                              )}
                              <button onClick={() => abrirModalAdiantamento(func.id, func.nome, ad)} title="Editar Vale" style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: '4px' }}><Edit3 size={16} /></button>
                              <button onClick={() => excluirAdiantamento(func.id, ad.id)} title="Excluir Vale" style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}><Trash2 size={16} /></button>
                            </div>
                          </div>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 15px', borderTop: '2px solid #e2e8f0', marginTop: '5px' }}>
                        <strong style={{ color: '#1e293b', fontSize: '14px' }}>Total a Descontar:</strong>
                        <strong style={{ color: '#b91c1c', fontSize: '16px' }}>R$ {totalAdiantado.toFixed(2)}</strong>
                      </div>
                    </div>
                  ) : <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', fontStyle: 'italic' }}>Nenhum adiantamento registado neste mês.</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {modalTransporte.visivel && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px', backdropFilter: 'blur(3px)' }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '24px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', animation: 'fadeIn 0.3s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
               <div style={{ backgroundColor: '#e0f2fe', padding: '10px', borderRadius: '50%' }}><Route size={24} color="#0284c7" /></div>
               <div>
                  <h3 style={{ margin: '0 0 2px 0', fontSize: '18px', color: '#0f172a' }}>Configurar Transporte Padrão</h3>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>A configuração abaixo aplica-se a todos os meses para: {modalTransporte.nome}</p>
               </div>
            </div>

            <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '15px', marginBottom: '20px' }}>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {modalTransporte.rotas.map(rota => (
                    <div key={rota.id} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                       <input type="text" placeholder="Nome (Ex: Ônibus)" value={rota.nomeConducao} onChange={e => atualizarLinhaRota(rota.id, 'nomeConducao', e.target.value)} style={{ flex: 2, padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                       <input type="number" placeholder="Valor (R$)" value={rota.valor} onChange={e => atualizarLinhaRota(rota.id, 'valor', e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                       <select value={rota.qtdDiaria} onChange={e => atualizarLinhaRota(rota.id, 'qtdDiaria', parseInt(e.target.value))} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                          <option value={1}>1x ao dia</option>
                          <option value={2}>2x ao dia</option>
                          <option value={3}>3x ao dia</option>
                          <option value={4}>4x ao dia</option>
                       </select>
                       <button onClick={() => removerLinhaRota(rota.id)} style={{ backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer' }}><Trash2 size={18} /></button>
                    </div>
                  ))}
               </div>
               <Button onClick={adicionarLinhaRota} style={{ marginTop: '15px', backgroundColor: 'white', color: '#3b82f6', border: '1px dashed #3b82f6', width: '100%', display: 'flex', justifyContent: 'center', gap: '8px' }}><PlusCircle size={16} /> Adicionar Nova Condução</Button>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <Button onClick={() => setModalTransporte({ visivel: false, funcId: '', nome: '', rotas: [] })} style={{ flex: 1, backgroundColor: '#f1f5f9', color: '#475569' }}>Cancelar</Button>
              <Button onClick={salvarConfiguracaoRotas} style={{ flex: 1, backgroundColor: '#0ea5e9' }}>Salvar Configuração <ArrowRight size={16}/></Button>
            </div>
          </div>
        </div>
      )}

      {modalAdiantamento.visivel && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(3px)' }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '16px', width: '100%', maxWidth: '400px', animation: 'fadeIn 0.3s' }}>
            <h3 style={{ margin: '0 0 5px 0', fontSize: '18px' }}>{modalAdiantamento.idVale ? 'Editar Vale/Adiantamento' : 'Lançar Novo Vale'}</h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748b' }}>Colaborador: {modalAdiantamento.nome}</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px' }}>
              <Input label="Data do Vale" type="date" value={modalAdiantamento.dataIso} onChange={e => setModalAdiantamento(prev => ({ ...prev, dataIso: e.target.value }))} />
              <Input label="Valor (R$)" type="number" placeholder="Ex: 50.00" value={modalAdiantamento.valor} onChange={e => setModalAdiantamento(prev => ({ ...prev, valor: e.target.value }))} />
              <Input label="Motivo / Descrição" type="text" placeholder="Ex: Vale farmácia, Almoço..." value={modalAdiantamento.motivo} onChange={e => setModalAdiantamento(prev => ({ ...prev, motivo: e.target.value }))} />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <Button onClick={() => setModalAdiantamento({ visivel: false, funcId: '', nome: '', idVale: '', valor: '', motivo: '', dataIso: '' })} style={{ flex: 1, backgroundColor: '#f1f5f9', color: '#475569' }}>Cancelar</Button>
              <Button onClick={salvarAdiantamento} style={{ flex: 1, backgroundColor: '#3b82f6' }}>{modalAdiantamento.idVale ? 'Atualizar Vale' : 'Confirmar'}</Button>
            </div>
          </div>
        </div>
      )}

      {modalAssinatura.visivel && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(3px)' }}>
          <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '16px', width: '100%', maxWidth: '500px', animation: 'fadeIn 0.3s' }}>
            <h3 style={{ margin: '0 0 5px 0', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}><PenTool size={20} color="#0f172a" /> Assinatura do Colaborador</h3>
            <p style={{ margin: '0 0 15px 0', fontSize: '13px', color: '#64748b' }}>Assine no quadro abaixo para confirmar o recebimento do adiantamento.</p>
            
            <div style={{ border: '2px dashed #cbd5e1', borderRadius: '12px', backgroundColor: '#f8fafc', overflow: 'hidden', touchAction: 'none' }}>
              <canvas ref={canvasRef} width={450} height={200} style={{ width: '100%', cursor: 'crosshair' }} onPointerDown={iniciarDesenho} onPointerMove={desenhar} onPointerUp={pararDesenho} onPointerOut={pararDesenho} />
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px', marginBottom: '20px' }}>
              <button onClick={limparAssinatura} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>Limpar Assinatura</button>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <Button onClick={() => setModalAssinatura({ visivel: false, funcId: '', idVale: '' })} style={{ flex: 1, backgroundColor: '#f1f5f9', color: '#475569' }}>Cancelar</Button>
              <Button onClick={salvarAssinatura} style={{ flex: 1, backgroundColor: '#16a34a' }}>Salvar Assinatura</Button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}