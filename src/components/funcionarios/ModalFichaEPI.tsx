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
  onClose: () => void;
  avisar: (msg: string, tipo?: 'sucesso' | 'erro') => void;
}

export default function ModalFichaEPI({ aberto, funcionario, entregas, onClose, avisar }: Props) {
  const [gerando, setGerando] = useState(false);

  // 1. ESTADO: Define o mês atual como padrão (Formato: YYYY-MM)
  const dataAtual = new Date();
  const mesAtualFormatado = `${dataAtual.getFullYear()}-${String(dataAtual.getMonth() + 1).padStart(2, '0')}`;
  const [mesReferencia, setMesReferencia] = useState(mesAtualFormatado);

  // 2. LÓGICA DE FILTRAGEM: Separa apenas as entregas do mês escolhido
  const entregasFiltradas = useMemo(() => {
    if (!entregas) return [];
    
    return entregas.filter(ent => {
      if (!ent.dataHora) return false;
      
      // Converte a data do Firebase (Timestamp) ou de registros antigos para um objeto Date
      const dataEpi = ent.dataHora.toDate ? ent.dataHora.toDate() : new Date(ent.dataHora);
      
      const mesEpi = String(dataEpi.getMonth() + 1).padStart(2, '0');
      const anoEpi = dataEpi.getFullYear();
      const anoMesEpi = `${anoEpi}-${mesEpi}`;
      
      return anoMesEpi === mesReferencia;
    });
  }, [entregas, mesReferencia]);

  if (!aberto || !funcionario) return null;

  // 3. GERAÇÃO DO PDF
  const gerarPDF = () => {
    setGerando(true);
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      let y = 15;

      // --- CABEÇALHO ---
      try { doc.addImage(logoCarvalho, 'PNG', 15, 10, 35, 12); } catch(e){}
      doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(30, 41, 59);
      doc.text("FICHA DE CONTROLE DE FORNECIMENTO", 105, 16, { align: 'center' });
      doc.setFontSize(11);
      doc.text("EQUIPAMENTOS DE PROTEÇÃO INDIVIDUAL E UNIFORMES", 105, 22, { align: 'center' });
      
      doc.setLineWidth(0.5); doc.line(15, 26, 195, 26);
      y = 30;

      // --- DADOS DO FUNCIONÁRIO E MÊS DE REFERÊNCIA ---
      doc.setFillColor(248, 250, 252); doc.setDrawColor(203, 213, 225);
      doc.rect(15, y, 180, 26, "FD"); // Altura ajustada para acomodar o Mês de Referência
      
      doc.setFontSize(9); doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "bold"); doc.text("Nome do Funcionário:", 18, y + 6);
      doc.setFont("helvetica", "normal"); doc.text(funcionario.nome.toUpperCase(), 55, y + 6);
      
      doc.setFont("helvetica", "bold"); doc.text("Cargo / Função:", 18, y + 12);
      doc.setFont("helvetica", "normal"); doc.text(funcionario.funcao || "Não informado", 45, y + 12);

      doc.setFont("helvetica", "bold"); doc.text("Registro / Matrícula:", 120, y + 6);
      doc.setFont("helvetica", "normal"); doc.text(funcionario.matricula || "Não informado", 155, y + 6);

      doc.setFont("helvetica", "bold"); doc.text("CPF:", 120, y + 12);
      doc.setFont("helvetica", "normal"); doc.text(funcionario.cpf || "Não informado", 130, y + 12);
      
      // Impressão do Mês de Referência no PDF
      const [anoRef, mesRef] = mesReferencia.split('-');
      doc.setFont("helvetica", "bold"); doc.text("Mês de Referência:", 18, y + 18);
      doc.setFont("helvetica", "normal"); doc.text(`${mesRef}/${anoRef}`, 50, y + 18);

      y += 32;

      // --- TERMOS DE RESPONSABILIDADE ---
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold"); doc.text("Declaro:", 15, y); y += 4;
      doc.setFont("helvetica", "normal");
      const termo1 = "Declaro ter recebido da Carvalho Pintura e Montagem, os equipamentos de proteção individual abaixo, fornecidos gratuitamente, para meu uso, de acordo com as normas de segurança. Comprometo-me a utilizá-los apenas para a finalidade a que se destinam e a conservá-los em perfeito estado, realizando a higienização quando necessário, e reportando ao responsável qualquer dano ou extravio.";
      const splitTermo1 = doc.splitTextToSize(termo1, 180);
      doc.text(splitTermo1, 15, y); y += (splitTermo1.length * 3.5) + 4;

      doc.setFont("helvetica", "bold"); doc.text("ESTOU CIENTE:", 15, y); y += 4;
      doc.setFont("helvetica", "normal");
      const ciente1 = "1. Que o não fornecimento do EPI ou a recusa em utilizá-lo de acordo com as orientações da empresa e da legislação (NR-06 e NR-18), bem como outras Normas Regulamentadoras, poderá resultar em penalidades.";
      const ciente2 = "2. Do recebimento gratuito e da importância dos EPI's fornecidos pela empresa, cuja não utilização pode implicar riscos à saúde e segurança.";
      const ciente3 = "3. Dos equipamentos fornecidos pela empresa.";
      const ciente4 = "4. Que a utilização dos EPI's não desobriga o cumprimento das normas, deveres e obrigações de prevenção de acidentes previstas na legislação vigente.";
      
      doc.text(doc.splitTextToSize(ciente1, 180), 15, y); y += 7;
      doc.text(doc.splitTextToSize(ciente2, 180), 15, y); y += 7;
      doc.text(doc.splitTextToSize(ciente3, 180), 15, y); y += 4;
      doc.text(doc.splitTextToSize(ciente4, 180), 15, y); y += 8;

      // --- TABELA DE ENTREGAS ---
      const renderTable = typeof autoTable === 'function' ? autoTable : (autoTable as any).default;
      
      const bodyData = entregasFiltradas.map(ent => {
        const dataFormatada = ent.dataHora?.toDate ? ent.dataHora.toDate().toLocaleDateString('pt-BR') : (ent.dataHora || '-');
        return [
          dataFormatada,
          `${ent.quantidade}`,
          ent.tamanho || '-',
          ent.itemNome,
          ent.ca || '-',
          '', // Célula vazia para a assinatura
          ent.dataDevolucao || '-'
        ];
      });

      renderTable(doc, {
        startY: y,
        head: [["Data Entrega", "Qtd", "Tam.", "Nome do EPI / Uniforme", "C.A.", "Assinatura do Colaborador", "Devolução"]],
        body: bodyData,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 2, minCellHeight: 12, valign: 'middle' }, 
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], halign: 'center' },
        columnStyles: { 
          0: { halign: 'center', cellWidth: 20 },
          1: { halign: 'center', cellWidth: 10 },
          2: { halign: 'center', cellWidth: 12 },
          4: { halign: 'center', cellWidth: 15 },
          5: { halign: 'center', cellWidth: 40 }, 
          6: { halign: 'center', cellWidth: 20 }
        },
        didDrawCell: (data: any) => {
          if (data.column.index === 5 && data.cell.section === 'body') {
            const rowIndex = data.row.index;
            const assinatura = entregasFiltradas[rowIndex].assinatura;
            
            if (assinatura && assinatura.startsWith('data:image')) {
              try {
                doc.addImage(assinatura, 'JPEG', data.cell.x + 2, data.cell.y + 1, 36, 10);
              } catch(e) {}
            } else if (assinatura === 'ASSINATURA DIGITAL (SÓCIO)') {
              doc.setFontSize(6);
              doc.setTextColor(16, 185, 129);
              doc.text("SÓCIO AUTORIZADO", data.cell.x + 20, data.cell.y + 7, { align: 'center' });
              doc.setTextColor(0, 0, 0); 
            } else if (assinatura) {
              doc.setFontSize(6);
              doc.text("Registro Manual Antigo", data.cell.x + 20, data.cell.y + 7, { align: 'center' });
            }
          }
        }
      });

      const [anoNome, mesNome] = mesReferencia.split('-');
      doc.save(`Ficha_EPI_${funcionario.nome.split(' ')[0]}_${mesNome}-${anoNome}.pdf`);
      avisar("Ficha de EPI gerada com sucesso!");
      onClose();
    } catch (e) {
      avisar("Erro ao gerar o PDF.", "erro");
    }
    setGerando(false);
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.9)', zIndex: 12000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '24px', width: '90%', maxWidth: '400px', textAlign: 'center' }}>
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '-10px' }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={24}/></button>
        </div>

        <div style={{ backgroundColor: '#f0fdf4', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <FileText size={30} color="#10b981" />
        </div>
        
        <h2 style={{ fontSize: '20px', color: '#1e293b', margin: '0 0 10px 0' }}>Ficha de EPI Mensal</h2>
        <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px', lineHeight: '1.5' }}>
          Gerar ficha de EPIs e Uniformes para <strong>{funcionario.nome}</strong>.
        </p>

        {/* 4. INTERFACE: Seletor de Mês/Ano */}
        <div style={{ marginBottom: '25px', textAlign: 'left', backgroundColor: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <Calendar size={16} color="#3b82f6" /> Selecionar Mês de Referência
          </label>
          <input 
            type="month" 
            value={mesReferencia}
            onChange={(e) => setMesReferencia(e.target.value)}
            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '15px' }}
          />
        </div>
        
        <Button 
          onClick={gerarPDF} 
          disabled={gerando || entregasFiltradas.length === 0} 
          style={{ width: '100%', height: '50px', backgroundColor: entregasFiltradas.length > 0 ? '#10b981' : '#cbd5e1', display: 'flex', justifyContent: 'center', gap: '8px', fontSize: '16px', fontWeight: 'bold' }}
        >
          <Printer size={20} /> 
          {gerando ? 'Gerando PDF...' : (entregasFiltradas.length > 0 ? `Baixar PDF (${entregasFiltradas.length} itens)` : 'Sem entregas neste mês')}
        </Button>
      </div>
    </div>
  );
}