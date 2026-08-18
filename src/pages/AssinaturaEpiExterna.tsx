// src/pages/AssinaturaEPI.tsx
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';

import logoCarvalho from '../assets/logopdf.png';
import { CheckCircle2, AlertCircle, PenTool, X, FileSignature, ShieldCheck, Smartphone, HardHat } from 'lucide-react';
import Button from '../components/ui/Button';

export default function AssinaturaEPI() {
  const { loteId } = useParams<{ loteId: string }>();
  const [entregas, setEntregas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  
  const [assinado, setAssinado] = useState(false);
  const [abrindoAssinatura, setAbrindoAssinatura] = useState(false);
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const desenhandoRef = useRef(false);
  const [estaDesenhandoUI, setEstaDesenhandoUI] = useState(false);

  // Monitora a rotação da tela
  useEffect(() => {
    const handleResize = () => setIsPortrait(window.innerHeight > window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Busca os itens do Lote
  useEffect(() => {
    const buscarLote = async () => {
      if (!loteId) return;
      try {
        const q = query(collection(db, 'entregas'), where('loteId', '==', loteId));
        const snap = await getDocs(q);
        
        if (snap.empty) {
          setErro("Lote de entrega não encontrado ou link inválido.");
        } else {
          const dados = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          
          // Se o primeiro item já estiver assinado (diferente de 'pendente'), bloqueia a tela
          if (dados[0].assinatura && dados[0].assinatura !== 'pendente') {
             setAssinado(true);
          }
          setEntregas(dados);
        }
      } catch (e) {
        setErro("Erro de conexão. Verifique a sua internet e tente novamente.");
      }
      setLoading(false);
    };
    buscarLote();
  }, [loteId]);

  // Lógica do Canvas HD
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
    if (!canvasRef.current || entregas.length === 0) return;
    const base64 = canvasRef.current.toDataURL('image/jpeg', 0.8);
    
    try {
      // Atualiza TODOS os itens deste lote com a mesma assinatura
      await Promise.all(
        entregas.map(ent => updateDoc(doc(db, 'entregas', ent.id), { assinatura: base64 }))
      );
      
      setAssinado(true);
      setAbrindoAssinatura(false);
    } catch (e) {
      alert("Erro ao salvar assinatura. Verifique sua conexão.");
    }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f8fafc' }}><span style={{ fontSize: '18px', color: '#64748b' }}>A carregar documento seguro...</span></div>;

  if (erro) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#f8fafc' }}>
        <div style={{ maxWidth: '400px', padding: '30px', textAlign: 'center', backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
          <AlertCircle size={60} color="#ef4444" style={{ margin: '0 auto 20px' }} />
          <h2 style={{ color: '#1e293b', fontSize: '20px' }}>{erro}</h2>
          <p style={{ color: '#64748b', fontSize: '14px', marginTop: '10px' }}>Por favor, solicite um novo link ao responsável do SESMT.</p>
        </div>
      </div>
    );
  }

  if (assinado) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#f0fdf4' }}>
        <div style={{ maxWidth: '450px', padding: '40px 30px', textAlign: 'center', backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', borderTop: '6px solid #10b981' }}>
          <CheckCircle2 size={70} color="#10b981" style={{ margin: '0 auto 20px' }} />
          <h2 style={{ color: '#166534', margin: '0 0 10px 0', fontSize: '24px' }}>EPIs Assinados com Sucesso!</h2>
          <p style={{ color: '#475569', fontSize: '15px', lineHeight: '1.5' }}>Obrigado. Este recebimento já consta como assinado e validado na sua Ficha de EPI.</p>
          <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f8fafc', borderRadius: '8px', fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
            <ShieldCheck size={14}/> Link protegido. Pode fechar esta página.
          </div>
        </div>
      </div>
    );
  }

  const funcionarioNome = entregas[0]?.funcionarioNome || 'Colaborador';
  const dataEntrega = entregas[0]?.dataHora?.toDate().toLocaleDateString('pt-BR') || new Date().toLocaleDateString('pt-BR');

  return (
    <div style={{ backgroundColor: '#f1f5f9', minHeight: '100vh', padding: '20px 10px' }}>
      <div style={{ maxWidth: '650px', margin: '0 auto' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <img src={logoCarvalho} alt="Logo Carvalho" style={{ height: '45px', marginBottom: '15px' }} />
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#dcfce7', color: '#166534', padding: '6px 12px', borderRadius: '50px', fontSize: '12px', fontWeight: 'bold' }}>
            <ShieldCheck size={16} /> Ficha de EPI Digital
          </div>
        </div>

        {!abrindoAssinatura ? (
          <>
            <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', marginBottom: '25px', borderTop: '6px solid #1e293b' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #f1f5f9', paddingBottom: '15px', marginBottom: '20px' }}>
                <div>
                  <h2 style={{ fontSize: '18px', margin: '0 0 5px 0', color: '#1e293b', fontWeight: 'bold' }}>RECIBO DE ENTREGA</h2>
                  <span style={{ fontSize: '14px', color: '#3b82f6', fontWeight: 'bold' }}>{funcionarioNome}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block' }}>Data</span>
                  <strong style={{ fontSize: '14px', color: '#334155' }}>{dataEntrega}</strong>
                </div>
              </div>

              <h3 style={{ fontSize: '14px', marginBottom: '15px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <HardHat size={16} color="#f59e0b" /> Itens Recebidos:
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                {entregas.map((item:any, idx:number) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px' }}>
                    <span style={{ color: '#334155', fontWeight: 'bold' }}>{item.quantidade}x {item.itemNome}</span>
                    <span style={{ color: '#64748b', fontSize: '12px' }}>{item.origem === 'externa_cliente' ? 'Hyundai' : 'Carvalho'}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', textAlign: 'center' }}>
              <p style={{ fontSize: '13px', color: '#475569', marginBottom: '20px', lineHeight: '1.5', textAlign: 'justify' }}>
                Declaro ter recebido os equipamentos de proteção individual acima descritos, comprometendo-me a utilizá-los apenas para a finalidade a que se destinam e a conservá-los em perfeito estado.
              </p>
              
              <Button onClick={() => setAbrindoAssinatura(true)} style={{ width: '100%', height: '60px', fontSize: '16px', backgroundColor: '#3b82f6', display: 'flex', justifyContent: 'center', gap: '10px', fontWeight: 'bold', transition: '0.3s' }}>
                <FileSignature size={22} /> Assinar Recebimento
              </Button>
            </div>
          </>
        ) : (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.98)', zIndex: 20000, display: 'flex', flexDirection: 'column' }}>
             {isPortrait ? (
               <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', padding: '20px', textAlign: 'center' }}>
                 <Smartphone size={70} style={{ marginBottom: '20px', transform: 'rotate(-90deg)', color: '#3b82f6' }} />
                 <h2 style={{ fontSize: '24px', margin: '0 0 10px 0' }}>Gire o seu celular</h2>
                 <p style={{ color: '#cbd5e1', maxWidth: '300px', fontSize: '16px', lineHeight: '1.5' }}>Para garantir uma assinatura clara e legível na sua ficha, por favor coloque o aparelho na <strong>horizontal</strong>.</p>
                 <Button onClick={() => setAbrindoAssinatura(false)} style={{ backgroundColor: 'transparent', border: '1px solid #475569', marginTop: '30px' }}>Voltar ao Resumo</Button>
               </div>
             ) : (
               <>
                 <div style={{ padding: '15px 20px', backgroundColor: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <h3 style={{ margin: 0, fontSize: '16px', color: '#1e293b' }}>Assinatura: {funcionarioNome}</h3>
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
                   <Button onClick={() => {
                      const canvas = canvasRef.current; const ctx = canvas?.getContext('2d');
                      if (ctx && canvas) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); desenhandoRef.current = false; setEstaDesenhandoUI(false); }
                   }} style={{ flex: 1, backgroundColor: '#f1f5f9', color: '#475569', fontSize: '16px', fontWeight: 'bold' }}>
                     Limpar Tela
                   </Button>
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