// src/pages/AssinaturaExterna.tsx
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

import logoCarvalho from '../assets/LogoLimpa.webp';
import { CheckCircle2, AlertCircle, PenTool, X, FileSignature, ShieldCheck, Smartphone, Info } from 'lucide-react';
import Button from '../components/ui/Button';

export default function AssinaturaExterna() {
  const { id } = useParams<{ id: string }>();
  const [os, setOs] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  
  // 1. Estado adicionado para guardar o nome do assinante
  const [nomeAssinante, setNomeAssinante] = useState('');
  const [assinado, setAssinado] = useState(false);
  const [abrindoAssinatura, setAbrindoAssinatura] = useState(false);
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const desenhandoRef = useRef(false);

  // Monitora a rotação da tela
  useEffect(() => {
    const handleResize = () => setIsPortrait(window.innerHeight > window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const buscarOS = async () => {
      if (!id) return;
      try {
        const osRef = doc(db, 'ordens_servico', id);
        const osSnap = await getDoc(osRef);
        
        if (!osSnap.exists()) {
          setErro("Ordem de Serviço não encontrada ou link expirado.");
        } else {
          const dados = { id: osSnap.id, ...osSnap.data() };
          if (dados.assinaturaCliente) {
             setAssinado(true);
          }
          setOs(dados);
        }
      } catch (e) {
        setErro("Erro de conexão. Verifique a sua internet e tente novamente.");
      }
      setLoading(false);
    };
    buscarOS();
  }, [id]);

  useEffect(() => {
    if (!abrindoAssinatura || !canvasRef.current || isPortrait) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    setTimeout(() => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
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
  }, [abrindoAssinatura, isPortrait]);

  const salvarAssinatura = async () => {
    if (!canvasRef.current || !os) return;
    const base64 = canvasRef.current.toDataURL('image/jpeg', 0.6);
    
    try {
      // 3. O nome do assinante agora é salvo no banco de dados juntamente com a imagem
      const atualizacoes: any = { 
        assinaturaCliente: base64,
        nomeClienteAssinatura: nomeAssinante 
      };
      
      if (os.assinaturaPrestador) atualizacoes.status = 'Concluída';

      await updateDoc(doc(db, 'ordens_servico', os.id), atualizacoes);
      setAssinado(true);
      setAbrindoAssinatura(false);
    } catch (e) {
      alert("Erro ao salvar assinatura. Verifique sua conexão.");
    }
  };

  const renderResumoOS = () => {
    if (!os) return null;
    return (
      <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', marginBottom: '25px', borderTop: '6px solid #1e293b' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #f1f5f9', paddingBottom: '15px', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '20px', margin: '0 0 5px 0', color: '#1e293b', fontWeight: 'bold' }}>ORDEM DE SERVIÇO</h2>
            <span style={{ fontSize: '13px', color: '#64748b' }}>Nº {os.id.slice(-6).toUpperCase()}</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block' }}>Data de Emissão</span>
            <strong style={{ fontSize: '14px', color: '#334155' }}>{os.dataEmissao?.toDate().toLocaleDateString('pt-BR')}</strong>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '25px' }}>
          <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>PRESTADOR</span>
            <strong style={{ fontSize: '12px', color: '#0f172a', display: 'block' }}>Carvalho Funilaria Ltda</strong>
            <span style={{ fontSize: '11px', color: '#475569' }}>CNPJ: 31.362.302/0001-33</span>
          </div>
          <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>CLIENTE</span>
            <strong style={{ fontSize: '12px', color: '#0f172a', display: 'block' }}>Hyundai Rotem Brasil</strong>
            <span style={{ fontSize: '11px', color: '#475569' }}>CNPJ: 17.866.875/0004-16</span>
          </div>
        </div>
        
        <h3 style={{ fontSize: '14px', marginBottom: '15px', color: '#1e293b', backgroundColor: '#f1f5f9', padding: '8px 12px', borderRadius: '6px' }}>
          Escopo: {os.tipoEscopo}
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
          {os.itens?.map((i:any, idx:number) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', borderBottom: '1px dashed #cbd5e1', fontSize: '14px' }}>
              <span style={{ color: '#334155' }}><strong>{i.quantidade}x</strong> {i.descricao}</span>
              <span style={{ color: '#64748b', fontSize: '12px' }}>{i.serial ? `SN: ${i.serial}` : 'S/ Registro'}</span>
            </div>
          ))}
        </div>

        {os.descricaoServico && (
           <div style={{ backgroundColor: '#fffbeb', padding: '15px', borderRadius: '8px', border: '1px solid #fde68a' }}>
             <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#b45309', fontWeight: 'bold', marginBottom: '5px' }}>
               <Info size={14}/> Observações do Serviço
             </span>
             <p style={{ margin: 0, fontSize: '13px', color: '#713f12' }}>{os.descricaoServico}</p>
           </div>
        )}
      </div>
    );
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f8fafc' }}><span style={{ fontSize: '18px', color: '#64748b' }}>A carregar documento seguro...</span></div>;

  if (erro) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#f8fafc' }}>
        <div style={{ maxWidth: '400px', padding: '30px', textAlign: 'center', backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
          <AlertCircle size={60} color="#ef4444" style={{ margin: '0 auto 20px' }} />
          <h2 style={{ color: '#1e293b', fontSize: '20px' }}>{erro}</h2>
          <p style={{ color: '#64748b', fontSize: '14px', marginTop: '10px' }}>Por favor, solicite um novo link ao responsável.</p>
        </div>
      </div>
    );
  }

  if (assinado) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#f0fdf4' }}>
        <div style={{ maxWidth: '450px', padding: '40px 30px', textAlign: 'center', backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', borderTop: '6px solid #10b981' }}>
          <CheckCircle2 size={70} color="#10b981" style={{ margin: '0 auto 20px' }} />
          <h2 style={{ color: '#166534', margin: '0 0 10px 0', fontSize: '24px' }}>Ordem de Serviço Assinada!</h2>
          <p style={{ color: '#475569', fontSize: '15px', lineHeight: '1.5' }}>Obrigado. Este documento já consta como assinado e validado nos nossos registos.</p>
          <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f8fafc', borderRadius: '8px', fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
            <ShieldCheck size={14}/> Link expirado por motivos de segurança.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#f1f5f9', minHeight: '100vh', padding: '20px 10px' }}>
      <div style={{ maxWidth: '650px', margin: '0 auto' }}>
        
        {/* Cabeçalho da Empresa */}
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <img src={logoCarvalho} alt="Logo" style={{ height: '45px', marginBottom: '15px' }} />
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#dcfce7', color: '#166534', padding: '6px 12px', borderRadius: '50px', fontSize: '12px', fontWeight: 'bold' }}>
            <ShieldCheck size={16} /> Portal de Assinatura Seguro
          </div>
        </div>

        {renderResumoOS()}

        {!abrindoAssinatura ? (
          <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', textAlign: 'center' }}>
            <p style={{ fontSize: '14px', color: '#334155', marginBottom: '20px', lineHeight: '1.5' }}>
              Declaro que os serviços, quantidades e peças listados acima foram devidamente verificados e estão de acordo com o solicitado.
            </p>
            
            {/* 2. Formulário adicionado para requerer o nome antes de assinar */}
            <div style={{ marginBottom: '20px', textAlign: 'left' }}>
              <label style={{ fontSize: '13px', color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
                Nome do Responsável (Hyundai) *
              </label>
              <input 
                type="text" 
                value={nomeAssinante} 
                onChange={(e) => setNomeAssinante(e.target.value)} 
                placeholder="Ex: João Silva" 
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '15px', backgroundColor: '#f8fafc' }}
              />
            </div>

            {/* O botão agora exige que o nome seja preenchido para funcionar */}
            <Button 
              onClick={() => {
                if (!nomeAssinante.trim()) {
                  alert('Por favor, introduza o seu nome para prosseguir.');
                  return;
                }
                setAbrindoAssinatura(true);
              }} 
              style={{ width: '100%', height: '60px', fontSize: '16px', backgroundColor: nomeAssinante.trim() ? '#3b82f6' : '#94a3b8', display: 'flex', justifyContent: 'center', gap: '10px', fontWeight: 'bold', transition: '0.3s' }}
            >
              <FileSignature size={22} /> Prosseguir para Assinatura
            </Button>
          </div>
        ) : (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.98)', zIndex: 20000, display: 'flex', flexDirection: 'column' }}>
             {isPortrait ? (
               <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', padding: '20px', textAlign: 'center' }}>
                 <Smartphone size={70} style={{ marginBottom: '20px', transform: 'rotate(-90deg)', color: '#3b82f6' }} />
                 <h2 style={{ fontSize: '24px', margin: '0 0 10px 0' }}>Gire o seu telemóvel</h2>
                 <p style={{ color: '#cbd5e1', maxWidth: '300px', fontSize: '16px', lineHeight: '1.5' }}>Para garantir uma assinatura clara e legível no documento, por favor coloque o aparelho na <strong>horizontal</strong>.</p>
                 <Button onClick={() => setAbrindoAssinatura(false)} style={{ backgroundColor: 'transparent', border: '1px solid #475569', marginTop: '30px' }}>Voltar ao Resumo</Button>
               </div>
             ) : (
               <>
                 <div style={{ padding: '15px 20px', backgroundColor: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <h3 style={{ margin: 0, fontSize: '16px', color: '#1e293b' }}>Assinatura: {nomeAssinante} (Hyundai)</h3>
                   <button onClick={() => setAbrindoAssinatura(false)} style={{ background: '#f1f5f9', border: 'none', padding: '8px', borderRadius: '50%' }}><X size={20}/></button>
                 </div>
                 
                 <div style={{ flex: 1, position: 'relative', touchAction: 'none', backgroundColor: '#f8fafc' }}>
                   <canvas ref={canvasRef} style={{ width: '100%', height: '100%', cursor: 'crosshair', display: 'block' }} />
                   <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', opacity: 0.1, textAlign: 'center' }}>
                     <PenTool size={60} style={{ margin: '0 auto' }} />
                     <p style={{ fontSize: '20px', fontWeight: 'bold' }}>Assine o seu nome aqui</p>
                   </div>
                 </div>

                 <div style={{ padding: '20px', backgroundColor: 'white', display: 'flex', gap: '15px', borderTop: '1px solid #e2e8f0' }}>
                   <Button onClick={() => {
                      const canvas = canvasRef.current; const ctx = canvas?.getContext('2d');
                      if (ctx && canvas) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); desenhandoRef.current = false; }
                   }} style={{ flex: 1, backgroundColor: '#f1f5f9', color: '#475569', fontSize: '16px', fontWeight: 'bold' }}>
                     Limpar Tela
                   </Button>
                   <Button onClick={salvarAssinatura} style={{ flex: 2, backgroundColor: '#10b981', fontSize: '16px', fontWeight: 'bold' }}>
                     Confirmar e Concluir OS
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