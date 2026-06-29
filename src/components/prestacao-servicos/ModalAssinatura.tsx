// src/components/prestacao-servicos/ModalAssinatura.tsx
import { useEffect, useRef, useState } from 'react';
import { Smartphone, PenTool, X } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';

interface Props {
  aberto: boolean;
  titulo: string;
  isPortrait: boolean;
  onClose: () => void;
  onSave: (base64: string, nomeDigitado: string) => void; 
}

export default function ModalAssinatura({ aberto, titulo, isPortrait, onClose, onSave }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const desenhandoRef = useRef(false);
  
  const [nomeAssinante, setNomeAssinante] = useState('');
  const [etapa, setEtapa] = useState<'pedirNome' | 'desenhar'>('pedirNome');

  useEffect(() => {
    if (aberto) {
      setEtapa('pedirNome');
      setNomeAssinante('');
    }
  }, [aberto]);

  useEffect(() => {
    if (!aberto || etapa !== 'desenhar' || isPortrait || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    setTimeout(() => {
      // ✨ CORREÇÃO: Usar a densidade de pixeis do ecrã para evitar serrilhados (Qualidade HD)
      const ratio = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      ctx.scale(ratio, ratio);
      
      ctx.fillStyle = '#ffffff'; 
      ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      
      ctx.strokeStyle = '#0f172a'; 
      ctx.lineWidth = 3; 
      ctx.lineCap = 'round'; 
      ctx.lineJoin = 'round';
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
  }, [aberto, etapa, isPortrait]);

  const limparCanvas = () => {
    const canvas = canvasRef.current; const ctx = canvas?.getContext('2d');
    if (ctx && canvas) { 
      ctx.fillStyle = '#ffffff'; 
      ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight); 
      desenhandoRef.current = false; 
    }
  };

  const confirmar = () => {
    if (!canvasRef.current) return;
    // ✨ CORREÇÃO: Aumentada a qualidade da exportação JPEG
    const base64 = canvasRef.current.toDataURL('image/jpeg', 0.8);
    onSave(base64, nomeAssinante);
  };

  if (!aberto) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.95)', zIndex: 20000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      
      {etapa === 'pedirNome' && (
        <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '16px', width: '90%', maxWidth: '400px', textAlign: 'center' }}>
          <h2 style={{ color: '#1e293b', fontSize: '20px', marginBottom: '10px' }}>{titulo}</h2>
          <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>Por favor, identifique quem vai assinar este documento.</p>
          
          <div style={{ textAlign: 'left', marginBottom: '25px' }}>
            <Input 
              label="Nome do Responsável *" 
              value={nomeAssinante} 
              onChange={(e) => setNomeAssinante(e.target.value)} 
              placeholder="Ex: Carlos Silva"
            />
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <Button onClick={onClose} style={{ flex: 1, backgroundColor: '#f1f5f9', color: '#475569' }}>Cancelar</Button>
            <Button 
              onClick={() => {
                if (!nomeAssinante.trim()) return alert("O nome é obrigatório!");
                setEtapa('desenhar');
              }} 
              style={{ flex: 2, backgroundColor: '#3b82f6' }}
            >
              Avançar
            </Button>
          </div>
        </div>
      )}

      {etapa === 'desenhar' && (
        <>
          {isPortrait ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', padding: '20px', textAlign: 'center' }}>
              <Smartphone size={70} style={{ marginBottom: '20px', transform: 'rotate(-90deg)', color: '#3b82f6' }} />
              <h2 style={{ fontSize: '24px', margin: '0 0 10px 0' }}>Gire o seu telemóvel</h2>
              <p style={{ color: '#cbd5e1', maxWidth: '300px', fontSize: '16px', lineHeight: '1.5' }}>Para garantir uma assinatura clara e legível no documento, por favor coloque o aparelho na <strong>horizontal</strong>.</p>
              <Button onClick={() => setEtapa('pedirNome')} style={{ backgroundColor: 'transparent', border: '1px solid #475569', marginTop: '30px' }}>Voltar</Button>
            </div>
          ) : (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'white', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '15px 20px', backgroundColor: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0' }}>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#1e293b' }}>Assinatura: {nomeAssinante}</h3>
                <button onClick={() => setEtapa('pedirNome')} style={{ background: '#f1f5f9', border: 'none', padding: '8px', borderRadius: '50%' }}><X size={20}/></button>
              </div>
              
              <div style={{ flex: 1, position: 'relative', touchAction: 'none', backgroundColor: '#f8fafc' }}>
                <canvas ref={canvasRef} style={{ width: '100%', height: '100%', cursor: 'crosshair', display: 'block' }} />
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', opacity: 0.1, textAlign: 'center' }}>
                  <PenTool size={60} style={{ margin: '0 auto' }} />
                  <p style={{ fontSize: '20px', fontWeight: 'bold' }}>Assine o seu nome aqui</p>
                </div>
              </div>

              <div style={{ padding: '20px', backgroundColor: 'white', display: 'flex', gap: '15px', borderTop: '1px solid #e2e8f0' }}>
                <Button onClick={limparCanvas} style={{ flex: 1, backgroundColor: '#f1f5f9', color: '#475569', fontSize: '16px', fontWeight: 'bold' }}>Limpar Tela</Button>
                <Button onClick={confirmar} style={{ flex: 2, backgroundColor: '#10b981', fontSize: '16px', fontWeight: 'bold' }}>Confirmar e Salvar</Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
