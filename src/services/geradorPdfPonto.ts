// src/services/geradorPdfPonto.ts
import { collection, query, where, getDocs } from 'firebase/firestore';
import { dbFolha } from './firebaseFolha';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import logoCarvalho from '../assets/logopdf.png'; 

const converterParaMinutos = (horaStr?: string) => {
  if (!horaStr || horaStr === '--:--') return 0;
  const [h, m] = horaStr.substring(0, 5).split(':').map(Number);
  return (h * 60) + m;
};

const formatarMinutosParaHoras = (totalMinutos: number) => {
  if (totalMinutos === 0) return '00:00';
  const horas = Math.floor(Math.abs(totalMinutos) / 60);
  const mins = Math.abs(totalMinutos) % 60;
  const sinal = totalMinutos > 0 ? '+' : '-';
  return `${sinal}${String(horas).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
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

  for (let i = 0; i < funcionarios.length; i++) {
    const funcionarioAtual = funcionarios[i];
    const registrosDoFuncionario = todosRegistrosBanco.filter(r => r.funcionarioId === funcionarioAtual.id);

    let saldoTotalMesMinutos = 0;
    let totalFaltas = 0;
    let totalDiasTrabalhados = 0;
    const tableData: any[] = [];
    
    // ✍️ DICIONÁRIO DE ASSINATURAS: Vamos guardar os desenhos em base64 atrelados a cada data
    const assinaturasMap: Record<string, string> = {}; 

    for (let dia = 1; dia <= diasNoMes; dia++) {
      const dataAtualStr = `${anoNum}-${String(mesNum).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
      const dataObj = new Date(anoNum, mesNum - 1, dia);
      const diaSemana = dataObj.getDay(); 
      
      const dataPt = dataObj.toLocaleDateString('pt-BR');
      const registroDia = registrosDoFuncionario.find(r => r.data === dataAtualStr);

      let entrada = '--:--';
      let saidaAlmoco = '--:--';
      let retorno = '--:--';
      let saidaFim = '--:--';
      let status = '';
      let textAssinatura = '-'; // Esse texto vai para o PDF se não tiver assinatura

      if (registroDia) {
        entrada = formatarHoraLimpa(registroDia.entrada1);
        saidaAlmoco = formatarHoraLimpa(registroDia.saida1);
        retorno = formatarHoraLimpa(registroDia.entrada2);
        saidaFim = formatarHoraLimpa(registroDia.saida2);

        // Se existir a imagem da assinatura no banco, salvamos no mapa e deixamos um espaço vazio na tabela para a imagem entrar depois
        if (registroDia.assinatura && registroDia.assinatura.startsWith('data:image')) {
            assinaturasMap[dataPt] = registroDia.assinatura;
            textAssinatura = ' '; 
        } else if (registroDia.entrada1) {
            textAssinatura = 'Pendente';
        }

        const minutosEsperados = converterParaMinutos(registroDia.cargaHorariaPrevista || jornadaPadrao.cargaHoraria);

        // Regras de Faltas Inteligentes
        if (registroDia.statusDia === 'Falta') {
          status = 'FALTA';
          totalFaltas++;
          saldoTotalMesMinutos -= minutosEsperados;
        } else if (registroDia.statusDia === 'Falta Justificada' || registroDia.statusDia === 'Atestado Médico') {
          status = registroDia.statusDia.toUpperCase();
        } else {
          
          const e1 = converterParaMinutos(registroDia.entrada1);
          const s1 = converterParaMinutos(registroDia.saida1);
          const e2 = converterParaMinutos(registroDia.entrada2);
          const s2 = converterParaMinutos(registroDia.saida2);

          const batidasValidas = [e1, s1, e2, s2].filter(t => t > 0);
          const diaPassado = registroDia.data < hojeString;
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
            
            if (Math.abs(diferenca) <= 10) {
              status = 'Jornada OK';
            } else {
              status = `BH: ${formatarMinutosParaHoras(diferenca)}`;
              saldoTotalMesMinutos += diferenca;
            }
            totalDiasTrabalhados++;
          }
        }
      } else {
        if (diaSemana === 0) {
          status = 'DSR (Domingo)';
        } else if (diaSemana === 6) {
          status = 'SÁBADO';
        } else {
          const hojeObj = new Date();
          hojeObj.setHours(0,0,0,0);
          status = dataObj < hojeObj ? 'Sem Registro' : '-';
        }
      }

      // Adiciona a linha na tabela (Lembre-se: o índice do dataPt é 0 e do textAssinatura é 6)
      tableData.push([ dataPt, entrada, saidaAlmoco, retorno, saidaFim, status, textAssinatura ]);
    }

    try { docPdf.addImage(logoCarvalho, 'PNG', 14, 10, 35, 12); } catch (e) {}

    docPdf.setFont("helvetica", "bold"); docPdf.setFontSize(14); docPdf.setTextColor(azul[0], azul[1], azul[2]);
    docPdf.text("FOLHA DE PONTO MENSAL", 105, 16, { align: 'center' });
    docPdf.setFontSize(10); docPdf.setTextColor(100);
    docPdf.text(`Período: 01/${String(mesNum).padStart(2, '0')}/${anoNum} a ${diasNoMes}/${String(mesNum).padStart(2, '0')}/${anoNum}`, 105, 22, { align: 'center' });

    docPdf.setDrawColor(200); docPdf.setFillColor(248, 250, 252);
    docPdf.rect(14, 28, 182, 18, "FD");
    docPdf.setFontSize(9); docPdf.setTextColor(0);
    docPdf.setFont("helvetica", "bold"); docPdf.text("Colaborador:", 18, 34); docPdf.setFont("helvetica", "normal"); docPdf.text(funcionarioAtual.nome.toUpperCase(), 42, 34);
    docPdf.setFont("helvetica", "bold"); docPdf.text("Matrícula:", 18, 40); docPdf.setFont("helvetica", "normal"); docPdf.text(funcionarioAtual.matricula, 38, 40);
    docPdf.setFont("helvetica", "bold"); docPdf.text("Empresa:", 120, 34); docPdf.setFont("helvetica", "normal"); docPdf.text("CARVALHO PINTURA E MONTAGEM", 138, 34);

    // ✍️ RENDERIZAÇÃO DA TABELA COM ASSINATURAS IMAGÉTICAS
    renderTable(docPdf, {
      startY: 48,
      head: [["Data", "Entrada", "Saída Alm.", "Retorno", "Saída Final", "Saldo / Status", "Assinatura"]],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 3, halign: 'center', textColor: 40 }, // Aumentei o cellPadding para 3 para a assinatura caber melhor
      headStyles: { fillColor: azul, textColor: 255, fontSize: 7 },
      columnStyles: { 
        0: { cellWidth: 20, fontStyle: 'bold' }, 
        5: { halign: 'left', cellWidth: 35 }, 
        6: { cellWidth: 25 } // Coluna mais larga para a imagem
      },
      didParseCell: function(data: any) {
        if (data.section === 'body' && (data.row.raw[5] === 'SÁBADO' || data.row.raw[5] === 'DOMINGO')) {
          data.cell.styles.fillColor = [241, 245, 249];
        }
      },
      // Aqui interceptamos o desenho para "colar" a imagem da assinatura
      didDrawCell: function(data: any) {
        if (data.section === 'body' && data.column.index === 6) {
           const dataDaLinha = data.row.raw[0]; // Pega a data exata desta linha (ex: 14/08/2026)
           const base64DaAssinatura = assinaturasMap[dataDaLinha]; // Procura se guardamos uma imagem para esta data
           
           if (base64DaAssinatura) {
              try {
                // Desenha a imagem dentro das coordenadas exatas da célula (x, y, largura, altura)
                docPdf.addImage(base64DaAssinatura, 'PNG', data.cell.x + 2, data.cell.y + 1, 20, 5);
              } catch (e) {
                console.error("Erro ao desenhar assinatura na data: " + dataDaLinha);
              }
           }
        }
      }
    });

    const finalY = (docPdf as any).lastAutoTable.finalY + 8;
    docPdf.setFillColor(241, 245, 249);
    docPdf.rect(14, finalY, 182, 22, "F");
    
    docPdf.setFontSize(9); docPdf.setFont("helvetica", "bold");
    docPdf.text("RESUMO MENSAL:", 18, finalY + 6);
    
    docPdf.setFontSize(8); docPdf.setFont("helvetica", "normal");
    docPdf.text(`Dias Trabalhados: ${totalDiasTrabalhados}`, 18, finalY + 12);
    docPdf.text(`Faltas: ${totalFaltas}`, 18, finalY + 18);

    docPdf.setFontSize(10); docPdf.setFont("helvetica", "bold");
    docPdf.text("SALDO DO BANCO DE HORAS:", 110, finalY + 13);
    
    const corSaldo = saldoTotalMesMinutos >= 0 ? [22, 163, 74] : [220, 38, 38];
    docPdf.setTextColor(corSaldo[0], corSaldo[1], corSaldo[2]);
    docPdf.setFontSize(12);
    docPdf.text(formatarMinutosParaHoras(saldoTotalMesMinutos), 170, finalY + 13);
    docPdf.setTextColor(0);

    const yAssinatura = 280; 
    docPdf.setDrawColor(0); docPdf.setLineWidth(0.3);
    docPdf.line(20, yAssinatura, 90, yAssinatura);
    docPdf.line(110, yAssinatura, 180, yAssinatura);
    
    docPdf.setFont("helvetica", "bold"); docPdf.setFontSize(8);
    docPdf.text("Assinatura do Gestor Responsável", 55, yAssinatura + 4, { align: 'center' });
    docPdf.text(`Assinatura do Colaborador (${funcionarioAtual.nome.split(' ')[0]})`, 145, yAssinatura + 4, { align: 'center' });

    if (i < funcionarios.length - 1) {
      docPdf.addPage();
    }
  }

  docPdf.save(`Folhas_de_Ponto_Geral_${mesExport}.pdf`);
};