// src/components/entrega/ModalAssinaturaEntrega.tsx
import { useEffect, useRef, useState } from 'react';
import { Smartphone, PenTool, X } from 'lucide-react';
import Button from '../ui/Button';

interface Props {
  aberto: boolean;
  onClose: () => void;
  onConfirm: (base64: string) => void;
}

export default function ModalAssinaturaEntrega({ aberto, onClose, onConfirm }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const desenhandoRef = useRef(false);
  const [estaDesenhandoUI, setEstaDesenhandoUI] = useState(false);
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);

  useEffect(() => {
    const handleResize = () => setIsPortrait(window.innerHeight > window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!aberto || isPortrait || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    setTimeout(() => {
      const ratio = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      ctx.scale(ratio, ratio);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    }, 100);
    
    const getPos = (e: any) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const start = (e: any) => { e.preventDefault(); ctx.beginPath(); ctx.moveTo(getPos(e).x, getPos(e).y); desenhandoRef.current = true; setEstaDesenhandoUI(true); };
    const move = (e: any) => { if (!desenhandoRef.current) return; e.preventDefault(); ctx.lineTo(getPos(e).x, getPos(e).y); ctx.stroke(); };
    const stop = () => { desenhandoRef.current = false; };

    canvas.addEventListener('mousedown', start); canvas.addEventListener('mousemove', move); window.addEventListener('mouseup', stop);
    canvas.addEventListener('touchstart', start, { passive: false }); canvas.addEventListener('touchmove', move, { passive: false }); window.addEventListener('touchend', stop);
    
    return () => {
      canvas.removeEventListener('mousedown', start); canvas.removeEventListener('mousemove', move); window.removeEventListener('mouseup', stop);
      canvas.removeEventListener('touchstart', start); canvas.removeEventListener('touchmove', move); window.removeEventListener('touchend', stop);
    };
  }, [aberto, isPortrait]);

  const limparAssinatura = () => {
    const canvas = canvasRef.current; const ctx = canvas?.getContext('2d');
    if (ctx && canvas) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight); setEstaDesenhandoUI(false); desenhandoRef.current = false; }
  };

  const confirmar = () => {
    if (!canvasRef.current) return;
    const base64 = canvasRef.current.toDataURL('image/jpeg', 0.8);
    onConfirm(base64);
  };

  if (!aberto) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'white', zIndex: 20000, display: 'flex', flexDirection: 'column' }}>
      {isPortrait ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e293b', color: 'white', padding: '20px', textAlign: 'center' }}>
          <Smartphone size={70} style={{ marginBottom: '20px', transform: 'rotate(-90deg)', opacity: 0.8, color: '#3b82f6' }} />
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '10px' }}>Gire o Celular</h2>
          <p style={{ color: '#cbd5e1', fontSize: '16px', marginBottom: '30px', maxWidth: '300px', lineHeight: '1.5' }}>
            Para garantir que a assinatura fique nas proporções corretas do documento, coloque o seu aparelho na <strong>horizontal</strong>.
          </p>
          <Button onClick={onClose} style={{ backgroundColor: '#475569', color: 'white', height: '50px', padding: '0 30px' }}>Voltar</Button>
        </div>
      ) : (
        <>
          <div style={{ padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
            <h2 style={{ fontSize: '18px', margin: 0, fontWeight: '800', color: '#1e293b' }}>Assinatura do Colaborador</h2>
            <button onClick={onClose} style={{ background: '#e2e8f0', border: 'none', borderRadius: '50%', padding: '8px', cursor: 'pointer' }}><X size={20} color="#475569" /></button>
          </div>

          <div style={{ flex: 1, position: 'relative', touchAction: 'none' }}>
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%', cursor: 'crosshair', display: 'block' }} />
            {!estaDesenhandoUI && (
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', opacity: 0.2, textAlign: 'center' }}>
                <PenTool size={60} style={{ margin: '0 auto' }} />
                <p style={{ fontSize: '18px', fontWeight: 'bold' }}>Assine Aqui</p>
              </div>
            )}
          </div>

          <div style={{ padding: '15px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '15px', backgroundColor: '#f8fafc' }}>
            <Button onClick={limparAssinatura} style={{ flex: 1, height: '45px', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}>Limpar</Button>
            <Button onClick={confirmar} style={{ flex: 2, height: '45px', backgroundColor: '#10b981', fontWeight: 'bold' }}>Confirmar Assinatura</Button>
          </div>
        </>
      )}
    </div>
  );
}