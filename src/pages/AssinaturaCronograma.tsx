// src/pages/AssinaturaCronograma.tsx
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

import logoCarvalho from '../assets/logopdf.png';
import { CheckCircle2, AlertCircle, PenTool, X, ShieldCheck, Smartphone, HardHat, Clock } from 'lucide-react';
import Button from '../components/ui/Button';

export default function AssinaturaCronograma() {
  const { id } = useParams<{ id: string }>();
  const [atividade, setAtividade] = useState<any>(null);
  const [erro, setErro] = useState('');
  
  // Controle de quem vai assinar
  const [quemAssina, setQuemAssina] = useState<'carvalho' | 'rotem' | null>(null);
  const [nomeAssinante, setNomeAssinante] = useState('');
  
  const [abrindoAssinatura, setAbrindoAssinatura] = useState(false);
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const desenhandoRef = useRef(false);
  const [estaDesenhandoUI, setEstaDesenhandoUI] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsPortrait(window.innerHeight > window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const buscarDados = async () => {
      if (!id) return;
      try {
        const docRef = await getDoc(doc(db, 'cronogramas_diarios', id));
        if (!docRef.exists()) setErro("Registo não encontrado.");
        else setAtividade({ id: docRef.id, ...docRef.data() });
      } catch (e) {
        setErro("Erro de conexão.");
      }
    };
    buscarDados();
  }, [id]);

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

      await updateDoc(doc(db, 'cronogramas_diarios', atividade.id), atualizacoes);
      
      // Atualiza estado local para refletir na tela
      setAtividade({ ...atividade, ...atualizacoes });
      setAbrindoAssinatura(false);
      setQuemAssina(null);
      setNomeAssinante('');
    } catch (e) {
      alert("Erro ao salvar assinatura.");
    }
  };

  if (erro) return <div style={{ textAlign: 'center', padding: '50px' }}><AlertCircle size={50} color="red"/><h2>{erro}</h2></div>;
  if (!atividade) return <div style={{ textAlign: 'center', padding: '50px' }}>Carregando documento...</div>;

  const tudoAssinado = atividade.assinaturaCarvalho !== 'pendente' && atividade.assinaturaRotem !== 'pendente';

  if (tudoAssinado) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#f0fdf4' }}>
        <div style={{ maxWidth: '450px', padding: '40px', textAlign: 'center', backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
          <CheckCircle2 size={70} color="#10b981" style={{ margin: '0 auto 20px' }} />
          <h2 style={{ color: '#166534', margin: '0 0 10px 0' }}>Cronograma Validado!</h2>
          <p style={{ color: '#475569', fontSize: '15px' }}>Ambas as partes já assinaram e atestaram este serviço.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#f1f5f9', minHeight: '100vh', padding: '20px 10px' }}>
      <div style={{ maxWidth: '650px', margin: '0 auto' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <img src={logoCarvalho} alt="Logo" style={{ height: '45px', marginBottom: '15px' }} />
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#dbeafe', color: '#1e3a8a', padding: '6px 12px', borderRadius: '50px', fontSize: '12px', fontWeight: 'bold' }}>
            <ShieldCheck size={16} /> Diário de Obra Digital
          </div>
        </div>

        {!abrindoAssinatura ? (
          <>
            <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px', marginBottom: '15px' }}>
                <div>
                  <h2 style={{ fontSize: '18px', margin: '0 0 5px 0', color: '#1e293b' }}>Serviço Prestado</h2>
                  <span style={{ fontSize: '14px', color: '#64748b' }}>{atividade.data.split('-').reverse().join('/')}</span>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '5px', color: '#f59e0b', fontWeight: 'bold' }}>
                  <Clock size={18}/> {atividade.horaInicio} - {atividade.horaTermino}
                </div>
              </div>
              
              <p style={{ color: '#334155', fontSize: '15px', lineHeight: '1.5', marginBottom: '20px' }}>
                {atividade.servicoPrestado}
              </p>

              <div style={{ backgroundColor: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#475569', marginBottom: '10px' }}>
                  <HardHat size={16} /> Equipe Envolvida ({atividade.equipe.length})
                </strong>
                <ul style={{ margin: 0, paddingLeft: '20px', color: '#1e293b', fontSize: '14px', lineHeight: '1.6' }}>
                  {atividade.equipe.map((nome: string, i: number) => <li key={i}>{nome}</li>)}
                </ul>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {atividade.assinaturaCarvalho === 'pendente' && (
                <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', borderLeft: '4px solid #3b82f6' }}>
                  <h3 style={{ fontSize: '15px', margin: '0 0 10px 0' }}>Assinatura: Líder Carvalho</h3>
                  <input type="text" value={nomeAssinante} onChange={e => {setNomeAssinante(e.target.value); setQuemAssina('carvalho');}} placeholder="Digite o seu nome..." style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '10px' }} />
                  <Button onClick={() => setAbrindoAssinatura(true)} disabled={!nomeAssinante || quemAssina !== 'carvalho'} style={{ width: '100%', backgroundColor: '#3b82f6' }}>Assinar (Carvalho)</Button>
                </div>
              )}

              {atividade.assinaturaRotem === 'pendente' && (
                <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', borderLeft: '4px solid #f59e0b' }}>
                  <h3 style={{ fontSize: '15px', margin: '0 0 10px 0' }}>Assinatura: Validação Rotem</h3>
                  <input type="text" value={nomeAssinante} onChange={e => {setNomeAssinante(e.target.value); setQuemAssina('rotem');}} placeholder="Digite o seu nome (Rotem)..." style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '10px' }} />
                  <Button onClick={() => setAbrindoAssinatura(true)} disabled={!nomeAssinante || quemAssina !== 'rotem'} style={{ width: '100%', backgroundColor: '#f59e0b' }}>Validar e Assinar (Rotem)</Button>
                </div>
              )}
            </div>
          </>
        ) : (
          /* O Canvas de Assinatura Padrão do Sistema (mantém a lógica que já usa noutros locais) */
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.98)', zIndex: 20000, display: 'flex', flexDirection: 'column' }}>
             {isPortrait ? (
               <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', padding: '20px', textAlign: 'center' }}>
                 <Smartphone size={70} style={{ marginBottom: '20px', transform: 'rotate(-90deg)', color: '#3b82f6' }} />
                 <h2 style={{ fontSize: '24px', margin: '0 0 10px 0' }}>Gire o seu celular</h2>
                 <Button onClick={() => setAbrindoAssinatura(false)} style={{ backgroundColor: 'transparent', border: '1px solid #475569', marginTop: '30px' }}>Voltar</Button>
               </div>
             ) : (
               <>
                 <div style={{ padding: '15px 20px', backgroundColor: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <h3 style={{ margin: 0, fontSize: '16px', color: '#1e293b' }}>Assinatura: {nomeAssinante}</h3>
                   <button onClick={() => setAbrindoAssinatura(false)} style={{ background: '#f1f5f9', border: 'none', padding: '8px', borderRadius: '50%' }}><X size={20}/></button>
                 </div>
                 
                 <div style={{ flex: 1, position: 'relative', touchAction: 'none', backgroundColor: '#f8fafc' }}>
                   <canvas ref={canvasRef} style={{ width: '100%', height: '100%', cursor: 'crosshair', display: 'block' }} />
                   {!estaDesenhandoUI && (
                     <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', opacity: 0.1, textAlign: 'center' }}>
                       <PenTool size={60} style={{ margin: '0 auto' }} />
                       <p style={{ fontSize: '20px', fontWeight: 'bold' }}>Assine o seu nome aqui</p>
                     </div>
                   )}
                 </div>

                 <div style={{ padding: '20px', backgroundColor: 'white', display: 'flex', gap: '15px', borderTop: '1px solid #e2e8f0' }}>
                   <Button onClick={salvarAssinatura} style={{ flex: 2, backgroundColor: '#10b981', fontSize: '16px', fontWeight: 'bold' }}>
                     Confirmar e Salvar
                   </Button>
                 </div>
               </>
             )}
          </div>
        )}
      </div>
    </div>
  );
}