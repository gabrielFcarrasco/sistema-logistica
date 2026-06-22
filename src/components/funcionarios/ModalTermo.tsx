// src/components/funcionarios/ModalTermo.tsx
import { useState, useEffect, useRef } from 'react';
import jsPDF from "jspdf";
import logoCarvalho from '../../assets/logopdf.png';
import { X, FileText, PenTool, Printer, Smartphone } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';

interface Props {
  aberto: boolean;
  funcionario: any;
  onClose: () => void;
  avisar: (msg: string, tipo?: 'sucesso' | 'erro') => void;
}

export default function ModalTermo({ aberto, funcionario, onClose, avisar }: Props) {
  const [modo, setModo] = useState<'escolha' | 'assinatura'>('escolha');
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);
  const [funcaoColaborador, setFuncaoColaborador] = useState('Ajudante de Pintor');
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const desenhandoRef = useRef(false);

  useEffect(() => {
    const handleResize = () => setIsPortrait(window.innerHeight > window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const setupCanvas = () => {
    if (!canvasRef.current || modo !== 'assinatura' || isPortrait) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    setTimeout(() => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    }, 100);

    const getPos = (e: any) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const start = (e: any) => { e.preventDefault(); ctx.beginPath(); ctx.moveTo(getPos(e).x, getPos(e).y); desenhandoRef.current = true; };
    const move = (e: any) => { if (!desenhandoRef.current) return; e.preventDefault(); ctx.lineTo(getPos(e).x, getPos(e).y); ctx.stroke(); };
    const stop = () => { desenhandoRef.current = false; };

    canvas.addEventListener('mousedown', start); canvas.addEventListener('mousemove', move); window.addEventListener('mouseup', stop);
    canvas.addEventListener('touchstart', start, { passive: false }); canvas.addEventListener('touchmove', move, { passive: false }); window.addEventListener('touchend', stop);
    
    return () => {
      canvas.removeEventListener('mousedown', start); canvas.removeEventListener('mousemove', move); window.removeEventListener('mouseup', stop);
      canvas.removeEventListener('touchstart', start); canvas.removeEventListener('touchmove', move); window.removeEventListener('touchend', stop);
    };
  };

  useEffect(() => { setupCanvas(); }, [modo, isPortrait]);

  const limparCanvas = () => {
    const canvas = canvasRef.current; const ctx = canvas?.getContext('2d');
    if (ctx && canvas) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); desenhandoRef.current = false; }
  };

  const registrarLogTermo = async (tipo: 'digital' | 'impresso') => {
    try {
      await addDoc(collection(db, 'termos_gerados'), {
        funcionarioId: funcionario.id,
        funcionarioNome: funcionario.nome,
        funcao: funcaoColaborador,
        tipoDocumento: 'termo_compromisso',
        metodo: tipo,
        dataGeracao: serverTimestamp()
      });
    } catch (e) {
      console.error("Erro ao registrar log do termo", e);
    }
  };

  const gerarPDF = async (assinaturaBase64: string | null) => {
    if (!funcionario) return;

    const doc = new jsPDF('p', 'mm', 'a4');
    const margemEsq = 15;
    const larguraMax = 180;
    
    // Começamos o documento mais acima para poupar espaço
    let y = 12; 

    // Função que quebra a linha com a nova dimensão compactada
    const escreverTexto = (texto: string, tamanhoFonte: number, estilo: 'normal' | 'bold', avancoY: number) => {
      doc.setFont("helvetica", estilo); 
      doc.setFontSize(tamanhoFonte);
      const linhas = doc.splitTextToSize(texto, larguraMax);
      doc.text(linhas, margemEsq, y);
      y += (linhas.length * avancoY);
    };

    // LOGO CENTRALIZADA
    try { doc.addImage(logoCarvalho, 'PNG', 85, y, 40, 14); } catch(e){}
    y += 18;

    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(30, 41, 59);
    doc.text("TERMO DE CIÊNCIA E COMPROMISSO TRABALHISTA", 105, y, { align: 'center' });
    y += 6;
    doc.setFontSize(9);
    doc.text("CARVALHO FUNILARIA E PINTURAS LTDA", 105, y, { align: 'center' });
    y += 12;

    doc.setTextColor(0, 0, 0);
    const cpf = funcionario.cpf && funcionario.cpf !== '' ? funcionario.cpf : '___________________';

    // Fonte de 8.5 para o corpo de texto caber perfeitamente
    escreverTexto(`Eu, ${funcionario.nome.toUpperCase()}, portador do CPF nº ${cpf}, na qualidade de empregado contratado para exercer a função de ${funcaoColaborador}, declaro por meio deste termo que estou plenamente ciente, de acordo e me comprometo a cumprir integralmente as condições de trabalho e diretrizes operacionais estabelecidas a seguir:`, 8.5, 'normal', 4);
    y += 4;

    escreverTexto("1. JORNADA DE TRABALHO E HORÁRIOS", 9.5, 'bold', 5);
    escreverTexto("• Carga Horária: Cumprirei uma jornada regular de 44 horas semanais, no sistema de escala 5x2 (de segunda a sexta-feira).", 8.5, 'normal', 4);
    escreverTexto("• Horário de Expediente: Das 08h00 às 17h48, com 1 (uma) hora de intervalo destinada à refeição e descanso, preferencialmente das 12h00 às 13h00.", 8.5, 'normal', 4);
    escreverTexto("• Compensação de Sábados: Declaro ciência de que a jornada diária já contempla a compensação dos sábados, não havendo expediente regular neste dia.", 8.5, 'normal', 4);
    y += 2;

    escreverTexto("2. CRONOGRAMA DE PAGAMENTOS", 9.5, 'bold', 5);
    escreverTexto("• Adiantamento Salarial (\"Vale\"): Estou ciente de que o adiantamento salarial mensal será efetuado pela empresa até o dia 20 (vinte) do próprio mês.", 8.5, 'normal', 4);
    escreverTexto("• Saldo de Salário: O pagamento do saldo restante será quitado impreterivelmente até o 5° (quinto) dia útil do mês subsequente.", 8.5, 'normal', 4);
    y += 2;

    escreverTexto("3. BENEFÍCIOS E DECLARAÇÃO DE INEXISTÊNCIA", 9.5, 'bold', 5);
    escreverTexto("• Vale-Transporte: Receberei o benefício estritamente para locomoção residência-trabalho, com créditos no dia 1º de cada mês, autorizando o desconto legal de 6% sobre o meu salário base.", 8.5, 'normal', 4);
    escreverTexto("• Inexistência de Outros Benefícios: Declaro estar ciente de que a empregadora não fornece e não está obrigada a fornecer Vale-Refeição (VR), Vale-Alimentação (VA), Plano de Saúde ou Assistência Médica/Odontológica.", 8.5, 'normal', 4);
    y += 2;

    escreverTexto("4. PRESTAÇÃO DE SERVIÇOS PONTUAIS (HYUNDAI ROTEM)", 9.5, 'bold', 5);
    escreverTexto("Estou ciente de que, em momentos pontuais (quando não houver demanda na minha função principal), poderei ser designado para prestar serviços nas dependências da empresa Hyundai Rotem.", 8.5, 'normal', 4);
    escreverTexto("• Escopo da Atividade: Auxiliar com serviços de limpeza, desmontagem e apoios gerais, preferencialmente, mas não se limitando aos processos iniciais da manutenção.", 8.5, 'normal', 4);
    escreverTexto("• Limitações Operacionais: Vedada a atuação direta ou autônoma em processos que necessitem de especialização técnica. Contudo, poderei atuar como apoio inclusive nas etapas finais da manutenção.", 8.5, 'normal', 4);
    escreverTexto("• Ausência de Subordinação Direta: Reconheço que a comunicação e a designação de atividades ocorrerão exclusivamente através do meu Líder da CARVALHO FUNILARIA E PINTURAS LTDA. Declaro não possuir qualquer subordinação hierárquica ou disciplinar com a Hyundai Rotem, mantendo meu vínculo empregatício intacto apenas com a minha empregadora.", 8.5, 'normal', 4);
    y += 2;

    escreverTexto("5. SEGURANÇA DO TRABALHO E PROTEÇÃO (NR-6)", 9.5, 'bold', 5);
    escreverTexto("• Gestão e Distribuição de EPIs: Estou ciente de que receberei os Equipamentos de Proteção Individual (EPIs) adequados aos riscos das instalações. A retirada e a distribuição direta a mim serão feitas estritamente pelo Líder da Carvalho.", 8.5, 'normal', 4);
    escreverTexto("• Comprovação e Uso Obrigatório: Comprometo-me a utilizar adequadamente os EPIs fornecidos durante todo o período de prestação dos serviços e a assinar regularmente a Ficha de EPI, em estrito cumprimento à Norma Regulamentadora nº 6 (NR-6), atestando o recebimento e a conformidade da proteção.", 8.5, 'normal', 4);
    
    // Distância exata para o bloco de assinatura caber na mesma página
    y += 20;

    // BLOCO DE ASSINATURA CENTRALIZADO 
    if (assinaturaBase64) {
      try { 
        doc.addImage(assinaturaBase64, 'JPEG', 85, y - 18, 40, 18); 
      } catch(e){}
    }
    
    doc.setLineWidth(0.5); 
    doc.line(65, y, 145, y); 
    
    doc.setFont("helvetica", "bold"); 
    doc.setFontSize(9);
    doc.text("Assinatura do Colaborador", 105, y + 4, { align: 'center' });
    
    doc.setFont("helvetica", "normal");
    doc.text(`Nome: ${funcionario.nome}`, 105, y + 9, { align: 'center' });
    if (funcionario.cpf) {
      doc.text(`CPF: ${funcionario.cpf}`, 105, y + 14, { align: 'center' });
    }

    await registrarLogTermo(assinaturaBase64 ? 'digital' : 'impresso');

    const dataArquivo = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
    doc.save(`Termo_Compromisso_${funcionario.nome.split(' ')[0]}_${dataArquivo}.pdf`);
    
    avisar("Documento gerado e registado com sucesso!");
    fecharModal();
  };

  const handleAssinaturaConfirmada = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      gerarPDF(canvas.toDataURL('image/jpeg', 0.8));
    }
  };

  const fecharModal = () => {
    setModo('escolha');
    onClose();
  };

  if (!aberto || !funcionario) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.9)', zIndex: 12000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      
      {modo === 'escolha' && (
        <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '24px', width: '90%', maxWidth: '400px', textAlign: 'center' }}>
          <div style={{ backgroundColor: '#f0f9ff', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <FileText size={30} color="#0ea5e9" />
          </div>
          <h2 style={{ fontSize: '20px', color: '#1e293b', margin: '0 0 10px 0' }}>Termo de Compromisso</h2>
          <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px', lineHeight: '1.5' }}>
            Gerar documento para o colaborador <strong>{funcionario.nome}</strong>
          </p>

          <div style={{ marginBottom: '25px', textAlign: 'left' }}>
            <Input 
              label="Função / Cargo do Colaborador" 
              value={funcaoColaborador} 
              onChange={e => setFuncaoColaborador(e.target.value)} 
            />
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Button onClick={() => setModo('assinatura')} style={{ backgroundColor: '#10b981', display: 'flex', justifyContent: 'center', gap: '8px' }}>
              <PenTool size={18} /> Assinar Digitalmente Agora
            </Button>
            <Button onClick={() => gerarPDF(null)} style={{ backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', display: 'flex', justifyContent: 'center', gap: '8px' }}>
              <Printer size={18} /> Gerar PDF em Branco (Imprimir)
            </Button>
            <button onClick={fecharModal} style={{ marginTop: '10px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontWeight: 'bold' }}>Cancelar</button>
          </div>
        </div>
      )}

      {modo === 'assinatura' && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'white', display: 'flex', flexDirection: 'column' }}>
          {isPortrait ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e293b', color: 'white', padding: '20px', textAlign: 'center' }}>
              <Smartphone size={70} style={{ marginBottom: '20px', transform: 'rotate(-90deg)', color: '#0ea5e9' }} />
              <h2>Vire o Aparelho</h2>
              <p style={{ color: '#cbd5e1', maxWidth: '300px' }}>Para recolher a assinatura no formato perfeito para o documento, coloque o aparelho na <strong>horizontal</strong>.</p>
              <Button onClick={() => setModo('escolha')} style={{ backgroundColor: '#475569', marginTop: '20px' }}>Voltar</Button>
            </div>
          ) : (
            <>
              <div style={{ padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <h2 style={{ fontSize: '18px', margin: 0, color: '#1e293b' }}>Assinatura: {funcionario.nome}</h2>
                <button onClick={() => setModo('escolha')} style={{ background: '#e2e8f0', border: 'none', borderRadius: '50%', padding: '8px', cursor: 'pointer' }}><X size={20}/></button>
              </div>

              <div style={{ flex: 1, position: 'relative', touchAction: 'none' }}>
                <canvas ref={canvasRef} style={{ width: '100%', height: '100%', cursor: 'crosshair', display: 'block' }} />
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', opacity: 0.1, textAlign: 'center' }}>
                  <PenTool size={60} style={{ margin: '0 auto' }} />
                  <p style={{ fontSize: '18px', fontWeight: 'bold' }}>Assine Aqui</p>
                </div>
              </div>

              <div style={{ padding: '15px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '15px', backgroundColor: '#f8fafc' }}>
                <Button onClick={limparCanvas} style={{ flex: 1, backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}>Limpar</Button>
                <Button onClick={handleAssinaturaConfirmada} style={{ flex: 2, backgroundColor: '#10b981', fontWeight: 'bold' }}>Salvar e Gerar PDF</Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}