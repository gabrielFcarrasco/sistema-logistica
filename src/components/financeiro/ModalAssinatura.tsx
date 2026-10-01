// src/components/financeiro/ModalAssinatura.tsx
import React, { useRef, useState } from 'react';
import { PenTool } from 'lucide-react';
import Button from '../ui/Button';

interface Props {
  visivel: boolean;
  onSalvar: (imagemBase64: string) => void;
  onCancelar: () => void;
}

export default function ModalAssinatura({ visivel, onSalvar, onCancelar }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [desenhando, setDesenhando] = useState(false);

  if (!visivel) return null;

  const iniciarDesenho = (e: any) => {
    setDesenhando(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const desenhar = (e: any) => {
    if (!desenhando) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.stroke();
  };

  const pararDesenho = () => setDesenhando(false);
  
  const limparAssinatura = () => {
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSalvar = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSalvar(canvas.toDataURL('image/png'));
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '12px', backdropFilter: 'blur(3px)' }}>
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', width: '100%', maxWidth: '450px' }}>
        <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <PenTool size={18} color="#0f172a" /> Assinatura do Colaborador
        </h3>
        <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#64748b' }}>Desenhe com o dedo na tela abaixo.</p>
        
        <div style={{ border: '2px dashed #cbd5e1', borderRadius: '10px', backgroundColor: '#f8fafc', touchAction: 'none' }}>
          <canvas 
            ref={canvasRef} 
            width={380} 
            height={180} 
            style={{ width: '100%', cursor: 'crosshair', display: 'block' }} 
            onPointerDown={iniciarDesenho} 
            onPointerMove={desenhar} 
            onPointerUp={pararDesenho} 
            onPointerLeave={pararDesenho}
            onTouchStart={iniciarDesenho}
            onTouchMove={desenhar}
            onTouchEnd={pararDesenho}
          />
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px', marginBottom: '16px' }}>
          <button onClick={limparAssinatura} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Limpar Assinatura</button>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <Button onClick={onCancelar} style={{ flex: 1, backgroundColor: '#f1f5f9', color: '#475569', minHeight: '44px' }}>Cancelar</Button>
          <Button onClick={handleSalvar} style={{ flex: 1, backgroundColor: '#16a34a', minHeight: '44px' }}>Salvar Assinatura</Button>
        </div>
      </div>
    </div>
  );
}