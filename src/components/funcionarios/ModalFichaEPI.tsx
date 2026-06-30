// src/components/funcionarios/ModalFichaEPI.tsx
import { useState, useMemo } from 'react';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoCarvalho from '../../assets/logopdf.png';
import { FileText, Printer, X, Calendar } from 'lucide-react';
import Button from '../ui/Button';

interface Props {
  aberto: boolean;
  funcionario: any;
  entregas: any[];
  estoque?: any[]; // Propriedade crucial para buscar o C.A.
  onClose: () => void;
  avisar: (msg: string, tipo?: 'sucesso' | 'erro') => void;
}

export default function ModalFichaEPI({ aberto, funcionario, entregas, estoque = [], onClose, avisar }: Props) {
  const [gerando, setGerando] = useState(false);

  // Mês padrão: Mês corrente
  const dataAtual = new Date();
  const mesAtualFormatado = `${dataAtual.getFullYear()}-${String(dataAtual.getMonth() + 1).padStart(2, '0')}`;
  const [mesReferencia, setMesReferencia] = useState(mesAtualFormatado);

  // ⚙️ MOTOR DE PROCESSAMENTO E CRUZAMENTO DE DADOS
  const entregasProcessadas = useMemo(() => {
    if (!entregas || entregas.length === 0) return [];

    // 1. Filtra apenas as entregas do mês e ano selecionados
    const filtradas = entregas.filter(ent => {
      if (!ent.dataHora) return false;
      try {
        const dataEpi = ent.dataHora.toDate ? ent.dataHora.toDate() : new Date(ent.dataHora);
        const mesEpi = String(dataEpi.getMonth() + 1).padStart(2, '0');
        const anoEpi = dataEpi.getFullYear();
        return `${anoEpi}-${mesEpi}` === mesReferencia;
      } catch (e) {
        return false;
      }
    });

    // 2. Ordenação Cronológica Absoluta (Dia 1 -> 31)
    filtradas.sort((a, b) => {
      const dataA = a.dataHora?.toMillis ? a.dataHora.toMillis() : new Date(a.dataHora).getTime();
      const dataB = b.dataHora?.toMillis ? b.dataHora.toMillis() : new Date(b.dataHora).getTime();
      return dataA - dataB;
    });

    // 3. Cruzamento de C.A. Diretamente no Estoque (Tempo Real)
    return filtradas.map(ent => {
      // Tenta achar pelo ID primeiro, se falhar, tenta achar pelo Nome exato
      const itemEstoque = estoque.find(item => item.id === ent.itemId) || 
                          estoque.find(item => item.nome?.toLowerCase().trim() === ent.itemNome?.toLowerCase().trim());
      
      // Prioridade 1: CA do Estoque | Prioridade 2: CA da Entrega | Prioridade 3: 'N/A'
      const caAtualizado = itemEstoque?.ca || itemEstoque?.CA || itemEstoque?.certificado || ent.ca || 'N/A';
      
      return { ...ent, caAtualizado };
    });
  }, [entregas, mesReferencia, estoque]);

  if (!aberto || !funcionario) return null;

  // 📄 GERADOR DO PDF CORPORATIVO
  const gerarPDF = () => {
    setGerando(true);
    
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const azulCorporativo = [30, 41, 59];
      const cinzaBorda = [203, 213, 225];
      let startYTable = 0;

      // --- 1. CABEÇALHO ---
      try { doc.addImage(logoCarvalho, 'PNG', 15, 10, 35, 10); } catch(e){}
      
      doc.setFont("helvetica", "bold"); 
      doc.setFontSize(14); 
      doc.setTextColor(azulCorporativo[0], azulCorporativo[1], azulCorporativo[2]);
      doc.text("FICHA DE CONTROLE DE FORNECIMENTO", 105, 14, { align: 'center' });
      
      doc.setFontSize(10);
      doc.text("EQUIPAMENTOS DE PROTEÇÃO INDIVIDUAL E UNIFORMES", 105, 19, { align: 'center' });
      
      doc.setLineWidth(0.4); 
      doc.setDrawColor(azulCorporativo[0], azulCorporativo[1], azulCorporativo[2]);
      doc.line(15, 23, 195, 23);

      // --- 2. IDENTIFICAÇÃO DO COLABORADOR ---
      doc.setFillColor(248, 250, 252); 
      doc.setDrawColor(cinzaBorda[0], cinzaBorda[1], cinzaBorda[2]);
      doc.rect(15, 26, 180, 20, "FD");
      
      doc.setFontSize(8); 
      doc.setTextColor(0, 0, 0);
      
      doc.setFont("helvetica", "bold"); doc.text("Nome do Funcionário:", 18, 32);
      doc.setFont("helvetica", "normal"); doc.text((funcionario.nome || "NÃO INFORMADO").toUpperCase(), 50, 32);
      
      doc.setFont("helvetica", "bold"); doc.text("Cargo / Função:", 18, 38);
      doc.setFont("helvetica", "normal"); doc.text((funcionario.funcao || "NÃO INFORMADO").toUpperCase(), 42, 38);
      
      doc.setFont("helvetica", "bold"); doc.text("CPF:", 18, 44);
      doc.setFont("helvetica", "normal"); doc.text(funcionario.cpf || "NÃO INFORMADO", 26, 44);

      const [anoRef, mesRef] = mesReferencia.split('-');
      doc.setFont("helvetica", "bold"); doc.text("Mês de Referência:", 130, 32);
      doc.setFont("helvetica", "normal"); doc.text(`${mesRef}/${anoRef}`, 158, 32);

      doc.setFont("helvetica", "bold"); doc.text("Registro / Matrícula:", 130, 38);
      doc.setFont("helvetica", "normal"); doc.text(funcionario.matricula || "NÃO INFORMADO", 160, 38);

      // --- 3. TERMOS DE RESPONSABILIDADE ---
      let yText = 50; // Ajustado milimetricamente para não sobrepor a tabela
      doc.setFontSize(7.5);
      
      doc.setFont("helvetica", "bold"); 
      doc.text("Declaro:", 15, yText); yText += 4;
      doc.setFont("helvetica", "normal");
      const termoPrincipal = "Declaro ter recebido da Carvalho Pintura e Montagem, os equipamentos de proteção individual abaixo, fornecidos gratuitamente, para meu uso, de acordo com as normas de segurança. Comprometo-me a utilizá-los apenas para a finalidade a que se destinam e a conservá-los em perfeito estado, realizando a higienização quando necessário, e reportando ao responsável qualquer dano ou extravio.";
      const linhasTermo = doc.splitTextToSize(termoPrincipal, 180);
      doc.text(linhasTermo, 15, yText, { align: 'justify' }); 
      yText += (linhasTermo.length * 3.5) + 3;

      doc.setFont("helvetica", "bold"); 
      doc.text("ESTOU CIENTE:", 15, yText); yText += 4;
      doc.setFont("helvetica", "normal");
      
      const cientes = [
        "1. Que o não fornecimento do EPI ou a recusa em utilizá-lo de acordo com as orientações da empresa e da legislação (NR-06 e NR-18), bem como outras NRs, poderá resultar em Penalidades.",
        "2. Do recebimento gratuito e da importância dos EPI's fornecidos pela empresa, cuja não utilização pode implicar riscos à saúde e segurança.",
        "3. Dos equipamentos fornecidos pela empresa.",
        "4. Que a utilização dos EPI's não desobriga o cumprimento das normas, deveres e obrigações de prevenção de acidentes previstas na legislação vigente."
      ];

      cientes.forEach(item => {
        const linhas = doc.splitTextToSize(item, 180);
        doc.text(linhas, 15, yText, { align: 'justify' });
        yText += (linhas.length * 3.5) + 1;
      });

      startYTable = yText + 4;

      // --- 4. TABELA INTELIGENTE ---
      const autoTablePlugin = typeof autoTable === 'function' ? autoTable : (autoTable as any).default;
      
      const bodyData = entregasProcessadas.map(ent => {
        let dataFormatada = '-';
        try {
          dataFormatada = ent.dataHora?.toDate ? ent.dataHora.toDate().toLocaleDateString('pt-BR') : new Date(ent.dataHora).toLocaleDateString('pt-BR');
        } catch(e) {}

        return [
          dataFormatada,
          `${ent.quantidade}`,
          ent.tamanho || '-',
          ent.itemNome || '-',
          ent.caAtualizado, // C.A. Seguro que puxa do Estoque
          '', // Célula para a imagem
          ent.dataDevolucao || '-'
        ];
      });

      autoTablePlugin(doc, {
        startY: startYTable,
        head: [["Data Entrega", "Qtd", "Tam.", "Nome do EPI / Uniforme", "C.A.", "Assinatura", "Devolução"]],
        body: bodyData,
        theme: 'grid',
        styles: { 
          font: 'helvetica', 
          fontSize: 7.5, 
          cellPadding: 2, 
          minCellHeight: 14, // Espaço exato para caber a imagem sem estragar o layout
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
          5: { halign: 'center', cellWidth: 42 }, // Coluna para a Assinatura Base64
          6: { halign: 'center', cellWidth: 18 }
        },
        margin: { top: 20, bottom: 20, left: 15, right: 15 },
        
        didDrawCell: (data: any) => {
          // Quando for a coluna da assinatura (Índice 5) e for o corpo da tabela
          if (data.column.index === 5 && data.cell.section === 'body') {
            const rowIndex = data.row.index;
            const assinatura = entregasProcessadas[rowIndex].assinatura;
            
            // SE FOR IMAGEM DE ASSINATURA DESENHADA
            if (typeof assinatura === 'string' && assinatura.includes('data:image')) {
              try {
                // Cálculo de Geometria: Centralizar a imagem exatemente no meio da célula
                const imgWidth = 38;
                const imgHeight = 10;
                const xPos = data.cell.x + (data.cell.width - imgWidth) / 2;
                const yPos = data.cell.y + (data.cell.height - imgHeight) / 2;
                
                doc.addImage(assinatura, 'JPEG', xPos, yPos, imgWidth, imgHeight);
              } catch(e) {
                // SISTEMA ANTI-CRASH: Se a imagem estiver corrompida, não bloqueia o PDF
                doc.setFontSize(6);
                doc.text("Erro na Imagem", data.cell.x + (data.cell.width / 2), data.cell.y + 7, { align: 'center' });
              }
            } 
            // SE FOR ASSINATURA DE SÓCIO
            else if (assinatura === 'ASSINATURA DIGITAL (SÓCIO)') {
              doc.setFontSize(6);
              doc.setTextColor(16, 185, 129); // Cor verde para dar credibilidade
              doc.setFont("helvetica", "bold");
              doc.text("AUTORIZADO ELETRONICAMENTE", data.cell.x + (data.cell.width / 2), data.cell.y + 7, { align: 'center' });
              doc.setTextColor(0, 0, 0); 
            } 
            // SE FOR REGISTO MANUAL ANTIGO
            else if (assinatura) {
              doc.setFontSize(6);
              doc.setFont("helvetica", "italic");
              doc.text("Registro Manual/Externo", data.cell.x + (data.cell.width / 2), data.cell.y + 7, { align: 'center' });
            }
          }
        },
        
        // --- 5. RODAPÉ DE PÁGINA ---
        didDrawPage: (data: any) => {
          const str = `Página ${doc.internal.getNumberOfPages()}`;
          doc.setFontSize(7);
          doc.setTextColor(100);
          doc.text(`Impresso pelo Sistema de Gestão de EPIs em ${new Date().toLocaleString('pt-BR')}`, data.settings.margin.left, doc.internal.pageSize.height - 10);
          doc.text(str, doc.internal.pageSize.width - data.settings.margin.right, doc.internal.pageSize.height - 10, { align: 'right' });
        }
      });

      const nomeArquivo = `Ficha_EPI_${funcionario.nome.split(' ')[0]}_${mesRef}-${anoRef}.pdf`;
      doc.save(nomeArquivo);
      avisar("Ficha de EPI Corporativa gerada com sucesso!");
      onClose();
      
    } catch (e) {
      console.error(e);
      avisar("Ocorreu um erro ao compilar o documento PDF.", "erro");
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

        {/* Filtro Mensal */}
        <div style={{ marginBottom: '25px', textAlign: 'left', backgroundColor: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <Calendar size={16} color="#3b82f6" /> Mês de Referência
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
          {gerando ? 'Compilando Relatório...' : (entregasProcessadas.length > 0 ? `Exportar Ficha (${entregasProcessadas.length} Registos)` : 'Sem movimentação neste mês')}
        </Button>
      </div>
    </div>
  );
}
