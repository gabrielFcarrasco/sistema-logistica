// src/components/prestacao-servicos/KanbanTruques.tsx
import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoCarvalho from '../../assets/logopdf.png'; // Usando a logo padronizada para PDFs

import { TrainFront, ArrowRight, Check, Printer, Paintbrush, Undo2, ClipboardCheck, FileDown, CalendarDays } from 'lucide-react';
import Button from '../ui/Button';
import ModalChecklistJateamento from './ModalChecklistJateamento';

interface Props { setorAtivo: string; funcionarios: any[]; avisar: (msg: string, tipo?: 'sucesso'|'erro') => void; }

// Constantes com os textos extraídos do documento oficial do cliente
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
  "1. Permanecer do lado externo da cabine durante toda a operação, garantindo visibilidade clara.",
  "2. Acionar o compressor pneumático somente quando o colaborador executante estiver posicionado e sinalizar.",
  "3. Monitorar assertivamente para todo e qualquer sinal de emergência, incluindo ruídos estranhos, vazamentos, movimento anormal.",
  "4. Atuar precisamente no desligamento do sistema em caso de anormalidade."
];

const OBRIGACOES_EXEC = [
  "1. Seguir procedimentos de segurança do checklist.",
  "2. Realizar inspeção preliminar dos equipamentos, EPI's e EPC's.",
  "3. Reportar imediatamente qualquer anormalidade (ruídos, vazamentos, tombamento).",
  "4. Utilizar todos os EPI's e EPC's designados.",
  "5. Após a execução, realizar higienização e organização do ambiente.",
  "6. Destinar adequadamente os resíduos."
];

export default function KanbanTruques({ setorAtivo, funcionarios, avisar }: Props) {
  const [truques, setTruques] = useState<any[]>([]);
  const [truqueId, setTruqueId] = useState('');
  const [colaboradorJateouId, setColaboradorJateouId] = useState('');
  const [jaPintado, setJaPintado] = useState(false);
  const [operadoresKanban, setOperadoresKanban] = useState<Record<string, string>>({});
  
  const [idsOcultos, setIdsOcultos] = useState<string[]>([]);
  const [novoValorGalpao, setNovoValorGalpao] = useState('');

  // ESTADOS DO CHECKLIST
  const [modalChecklistAberto, setModalChecklistAberto] = useState(false);
  const [truqueParaChecklist, setTruqueParaChecklist] = useState<any>(null);

  useEffect(() => {
    if (!setorAtivo) return;
    const q = query(collection(db, 'truques_producao'), where('setorId', '==', setorAtivo));
    const unsub = onSnapshot(q, (snap) => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      lista.sort((a: any, b: any) => (b.dataCadastro?.toMillis() || 0) - (a.dataCadastro?.toMillis() || 0));
      setTruques(lista);
    });
    return () => unsub();
  }, [setorAtivo]);

  const registrarTruque = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!truqueId) return avisar("Preencha os números da Plaquinha.", "erro");
    if (!/^M\d{3}$/.test(truqueId)) return avisar("A plaquinha deve conter M e 3 números. Ex: M001.", "erro");

    try {
      const funcNome = colaboradorJateouId ? funcionarios.find(f => f.id === colaboradorJateouId)?.nome || 'Desconhecido' : 'A Definir';
      await addDoc(collection(db, 'truques_producao'), {
        setorId: setorAtivo, identificacao: truqueId, colaboradorJateouId: colaboradorJateouId || 'pendente', 
        colaboradorJateouNome: funcNome, status: jaPintado ? 'pintado' : 'pronto_jateamento', dataCadastro: serverTimestamp(),
        ...(jaPintado ? { dataPintura: serverTimestamp(), dataPM: serverTimestamp() } : {})
      });
      avisar(jaPintado ? "Truque registrado (Pintado)!" : "Truque cadastrado para Lavagem.");
      setTruqueId(''); setColaboradorJateouId(''); setJaPintado(false);
    } catch (error) { avisar("Erro ao registrar.", "erro"); }
  };

  const avancarParaPintura = async (id: string) => {
    try { await updateDoc(doc(db, 'truques_producao', id), { status: 'pronto_pintura' }); avisar("Liberado para Pintura."); } 
    catch (e) { avisar("Erro ao enviar para pintura.", "erro"); }
  };

  const marcarComoPintado = async (id: string) => {
    try { await updateDoc(doc(db, 'truques_producao', id), { status: 'pintado', dataPintura: serverTimestamp() }); avisar("Pintura Concluída e enviada ao Galpão."); } 
    catch (e) { avisar("Erro.", "erro"); }
  };

  const voltarEtapa = async (id: string, statusAnterior: string) => {
    try { await updateDoc(doc(db, 'truques_producao', id), { status: statusAnterior }); avisar("Peça retornada para a etapa anterior."); } 
    catch (e) { avisar("Erro ao retornar peça.", "erro"); }
  };

  const aplicarRecontagem = () => {
    const valor = parseInt(novoValorGalpao, 10);
    const todosPintados = truques.filter(t => t.status === 'pintado');
    if (isNaN(valor) || valor < 0) return avisar("Insira um valor válido para a recontagem.", "erro");
    if (valor > todosPintados.length) return avisar("O novo valor não pode ser maior que o total real do banco.", "erro");
    const quantidadeRemover = todosPintados.length - valor;
    if (quantidadeRemover === 0) { setIdsOcultos([]); setNovoValorGalpao(''); return avisar("Contagem restaurada para o valor original."); }
    const embaralhados = [...todosPintados].sort(() => 0.5 - Math.random());
    setIdsOcultos(embaralhados.slice(0, quantidadeRemover).map(t => t.id)); 
    setNovoValorGalpao('');
    avisar(`Contagem ajustada. ${quantidadeRemover} truques removidos visualmente.`);
  };

  // ============================================================================
  // 📄 LÓGICA DE GERAÇÃO DO PDF DO CHECKLIST DE JATEAMENTO
  // ============================================================================
  const renderizarPaginaChecklist = (docPdf: jsPDF, truque: any) => {
    const chk = truque.checklistJateamento;
    if (!chk) return;

    const dataPreenchimento = chk.dataPreenchimento?.toDate().toLocaleDateString('pt-BR') || "Data Indisponível";
    let y = 10;

    // Cabeçalho e Logo
    try { docPdf.addImage(logoCarvalho, 'PNG', 15, y, 40, 14); } catch(e){}
    docPdf.setFont("helvetica", "bold"); docPdf.setFontSize(14); docPdf.setTextColor(30, 41, 59);
    docPdf.text("CHECKLIST DE SEGURANÇA JATEAMENTO", 105, y + 6, { align: 'center' });
    docPdf.setFontSize(10);
    docPdf.text("DA ARANHA DO TRUQUE TRENS 59500", 105, y + 12, { align: 'center' });
    
    docPdf.setFontSize(9); docPdf.setFont("helvetica", "normal");
    docPdf.text(`Data: ${dataPreenchimento} | Plaqueta: ${truque.identificacao}`, 195, y + 12, { align: 'right' });
    y += 18;
    
    docPdf.setLineWidth(0.5); docPdf.line(15, y, 195, y); y += 6;

    // Objetivo
    docPdf.setFont("helvetica", "bold"); docPdf.setFontSize(10);
    docPdf.text("OBJETIVO", 15, y); y += 4;
    docPdf.setFont("helvetica", "normal"); docPdf.setFontSize(8);
    const objText = "Estabelecer os procedimentos operacionais seguros para a execução da atividade de jateamento da aranha do truque de trem utilizando poeira metálica para remoção de tinta, visando garantir a integridade física dos trabalhadores, a preservação do meio ambiente e a integridade dos equipamentos.";
    const splitObj = docPdf.splitTextToSize(objText, 180);
    docPdf.text(splitObj, 15, y);
    y += (splitObj.length * 4) + 4;

    // Itens de Verificação (Tabela)
    const renderTable = typeof autoTable === 'function' ? autoTable : (autoTable as any).default;
    const bodyRespostas = PERGUNTAS_CHECKLIST.map((p, i) => {
      const resp = chk.respostas[i];
      return [p, resp === true ? "[ X ]" : "[   ]", resp === false ? "[ X ]" : "[   ]"];
    });

    renderTable(docPdf, {
      startY: y,
      head: [["ITENS DE VERIFICAÇÃO", "SIM", "NÃO"]],
      body: bodyRespostas,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: { 0: { cellWidth: 140 }, 1: { cellWidth: 20, halign: 'center' }, 2: { cellWidth: 20, halign: 'center' } },
      headStyles: { fillColor: [30, 41, 59] }
    });

    y = (docPdf as any).lastAutoTable.finalY + 8;

    // Função auxiliar para evitar cortes na página
    const verificarEspaco = (espacoNecessario: number) => {
      if (y + espacoNecessario > 280) { docPdf.addPage(); y = 15; }
    };

    // Obrigações (2 Colunas para poupar espaço)
    verificarEspaco(40);
    docPdf.setFont("helvetica", "bold"); docPdf.setFontSize(9);
    docPdf.text("OBRIGAÇÕES DO VIGIA", 15, y);
    docPdf.text("OBRIGAÇÕES DO EXECUTANTE", 105, y);
    y += 5;
    
    docPdf.setFont("helvetica", "normal"); docPdf.setFontSize(7.5);
    let yVigia = y;
    OBRIGACOES_VIGIA.forEach(txt => {
      const linhas = docPdf.splitTextToSize(txt, 85);
      docPdf.text(linhas, 15, yVigia); yVigia += linhas.length * 3.5;
    });

    let yExec = y;
    OBRIGACOES_EXEC.forEach(txt => {
      const linhas = docPdf.splitTextToSize(txt, 85);
      docPdf.text(linhas, 105, yExec); yExec += linhas.length * 3.5;
    });

    y = Math.max(yVigia, yExec) + 8;

    // Medidas Preventivas e EPIs
    verificarEspaco(45);
    docPdf.setFont("helvetica", "bold"); docPdf.setFontSize(9);
    docPdf.text("MEDIDAS PREVENTIVAS GERAIS", 15, y); y += 5;
    docPdf.setFont("helvetica", "normal"); docPdf.setFontSize(7.5);
    const medidasText = "1. Exaustão | 2. Distanciamento | 3. Fechamento de cabine | 4. Monitoramento contínuo | 5. Exames específicos | 6. EPIs | 7. Inspeções diárias | 8. Evitar improvisos | 9. Uso de válvulas | 10. Sinalização | 11. Descansos | 12. Armazenamento seguro | 13. Verificação de abrasivo.";
    const splitMedidas = docPdf.splitTextToSize(medidasText, 180);
    docPdf.text(splitMedidas, 15, y); y += (splitMedidas.length * 4) + 6;

    docPdf.setFont("helvetica", "bold"); docPdf.setFontSize(9);
    docPdf.text("EPI's E EPC's OBRIGATÓRIOS", 15, y); y += 5;
    docPdf.setFont("helvetica", "normal"); docPdf.setFontSize(7.5);
    const episText = "Capacete de jatista (ar mandado) | Jaqueta couro/raspa | Calça couro/raspa | Luvas cano longo | Proteção pés | Exaustão | Compressor e Filtro | Manômetros independentes.";
    const splitEpis = docPdf.splitTextToSize(episText, 180);
    docPdf.text(splitEpis, 15, y); y += (splitEpis.length * 4) + 15;

    // Assinaturas
    verificarEspaco(40);
    docPdf.setFont("helvetica", "bold"); docPdf.setFontSize(10);
    docPdf.text("ASSINATURA DOS RESPONSÁVEIS PELA EXECUÇÃO", 105, y, { align: 'center' }); y += 25;

    // Assinatura Executante
    if (chk.assinaturaExecutante) { try { docPdf.addImage(chk.assinaturaExecutante, 'JPEG', 35, y - 20, 35, 18); } catch(e){} }
    docPdf.setLineWidth(0.5); docPdf.line(20, y, 85, y);
    docPdf.setFont("helvetica", "bold"); docPdf.setFontSize(9);
    docPdf.text("ASSINATURA DO EXECUTANTE", 52.5, y + 4, { align: 'center' });
    docPdf.setFont("helvetica", "normal");
    docPdf.text(`Nome: ${chk.executanteNome}`, 52.5, y + 9, { align: 'center' });

    // Assinatura Vigia
    if (chk.assinaturaVigia) { try { docPdf.addImage(chk.assinaturaVigia, 'JPEG', 135, y - 20, 35, 18); } catch(e){} }
    docPdf.line(120, y, 185, y);
    docPdf.setFont("helvetica", "bold");
    docPdf.text("ASSINATURA DO VIGIA", 152.5, y + 4, { align: 'center' });
    docPdf.setFont("helvetica", "normal");
    docPdf.text(`Nome: ${chk.vigiaNome}`, 152.5, y + 9, { align: 'center' });
  };

  const baixarChecklistIndividual = (truque: any) => {
    const docPdf = new jsPDF('p', 'mm', 'a4');
    renderizarPaginaChecklist(docPdf, truque);
    docPdf.save(`Checklist_Jateamento_${truque.identificacao}.pdf`);
  };

  const baixarChecklistsDaSemana = () => {
    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);

    const filtrados = truques.filter(t => {
      if (!t.checklistJateamento || !t.checklistJateamento.dataPreenchimento) return false;
      return t.checklistJateamento.dataPreenchimento.toDate() >= seteDiasAtras;
    });

    if (filtrados.length === 0) return avisar("Nenhum checklist preenchido nos últimos 7 dias.", "erro");

    const docPdf = new jsPDF('p', 'mm', 'a4');
    filtrados.forEach((t, index) => {
      if (index > 0) docPdf.addPage();
      renderizarPaginaChecklist(docPdf, t);
    });

    const dataHoje = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
    docPdf.save(`Lote_Checklists_Semanal_${dataHoje}.pdf`);
  };

  // Geração do PDF Antigo de Resumo de Produção (Galpão)
  const gerarRelatorioTruques = () => {
    const docPdf = new jsPDF('p', 'mm', 'a4');
    const dataAtual = new Date().toLocaleDateString('pt-BR');
    try { docPdf.addImage(logoCarvalho, 'PNG', 15, 10, 40, 14); } catch(e){}
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
        ...truquesAguardandoJateamento.map(t => [t.identificacao, 'Lavagem / Jateamento', t.colaboradorJateouNome]),
        ...truquesAguardandoPM.map(t => [t.identificacao, 'Partículas Magnéticas', t.colaboradorJateouNome]),
        ...truquesAguardandoPintura.map(t => [t.identificacao, 'Pintura', t.colaboradorJateouNome]),
        ...truquesConcluidos.map(t => [t.identificacao, 'Concluído (Galpão)', t.colaboradorJateouNome])
      ],
      theme: 'grid', styles: { fontSize: 9, cellPadding: 4 }
    });
    docPdf.save(`Relatorio_Truques_${dataAtual.replace(/\//g, '-')}.pdf`);
  };

  const truquesAguardandoJateamento = truques.filter(t => t.status === 'pronto_jateamento');
  const truquesAguardandoPM = truques.filter(t => t.status === 'analisado_pm');
  const truquesAguardandoPintura = truques.filter(t => t.status === 'pronto_pintura');
  const truquesConcluidos = truques.filter(t => t.status === 'pintado' && !idsOcultos.includes(t.id));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
      {/* Coluna 1: Cadastro */}
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', height: 'fit-content' }}>
        <h3 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 20px 0', color: '#1e293b' }}>
          <TrainFront size={18} color="#3b82f6" /> Lançar Truque
        </h3>
        <form onSubmit={registrarTruque} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <label style={{ fontSize: '13px', color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Código da Plaquinha *</label>
            <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
              <span style={{ padding: '12px 15px', backgroundColor: '#e2e8f0', fontWeight: 'bold' }}>M</span>
              <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={3} value={truqueId.replace('M', '')} onChange={e => setTruqueId(e.target.value.replace(/\D/g, '') ? `M${e.target.value.replace(/\D/g, '')}` : '')} placeholder="000" style={{ width: '100%', padding: '12px', border: 'none', background: 'transparent', outline: 'none', fontSize: '16px', fontWeight: 'bold' }} />
            </div>
          </div>
          <Button type="submit" style={{ height: '50px', backgroundColor: '#3b82f6' }}>Iniciar Preparação</Button>
          
          <div style={{ borderTop: '1px solid #e2e8f0', marginTop: '10px', paddingTop: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <Button type="button" onClick={gerarRelatorioTruques} style={{ backgroundColor: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Printer size={16}/> Resumo de Produção
            </Button>
            <Button type="button" onClick={baixarChecklistsDaSemana} style={{ backgroundColor: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <CalendarDays size={16}/> Checklists da Semana
            </Button>
          </div>
        </form>
      </div>

      {/* Coluna 2: Kanban Completo */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* 1. Jateamento */}
        <div style={{ backgroundColor: '#f1f5f9', padding: '20px', borderRadius: '16px' }}>
          <h4 style={{ margin: '0 0 15px 0', color: '#334155' }}>1. Lavagem / Jateamento ({truquesAguardandoJateamento.length})</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '250px', overflowY: 'auto' }}>
            {truquesAguardandoJateamento.map(t => (
              <div key={t.id} style={{ backgroundColor: 'white', padding: '15px', borderRadius: '12px', border: '1px solid #94a3b8' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><strong>{t.identificacao}</strong></div>
                <Button onClick={() => { setTruqueParaChecklist(t); setModalChecklistAberto(true); }} style={{ backgroundColor: '#f59e0b', marginTop: '10px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <ClipboardCheck size={16}/> Preencher Checklist (NR)
                </Button>
              </div>
            ))}
          </div>
        </div>
        
        {/* 2. Partículas Magnéticas */}
        <div style={{ backgroundColor: '#fffbeb', padding: '20px', borderRadius: '16px' }}>
          <h4 style={{ margin: '0 0 15px 0', color: '#b45309' }}>2. Partículas Magnéticas (PM) ({truquesAguardandoPM.length})</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto' }}>
            {truquesAguardandoPM.map(t => (
              <div key={t.id} style={{ backgroundColor: 'white', padding: '15px', borderRadius: '12px', border: '1px solid #fde047', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{t.identificacao}</strong>
                  {t.checklistJateamento && (
                    <button onClick={() => baixarChecklistIndividual(t)} style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer' }} title="Baixar Checklist">
                      <FileDown size={20} />
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button onClick={() => voltarEtapa(t.id, 'pronto_jateamento')} style={{ backgroundColor: '#f1f5f9', color: '#64748b', padding: '8px 10px' }} title="Voltar para Lavagem">
                    <Undo2 size={16}/>
                  </Button>
                  <Button onClick={() => avancarParaPintura(t.id)} style={{ backgroundColor: '#8b5cf6', padding: '8px 12px', flex: 1 }}>
                    Ir p/ Pintura <ArrowRight size={14}/>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Pintura */}
        <div style={{ backgroundColor: '#eff6ff', padding: '20px', borderRadius: '16px' }}>
          <h4 style={{ margin: '0 0 15px 0', color: '#1d4ed8', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Paintbrush size={18} /> 3. Pintura ({truquesAguardandoPintura.length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto' }}>
            {truquesAguardandoPintura.map(t => (
              <div key={t.id} style={{ backgroundColor: 'white', padding: '15px', borderRadius: '12px', border: '1px solid #bfdbfe', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{t.identificacao}</strong>
                  {t.checklistJateamento && (
                    <button onClick={() => baixarChecklistIndividual(t)} style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer' }} title="Baixar Checklist">
                      <FileDown size={20} />
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button onClick={() => voltarEtapa(t.id, 'analisado_pm')} style={{ backgroundColor: '#f1f5f9', color: '#64748b', padding: '8px 10px' }} title="Voltar para Partículas Magnéticas">
                    <Undo2 size={16}/>
                  </Button>
                  <Button onClick={() => marcarComoPintado(t.id)} style={{ backgroundColor: '#10b981', padding: '8px 12px', flex: 1 }}>
                    Concluir <Check size={14}/>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Galpão (Concluído) */}
        <div style={{ backgroundColor: '#f0fdf4', padding: '20px', borderRadius: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h4 style={{ margin: 0, color: '#166534' }}>4. Galpão ({truquesConcluidos.length})</h4>
            <div style={{ display: 'flex', gap: '5px' }}>
              <input type="number" value={novoValorGalpao} onChange={e => setNovoValorGalpao(e.target.value)} placeholder="Qtd atual" style={{ width: '70px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #86efac', outline: 'none', fontSize: '13px' }} />
              <Button onClick={aplicarRecontagem} style={{ padding: '4px 10px', fontSize: '12px', backgroundColor: '#166534' }}>Ajustar</Button>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
            {truquesConcluidos.map(t => (
              <div key={t.id} style={{ backgroundColor: 'white', padding: '10px 15px', borderRadius: '8px', border: '1px solid #86efac', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold', color: '#15803d' }}>{t.identificacao}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {t.checklistJateamento && (
                    <button onClick={() => baixarChecklistIndividual(t)} style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer' }} title="Baixar Checklist">
                      <FileDown size={18} />
                    </button>
                  )}
                  <Button onClick={() => voltarEtapa(t.id, 'pronto_pintura')} style={{ backgroundColor: 'transparent', color: '#15803d', padding: '4px', border: 'none' }} title="Desfazer (Voltar para Pintura)">
                    <Undo2 size={16}/>
                  </Button>
                  <Check size={16} color="#15803d" />
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      <ModalChecklistJateamento 
        aberto={modalChecklistAberto}
        truque={truqueParaChecklist}
        funcionarios={funcionarios}
        onClose={() => { setModalChecklistAberto(false); setTruqueParaChecklist(null); }}
        avisar={avisar}
      />
    </div>
  );
}