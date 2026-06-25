// src/components/prestacao-servicos/ModalChecklistJateamento.tsx
import { useState, useEffect, useRef } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { X, ShieldAlert, PenTool, Smartphone, CheckCircle2 } from 'lucide-react';
import Button from '../ui/Button';

interface Props {
  aberto: boolean;
  truque: any;
  funcionarios: any[];
  onClose: () => void;
  avisar: (msg: string, tipo?: 'sucesso' | 'erro') => void;
}

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

export default function ModalChecklistJateamento({ aberto, truque, funcionarios, onClose, avisar }: Props) {
  const [passo, setPasso] = useState(0); // 0: Form, 1: Assina Executante, 2: Assina Vigia
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);
  
  const [respostas, setRespostas] = useState<Record<number, boolean>>({});
  const [executanteId, setExecutanteId] = useState('');
  const [vigiaId, setVigiaId] = useState('');
  
  const [assinaturaExecutante, setAssinaturaExecutante] = useState('');
  const [assinaturaVigia, setAssinaturaVigia] = useState('');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const desenhandoRef = useRef(false);

  useEffect(() => {
    if (aberto && truque) {
      setPasso(0);
      setRespostas({});
      setExecutanteId(truque.colaboradorJateouId && truque.colaboradorJateouId !== 'pendente' ? truque.colaboradorJateouId : '');
      setVigiaId('');
      setAssinaturaExecutante('');
      setAssinaturaVigia('');
    }
  }, [aberto, truque]);

  useEffect(() => {
    const handleResize = () => setIsPortrait(window.innerHeight > window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const setupCanvas = () => {
    if (!canvasRef.current || passo === 0 || isPortrait) return;
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

  useEffect(() => { setupCanvas(); }, [passo, isPortrait]);

  const limparCanvas = () => {
    const canvas = canvasRef.current; const ctx = canvas?.getContext('2d');
    if (ctx && canvas) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); desenhandoRef.current = false; }
  };

  const confirmarAssinatura = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const jpegBase64 = canvas.toDataURL('image/jpeg', 0.8);

    if (passo === 1) {
      setAssinaturaExecutante(jpegBase64);
      setPasso(0); // Volta ao form
    } else if (passo === 2) {
      setAssinaturaVigia(jpegBase64);
      setPasso(0); // Volta ao form
    }
  };

  const finalizarChecklistEAvancar = async () => {
    if (Object.keys(respostas).length < PERGUNTAS_CHECKLIST.length) {
      return avisar("Responda a todos os itens do checklist.", "erro");
    }
    if (!executanteId || !vigiaId) return avisar("Selecione o Executante e o Vigia.", "erro");
    if (!assinaturaExecutante || !assinaturaVigia) return avisar("Faltam recolher as assinaturas.", "erro");

    try {
      const executanteNome = funcionarios.find(f => f.id === executanteId)?.nome || 'Desconhecido';
      const vigiaNome = funcionarios.find(f => f.id === vigiaId)?.nome || 'Desconhecido';

      const checklistData = {
        respostas,
        executanteId, executanteNome, assinaturaExecutante,
        vigiaId, vigiaNome, assinaturaVigia,
        dataPreenchimento: serverTimestamp()
      };

      // Atualiza o Truque com os dados do checklist e avança para Análise de PM
      await updateDoc(doc(db, 'truques_producao', truque.id), { 
        status: 'analisado_pm', 
        dataPM: serverTimestamp(), 
        colaboradorJateouId: executanteId, 
        colaboradorJateouNome: executanteNome,
        checklistJateamento: checklistData
      });
      
      avisar("Checklist salvo e avançado para Análise PM!");
      onClose();
    } catch (e) {
      avisar("Erro ao salvar checklist.", "erro");
    }
  };

  if (!aberto || !truque) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.95)', zIndex: 15000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '10px' }}>
      
      {passo === 0 && (
        <div style={{ backgroundColor: '#f8fafc', width: '100%', maxWidth: '700px', maxHeight: '90vh', borderRadius: '16px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          
          <div style={{ padding: '20px', backgroundColor: '#1e293b', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={20} color="#f59e0b" /> Checklist: Jateamento Aranha
              </h2>
              <span style={{ fontSize: '12px', color: '#cbd5e1' }}>Truque: {truque.identificacao}</span>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X size={24}/></button>
          </div>

          <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569' }}>Executante *</label>
                <select value={executanteId} onChange={e => setExecutanteId(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}>
                  <option value="">Selecione...</option>
                  {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569' }}>Vigia (Segurança) *</label>
                <select value={vigiaId} onChange={e => setVigiaId(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}>
                  <option value="">Selecione...</option>
                  {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              </div>
            </div>

            <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '15px', marginBottom: '25px' }}>
              <h4 style={{ margin: '0 0 15px 0', color: '#1e293b' }}>Itens de Verificação</h4>
              {PERGUNTAS_CHECKLIST.map((perg, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: idx < PERGUNTAS_CHECKLIST.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                  <span style={{ fontSize: '13px', color: '#475569', maxWidth: '75%' }}>{perg}</span>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button onClick={() => setRespostas({...respostas, [idx]: true})} style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer', backgroundColor: respostas[idx] === true ? '#10b981' : '#f1f5f9', color: respostas[idx] === true ? 'white' : '#64748b' }}>SIM</button>
                    <button onClick={() => setRespostas({...respostas, [idx]: false})} style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer', backgroundColor: respostas[idx] === false ? '#ef4444' : '#f1f5f9', color: respostas[idx] === false ? 'white' : '#64748b' }}>NÃO</button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <Button onClick={() => { if(!executanteId) return avisar("Selecione o executante", "erro"); setPasso(1); }} style={{ backgroundColor: assinaturaExecutante ? '#f0fdf4' : '#f8fafc', color: assinaturaExecutante ? '#15803d' : '#1e293b', border: `1px solid ${assinaturaExecutante ? '#86efac' : '#cbd5e1'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                {assinaturaExecutante ? <CheckCircle2 size={18}/> : <PenTool size={18}/>} 
                {assinaturaExecutante ? 'Executante Assinou' : 'Assinar Executante'}
              </Button>

              <Button onClick={() => { if(!vigiaId) return avisar("Selecione o vigia", "erro"); setPasso(2); }} style={{ backgroundColor: assinaturaVigia ? '#f0fdf4' : '#f8fafc', color: assinaturaVigia ? '#15803d' : '#1e293b', border: `1px solid ${assinaturaVigia ? '#86efac' : '#cbd5e1'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                {assinaturaVigia ? <CheckCircle2 size={18}/> : <PenTool size={18}/>} 
                {assinaturaVigia ? 'Vigia Assinou' : 'Assinar Vigia'}
              </Button>
            </div>
          </div>

          <div style={{ padding: '15px', backgroundColor: 'white', borderTop: '1px solid #e2e8f0' }}>
            <Button onClick={finalizarChecklistEAvancar} style={{ width: '100%', height: '50px', backgroundColor: '#f59e0b', fontSize: '15px', fontWeight: 'bold' }}>
              Salvar Checklist e Avançar para PM
            </Button>
          </div>
        </div>
      )}

      {(passo === 1 || passo === 2) && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'white', display: 'flex', flexDirection: 'column' }}>
          {isPortrait ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e293b', color: 'white', padding: '20px', textAlign: 'center' }}>
              <Smartphone size={70} style={{ marginBottom: '20px', transform: 'rotate(-90deg)', color: '#f59e0b' }} />
              <h2>Vire o Aparelho</h2>
              <p style={{ color: '#cbd5e1', maxWidth: '300px' }}>Por favor, coloque o aparelho na <strong>horizontal</strong> para recolher a assinatura.</p>
              <Button onClick={() => setPasso(0)} style={{ backgroundColor: '#475569', marginTop: '20px' }}>Voltar</Button>
            </div>
          ) : (
            <>
              <div style={{ padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <h2 style={{ fontSize: '18px', margin: 0, color: '#1e293b' }}>
                  Assinatura: {passo === 1 ? 'EXECUTANTE' : 'VIGIA'}
                </h2>
                <button onClick={() => setPasso(0)} style={{ background: '#e2e8f0', border: 'none', borderRadius: '50%', padding: '8px', cursor: 'pointer' }}><X size={20}/></button>
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
                <Button onClick={confirmarAssinatura} style={{ flex: 2, backgroundColor: '#10b981', fontWeight: 'bold' }}>Confirmar Assinatura</Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}