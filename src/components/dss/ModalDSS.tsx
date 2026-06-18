// src/components/dss/ModalDSS.tsx
import { useState, useEffect, useRef } from 'react';
import { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import jsPDF from "jspdf";
import logoCarvalho from '../../assets/logopdf.png';

import { X, PenTool, Smartphone, Users, Plus, Download, ShieldCheck } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';

interface Props {
  aberto: boolean;
  onClose: () => void;
  funcionarios: any[];
  avisar: (msg: string, tipo?: 'sucesso' | 'erro') => void;
}

export default function ModalDSS({ aberto, onClose, funcionarios, avisar }: Props) {
  const [step, setStep] = useState(0);
  const [dssGlobais, setDssGlobais] = useState<any[]>([]);

  // Formulário
  const [tema, setTema] = useState('');
  const [data, setData] = useState('');
  const [lider, setLider] = useState('');
  const [selecionados, setSelecionados] = useState<string[]>([]);
  
  // Assinaturas
  const [assinaturaLider, setAssinaturaLider] = useState('');
  const [assinaturasFuncs, setAssinaturasFuncs] = useState<Record<string, string>>({});
  const [currentFuncIndex, setCurrentFuncIndex] = useState(0);

  // Responsividade do Canvas
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const desenhandoRef = useRef(false);

  useEffect(() => {
    if (!aberto) return;
    const q = query(collection(db, 'dss'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setDssGlobais(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [aberto]);

  useEffect(() => {
    const handleResize = () => setIsPortrait(window.innerHeight > window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const iniciarNovoDSS = () => {
    setTema(''); setData(''); setLider(''); setSelecionados([]);
    setAssinaturaLider(''); setAssinaturasFuncs({}); setCurrentFuncIndex(0); setStep(1);
  };

  const setupCanvas = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setTimeout(() => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
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

  useEffect(() => {
    if ((step === 2 || step === 3) && !isPortrait) setupCanvas();
  }, [step, isPortrait, currentFuncIndex]);

  const limparCanvas = () => {
    const canvas = canvasRef.current; const ctx = canvas?.getContext('2d');
    if (ctx && canvas) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); desenhandoRef.current = false; }
  };

  const confirmarAssinatura = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const jpegBase64 = canvas.toDataURL('image/jpeg', 0.6);

    if (step === 2) {
      setAssinaturaLider(jpegBase64);
      setStep(3);
    } else if (step === 3) {
      const funcId = selecionados[currentFuncIndex];
      setAssinaturasFuncs(prev => ({ ...prev, [funcId]: jpegBase64 }));
      
      if (currentFuncIndex + 1 < selecionados.length) {
        setCurrentFuncIndex(currentFuncIndex + 1);
      } else {
        try {
          const participantesData = selecionados.map(id => {
            const f = funcionarios.find(x => x.id === id);
            return {
              funcionarioId: id,
              nome: f?.nome || 'Desconhecido',
              cpf: f?.cpf || 'Não Informado',
              assinaturaFunc: assinaturasFuncs[id] || jpegBase64 
            };
          });

          await addDoc(collection(db, 'dss'), {
            tema, data, lider, assinaturaLider,
            participantes: participantesData, createdAt: serverTimestamp()
          });
          avisar("DSS registrado com sucesso!");
          setStep(0);
        } catch (e) { avisar("Erro ao salvar DSS.", "erro"); }
      }
    }
  };

  const gerarAtaPDF = (dss: any) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    
    try { doc.addImage(logoCarvalho, 'PNG', 15, 10, 40, 14); } catch(e){}
    doc.setFont("helvetica", "bold"); doc.setFontSize(16);
    doc.text("ATA DE DIÁLOGO SEMANAL DE SEGURANÇA (DSS)", 105, 20, { align: 'center' });
    
    doc.setLineWidth(0.5); doc.line(15, 25, 195, 25);
    
    doc.setFontSize(11);
    doc.text(`Tema Abordado:`, 15, 35); doc.setFont("helvetica", "normal"); doc.text(dss.tema, 48, 35);
    doc.setFont("helvetica", "bold"); doc.text(`Data:`, 15, 42); doc.setFont("helvetica", "normal"); doc.text(new Date(`${dss.data}T12:00:00`).toLocaleDateString('pt-BR'), 26, 42);
    doc.setFont("helvetica", "bold"); doc.text(`Ministrado por:`, 15, 49); doc.setFont("helvetica", "normal"); doc.text(dss.lider, 45, 49);

    doc.setFont("helvetica", "bold");
    doc.text("Assinatura do Responsável:", 120, 35);
    try { doc.addImage(dss.assinaturaLider, 'JPEG', 120, 38, 40, 15); } catch(e){}

    // Tabela de Participantes
    let y = 65;
    doc.setFillColor(241, 245, 249); doc.rect(15, y - 5, 180, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.text("Nome do Colaborador", 18, y);
    doc.text("Assinatura", 120, y);
    doc.line(15, y + 3, 195, y + 3);

    doc.setFont("helvetica", "normal");
    y += 12;

    dss.participantes.forEach((p: any) => {
      if (y > 275) { doc.addPage(); y = 20; }
      doc.text(p.nome, 18, y);
      try { doc.addImage(p.assinaturaFunc, 'JPEG', 120, y - 6, 40, 12); } catch(e){}
      doc.line(15, y + 8, 195, y + 8);
      y += 15;
    });

    const fileName = `Ata_DSS_${dss.tema.replace(/\s+/g, '_')}_${dss.data}.pdf`;
    doc.save(fileName);
  };

  if (!aberto) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'white', zIndex: 15000, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '15px 20px', backgroundColor: '#0ea5e9', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}><ShieldCheck/> Gestão de DSS</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X size={28}/></button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', backgroundColor: '#f0f9ff' }}>
        
        {step === 0 && (
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#0c4a6e' }}>Diálogos Realizados</h3>
              <Button onClick={iniciarNovoDSS} style={{ backgroundColor: '#0284c7' }}><Plus size={18} style={{marginRight:'5px'}}/> Iniciar Novo DSS</Button>
            </div>

            {dssGlobais.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px', backgroundColor: 'white', borderRadius: '16px', border: '1px dashed #bae6fd' }}>
                <ShieldCheck size={48} color="#bae6fd" style={{ margin: '0 auto 15px' }} />
                <p style={{ color: '#0ea5e9' }}>Nenhum DSS registrado ainda.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {dssGlobais.map(dss => (
                  <div key={dss.id} style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', border: '1px solid #e0f2fe', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ fontSize: '16px', color: '#0369a1', display: 'block' }}>{dss.tema}</strong>
                      <span style={{ fontSize: '13px', color: '#64748b' }}>Aplicado por: {dss.lider} | Data: {new Date(`${dss.data}T12:00:00`).toLocaleDateString('pt-BR')} | {dss.participantes?.length || 0} Participantes</span>
                    </div>
                    <Button onClick={() => gerarAtaPDF(dss)} style={{ backgroundColor: '#0284c7', display: 'flex', gap: '8px' }}><Download size={16}/> Ata em PDF</Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div style={{ maxWidth: '700px', margin: '0 auto', backgroundColor: 'white', padding: '30px', borderRadius: '20px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '20px', color: '#0c4a6e', borderBottom: '2px solid #e0f2fe', paddingBottom: '10px' }}>Passo 1: Dados do DSS</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '30px' }}>
              <Input label="Tema do Diálogo *" placeholder="Ex: Uso Correto de EPIs, Cuidados com as Mãos..." value={tema} onChange={e => setTema(e.target.value)} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <Input label="Data *" type="date" value={data} onChange={e => setData(e.target.value)} />
                <Input label="Líder / Responsável *" placeholder="Quem aplicou?" value={lider} onChange={e => setLider(e.target.value)} />
              </div>
            </div>

            <h4 style={{ fontSize: '14px', color: '#475569', marginBottom: '10px' }}>Selecione os Participantes ({selecionados.length})</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', maxHeight: '300px', overflowY: 'auto', padding: '10px', border: '1px solid #e0f2fe', borderRadius: '12px' }}>
              {funcionarios.filter(f => f.status !== 'desligado').map(f => (
                <label key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', backgroundColor: selecionados.includes(f.id) ? '#e0f2fe' : '#f8fafc', border: `1px solid ${selecionados.includes(f.id) ? '#38bdf8' : '#f1f5f9'}`, borderRadius: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={selecionados.includes(f.id)} onChange={() => setSelecionados(prev => prev.includes(f.id) ? prev.filter(i => i !== f.id) : [...prev, f.id])} style={{ width: '18px', height: '18px' }} />
                  <span style={{ fontSize: '14px', fontWeight: selecionados.includes(f.id) ? 'bold' : 'normal' }}>{f.nome}</span>
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '15px', marginTop: '30px' }}>
              <Button onClick={() => setStep(0)} style={{ flex: 1, backgroundColor: '#f1f5f9', color: '#475569' }}>Cancelar</Button>
              <Button onClick={() => setStep(2)} disabled={!tema || !data || !lider || selecionados.length === 0} style={{ flex: 2, backgroundColor: '#0284c7' }}>Recolher Assinaturas</Button>
            </div>
          </div>
        )}

        {(step === 2 || step === 3) && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'white', zIndex: 16000, display: 'flex', flexDirection: 'column' }}>
            {isPortrait ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0c4a6e', color: 'white', padding: '20px', textAlign: 'center' }}>
                <Smartphone size={70} style={{ marginBottom: '20px', transform: 'rotate(-90deg)', color: '#38bdf8' }} />
                <h2>Gire o Celular</h2>
                <p style={{ color: '#bae6fd', maxWidth: '300px' }}>Para coletar as assinaturas no formato perfeito para a Ata, coloque o aparelho na <strong>horizontal</strong>.</p>
                <Button onClick={() => setStep(1)} style={{ backgroundColor: '#0369a1', marginTop: '20px' }}>Voltar</Button>
              </div>
            ) : (
              <>
                <div style={{ padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f0f9ff', borderBottom: '1px solid #bae6fd' }}>
                  <div>
                    <h2 style={{ fontSize: '18px', margin: 0, color: '#0c4a6e' }}>
                      {step === 2 ? `Assinatura do Líder: ${lider}` : `Assinatura do Colaborador: ${funcionarios.find(f => f.id === selecionados[currentFuncIndex])?.nome}`}
                    </h2>
                    {step === 3 && <span style={{ fontSize: '12px', color: '#0284c7', fontWeight: 'bold' }}>Coletando: {currentFuncIndex + 1} de {selecionados.length}</span>}
                  </div>
                  <button onClick={() => setStep(1)} style={{ background: '#bae6fd', border: 'none', borderRadius: '50%', padding: '8px' }}><X/></button>
                </div>
                <div style={{ flex: 1, position: 'relative', touchAction: 'none' }}>
                  <canvas ref={canvasRef} style={{ width: '100%', height: '100%', cursor: 'crosshair', display: 'block' }} />
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', opacity: 0.1, textAlign: 'center' }}>
                    <PenTool size={60} style={{ margin: '0 auto' }} />
                    <p style={{ fontSize: '18px', fontWeight: 'bold' }}>Assine Aqui</p>
                  </div>
                </div>
                <div style={{ padding: '15px 20px', borderTop: '1px solid #bae6fd', display: 'flex', gap: '15px', backgroundColor: '#f0f9ff' }}>
                  <Button onClick={limparCanvas} style={{ flex: 1, backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #7dd3fc' }}>Limpar</Button>
                  <Button onClick={confirmarAssinatura} style={{ flex: 2, backgroundColor: '#0284c7', fontWeight: 'bold' }}>
                    {step === 3 && currentFuncIndex + 1 === selecionados.length ? 'Finalizar DSS' : 'Confirmar e Avançar'}
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