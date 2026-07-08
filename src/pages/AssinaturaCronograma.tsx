// src/pages/AssinaturaCronograma.tsx
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

// ✨ CORREÇÃO 1: Apenas um '../' para ir de 'pages' para 'services'
import { db } from '../services/firebase';

// ✨ CORREÇÃO 2: Apenas um '../' para ir de 'pages' para 'assets'
import logoCarvalho from '../assets/logopdf.png';

import { CheckCircle2, AlertCircle, PenTool, X, ShieldCheck, Smartphone, Clock, HardHat } from 'lucide-react';

// ✨ CORREÇÃO 3: Apenas um '../' para ir de 'pages' para 'components'
import Button from '../components/ui/Button';

export default function AssinaturaCronograma() {
  const { loteId } = useParams<{ loteId: string }>();
  const [atividade, setAtividade] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  
  const [quemAssina, setQuemAssina] = useState<'carvalho' | 'rotem' | null>(null);
  const [nomeAssinante, setNomeAssinante] = useState('');
  const [abrindoAssinatura, setAbrindoAssinatura] = useState(false);
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [estaDesenhandoUI, setEstaDesenhandoUI] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsPortrait(window.innerHeight > window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const buscarDados = async () => {
      if (!loteId) { setErro("ID do lote não encontrado."); setLoading(false); return; }
      try {
        const docRef = await getDoc(doc(db, 'diario_obra_lotes', loteId));
        if (!docRef.exists()) setErro("Registo não encontrado.");
        else setAtividade({ id: docRef.id, ...docRef.data() });
      } catch (e) { setErro("Erro de conexão."); }
      setLoading(false);
    };
    buscarDados();
  }, [loteId]);

  useEffect(() => {
    if (!abrindoAssinatura || !canvasRef.current || isPortrait) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    setTimeout(() => {
      const ratio = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      ctx.scale(ratio, ratio);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    }, 200);

    const getPos = (e: any) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const start = (e: any) => { e.preventDefault(); ctx.beginPath(); ctx.moveTo(getPos(e).x, getPos(e).y); setEstaDesenhandoUI(true); };
    const move = (e: any) => { if (!estaDesenhandoUI) return; e.preventDefault(); ctx.lineTo(getPos(e).x, getPos(e).y); ctx.stroke(); };
    
    canvas.addEventListener('mousedown', start); canvas.addEventListener('mousemove', move);
    canvas.addEventListener('touchstart', start, { passive: false }); canvas.addEventListener('touchmove', move, { passive: false });
    
    return () => {
      canvas.removeEventListener('mousedown', start); canvas.removeEventListener('mousemove', move);
      canvas.removeEventListener('touchstart', start); canvas.removeEventListener('touchmove', move);
    };
  }, [abrindoAssinatura, isPortrait]);

  const salvarAssinatura = async () => {
    if (!canvasRef.current || !atividade || !quemAssina) return;
    const base64 = canvasRef.current.toDataURL('image/jpeg', 0.8);
    
    try {
      const atualizacoes: any = {};
      if (quemAssina === 'carvalho') {
        atualizacoes.assinaturaCarvalho = base64;
        atualizacoes.nomeCarvalho = nomeAssinante;
      } else {
        atualizacoes.assinaturaRotem = base64;
        atualizacoes.nomeRotem = nomeAssinante;
      }
      await updateDoc(doc(db, 'diario_obra_lotes', atividade.id), atualizacoes);
      setAtividade({ ...atividade, ...atualizacoes });
      setAbrindoAssinatura(false);
      setQuemAssina(null);
      setNomeAssinante('');
    } catch (e) { alert("Erro ao salvar assinatura."); }
  };

  if (loading) return <div style={{ padding: '50px', textAlign: 'center' }}>Carregando dados...</div>;
  if (erro) return <div style={{ padding: '50px', color: 'red' }}><AlertCircle /><h2>{erro}</h2></div>;

  const tudoAssinado = atividade.assinaturaCarvalho !== 'pendente' && atividade.assinaturaRotem !== 'pendente';

  if (tudoAssinado) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#f0fdf4' }}>
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <CheckCircle2 size={70} color="#10b981" />
          <h2>Cronograma Validado!</h2>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#f1f5f9', minHeight: '100vh', padding: '20px 10px' }}>
      <div style={{ maxWidth: '650px', margin: '0 auto' }}>
        
        {!abrindoAssinatura ? (
          <>
            <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', marginBottom: '20px' }}>
              <h2>Serviço Prestado</h2>
              <p>{atividade.servicoPrestado}</p>
              <div style={{ marginTop: '10px' }}>
                <Clock size={16} /> {atividade.horaInicio} - {atividade.horaTermino}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {atividade.assinaturaCarvalho === 'pendente' && (
                <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '8px' }}>Seu Nome (Líder Carvalho)</label>
                  <input type="text" value={quemAssina === 'carvalho' ? nomeAssinante : ''} onChange={e => {setNomeAssinante(e.target.value); setQuemAssina('carvalho');}} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '10px' }} />
                  <Button onClick={() => setAbrindoAssinatura(true)} disabled={!nomeAssinante || quemAssina !== 'carvalho'} style={{ width: '100%', backgroundColor: '#3b82f6' }}>Assinar (Carvalho)</Button>
                </div>
              )}
              {atividade.assinaturaRotem === 'pendente' && (
                <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '8px' }}>Seu Nome (Responsável Rotem)</label>
                  <input type="text" value={quemAssina === 'rotem' ? nomeAssinante : ''} onChange={e => {setNomeAssinante(e.target.value); setQuemAssina('rotem');}} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '10px' }} />
                  <Button onClick={() => setAbrindoAssinatura(true)} disabled={!nomeAssinante || quemAssina !== 'rotem'} style={{ width: '100%', backgroundColor: '#f59e0b' }}>Assinar (Rotem)</Button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ position: 'fixed', inset: 0, background: 'white', zIndex: 999 }}>
            {isPortrait ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column' }}><Smartphone size={50} style={{ transform: 'rotate(-90deg)', marginBottom: '15px' }}/>Gire o telemóvel para assinar!</div> : (
              <>
                <canvas ref={canvasRef} style={{ width: '100%', height: '80%', cursor: 'crosshair' }} />
                <div style={{ display: 'flex', gap: '10px', padding: '20px', borderTop: '1px solid #e2e8f0' }}>
                  <Button onClick={() => setAbrindoAssinatura(false)} style={{ backgroundColor: '#64748b' }}>Voltar</Button>
                  <Button onClick={salvarAssinatura} style={{ backgroundColor: '#10b981', flex: 1 }}>Confirmar Assinatura</Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}