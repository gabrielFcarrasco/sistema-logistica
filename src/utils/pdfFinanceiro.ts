// src/utils/pdfFinanceiro.ts
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import logoCarvalho from '../assets/logopdf.png';

export const formatarCPF = (cpf: string) => {
  if (!cpf) return 'Não informado';
  const apenasNumeros = cpf.replace(/\D/g, '');
  if (apenasNumeros.length !== 11) return cpf; 
  return apenasNumeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
};

export const calcularDiasUteis = (mesAnoFiltro: string) => {
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

export const exportarPdfValesEscritorio = (funcionarios: any[], dadosFinanceiros: Record<string, any>, mesFiltro: string) => {
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

export const exportarPdfTermoIndividual = (func: any, dadosFinanceiros: Record<string, any>, mesFiltro: string) => {
  const docPdf = new jsPDF('p', 'mm', 'a4');
  const vermelhoCorporativo = [185, 28, 28];
  const cpfFormatado = formatarCPF(func.cpf);

  try { docPdf.addImage(logoCarvalho, 'PNG', 14, 10, 28, 7); } catch(e){}

  docPdf.setFont("helvetica", "bold"); docPdf.setFontSize(12); docPdf.setTextColor(vermelhoCorporativo[0], vermelhoCorporativo[1], vermelhoCorporativo[2]);
  docPdf.text("TERMO DE CONSENTIMENTO E ADIANTAMENTO SALARIAL", 105, 13, { align: 'center' });
  docPdf.setFontSize(7.5); docPdf.setTextColor(90, 90, 90);
  docPdf.text("CARVALHO FUNILARIA E PINTURAS LTDA | CNPJ: 31.362.302/0001-39", 105, 17, { align: 'center' });
  docPdf.setLineWidth(0.3); docPdf.setDrawColor(vermelhoCorporativo[0], vermelhoCorporativo[1], vermelhoCorporativo[2]);
  docPdf.line(14, 20, 196, 20);

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

export const exportarPdfPixTransporte = (funcionarios: any[], dadosFinanceiros: Record<string, any>, diasUteis: number, mesFiltro: string) => {
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