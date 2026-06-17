// src/components/advertencias/ModalAssinaturaAdv.tsx
import { useEffect, useRef } from 'react';
import { X, Eraser, Check } from 'lucide-react';
import Button from '../ui/Button';

interface Props {
  aberto: boolean;
  onClose: () => void;
  onSave: (base64: string) => void;
}

export default function ModalAssinaturaAdv({ aberto, onClose, onSave }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const desenhandoRef = useRef(false);

  useEffect(() => {
    if (!aberto || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    ctx.scale(ratio, ratio);

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

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
  }, [aberto]);

  const limpar = () => {
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
  };

  const confirmar = () => {
    if (canvasRef.current) {
      onSave(canvasRef.current.toDataURL('image/png'));
    }
  };

  if (!aberto) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'white', zIndex: 10000, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0' }}>
        <h2 style={{ fontSize: '18px', margin: 0, color: '#1e293b' }}>Assinatura do Colaborador</h2>
        <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', padding: '8px', borderRadius: '50%' }}><X size={20} /></button>
      </div>
      <div style={{ flex: 1, position: 'relative', backgroundColor: '#f8fafc' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', touchAction: 'none' }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#e2e8f0', pointerEvents: 'none', zIndex: 0, fontSize: '40px', fontWeight: 'bold' }}>ASSINE AQUI</div>
      </div>
      <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', borderTop: '1px solid #e2e8f0' }}>
        <Button onClick={limpar} style={{ backgroundColor: '#f1f5f9', color: '#475569', fontSize: '16px' }}><Eraser size={20} style={{ marginRight: '8px' }}/> Limpar</Button>
        <Button onClick={confirmar} style={{ backgroundColor: '#10b981', fontSize: '16px' }}><Check size={20} style={{ marginRight: '8px' }}/> Confirmar</Button>
      </div>
    </div>
  );
}