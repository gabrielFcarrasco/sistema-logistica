// src/components/advertencias/HistoricoAdvertencias.tsx
import { useState } from 'react';
import jsPDF from "jspdf";
import logoCarvalho from '../../assets/logopdf.png';
import { Download, FileText, Calendar } from 'lucide-react';
import Button from '../ui/Button';

interface Advertencia { 
  id: string; 
  funcionarioNome: string; 
  funcionarioCpf?: string; 
  funcionarioRg?: string;
  tipo: 'oral' | 'escrita';
  motivo: string; 
  dataOcorrencia: string; 
  horaOcorrencia?: string;
  metodoAssinatura?: 'digital' | 'fisica' | 'recusa';
  assinaturaBase64?: string; 
  recusouAssinar?: boolean;
  nomeTestemunha1?: string;
  nomeTestemunha2?: string;
  fotoOcorrenciaBase64?: string;
}

interface Props {
  advertencias: Advertencia[];
}

export default function HistoricoAdvertencias({ advertencias }: Props) {
  const [periodoLote, setPeriodoLote] = useState('completo');

  // ✨ FUNÇÃO REUTILIZÁVEL: Desenha o layout de uma advertência numa página do PDF
  const renderizarPaginaAdvertencia = (docPdf: jsPDF, adv: Advertencia) => {
    const dataFato = adv.dataOcorrencia.split('-').reverse().join('/') + (adv.horaOcorrencia ? ` às ${adv.horaOcorrencia}` : '');
    const tituloDoc = adv.tipo === 'escrita' ? "COMUNICAÇÃO DE ADVERTÊNCIA DISCIPLINAR" : "REGISTRO DE ORIENTAÇÃO VERBAL";
    
    try { docPdf.addImage(logoCarvalho, 'PNG', 15, 10, 40, 14); } catch(e){}
    docPdf.setFont("helvetica", "bold"); docPdf.setFontSize(14); docPdf.setTextColor(30, 41, 59);
    docPdf.text("CARVALHO FUNILARIA E PINTURAS LTDA", 105, 16, { align: 'center' });
    docPdf.setFontSize(9); docPdf.setFont("helvetica", "normal");
    docPdf.text("CNPJ: 31.362.302/0001-33", 105, 21, { align: 'center' });
    
    docPdf.setLineWidth(0.5); docPdf.line(15, 26, 195, 26);

    docPdf.setFontSize(16); docPdf.setFont("helvetica", "bold"); docPdf.setTextColor(0, 0, 0);
    docPdf.text(tituloDoc, 105, 38, { align: 'center' });

    docPdf.setFillColor(241, 245, 249); docPdf.rect(15, 45, 180, 22, "F");
    docPdf.setFontSize(10); docPdf.setFont("helvetica", "bold");
    docPdf.text(`COLABORADOR: ${adv.funcionarioNome.toUpperCase()}`, 18, 52);
    docPdf.setFont("helvetica", "normal");
    docPdf.text(`CPF: ${adv.funcionarioCpf || 'Não cadastrado'}`, 18, 58);
    docPdf.text(`RG: ${adv.funcionarioRg || 'Não cadastrado'}`, 105, 58);
    docPdf.text(`Data/Hora da Ocorrência: ${dataFato}`, 18, 63);

    docPdf.setFontSize(11);
    let textoIntro = adv.tipo === 'escrita' ? 
      `Pela presente, vimos comunicar-lhe que está sendo aplicada a presente ADVERTÊNCIA DISCIPLINAR ESCRITA, em razão da infração cometida durante o exercício de suas funções, especificamente descrita abaixo:` : 
      `Pela presente, registramos formalmente que o(a) colaborador(a) acima qualificado(a) recebeu uma ORIENTAÇÃO / ADVERTÊNCIA VERBAL, a fim de alinhar condutas e procedimentos, referentes à seguinte ocorrência:`;
    
    const splitIntro = docPdf.splitTextToSize(textoIntro, 180);
    docPdf.text(splitIntro, 15, 78);

    const yMotivo = 78 + (splitIntro.length * 5) + 5;
    docPdf.setFont("helvetica", "bold");
    docPdf.text("DESCRIÇÃO DOS FATOS (MOTIVO):", 15, yMotivo);
    
    docPdf.setFont("helvetica", "normal");
    const splitMotivo = docPdf.splitTextToSize(adv.motivo, 174);
    
    const alturaQuadroMotivo = (splitMotivo.length * 5) + 8;
    docPdf.setDrawColor(203, 213, 225); 
    docPdf.rect(15, yMotivo + 3, 180, alturaQuadroMotivo);
    docPdf.text(splitMotivo, 18, yMotivo + 9);

    const yConclusao = yMotivo + alturaQuadroMotivo + 10;
    const textoConclusao = `Esclarecemos que a repetição de atitudes desta natureza, ou o cometimento de outras faltas, demonstrará desinteresse no cumprimento de suas obrigações contratuais e poderá acarretar sanções mais severas, tais como suspensão disciplinar e até mesmo a rescisão do contrato de trabalho por JUSTA CAUSA, conforme preceitua o Artigo 482 da Consolidação das Leis do Trabalho (CLT). Solicitamos, portanto, que observe rigorosamente as normas internas da empresa.`;
    
    const splitConclusao = docPdf.splitTextToSize(textoConclusao, 180);
    docPdf.text(splitConclusao, 15, yConclusao);

    // ✨ A linha de "Araraquara/SP..." foi removida daqui!
    // As assinaturas agora descem calculando diretamente do fim do texto da conclusão.
    const yAssinaturas = yConclusao + (splitConclusao.length * 5) + 25;
    
    docPdf.setDrawColor(0,0,0);
    
    // ✨ LÓGICA DE ASSINATURA DINÂMICA
    if (adv.tipo === 'oral') {
      // APENAS FUNCIONÁRIO (Centralizado)
      if (adv.assinaturaBase64) {
        try { docPdf.addImage(adv.assinaturaBase64, 'PNG', 85, yAssinaturas - 22, 40, 20); } catch(e){}
      }
      docPdf.line(65, yAssinaturas, 145, yAssinaturas);
      docPdf.setFont("helvetica", "bold"); docPdf.setFontSize(10);
      docPdf.text("Assinatura do Colaborador", 105, yAssinaturas + 5, { align: 'center' });
      docPdf.setFont("helvetica", "normal");
      docPdf.text(`Nome: ${adv.funcionarioNome}`, 105, yAssinaturas + 10, { align: 'center' });
      if (adv.funcionarioCpf) {
        docPdf.text(`CPF: ${adv.funcionarioCpf}`, 105, yAssinaturas + 15, { align: 'center' });
      }
    } else {
      // EMPRESA + FUNCIONÁRIO (Advertência Escrita)
      docPdf.line(20, yAssinaturas, 80, yAssinaturas);
      docPdf.setFontSize(9); docPdf.setFont("helvetica", "bold");
      docPdf.text("A EMPRESA", 50, yAssinaturas + 5, { align: 'center' });
      docPdf.setFont("helvetica", "normal");
      docPdf.text("Carvalho Funilaria e Pinturas Ltda", 50, yAssinaturas + 10, { align: 'center' });

      if (adv.recusouAssinar) {
        docPdf.setFont("helvetica", "bold"); docPdf.setTextColor(220, 38, 38);
        docPdf.text("O COLABORADOR RECUSOU-SE A ASSINAR", 150, yAssinaturas - 5, { align: 'center' });
        docPdf.setTextColor(0, 0, 0); docPdf.line(120, yAssinaturas, 180, yAssinaturas);
        docPdf.setFont("helvetica", "bold"); docPdf.text("Ciente e de acordo:", 150, yAssinaturas + 5, { align: 'center' });
        docPdf.setFont("helvetica", "normal"); docPdf.text(adv.funcionarioNome, 150, yAssinaturas + 10, { align: 'center' });
      } else {
        if (adv.assinaturaBase64) {
          try { docPdf.addImage(adv.assinaturaBase64, 'PNG', 130, yAssinaturas - 25, 40, 20); } catch(e){}
        }
        docPdf.line(120, yAssinaturas, 180, yAssinaturas);
        docPdf.setFont("helvetica", "bold"); docPdf.text("Ciente e de acordo:", 150, yAssinaturas + 5, { align: 'center' });
        docPdf.setFont("helvetica", "normal"); docPdf.text(adv.funcionarioNome, 150, yAssinaturas + 10, { align: 'center' });
      }

      // Testemunhas da Advertência Escrita
      const yTestemunhas = yAssinaturas + 35;
      docPdf.setFont("helvetica", "bold");
      docPdf.text(adv.recusouAssinar ? "TESTEMUNHAS OBRIGATÓRIAS (Devido à recusa de assinatura):" : "TESTEMUNHAS (Opcional, em caso de recusa posterior de assinatura):", 15, yTestemunhas - 5);
      docPdf.setFont("helvetica", "normal");
      
      docPdf.line(20, yTestemunhas + 10, 80, yTestemunhas + 10);
      docPdf.text(adv.nomeTestemunha1 ? `1. Nome: ${adv.nomeTestemunha1} / CPF:` : "1. Nome / CPF:", 20, yTestemunhas + 15);
      
      docPdf.line(120, yTestemunhas + 10, 180, yTestemunhas + 10);
      docPdf.text(adv.nomeTestemunha2 ? `2. Nome: ${adv.nomeTestemunha2} / CPF:` : "2. Nome / CPF:", 120, yTestemunhas + 15);
    }

    // PÁGINA EXTRA: ANEXO FOTOGRÁFICO
    if (adv.fotoOcorrenciaBase64) {
      docPdf.addPage();
      docPdf.setFont("helvetica", "bold"); docPdf.setFontSize(16);
      docPdf.text("ANEXO FOTOGRÁFICO - EVIDÊNCIA DA INFRAÇÃO", 105, 20, { align: 'center' });
      docPdf.setLineWidth(0.5); docPdf.line(15, 25, 195, 25);
      
      docPdf.setFontSize(10); docPdf.setFont("helvetica", "normal");
      docPdf.text(`Documento Ref.: ${tituloDoc}`, 15, 35);
      docPdf.text(`Colaborador: ${adv.funcionarioNome}`, 15, 40);
      try {
        docPdf.addImage(adv.fotoOcorrenciaBase64, 'JPEG', 25, 55, 160, 120);
        docPdf.setDrawColor(203, 213, 225); docPdf.rect(25, 55, 160, 120);
      } catch(e) {}
    }
  };

  // 📄 GERA UM PDF INDIVIDUAL
  const gerarPDFFormal = (adv: Advertencia) => {
    const docPdf = new jsPDF('p', 'mm', 'a4');
    renderizarPaginaAdvertencia(docPdf, adv); // Omitimos a data atual

    const dataArquivo = adv.dataOcorrencia.split('-').reverse().join('-');
    const primeiroNome = adv.funcionarioNome.split(' ')[0];
    const tipoAviso = adv.tipo === 'escrita' ? 'Advertencia' : 'Orientacao';
    
    docPdf.save(`${tipoAviso}_${primeiroNome}_${dataArquivo}.pdf`);
  };

  // 📄 GERA UM PDF COM O DOSSIÊ/HISTÓRICO EM LOTE
  const gerarPDFLote = () => {
    if (!advertencias || advertencias.length === 0) {
      return alert("Não há registros no sistema para gerar.");
    }

    const hoje = new Date();
    let filtradas = [...advertencias];

    if (periodoLote === 'mensal') {
      const limite = new Date();
      limite.setMonth(hoje.getMonth() - 1);
      filtradas = filtradas.filter(a => new Date(`${a.dataOcorrencia}T12:00:00`) >= limite);
    } else if (periodoLote === 'semestral') {
      const limite = new Date();
      limite.setMonth(hoje.getMonth() - 6);
      filtradas = filtradas.filter(a => new Date(`${a.dataOcorrencia}T12:00:00`) >= limite);
    }

    if (filtradas.length === 0) {
      return alert("Nenhum registro de advertência encontrado para este período selecionado.");
    }

    // Ordena cronologicamente (da ocorrência mais antiga para a mais nova) para o PDF fazer sentido
    filtradas.sort((a, b) => new Date(`${a.dataOcorrencia}T12:00:00`).getTime() - new Date(`${b.dataOcorrencia}T12:00:00`).getTime());

    const docPdf = new jsPDF('p', 'mm', 'a4');

    // Desenha cada advertência no PDF, adicionando páginas novas
    filtradas.forEach((adv, index) => {
      if (index > 0) docPdf.addPage();
      renderizarPaginaAdvertencia(docPdf, adv);
    });

    const dataAtualString = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
    docPdf.save(`Histórico_Ocorrencias_${periodoLote.toUpperCase()}_${dataAtualString}.pdf`);
  };

  return (
    <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: 'var(--sombra-card)' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3 style={{ fontSize: '18px', color: '#1e293b', margin: 0, fontWeight: 'bold' }}>Histórico do RH</h3>
      </div>

      <div style={{ backgroundColor: '#f8fafc', padding: '15px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
        <p style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 'bold', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Calendar size={16} color="#3b82f6" /> Emitir Dossiê de Ocorrências (PDF Único)
        </p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <select value={periodoLote} onChange={e => setPeriodoLote(e.target.value)} style={{ flex: 1, minWidth: '150px', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', backgroundColor: 'white' }}>
            <option value="completo">Histórico Completo (Tudo)</option>
            <option value="semestral">Últimos 6 Meses</option>
            <option value="mensal">Últimos 30 Dias</option>
          </select>
          <Button onClick={gerarPDFLote} style={{ backgroundColor: '#3b82f6', display: 'flex', alignItems: 'center', gap: '8px', padding: '0 20px' }}>
            <FileText size={18} /> Baixar PDF
          </Button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '550px', overflowY: 'auto', paddingRight: '5px' }}>
        {(advertencias || []).length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '20px' }}>Nenhum registo efetuado ainda.</p>
        ) : (
          (advertencias || []).map(adv => (
            <div key={adv.id} style={{ border: '1px solid #e2e8f0', padding: '15px', borderRadius: '10px', backgroundColor: adv.tipo === 'oral' ? '#fffbeb' : '#fef2f2' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <strong style={{ color: '#1e293b', fontSize: '14px' }}>{adv.funcionarioNome}</strong>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: adv.tipo === 'oral' ? '#b45309' : '#b91c1c' }}>{adv.tipo.toUpperCase()}</span>
              </div>
              <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '8px' }}>
                Data do Fato: {adv.dataOcorrencia.split('-').reverse().join('/')}
              </span>
              <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 12px 0', lineHeight: '1.4' }}>{adv.motivo}</p>
              
              <Button onClick={() => gerarPDFFormal(adv)} style={{ width: '100%', backgroundColor: 'white', color: '#1e293b', border: '1px solid #cbd5e1', display: 'flex', justifyContent: 'center', gap: '8px' }}>
                <Download size={16} /> Baixar Documento Individual
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
