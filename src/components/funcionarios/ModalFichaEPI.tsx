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
  estoque?: any[]; 
  onClose: () => void;
  avisar: (msg: string, tipo?: 'sucesso' | 'erro') => void;
}

export default function ModalFichaEPI({ aberto, funcionario, entregas, estoque = [], onClose, avisar }: Props) {
  const [gerando, setGerando] = useState(false);

  const dataAtual = new Date();
  const mesAtualFormatado = `${dataAtual.getFullYear()}-${String(dataAtual.getMonth() + 1).padStart(2, '0')}`;
  const [mesReferencia, setMesReferencia] = useState(mesAtualFormatado);

  const entregasProcessadas = useMemo(() => {
    if (!entregas || entregas.length === 0) return [];

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

    filtradas.sort((a, b) => {
      const dataA = a.dataHora?.toMillis ? a.dataHora.toMillis() : new Date(a.dataHora).getTime();
      const dataB = b.dataHora?.toMillis ? b.dataHora.toMillis() : new Date(b.dataHora).getTime();
      return dataA - dataB;
    });

    return filtradas.map(ent => {
      const itemEstoque = estoque.find(item => item.id === ent.itemId) || 
                          estoque.find(item => item.nome?.toLowerCase().trim() === ent.itemNome?.toLowerCase().trim());
      
      const caAtualizado = itemEstoque?.ca || itemEstoque?.CA || itemEstoque?.certificado || ent.ca || 'N/A';
      return { ...ent, caAtualizado };
    });
  }, [entregas, mesReferencia, estoque]);

  if (!aberto || !funcionario) return null;

  const gerarPDF = () => {
    setGerando(true);
    
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const azulCorporativo = [30, 41, 59];
      const cinzaBorda = [203, 213, 225];
      let startYTable = 0;

      // 1. CABEÇALHO (Otimizado para poupar espaço)
      try { doc.addImage(logoCarvalho, 'PNG', 12, 8, 30, 8); } catch(e){}
      
      doc.setFont("helvetica", "bold"); 
      doc.setFontSize(12); // Reduzido ligeiramente
      doc.setTextColor(azulCorporativo[0], azulCorporativo[1], azulCorporativo[2]);
      doc.text("FICHA DE CONTROLE DE FORNECIMENTO", 105, 12, { align: 'center' });
      
      doc.setFontSize(8); // Reduzido ligeiramente
      doc.text("EQUIPAMENTOS DE PROTEÇÃO INDIVIDUAL E UNIFORMES", 105, 16, { align: 'center' });
      
      doc.setLineWidth(0.4); 
      doc.setDrawColor(azulCorporativo[0], azulCorporativo[1], azulCorporativo[2]);
      doc.line(12, 19, 198, 19); // Ampliado para as margens totais

      // 2. IDENTIFICAÇÃO DO COLABORADOR (Caixa mais compacta)
      doc.setFillColor(248, 250, 252); 
      doc.setDrawColor(cinzaBorda[0], cinzaBorda[1], cinzaBorda[2]);
      doc.rect(12, 22, 186, 15, "FD"); // Altura reduzida de 20 para 15
      
      doc.setFontSize(7.5); 
      doc.setTextColor(0, 0, 0);
      
      doc.setFont("helvetica", "bold"); doc.text("Colaborador:", 15, 27);
      doc.setFont("helvetica", "normal"); doc.text((funcionario.nome || "NÃO INFORMADO").toUpperCase(), 38, 27);
      
      doc.setFont("helvetica", "bold"); doc.text("Cargo / Função:", 15, 33);
      doc.setFont("helvetica", "normal"); doc.text((funcionario.funcao || "NÃO INFORMADO").toUpperCase(), 40, 33);
      
      const [anoRef, mesRef] = mesReferencia.split('-');
      doc.setFont("helvetica", "bold"); doc.text("CPF:", 135, 27);
      doc.setFont("helvetica", "normal"); doc.text(funcionario.cpf || "NÃO INFORMADO", 145, 27);

      doc.setFont("helvetica", "bold"); doc.text("Ref:", 175, 27);
      doc.setFont("helvetica", "normal"); doc.text(`${mesRef}/${anoRef}`, 183, 27);

      doc.setFont("helvetica", "bold"); doc.text("Matrícula:", 135, 33);
      doc.setFont("helvetica", "normal"); doc.text(funcionario.matricula || "NÃO INFORMADO", 152, 33);

      // 3. TERMOS DE RESPONSABILIDADE (Fontes menores e linhas mais próximas)
      let yText = 41; 
      doc.setFontSize(7);
      
      doc.setFont("helvetica", "bold"); 
      doc.text("Declaro:", 12, yText); yText += 3.5;
      doc.setFont("helvetica", "normal");
      const termoPrincipal = "Declaro ter recebido da Carvalho Pintura e Montagem, os equipamentos de proteção individual abaixo, fornecidos gratuitamente, para meu uso, de acordo com as normas de segurança. Comprometo-me a utilizá-los apenas para a finalidade a que se destinam e a conservá-los em perfeito estado, realizando a higienização quando necessário, e reportando ao responsável qualquer dano ou extravio.";
      const linhasTermo = doc.splitTextToSize(termoPrincipal, 186);
      doc.text(linhasTermo, 12, yText, { align: 'justify' }); 
      yText += (linhasTermo.length * 3) + 2; // Espaçamento de entrelinha otimizado

      doc.setFont("helvetica", "bold"); 
      doc.text("ESTOU CIENTE:", 12, yText); yText += 3.5;
      doc.setFont("helvetica", "normal");
      
      const cientes = [
        "1. Que o não fornecimento do EPI ou a recusa em utilizá-lo conforme normas (NR-06/NR-18) resultará em penalidades.",
        "2. Da importância dos EPI's, cuja não utilização pode implicar riscos diretos à saúde e segurança.",
        "3. Que a utilização dos EPI's não desobriga o cumprimento das obrigações de prevenção de acidentes vigentes."
      ]; // Textos levemente resumidos para salvar espaço vertical sem perder o valor jurídico

      cientes.forEach(item => {
        const linhas = doc.splitTextToSize(item, 186);
        doc.text(linhas, 12, yText, { align: 'justify' });
        yText += (linhas.length * 3) + 1;
      });

      startYTable = yText + 3;

      // 4. TABELA INTELIGENTE (Com prevenção de quebra e margens expandidas)
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
          ent.caAtualizado, 
          '', 
          ent.dataDevolucao || '-'
        ];
      });

      autoTablePlugin(doc, {
        startY: startYTable,
        head: [["Data Entrega", "Qtd", "Tam.", "Nome do EPI / Uniforme", "C.A.", "Assinatura", "Devolução"]],
        body: bodyData,
        theme: 'grid',
        rowPageBreak: 'avoid', // <-- DOCUMENTAÇÃO: Esta linha previne que a assinatura seja cortada ao meio!
        styles: { 
          font: 'helvetica', 
          fontSize: 7, // Fonte menor para caber mais itens
          cellPadding: 1.5, 
          minCellHeight: 12, // Altura exata para a assinatura
          valign: 'middle' 
        }, 
        headStyles: { 
          fillColor: azulCorporativo, 
          textColor: [255, 255, 255], 
          halign: 'center',
          fontStyle: 'bold'
        },
        columnStyles: { 
          0: { halign: 'center', cellWidth: 18 },
          1: { halign: 'center', cellWidth: 8 },
          2: { halign: 'center', cellWidth: 10 },
          3: { halign: 'left' },
          4: { halign: 'center', cellWidth: 16 },
          5: { halign: 'center', cellWidth: 38 }, 
          6: { halign: 'center', cellWidth: 16 }
        },
        margin: { top: 15, bottom: 20, left: 12, right: 12 }, // DOCUMENTAÇÃO: Margem inferior segura para proteger o rodapé
        
        didDrawCell: (data: any) => {
          if (data.column.index === 5 && data.cell.section === 'body') {
            const rowIndex = data.row.index;
            const assinatura = entregasProcessadas[rowIndex].assinatura;
            
            if (typeof assinatura === 'string' && assinatura.includes('data:image')) {
              try {
                // Posicionamento perfeitamente centralizado usando a largura/altura matemática da célula
                const imgWidth = 34;
                const imgHeight = 9;
                const xPos = data.cell.x + (data.cell.width - imgWidth) / 2;
                const yPos = data.cell.y + (data.cell.height - imgHeight) / 2;
                
                doc.addImage(assinatura, 'JPEG', xPos, yPos, imgWidth, imgHeight);
              } catch(e) {
                doc.setFontSize(5);
                doc.text("Erro na Imagem", data.cell.x + (data.cell.width / 2), data.cell.y + 6, { align: 'center' });
              }
            } else if (assinatura === 'ASSINATURA DIGITAL (SÓCIO)') {
              doc.setFontSize(5.5);
              doc.setTextColor(16, 185, 129);
              doc.setFont("helvetica", "bold");
              doc.text("AUTORIZADO ELETRONICAMENTE", data.cell.x + (data.cell.width / 2), data.cell.y + 6, { align: 'center' });
              doc.setTextColor(0, 0, 0); 
            } else if (assinatura) {
              doc.setFontSize(6);
              doc.setFont("helvetica", "italic");
              doc.text("Registro Manual/Externo", data.cell.x + (data.cell.width / 2), data.cell.y + 6, { align: 'center' });
            }
          }
        },
        
        // 5. RODAPÉ DE PÁGINA (Protegido pela margem inferior de 20mm)
        didDrawPage: (data: any) => {
          const str = `Página ${doc.internal.getNumberOfPages()}`;
          doc.setFontSize(6.5);
          doc.setTextColor(120);
          doc.text(`Impresso pelo Sistema de Gestão em ${new Date().toLocaleString('pt-BR')}`, data.settings.margin.left, doc.internal.pageSize.height - 10);
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