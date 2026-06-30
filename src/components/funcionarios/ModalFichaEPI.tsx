// src/components/funcionarios/ModalFichaEPI.tsx
import { useState, useMemo } from 'react';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoCarvalho from '../../assets/logopdf.png';
import { FileText, Printer, X, Calendar } from 'lucide-react';
import Button from '../ui/Button';

// Adicionada a prop 'estoque' para cruzamento de dados do C.A. em tempo real
interface Props {
  aberto: boolean;
  funcionario: any;
  entregas: any[];
  estoque: any[]; 
  onClose: () => void;
  avisar: (msg: string, tipo?: 'sucesso' | 'erro') => void;
}

export default function ModalFichaEPI({ aberto, funcionario, entregas, estoque, onClose, avisar }: Props) {
  const [gerando, setGerando] = useState(false);

  // Mês padrão: Mês corrente
  const dataAtual = new Date();
  const mesAtualFormatado = `${dataAtual.getFullYear()}-${String(dataAtual.getMonth() + 1).padStart(2, '0')}`;
  const [mesReferencia, setMesReferencia] = useState(mesAtualFormatado);

  // ⚙️ MOTOR DE PROCESSAMENTO DE DADOS
  const entregasProcessadas = useMemo(() => {
    if (!entregas || entregas.length === 0) return [];

    // 1. Filtragem por Mês de Referência
    const filtradas = entregas.filter(ent => {
      if (!ent.dataHora) return false;
      const dataEpi = ent.dataHora.toDate ? ent.dataHora.toDate() : new Date(ent.dataHora);
      const mesEpi = String(dataEpi.getMonth() + 1).padStart(2, '0');
      const anoEpi = dataEpi.getFullYear();
      return `${anoEpi}-${mesEpi}` === mesReferencia;
    });

    // 2. Ordenação Cronológica (Crescente: do dia 1 ao 31)
    filtradas.sort((a, b) => {
      const dataA = a.dataHora?.toMillis ? a.dataHora.toMillis() : new Date(a.dataHora).getTime();
      const dataB = b.dataHora?.toMillis ? b.dataHora.toMillis() : new Date(b.dataHora).getTime();
      return dataA - dataB;
    });

    // 3. Cruzamento Dinâmico de C.A. (Busca no Estoque Atualizado)
    return filtradas.map(ent => {
      const itemEstoque = estoque?.find(item => item.id === ent.itemId);
      // Regra de Negócio: C.A. do estoque prevalece. Fallback para entrega antiga.
      const caAtualizado = itemEstoque?.ca || itemEstoque?.CA || ent.ca || '-';
      return { ...ent, caAtualizado };
    });
  }, [entregas, mesReferencia, estoque]);

  if (!aberto || !funcionario) return null;

  // 📄 MOTOR DE RENDERIZAÇÃO PDF CORPORATIVO
  const gerarPDF = () => {
    setGerando(true);
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const azulCorporativo = [30, 41, 59];
      const cinzaBorda = [203, 213, 225];
      let startYTable = 0;

      // --- 1. CABEÇALHO DO DOCUMENTO ---
      try { doc.addImage(logoCarvalho, 'PNG', 15, 10, 35, 10); } catch(e){}
      
      doc.setFont("helvetica", "bold"); 
      doc.setFontSize(14); 
      doc.setTextColor(azulCorporativo[0], azulCorporativo[1], azulCorporativo[2]);
      doc.text("FICHA DE CONTROLE DE FORNECIMENTO", 105, 14, { align: 'center' });
      
      doc.setFontSize(10);
      doc.text("EQUIPAMENTOS DE PROTEÇÃO INDIVIDUAL E UNIFORMES", 105, 19, { align: 'center' });[span_0](start_span)[span_0](end_span)
      
      doc.setLineWidth(0.4); 
      doc.setDrawColor(azulCorporativo[0], azulCorporativo[1], azulCorporativo[2]);
      doc.line(15, 23, 195, 23);

      // --- 2. QUADRO DE IDENTIFICAÇÃO DO COLABORADOR ---
      doc.setFillColor(248, 250, 252); 
      doc.setDrawColor(cinzaBorda[0], cinzaBorda[1], cinzaBorda[2]);
      doc.rect(15, 26, 180, 20, "FD");
      
      doc.setFontSize(8); 
      doc.setTextColor(0, 0, 0);
      
      // Coluna Esquerda
      doc.setFont("helvetica", "bold"); doc.text("Nome do Funcionário:", 18, 32);[span_1](start_span)[span_1](end_span)
      doc.setFont("helvetica", "normal"); doc.text(funcionario.nome.toUpperCase(), 50, 32);
      
      doc.setFont("helvetica", "bold"); doc.text("Cargo / Função:", 18, 38);[span_2](start_span)[span_2](end_span)
      doc.setFont("helvetica", "normal"); doc.text(funcionario.funcao?.toUpperCase() || "NÃO INFORMADO", 42, 38);
      
      doc.setFont("helvetica", "bold"); doc.text("CPF:", 18, 44);
      doc.setFont("helvetica", "normal"); doc.text(funcionario.cpf || "NÃO INFORMADO", 26, 44);

      // Coluna Direita
      const [anoRef, mesRef] = mesReferencia.split('-');
      doc.setFont("helvetica", "bold"); doc.text("Mês de Referência:", 130, 32);[span_3](start_span)[span_3](end_span)
      doc.setFont("helvetica", "normal"); doc.text(`${mesRef}/${anoRef}`, 158, 32);

      doc.setFont("helvetica", "bold"); doc.text("Registro / Matrícula:", 130, 38);[span_4](start_span)[span_4](end_span)
      doc.setFont("helvetica", "normal"); doc.text(funcionario.matricula || "NÃO INFORMADO", 160, 38);

      // --- 3. TERMOS LEGAIS E CIENTES (NR-6) ---
      let yText = 52;
      doc.setFontSize(7.5);
      
      doc.setFont("helvetica", "bold"); 
      doc.text("Declaro:", 15, yText); yText += 4;[span_5](start_span)[span_5](end_span)
      doc.setFont("helvetica", "normal");
      const termoPrincipal = "Declaro ter recebido da Carvalho Pintura e Montagem, os equipamentos de proteção individual abaixo, fornecidos gratuitamente, para meu uso, de acordo com as normas de segurança. Comprometo-me a utilizá-los apenas para a finalidade a que se destinam e a conservá-los em perfeito estado, realizando a higienização quando necessário, e reportando ao responsável qualquer dano ou extravio.";[span_6](start_span)[span_6](end_span)
      const linhasTermo = doc.splitTextToSize(termoPrincipal, 180);
      doc.text(linhasTermo, 15, yText, { align: 'justify' }); yText += (linhasTermo.length * 3.5) + 4;

      doc.setFont("helvetica", "bold"); 
      doc.text("ESTOU CIENTE:", 15, yText); yText += 4;[span_7](start_span)[span_7](end_span)
      doc.setFont("helvetica", "normal");
      
      const cientes = [
        "1. Que o não fornecimento do EPI ou a recusa em utilizá-lo de acordo com as orientações da Carvalho Pintura e Montagem e da legislação (NR-06 e NR-18), bem como outras Normas Regulamentadoras, poderá resultar em Penalidades.",[span_8](start_span)[span_8](end_span)
        "2. Do recebimento gratuito e da importância dos EPI's fornecidos pela empresa, cuja não utilização pode implicar riscos à saúde e segurança.",[span_9](start_span)[span_9](end_span)
        "3. Dos equipamentos fornecidos pela empresa.",[span_10](start_span)[span_10](end_span)
        "4. Que a utilização dos EPI's não desobriga o cumprimento das normas, deveres e obrigações de prevenção de acidentes previstas na legislação vigente.[span_11](start_span)"[span_11](end_span)
      ];

      cientes.forEach(item => {
        const linhas = doc.splitTextToSize(item, 180);
        doc.text(linhas, 15, yText, { align: 'justify' });
        yText += (linhas.length * 3.5) + 1.5;
      });

      startYTable = yText + 4;

      // --- 4. TABELA DE REGISTROS CORPORATIVA ---
      const autoTablePlugin = typeof autoTable === 'function' ? autoTable : (autoTable as any).default;
      
      const bodyData = entregasProcessadas.map(ent => {
        const dataFormatada = ent.dataHora?.toDate ? ent.dataHora.toDate().toLocaleDateString('pt-BR') : (ent.dataHora || '-');
        return [
          dataFormatada,
          `${ent.quantidade}`,
          ent.tamanho || '-',
          ent.itemNome,
          ent.caAtualizado, // Utilizando o CA dinâmico processado
          '', // Célula oca reservada para a imagem da assinatura
          ent.dataDevolucao || '-'
        ];
      });

      autoTablePlugin(doc, {
        startY: startYTable,
        head: [["Data Entrega", "Qtd.", "Tam.", "Nome do EPI / Uniforme", "C.A.", "Assinatura", "Devolução"]],[span_12](start_span)[span_12](end_span)
        body: bodyData,
        theme: 'grid',
        styles: { 
          font: 'helvetica', 
          fontSize: 7, 
          cellPadding: 2, 
          minCellHeight: 14, // Espaço exato para caber a imagem HD sem estourar
          valign: 'middle' 
        }, 
        headStyles: { 
          fillColor: azulCorporativo, 
          textColor: [255, 255, 255], 
          halign: 'center',
          fontStyle: 'bold'
        },
        columnStyles: { 
          0: { halign: 'center', cellWidth: 20 },
          1: { halign: 'center', cellWidth: 10 },
          2: { halign: 'center', cellWidth: 12 },
          3: { halign: 'left' },
          4: { halign: 'center', cellWidth: 18 },
          5: { halign: 'center', cellWidth: 45 }, // Célula Larga para a Assinatura
          6: { halign: 'center', cellWidth: 20 }
        },
        margin: { top: 20, bottom: 20, left: 15, right: 15 },
        
        // Renderização Dinâmica de Células (Imagens e Textos de Assinatura)
        didDrawCell: (data: any) => {
          if (data.column.index === 5 && data.cell.section === 'body') {
            const rowIndex = data.row.index;
            const assinatura = entregasProcessadas[rowIndex].assinatura;
            
            if (assinatura && assinatura.startsWith('data:image')) {
              try {
                // Cálculo matemático para centralizar a imagem perfeitamente na célula
                const imgWidth = 40;
                const imgHeight = 11;
                const xPos = data.cell.x + (data.cell.width - imgWidth) / 2;
                const yPos = data.cell.y + (data.cell.height - imgHeight) / 2;
                
                doc.addImage(assinatura, 'JPEG', xPos, yPos, imgWidth, imgHeight);
              } catch(e) {
                console.error("Falha ao desenhar assinatura", e);
              }
            } else if (assinatura === 'ASSINATURA DIGITAL (SÓCIO)') {
              doc.setFontSize(6.5);
              doc.setTextColor(16, 185, 129); // Verde Sólido
              doc.setFont("helvetica", "bold");
              doc.text("ASSINATURA ELETRÔNICA (SÓCIO)", data.cell.x + (data.cell.width / 2), data.cell.y + (data.cell.height / 2) + 2, { align: 'center' });
              doc.setTextColor(0, 0, 0); 
            } else if (assinatura) {
              doc.setFontSize(6.5);
              doc.setFont("helvetica", "italic");
              doc.text("Registro Manual", data.cell.x + (data.cell.width / 2), data.cell.y + (data.cell.height / 2) + 2, { align: 'center' });
            }
          }
        },
        
        // Desenha Cabeçalho Superior e Numeração de Página em cada quebra de folha
        didDrawPage: (data: any) => {
          const str = `Página ${doc.internal.getNumberOfPages()}`;
          doc.setFontSize(7);
          doc.setTextColor(100);
          doc.text(`Impresso pelo Sistema de Gestão de EPIs em ${new Date().toLocaleString('pt-BR')}`, data.settings.margin.left, doc.internal.pageSize.height - 10);
          doc.text(str, doc.internal.pageSize.width - data.settings.margin.right, doc.internal.pageSize.height - 10, { align: 'right' });
        }
      });

      // --- 5. EXPORTAÇÃO ---
      const nomeArquivo = `Ficha_EPI_${funcionario.nome.split(' ')[0]}_${mesRef}-${anoRef}.pdf`;
      doc.save(nomeArquivo);
      avisar("Ficha Corporativa de EPI gerada com sucesso!");
      onClose();
      
    } catch (e) {
      console.error(e);
      avisar("Ocorreu um erro interno ao compilar o documento.", "erro");
    }
    setGerando(false);
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.9)', zIndex: 12000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
      <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '24px', width: '90%', maxWidth: '400px', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '-10px' }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', transition: '0.2s' }}><X size={24}/></button>
        </div>

        <div style={{ backgroundColor: '#f0fdf4', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', border: '1px solid #bbf7d0' }}>
          <FileText size={28} color="#10b981" />
        </div>
        
        <h2 style={{ fontSize: '20px', color: '#1e293b', margin: '0 0 10px 0', fontWeight: '800' }}>Ficha de EPI Mensal</h2>
        <p style={{ color: '#64748b', fontSize: '13.5px', marginBottom: '25px', lineHeight: '1.5' }}>
          Gerar documento oficial corporativo de Controle de EPIs para <strong>{funcionario.nome}</strong>.
        </p>

        {/* CONTROLES DE FILTRO */}
        <div style={{ marginBottom: '25px', textAlign: 'left', backgroundColor: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <Calendar size={16} color="#3b82f6" /> Selecionar Mês de Referência
          </label>
          <input 
            type="month" 
            value={mesReferencia}
            onChange={(e) => setMesReferencia(e.target.value)}
            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '15px', backgroundColor: 'white', color: '#1e293b' }}
          />
        </div>
        
        <Button 
          onClick={gerarPDF} 
          disabled={gerando || entregasProcessadas.length === 0} 
          style={{ width: '100%', height: '50px', backgroundColor: entregasProcessadas.length > 0 ? '#10b981' : '#cbd5e1', display: 'flex', justifyContent: 'center', gap: '8px', fontSize: '15px', fontWeight: 'bold', transition: '0.3s' }}
        >
          <Printer size={20} /> 
          {gerando ? 'Compilando Relatório...' : (entregasProcessadas.length > 0 ? `Exportar Ficha (${entregasProcessadas.length} Registos)` : 'Sem movimentação no período')}
        </Button>
      </div>
    </div>
  );
}

