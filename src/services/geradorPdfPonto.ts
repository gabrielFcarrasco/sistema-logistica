// src/services/geradorPdfPonto.ts
import { collection, query, where, getDocs } from 'firebase/firestore';
import { dbFolha } from './firebaseFolha';
import { jsPDF } from "jspdf";
import "jspdf-autotable"; 
import logoCarvalho from '../assets/logopdf.png'; 

// Funções Matemáticas Auxiliares
const converterParaMinutos = (horaStr?: string) => {
  if (!horaStr || horaStr === '--:--') return 0;
  const [h, m] = horaStr.substring(0, 5).split(':').map(Number);
  return (h * 60) + m;
};

// Formata os minutos em HH:MM sem sinais fixos (usado para controlar manualmente o + e o -)
const formatarApenasHoras = (totalMinutos: number) => {
  if (totalMinutos === 0) return '00:00';
  const horas = Math.floor(Math.abs(totalMinutos) / 60);
  const mins = Math.abs(totalMinutos) % 60;
  return `${String(horas).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

const formatarHoraLimpa = (hora?: string) => {
  if (!hora || hora === '--:--') return '--:--';
  return hora.substring(0, 5);
};

export const gerarFolhaDePontoPDF = async (mesExport: string, funcionarios: any[], jornadaPadrao: any) => {
  if (funcionarios.length === 0) throw new Error("Nenhum funcionário encontrado.");

  const anoNum = parseInt(mesExport.split('-')[0]);
  const mesNum = parseInt(mesExport.split('-')[1]);
  const diasNoMes = new Date(anoNum, mesNum, 0).getDate();
  
  const inicioMes = `${mesExport}-01`;
  const fimMes = `${mesExport}-${String(diasNoMes).padStart(2, '0')}`;
  
  const q = query(
    collection(dbFolha, 'registros_ponto'), 
    where('data', '>=', inicioMes),
    where('data', '<=', fimMes)
  );
  
  const snap = await getDocs(q);
  const todosRegistrosBanco = snap.docs.map(d => d.data());

  const docPdf = new jsPDF('p', 'mm', 'a4');
  const azul = [30, 41, 59];
  const hojeString = new Date().toISOString().split('T')[0];
  const FERIADOS_SP = ['01-01', '01-25', '04-21', '05-01', '07-09', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25'];

  for (let i = 0; i < funcionarios.length; i++) {
    const funcionarioAtual = funcionarios[i];
    const registrosDoFuncionario = todosRegistrosBanco.filter(r => r.funcionarioId === funcionarioAtual.id);

    let totalExtrasMinutos = 0;
    let totalAtrasosMinutos = 0;
    let totalFaltas = 0;
    let totalDiasTrabalhados = 0;
    const tableData: any[] = [];
    const assinaturasMap: Record<string, string> = {}; 

    for (let dia = 1; dia <= diasNoMes; dia++) {
      const dataAtualStr = `${anoNum}-${String(mesNum).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
      const dataObj = new Date(anoNum, mesNum - 1, dia);
      const diaSemana = dataObj.getDay(); 
      
      const dataPt = dataObj.toLocaleDateString('pt-BR');
      const dataIsoFormatada = dataObj.toLocaleDateString('pt-BR', { weekday: 'short' }).toUpperCase();
      const isFimDeSemana = diaSemana === 0 || diaSemana === 6;
      const isFeriado = FERIADOS_SP.includes(`${String(mesNum).padStart(2, '0')}-${String(dia).padStart(2, '0')}`);
      const isAntesDaContratacao = funcionarioAtual.dataContratacao && dataAtualStr < funcionarioAtual.dataContratacao;

      const registroDia = registrosDoFuncionario.find(r => r.data === dataAtualStr);

      let entrada = '--:--';
      let saidaAlmoco = '--:--';
      let retorno = '--:--';
      let saidaFim = '--:--';
      let status = '';
      let saldoExtraStr = '--';
      let saldoAtrasoStr = '--';

      if (registroDia?.assinatura && registroDia.assinatura.startsWith('data:image')) {
        assinaturasMap[dataPt] = registroDia.assinatura;
      }

      if (isAntesDaContratacao) {
        status = 'Pré-Contrato';
      } else if (registroDia) {
        entrada = formatarHoraLimpa(registroDia.entrada1);
        saidaAlmoco = formatarHoraLimpa(registroDia.saida1);
        retorno = formatarHoraLimpa(registroDia.entrada2);
        saidaFim = formatarHoraLimpa(registroDia.saida2);

        const minutosEsperados = converterParaMinutos(registroDia.cargaHorariaPrevista || jornadaPadrao.cargaHoraria);

        if (registroDia.statusDia === 'Falta') {
          status = 'Falta';
          totalFaltas++;
        } else if (['Atestado Médico', 'Falta Justificada', 'Férias', 'Licença', 'Comprovante de Horas', 'Acordo (Pago/Abonado)'].includes(registroDia.statusDia)) {
          status = registroDia.statusDia;
        } else {
          const e1 = converterParaMinutos(registroDia.entrada1);
          const s1 = converterParaMinutos(registroDia.saida1);
          const e2 = converterParaMinutos(registroDia.entrada2);
          const s2 = converterParaMinutos(registroDia.saida2);

          const batidasValidas = [e1, s1, e2, s2].filter(t => t > 0);
          const diaPassado = dataAtualStr < hojeString;
          const temSaidaFinal = registroDia.saida2 && registroDia.saida2 !== '--:--';
          
          if (!diaPassado && !temSaidaFinal) {
             status = 'Em Andamento';
          } else if (diaPassado && batidasValidas.length % 2 !== 0) {
             status = 'Ponto Incompleto';
          } else if (batidasValidas.length > 1) {
            let minsTrabalhados = 0;
            for (let b = 0; b < batidasValidas.length - 1; b += 2) {
                minsTrabalhados += (batidasValidas[b + 1] - batidasValidas[b]);
            }
            
            const diferenca = minsTrabalhados - minutosEsperados;
            if (diferenca > 10) {
              totalExtrasMinutos += diferenca;
              saldoExtraStr = `+ ${formatarApenasHoras(diferenca)}`;
            } else if (diferenca < -10) {
              totalAtrasosMinutos += Math.abs(diferenca);
              saldoAtrasoStr = `- ${formatarApenasHoras(Math.abs(diferenca))}`;
            } else {
              status = 'Jornada OK';
            }
            totalDiasTrabalhados++;
          }
        }
      } else {
        if (isFeriado) status = 'Feriado';
        else if (diaSemana === 0) status = 'DSR';
        else if (isFimDeSemana) status = 'Folga/FDS';
        else if (dataAtualStr < hojeString) {
          status = 'Falta';
          totalFaltas++;
        } else {
          status = '-';
        }
      }

      tableData.push([ dataPt, dataIsoFormatada, entrada, saidaAlmoco, retorno, saidaFim, saldoExtraStr, saldoAtrasoStr, status, '' ]);
    }

    try { docPdf.addImage(logoCarvalho, 'PNG', 14, 10, 30, 10); } catch (e) {}

    docPdf.setFont("helvetica", "bold"); docPdf.setFontSize(14); docPdf.setTextColor(azul[0], azul[1], azul[2]);
    docPdf.text("FOLHA DE PONTO INDIVIDUAL", 105, 15, { align: 'center' });
    docPdf.setFontSize(9); docPdf.setTextColor(100);
    docPdf.text(`Período: 01/${String(mesNum).padStart(2, '0')}/${anoNum} a ${diasNoMes}/${String(mesNum).padStart(2, '0')}/${anoNum}`, 105, 22, { align: 'center' });

    docPdf.setDrawColor(200); docPdf.setFillColor(248, 250, 252);
    docPdf.rect(14, 26, 182, 18, "FD");
    docPdf.setFontSize(9); docPdf.setTextColor(0);
    docPdf.setFont("helvetica", "bold"); docPdf.text("Colaborador:", 18, 32); docPdf.setFont("helvetica", "normal"); docPdf.text(funcionarioAtual.nome.toUpperCase(), 42, 32);
    docPdf.setFont("helvetica", "bold"); docPdf.text("Matrícula:", 18, 38); docPdf.setFont("helvetica", "normal"); docPdf.text(String(funcionarioAtual.matricula || ''), 38, 38);
    
    const dataAdmissao = funcionarioAtual.dataContratacao ? funcionarioAtual.dataContratacao.split('-').reverse().join('/') : 'Não informada';
    docPdf.setFont("helvetica", "bold"); docPdf.text("Admissão:", 120, 32); docPdf.setFont("helvetica", "normal"); docPdf.text(dataAdmissao, 138, 32);
    docPdf.setFont("helvetica", "bold"); docPdf.text("Empresa:", 120, 38); docPdf.setFont("helvetica", "normal"); docPdf.text("CARVALHO PINTURA E MONTAGEM", 138, 38);

    (docPdf as any).autoTable({
      startY: 46,
      head: [["Data", "Dia", "Entrada", "Saída Alm.", "Retorno", "Saída Final", "Extra (+)", "Atraso (-)", "Status / Ocorrência", "Assinatura"]],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 1.5, halign: 'center', textColor: 40 }, 
      headStyles: { fillColor: azul, textColor: 255, fontSize: 7 },
      columnStyles: { 
        0: { cellWidth: 18, fontStyle: 'bold' }, 
        1: { cellWidth: 12 },
        6: { textColor: [22, 101, 52], fontStyle: 'bold' },
        7: { textColor: [153, 27, 27], fontStyle: 'bold' },
        8: { halign: 'left', cellWidth: 32 }, 
        9: { cellWidth: 22 } 
      },
      didParseCell: function(data: any) {
        if (data.section === 'body') {
          const statusCell = data.row.raw[8] as string;
          if (statusCell === 'Falta') {
            data.cell.styles.fillColor = [254, 226, 226];
            data.cell.styles.textColor = [153, 27, 27];
          } else if (['DSR', 'Folga/FDS', 'Feriado'].includes(statusCell)) {
            data.cell.styles.fillColor = [241, 245, 249];
            data.cell.styles.textColor = [71, 85, 105];
          } else if (['Atestado Médico', 'Férias', 'Licença'].includes(statusCell)) {
            data.cell.styles.fillColor = [254, 252, 232];
            data.cell.styles.textColor = [133, 77, 14];
          } else if (statusCell === 'Pré-Contrato') {
            data.cell.styles.fillColor = [226, 232, 240];
            data.cell.styles.textColor = [148, 163, 184];
          }
        }
      },
      didDrawCell: function(data: any) {
        if (data.section === 'body' && data.column.index === 9) {
           const dataDaLinha = data.row.raw[0]; 
           const base64DaAssinatura = assinaturasMap[dataDaLinha];
           if (base64DaAssinatura) {
              try {
                docPdf.addImage(base64DaAssinatura, 'PNG', data.cell.x + 1, data.cell.y + 0.5, 20, 4);
              } catch (e) {}
           }
        }
      }
    });

    const finalY = (docPdf as any).lastAutoTable.finalY + 6;
    
    // Caixa de Resumo Mensal Otimizada
    docPdf.setFillColor(241, 245, 249);
    docPdf.rect(14, finalY, 182, 22, "F");
    
    // Esquerda: Informações gerais de dias e faltas
    docPdf.setFontSize(9); docPdf.setFont("helvetica", "bold");
    docPdf.text("RESUMO MENSAL:", 18, finalY + 7);
    
    docPdf.setFontSize(8); docPdf.setFont("helvetica", "normal");
    docPdf.text(`Dias Trabalhados: ${totalDiasTrabalhados}`, 18, finalY + 14);
    docPdf.text(`Faltas Acumuladas: ${totalFaltas}`, 18, finalY + 18);

    // Direita: Atrasos em cima e Horas Extras em verde logo abaixo (Corrigido para evitar sinal duplo)
    docPdf.setFontSize(8); docPdf.setFont("helvetica", "bold");
    docPdf.text("ATRASOS / DÉBITO:", 115, finalY + 8);
    
    docPdf.setTextColor(185, 28, 28); // Vermelho
    docPdf.setFontSize(10);
    docPdf.text(`- ${formatarApenasHoras(totalAtrasosMinutos)}`, 165, finalY + 8);
    docPdf.setTextColor(0);

    docPdf.setFontSize(8); docPdf.setFont("helvetica", "bold");
    docPdf.text("HORAS EXTRAS:", 115, finalY + 16);
    
    docPdf.setTextColor(22, 163, 74); // Verde destacado
    docPdf.setFontSize(10);
    docPdf.text(`+ ${formatarApenasHoras(totalExtrasMinutos)}`, 165, finalY + 16);
    docPdf.setTextColor(0);

    if (i < funcionarios.length - 1) {
      docPdf.addPage();
    }
  }

  docPdf.save(`Folha_de_Ponto_Geral_${mesExport}.pdf`);
};

export const gerarRelatorioPontoMensal = async (
  funcionarios: any[],
  _registrosMes: any[],
  mesAnoFiltro: string,
  jornadaPadrao: any
) => {
  return gerarFolhaDePontoPDF(mesAnoFiltro, funcionarios, jornadaPadrao);
};