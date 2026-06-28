// src/utils/pdfTruques.ts
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoCarvalho from '../assets/logopdf.png'; 

const PERGUNTAS_CHECKLIST = [
  "1. Mapa de risco e EPI's implantado e disponível no local?",
  "2. Área devidamente isolada e sinalizada?",
  "3. Sistema de ventilação/exaustão funcionando corretamente?",
  "4. Integridade dos equipamentos de jateamento verificada?",
  "5. Integridade das mangueiras e conexões pneumáticas conferida?",
  "6. EPI específico para jateamento disponível e em uso?",
  "7. Funcionamento do compressor pneumático conferido?",
  "8. Vigia posicionado, treinado e apto para operação?",
  "9. Sistema de parada de emergência do compressor testado?",
  "10. Comunicação efetiva entre operador e vigia testada?",
  "11. Coleta e destinação correta dos resíduos gerados definida?",
  "12. Pós-atividade: limpeza da área, equipamentos e EPIs realizada?"
];

const OBRIGACOES_VIGIA = [
  "1. Permanecer do lado externo da cabine durante a operação, garantindo visibilidade clara.",
  "2. Acionar o compressor somente quando o executante estiver posicionado e sinalizar.",
  "3. Monitorar assertivamente para qualquer sinal de emergência (ruídos, vazamentos).",
  "4. Atuar precisamente no desligamento do sistema em caso de anormalidade."
];

const OBRIGACOES_EXEC = [
  "1. Seguir os procedimentos de segurança do checklist.",
  "2. Realizar inspeção preliminar dos equipamentos, EPI's e EPC's.",
  "3. Reportar imediatamente qualquer anormalidade.",
  "4. Utilizar todos os EPI's e EPC's designados.",
  "5. Após execução, realizar higienização e organização do ambiente.",
  "6. Destinar adequadamente os resíduos."
];

const renderizarPaginaChecklistHorizontal = (docPdf: jsPDF, truque: any) => {
  const chk = truque.checklistJateamento;
  if (!chk) return;

  const dataPreenchimento = chk.dataPreenchimento?.toDate().toLocaleDateString('pt-BR') || "Data Indisponível";

  try { docPdf.addImage(logoCarvalho, 'PNG', 10, 10, 35, 10); } catch(e){} 
  
  docPdf.setFont("helvetica", "bold"); docPdf.setFontSize(13); docPdf.setTextColor(30, 41, 59);
  docPdf.text("CHECKLIST DE SEGURANÇA JATEAMENTO", 148.5, 14, { align: 'center' });
  docPdf.setFontSize(10);
  docPdf.text("DA ARANHA DO TRUQUE TRENS 59500", 148.5, 20, { align: 'center' });
  
  docPdf.setFontSize(9); docPdf.setFont("helvetica", "bold");
  docPdf.text(`Data: ${dataPreenchimento} | Plaqueta: ${truque.identificacao}`, 287, 20, { align: 'right' });
  
  docPdf.setLineWidth(0.4); docPdf.setDrawColor(30, 41, 59);
  docPdf.line(10, 24, 287, 24); 
  
  let yEsq = 30; 
  docPdf.setFont("helvetica", "bold"); docPdf.setFontSize(9);
  docPdf.text("OBJETIVO", 10, yEsq); yEsq += 4;
  docPdf.setFont("helvetica", "normal"); docPdf.setFontSize(8);
  const objText = "Estabelecer os procedimentos operacionais seguros para a execução da atividade de jateamento da aranha do truque de trem utilizando poeira metálica para remoção de tinta, visando garantir a integridade física dos trabalhadores, a preservação do meio ambiente e a integridade dos equipamentos.";
  const splitObj = docPdf.splitTextToSize(objText, 135);
  docPdf.text(splitObj, 10, yEsq);
  yEsq += (splitObj.length * 3.5) + 4;

  const renderTable = typeof autoTable === 'function' ? autoTable : (autoTable as any).default;
  const bodyRespostas = PERGUNTAS_CHECKLIST.map((p, i) => {
    const resp = chk.respostas[i];
    return [p, resp === true ? "[ X ]" : "[   ]", resp === false ? "[ X ]" : "[   ]"];
  });

  renderTable(docPdf, {
    startY: yEsq, margin: { left: 10 }, tableWidth: 135,
    head: [["ITENS DE VERIFICAÇÃO", "SIM", "NÃO"]], body: bodyRespostas, theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.5 },
    columnStyles: { 0: { cellWidth: 105 }, 1: { cellWidth: 15, halign: 'center' }, 2: { cellWidth: 15, halign: 'center' } },
    headStyles: { fillColor: [30, 41, 59] }
  });

  docPdf.setDrawColor(200, 200, 200); docPdf.setLineWidth(0.2);
  docPdf.line(150, 28, 150, 200);

  let yDir = 30; 
  docPdf.setTextColor(30, 41, 59); docPdf.setFont("helvetica", "bold"); docPdf.setFontSize(9);
  docPdf.text("OBRIGAÇÕES DO VIGIA", 155, yDir);
  docPdf.text("OBRIGAÇÕES DO EXECUTANTE", 220, yDir);
  yDir += 5;
  
  docPdf.setFont("helvetica", "normal"); docPdf.setFontSize(8);
  let yVigia = yDir;
  OBRIGACOES_VIGIA.forEach(txt => {
    const linhas = docPdf.splitTextToSize(txt, 60);
    docPdf.text(linhas, 155, yVigia); yVigia += linhas.length * 3.5;
  });

  let yExec = yDir;
  OBRIGACOES_EXEC.forEach(txt => {
    const linhas = docPdf.splitTextToSize(txt, 65);
    docPdf.text(linhas, 220, yExec); yExec += linhas.length * 3.5;
  });

  yDir = Math.max(yVigia, yExec) + 6;

  docPdf.setFont("helvetica", "bold"); docPdf.setFontSize(9);
  docPdf.text("MEDIDAS PREVENTIVAS GERAIS", 155, yDir); yDir += 5;
  docPdf.setFont("helvetica", "normal"); docPdf.setFontSize(8);
  const medidasText = "1. Exaustão | 2. Distanciamento seguro | 3. Fechamento de cabine | 4. Monitoramento contínuo | 5. Exames específicos para poeiras | 6. EPIs | 7. Inspeções diárias | 8. Evitar improvisos | 9. Uso de válvulas | 10. Sinalização restrita | 11. Descansos | 12. Armazenamento seguro | 13. Verificação de abrasivo.";
  const splitMedidas = docPdf.splitTextToSize(medidasText, 132);
  docPdf.text(splitMedidas, 155, yDir); yDir += (splitMedidas.length * 3.5) + 6;

  docPdf.setFont("helvetica", "bold"); docPdf.setFontSize(9);
  docPdf.text("EPI's E EPC's OBRIGATÓRIOS", 155, yDir); yDir += 5;
  docPdf.setFont("helvetica", "normal"); docPdf.setFontSize(8);
  const episText = "Capacete de jatista (ar mandado) | Jaqueta couro/raspa | Calça couro/raspa | Luvas cano longo | Proteção pés | Sistema de Exaustão | Compressor e Filtro | Manômetros independentes.";
  const splitEpis = docPdf.splitTextToSize(episText, 132);
  docPdf.text(splitEpis, 155, yDir); yDir += (splitEpis.length * 3.5) + 16;

  docPdf.setFont("helvetica", "bold"); docPdf.setFontSize(10);
  docPdf.text("ASSINATURA DOS RESPONSÁVEIS PELA EXECUÇÃO", 221, yDir, { align: 'center' }); yDir += 20;

  if (chk.assinaturaExecutante) { try { docPdf.addImage(chk.assinaturaExecutante, 'JPEG', 160, yDir - 15, 30, 12); } catch(e){} }
  docPdf.setDrawColor(0,0,0); docPdf.setLineWidth(0.5); docPdf.line(155, yDir, 215, yDir);
  docPdf.setFont("helvetica", "bold"); docPdf.setFontSize(8);
  docPdf.text("ASSINATURA DO EXECUTANTE", 185, yDir + 4, { align: 'center' });
  docPdf.setFont("helvetica", "normal"); docPdf.text(`Nome: ${chk.executanteNome}`, 185, yDir + 8, { align: 'center' });

  if (chk.assinaturaVigia) { try { docPdf.addImage(chk.assinaturaVigia, 'JPEG', 235, yDir - 15, 30, 12); } catch(e){} }
  docPdf.line(225, yDir, 285, yDir);
  docPdf.setFont("helvetica", "bold"); docPdf.text("ASSINATURA DO VIGIA", 255, yDir + 4, { align: 'center' });
  docPdf.setFont("helvetica", "normal"); docPdf.text(`Nome: ${chk.vigiaNome}`, 255, yDir + 8, { align: 'center' });
};

export const baixarChecklistIndividual = (truque: any) => {
  const docPdf = new jsPDF('l', 'mm', 'a4'); 
  renderizarPaginaChecklistHorizontal(docPdf, truque);
  docPdf.save(`Checklist_Jateamento_${truque.identificacao}.pdf`);
};

export const baixarChecklistsDaSemana = (truques: any[], avisar: (msg: string, tipo: 'erro') => void) => {
  const seteDiasAtras = new Date();
  seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);

  const filtrados = truques.filter(t => {
    if (!t.checklistJateamento || !t.checklistJateamento.dataPreenchimento) return false;
    return t.checklistJateamento.dataPreenchimento.toDate() >= seteDiasAtras;
  });

  if (filtrados.length === 0) return avisar("Nenhum checklist preenchido nos últimos 7 dias.", "erro");

  const docPdf = new jsPDF('l', 'mm', 'a4');
  filtrados.forEach((t, index) => {
    if (index > 0) docPdf.addPage();
    renderizarPaginaChecklistHorizontal(docPdf, t);
  });

  const dataHoje = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
  docPdf.save(`Lote_Checklists_Semanal_${dataHoje}.pdf`);
};

export const gerarRelatorioTruques = (truquesAguardandoJateamento: any[], truquesAguardandoPM: any[], truquesAguardandoPintura: any[], truquesConcluidos: any[]) => {
  const docPdf = new jsPDF('p', 'mm', 'a4');
  const dataAtual = new Date().toLocaleDateString('pt-BR');
  try { docPdf.addImage(logoCarvalho, 'PNG', 15, 10, 35, 10); } catch(e){}
  docPdf.setFont("helvetica", "bold"); docPdf.setFontSize(16); docPdf.setTextColor(30, 41, 59);
  docPdf.text("RELATÓRIO DE PRODUÇÃO - TRUQUES", 105, 18, { align: 'center' });
  docPdf.setFontSize(10); docPdf.setTextColor(100, 100, 100); docPdf.text(`Emissão: ${dataAtual}`, 195, 20, { align: 'right' });
  docPdf.setLineWidth(0.5); docPdf.line(15, 26, 195, 26);
  docPdf.setFontSize(11); docPdf.setTextColor(0, 0, 0); docPdf.text("RESUMO DO PÁTIO / GALPÃO", 15, 35);
  docPdf.setFontSize(10); docPdf.setFont("helvetica", "normal");
  
  docPdf.text(`1. Lavagem e Jateamento: ${truquesAguardandoJateamento.length} peça(s)`, 15, 42);
  docPdf.text(`2. Partículas Magnéticas: ${truquesAguardandoPM.length} peça(s)`, 15, 48);
  docPdf.text(`3. Setor de Pintura: ${truquesAguardandoPintura.length} peça(s)`, 15, 54);
  docPdf.text(`4. Pintura Concluída (Galpão): ${truquesConcluidos.length} peça(s)`, 15, 60);

  const renderTable = typeof autoTable === 'function' ? autoTable : (autoTable as any).default;
  renderTable(docPdf, {
    startY: 68, head: [["PLAQUETA", "STATUS ATUAL", "COLABORADOR (JAT)"]],
    body: [
      ...truquesAguardandoJateamento.map(t => [t.identificacao, 'Lavagem / Jateamento', t.colaboradorJateouNome || 'N/A']),
      ...truquesAguardandoPM.map(t => [t.identificacao, 'Partículas Magnéticas', t.colaboradorJateouNome || 'N/A']),
      ...truquesAguardandoPintura.map(t => [t.identificacao, 'Pintura', t.colaboradorJateouNome || 'N/A']),
      ...truquesConcluidos.map(t => [t.identificacao, 'Concluído (Galpão)', t.colaboradorJateouNome || 'N/A'])
    ],
    theme: 'grid', styles: { fontSize: 9, cellPadding: 4 }
  });
  docPdf.save(`Relatorio_Truques_${dataAtual.replace(/\//g, '-')}.pdf`);
};