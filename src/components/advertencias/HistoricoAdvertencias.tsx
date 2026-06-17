// src/components/advertencias/HistoricoAdvertencias.tsx
import jsPDF from "jspdf";
import logoCarvalho from '../../assets/logopdf.png'; // ✨ Nosso novo padrão
import { Download } from 'lucide-react';
import Button from '../ui/Button';

// ✨ Interface atualizada com os novos campos do formulário
interface Advertencia { 
  id: string; 
  funcionarioId: string; 
  funcionarioNome: string; 
  funcionarioCpf: string; 
  funcionarioRg: string;
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

  // GERADOR DE PDF FORMAL JURÍDICO
  const gerarPDFFormal = (adv: Advertencia) => {
    const docPdf = new jsPDF('p', 'mm', 'a4');
    const dataAtual = new Date().toLocaleDateString('pt-BR');
    
    // Concatena a Data com a Hora (se existir)
    const dataFato = adv.dataOcorrencia.split('-').reverse().join('/') + (adv.horaOcorrencia ? ` às ${adv.horaOcorrencia}` : '');
    
    const tituloDoc = adv.tipo === 'escrita' ? "COMUNICAÇÃO DE ADVERTÊNCIA DISCIPLINAR" : "REGISTRO DE ORIENTAÇÃO VERBAL";
    
    // ✨ Atualizado para formato 'PNG'
    try { docPdf.addImage(logoCarvalho, 'PNG', 15, 10, 40, 14); } catch(e){}
    docPdf.setFont("helvetica", "bold"); docPdf.setFontSize(14); docPdf.setTextColor(30, 41, 59);
    docPdf.text("CARVALHO FUNILARIA E PINTURAS LTDA", 105, 16, { align: 'center' });
    docPdf.setFontSize(9); docPdf.setFont("helvetica", "normal");
    docPdf.text("CNPJ: 31.362.302/0001-33", 105, 21, { align: 'center' });
    
    docPdf.setLineWidth(0.5); docPdf.line(15, 26, 195, 26);

    docPdf.setFontSize(16); docPdf.setFont("helvetica", "bold"); docPdf.setTextColor(0, 0, 0);
    docPdf.text(tituloDoc, 105, 38, { align: 'center' });

    // Quadro de Qualificação
    docPdf.setFillColor(241, 245, 249); docPdf.rect(15, 45, 180, 22, "F");
    docPdf.setFontSize(10); docPdf.setFont("helvetica", "bold");
    docPdf.text(`COLABORADOR: ${adv.funcionarioNome.toUpperCase()}`, 18, 52);
    docPdf.setFont("helvetica", "normal");
    docPdf.text(`CPF: ${adv.funcionarioCpf || 'Não cadastrado'}`, 18, 58);
    docPdf.text(`RG: ${adv.funcionarioRg || 'Não cadastrado'}`, 105, 58);
    docPdf.text(`Data/Hora da Ocorrência: ${dataFato}`, 18, 63);

    docPdf.setFontSize(11);
    let textoIntro = "";
    if (adv.tipo === 'escrita') {
      textoIntro = `Pela presente, vimos comunicar-lhe que está sendo aplicada a presente ADVERTÊNCIA DISCIPLINAR ESCRITA, em razão da infração cometida durante o exercício de suas funções, especificamente descrita abaixo:`;
    } else {
      textoIntro = `Pela presente, registramos formalmente que o(a) colaborador(a) acima qualificado(a) recebeu uma ORIENTAÇÃO / ADVERTÊNCIA VERBAL, a fim de alinhar condutas e procedimentos, referentes à seguinte ocorrência:`;
    }
    
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

    const yLocalData = yConclusao + (splitConclusao.length * 5) + 15;
    docPdf.text(`Araraquara/SP, ${dataAtual}.`, 195, yLocalData, { align: 'right' });

    // === ÁREA DE ASSINATURAS E TESTEMUNHAS DINÂMICAS ===
    const yAssinaturas = yLocalData + 35;
    docPdf.setDrawColor(0,0,0);
    
    // Assinatura Empresa
    docPdf.line(20, yAssinaturas, 80, yAssinaturas);
    docPdf.setFontSize(9); docPdf.setFont("helvetica", "bold");
    docPdf.text("A EMPRESA", 50, yAssinaturas + 5, { align: 'center' });
    docPdf.setFont("helvetica", "normal");
    docPdf.text("Carvalho Funilaria e Pinturas Ltda", 50, yAssinaturas + 10, { align: 'center' });

    // Assinatura Colaborador
    if (adv.recusouAssinar) {
      // Regra de Recusa
      docPdf.setFont("helvetica", "bold");
      docPdf.setTextColor(220, 38, 38); // Vermelho
      docPdf.text("O COLABORADOR RECUSOU-SE A ASSINAR", 150, yAssinaturas - 5, { align: 'center' });
      docPdf.setTextColor(0, 0, 0); // Volta pro Preto
      docPdf.line(120, yAssinaturas, 180, yAssinaturas);
      docPdf.setFont("helvetica", "bold");
      docPdf.text("Ciente e de acordo:", 150, yAssinaturas + 5, { align: 'center' });
      docPdf.setFont("helvetica", "normal");
      docPdf.text(adv.funcionarioNome, 150, yAssinaturas + 10, { align: 'center' });
    } else {
      // Regra Digital ou Física
      if (adv.assinaturaBase64) {
        try { docPdf.addImage(adv.assinaturaBase64, 'PNG', 130, yAssinaturas - 25, 40, 20); } catch(e){}
      }
      docPdf.line(120, yAssinaturas, 180, yAssinaturas);
      docPdf.setFont("helvetica", "bold");
      docPdf.text("Ciente e de acordo:", 150, yAssinaturas + 5, { align: 'center' });
      docPdf.setFont("helvetica", "normal");
      docPdf.text(adv.funcionarioNome, 150, yAssinaturas + 10, { align: 'center' });
    }

    // Regras das Testemunhas
    const yTestemunhas = yAssinaturas + 35;
    docPdf.setFont("helvetica", "bold");
    
    if (adv.recusouAssinar) {
      docPdf.text("TESTEMUNHAS OBRIGATÓRIAS (Devido à recusa de assinatura):", 15, yTestemunhas - 5);
    } else {
      docPdf.text("TESTEMUNHAS (Opcional, em caso de recusa posterior de assinatura):", 15, yTestemunhas - 5);
    }

    docPdf.setFont("helvetica", "normal");
    
    // Testemunha 1
    docPdf.line(20, yTestemunhas + 10, 80, yTestemunhas + 10);
    const textoT1 = adv.nomeTestemunha1 ? `1. Nome: ${adv.nomeTestemunha1} / CPF:` : "1. Nome / CPF:";
    docPdf.text(textoT1, 20, yTestemunhas + 15);
    
    // Testemunha 2
    docPdf.line(120, yTestemunhas + 10, 180, yTestemunhas + 10);
    const textoT2 = adv.nomeTestemunha2 ? `2. Nome: ${adv.nomeTestemunha2} / CPF:` : "2. Nome / CPF:";
    docPdf.text(textoT2, 120, yTestemunhas + 15);

    // === PÁGINA 2: ANEXO FOTOGRÁFICO ===
    if (adv.fotoOcorrenciaBase64) {
      docPdf.addPage();
      docPdf.setFont("helvetica", "bold"); docPdf.setFontSize(16);
      docPdf.text("ANEXO FOTOGRÁFICO - EVIDÊNCIA DA INFRAÇÃO", 105, 20, { align: 'center' });
      docPdf.setLineWidth(0.5); docPdf.line(15, 25, 195, 25);
      
      docPdf.setFontSize(10); docPdf.setFont("helvetica", "normal");
      docPdf.text(`Documento Ref.: ${tituloDoc}`, 15, 35);
      docPdf.text(`Colaborador: ${adv.funcionarioNome}`, 15, 40);
      docPdf.text(`Data do Registo: ${dataAtual}`, 15, 45);

      try {
        docPdf.addImage(adv.fotoOcorrenciaBase64, 'JPEG', 25, 55, 160, 120);
        docPdf.setDrawColor(203, 213, 225);
        docPdf.rect(25, 55, 160, 120);
      } catch(e) {
        docPdf.text("Erro ao carregar a imagem.", 25, 60);
      }
    }

    // Salvar Documento
    const tipoFicheiro = adv.tipo === 'escrita' ? 'Advertencia' : 'Orientacao';
    const dataFicheiro = adv.dataOcorrencia.replace(/\//g, '-');
    docPdf.save(`${tipoFicheiro}_${adv.funcionarioNome.split(' ')[0]}_${dataFicheiro}.pdf`);
  };

  return (
    <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: 'var(--sombra-card)' }}>
      <h3 style={{ marginBottom: '15px', fontSize: '16px', color: '#1e293b' }}>Histórico do RH</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '650px', overflowY: 'auto' }}>
        {advertencias.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '20px' }}>Nenhum registo efetuado ainda.</p>
        ) : (
          advertencias.map(adv => (
            <div key={adv.id} style={{ border: '1px solid #e2e8f0', padding: '15px', borderRadius: '8px', backgroundColor: adv.tipo === 'oral' ? '#fffbeb' : '#fff5f5' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <strong style={{ color: '#1e293b', fontSize: '14px' }}>{adv.funcionarioNome}</strong>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: adv.tipo === 'oral' ? '#b45309' : '#b91c1c' }}>{adv.tipo.toUpperCase()}</span>
              </div>
              <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '8px' }}>
                Ocorrência: {adv.dataOcorrencia.split('-').reverse().join('/')} {adv.horaOcorrencia && `às ${adv.horaOcorrencia}`}
              </span>
              <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 10px 0', lineHeight: '1.4' }}>{adv.motivo}</p>
              
              <Button onClick={() => gerarPDFFormal(adv)} style={{ width: '100%', backgroundColor: 'white', color: '#1e293b', border: '1px solid #cbd5e1', display: 'flex', justifyContent: 'center', gap: '8px' }}>
                <Download size={16} /> Baixar PDF Jurídico
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}