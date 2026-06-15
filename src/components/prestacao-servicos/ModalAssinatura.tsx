// src/components/prestacao-servicos/ModalAssinatura.tsx
import { useEffect, useRef } from 'react';
import { X, PenTool, Smartphone } from 'lucide-react';
import Button from '../ui/Button';

interface Props {
  aberto: boolean;
  titulo: string;
  isPortrait: boolean;
  onClose: () => void;
  onSave: (base64: string) => void;
}

export default function ModalAssinatura({ aberto, titulo, isPortrait, onClose, onSave }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const desenhandoRef = useRef(false);

  useEffect(() => {
    if (!aberto || !canvasRef.current || isPortrait) return;
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
  }, [aberto, isPortrait]);

  const limparCanvas = () => {
    const canvas = canvasRef.current; const ctx = canvas?.getContext('2d');
    if (ctx && canvas) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); desenhandoRef.current = false; }
  };

  const salvar = () => {
    if (!canvasRef.current) return;
    onSave(canvasRef.current.toDataURL('image/jpeg', 0.6));
  };

  if (!aberto) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.95)', zIndex: 20000, display: 'flex', flexDirection: 'column' }}>
       {isPortrait ? (
         <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e293b', color: 'white', padding: '20px', textAlign: 'center' }}>
           <Smartphone size={70} style={{ marginBottom: '20px', transform: 'rotate(-90deg)', color: '#8b5cf6' }} />
           <h2>Gire o Celular</h2>
           <p style={{ color: '#cbd5e1', maxWidth: '300px' }}>Para coletar a assinatura, coloque o aparelho na <strong>horizontal</strong>.</p>
           <Button onClick={onClose} style={{ backgroundColor: '#475569', marginTop: '20px' }}>Voltar</Button>
         </div>
       ) : (
         <>
           <div style={{ padding: '15px 20px', backgroundColor: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <h3 style={{ margin: 0, fontSize: '16px' }}>{titulo}</h3>
             <button onClick={onClose} style={{ background: 'none', border: 'none' }}><X/></button>
           </div>
           <div style={{ flex: 1, position: 'relative', touchAction: 'none' }}>
             <canvas ref={canvasRef} style={{ width: '100%', height: '100%', backgroundColor: 'white', cursor: 'crosshair', display: 'block' }} />
             <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', opacity: 0.1, textAlign: 'center' }}>
               <PenTool size={60} style={{ margin: '0 auto' }} />
               <p style={{ fontSize: '18px', fontWeight: 'bold' }}>Assine Aqui</p>
             </div>
           </div>
           <div style={{ padding: '15px', backgroundColor: 'white', display: 'flex', gap: '10px' }}>
             <Button onClick={limparCanvas} style={{ flex: 1, backgroundColor: '#f1f5f9', color: '#475569' }}>Limpar Fundo</Button>
             <Button onClick={salvar} style={{ flex: 2, backgroundColor: '#10b981' }}>Salvar Assinatura e Voltar</Button>
           </div>
         </>
       )}
    </div>
  );
}