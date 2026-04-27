// src/pages/Advertencias.tsx
import { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { 
  ShieldAlert, Printer, CheckCircle2, AlertCircle, FileText, X, 
  MessageSquare, FileSignature, Camera, Image as ImageIcon, PenTool, Eraser, Check 
} from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

interface Funcionario { id: string; nome: string; matricula: string; cpf: string; rg: string; }
interface Advertencia { 
  id: string; 
  funcionarioId: string; 
  funcionarioNome: string; 
  funcionarioCpf: string; 
  funcionarioRg: string;
  tipo: 'oral' | 'escrita';
  motivo: string; 
  dataOcorrencia: string; 
  assinaturaBase64?: string; 
  fotoOcorrenciaBase64?: string;
  createdAt: any; 
}

const INFRACÕES_COMUNS = [
  "Não utilização de EPI obrigatório (Óculos, Luvas, Bota, etc)",
  "Uso de celular em área operacional",
  "Atraso injustificado ao posto de trabalho",
  "Falta injustificada",
  "Desrespeito às normas de segurança da empresa",
  "Desperdício ou mau uso de materiais/EPIs",
  "Outros (Especificar nos detalhes)"
];

export default function Advertencias() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [advertencias, setAdvertencias] = useState<Advertencia[]>([]);
  
  const [funcionarioId, setFuncionarioId] = useState('');
  const [tipoAdvertencia, setTipoAdvertencia] = useState<'oral' | 'escrita'>('escrita');
  const [motivoComum, setMotivoComum] = useState('');
  const [detalhesMotivo, setDetalhesMotivo] = useState('');
  const [dataOcorrencia, setDataOcorrencia] = useState('');
  
  // --- ESTADOS DA ASSINATURA TELA CHEIA ---
  const [modalAssinaturaAberto, setModalAssinaturaAberto] = useState(false);
  const [assinaturaBase64, setAssinaturaBase64] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [estaDesenhando, setEstaDesenhando] = useState(false);
  
  // Foto da Ocorrência
  const [fotoOcorrenciaBase64, setFotoOcorrenciaBase64] = useState('');
  const fotoInputRef = useRef<HTMLInputElement>(null);

  const [termoParaImprimir, setTermoParaImprimir] = useState<Advertencia | null>(null);
  const [notificacao, setNotificacao] = useState<{msg: string, tipo: 'sucesso' | 'erro'} | null>(null);

  const avisar = (msg: string, tipo: 'sucesso' | 'erro' = 'sucesso') => {
    setNotificacao({ msg, tipo });
    setTimeout(() => setNotificacao(null), 4000);
  };

  useEffect(() => {
    const unsubFunc = onSnapshot(collection(db, 'funcionarios'), (s) => setFuncionarios(s.docs.map(d => ({ id: d.id, ...d.data() } as Funcionario))));
    const unsubAdv = onSnapshot(query(collection(db, 'advertencias'), orderBy('createdAt', 'desc')), (s) => setAdvertencias(s.docs.map(d => ({ id: d.id, ...d.data() } as Advertencia))));
    return () => { unsubFunc(); unsubAdv(); };
  }, []);

  // --- LÓGICA DO CANVAS (MESMA DA ENTREGA) ---
  useEffect(() => {
    if (!modalAssinaturaAberto || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resolução Retina/HD
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

    const start = (e: any) => {
      e.preventDefault();
      const { x, y } = getPos(e);
      ctx.beginPath(); ctx.moveTo(x, y);
      setEstaDesenhando(true);
    };

    const move = (e: any) => {
      if (!estaDesenhando) return;
      e.preventDefault();
      const { x, y } = getPos(e);
      ctx.lineTo(x, y); ctx.stroke();
    };

    const stop = () => setEstaDesenhando(false);

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', stop);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', stop);

    return () => {
      canvas.removeEventListener('mousedown', start);
      canvas.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', stop);
      canvas.removeEventListener('touchstart', start);
      canvas.removeEventListener('touchmove', move);
      canvas.removeEventListener('touchend', stop);
    };
  }, [modalAssinaturaAberto, estaDesenhando]);

  const limparAssinatura = () => {
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setAssinaturaBase64('');
  };

  const confirmarAssinatura = () => {
    if (canvasRef.current) {
      setAssinaturaBase64(canvasRef.current.toDataURL());
      setModalAssinaturaAberto(false);
    }
  };

  const processarFotoOcorrencia = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 800;
        let width = img.width; let height = img.height;
        if (width > height && width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } 
        else if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
        setFotoOcorrenciaBase64(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const registrarAdvertencia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!funcionarioId || !dataOcorrencia) return avisar("Preencha Colaborador e Data.", "erro");
    if (tipoAdvertencia === 'escrita' && !assinaturaBase64) return avisar("A assinatura é obrigatória para advertência escrita.", "erro");

    const func = funcionarios.find(f => f.id === funcionarioId);
    const motivoFinal = motivoComum === 'Outros (Especificar nos detalhes)' ? detalhesMotivo : `${motivoComum}. ${detalhesMotivo}`;

    try {
      await addDoc(collection(db, 'advertencias'), {
        funcionarioId: func!.id, funcionarioNome: func!.nome, funcionarioCpf: func!.cpf || '', funcionarioRg: func!.rg || '',
        tipo: tipoAdvertencia, motivo: motivoFinal, dataOcorrencia, 
        assinaturaBase64: tipoAdvertencia === 'escrita' ? assinaturaBase64 : '', 
        fotoOcorrenciaBase64, createdAt: serverTimestamp()
      });
      avisar("Registro salvo com sucesso!");
      setFuncionarioId(''); setMotivoComum(''); setDetalhesMotivo(''); setDataOcorrencia(''); 
      setAssinaturaBase64(''); setFotoOcorrenciaBase64('');
    } catch (error) { avisar("Erro ao salvar.", "erro"); }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '40px', padding: '10px' }}>
      
      <style>{`@media print { body * { visibility: hidden; } #print-section, #print-section * { visibility: visible; } #print-section { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; } .no-print { display: none !important; } }`}</style>

      {notificacao && (
        <div className="no-print" style={{ position: 'fixed', top: '10px', left: '10px', right: '10px', zIndex: 9999, backgroundColor: notificacao.tipo === 'sucesso' ? '#10b981' : '#ef4444', color: 'white', padding: '15px', borderRadius: '8px', display: 'flex', gap: '10px' }}>
          <CheckCircle2 /> <span>{notificacao.msg}</span>
        </div>
      )}

      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <ShieldAlert size={28} color="#ef4444" />
        <h1 style={{ fontSize: '22px', color: '#1e293b', margin: 0 }}>Ocorrências e Advertências</h1>
      </div>

      <div className="no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: 'var(--sombra-card)', borderTop: '4px solid #ef4444' }}>
          <form onSubmit={registrarAdvertencia} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            
            <div style={{ display: 'flex', gap: '10px', backgroundColor: '#f1f5f9', padding: '5px', borderRadius: '8px' }}>
              <button type="button" onClick={() => setTipoAdvertencia('oral')} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', backgroundColor: tipoAdvertencia === 'oral' ? '#f59e0b' : 'transparent', color: tipoAdvertencia === 'oral' ? 'white' : '#64748b' }}>
                <MessageSquare size={18} /> Oral
              </button>
              <button type="button" onClick={() => setTipoAdvertencia('escrita')} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', backgroundColor: tipoAdvertencia === 'escrita' ? '#ef4444' : 'transparent', color: tipoAdvertencia === 'escrita' ? 'white' : '#64748b' }}>
                <FileSignature size={18} /> Escrita
              </button>
            </div>

            <select value={funcionarioId} onChange={e => setFuncionarioId(e.target.value)} style={{ width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <option value="">Colaborador...</option>
              {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>

            <Input label="Data *" type="date" value={dataOcorrencia} onChange={e => setDataOcorrencia(e.target.value)} />

            <select value={motivoComum} onChange={e => setMotivoComum(e.target.value)} style={{ width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <option value="">Motivo Principal...</option>
              {INFRACÕES_COMUNS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>

            <textarea value={detalhesMotivo} onChange={e => setDetalhesMotivo(e.target.value)} placeholder="Detalhes adicionais..." style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', minHeight: '80px' }} />

            {/* EVIDÊNCIA FOTOGRÁFICA */}
            <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
              {fotoOcorrenciaBase64 ? (
                <div style={{ position: 'relative', height: '120px' }}>
                  <img src={fotoOcorrenciaBase64} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px' }} />
                  <button type="button" onClick={() => setFotoOcorrenciaBase64('')} style={{ position: 'absolute', top: 5, right: 5, backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: '25px', height: '25px' }}><X size={14}/></button>
                </div>
              ) : (
                <Button type="button" onClick={() => fotoInputRef.current?.click()} style={{ width: '100%', backgroundColor: 'white', color: '#3b82f6', border: '1px solid #bfdbfe' }}>
                  <Camera size={18} style={{ marginRight: '8px' }} /> Foto da Evidência
                </Button>
              )}
              <input type="file" accept="image/*" capture="environment" ref={fotoInputRef} onChange={processarFotoOcorrencia} style={{ display: 'none' }} />
            </div>

            {/* GATILHO DA ASSINATURA TELA CHEIA */}
            {tipoAdvertencia === 'escrita' && (
              <div 
                onClick={() => setModalAssinaturaAberto(true)}
                style={{ padding: '15px', border: '2px dashed #cbd5e1', borderRadius: '8px', textAlign: 'center', cursor: 'pointer', backgroundColor: '#f8fafc' }}
              >
                {assinaturaBase64 ? (
                  <img src={assinaturaBase64} style={{ maxHeight: '80px' }} />
                ) : (
                  <div style={{ color: '#64748b' }}>
                    <PenTool size={24} style={{ marginBottom: '5px' }} />
                    <p style={{ fontSize: '13px', fontWeight: 'bold' }}>Clique para Assinar</p>
                  </div>
                )}
              </div>
            )}

            <Button type="submit" style={{ height: '50px', backgroundColor: tipoAdvertencia === 'oral' ? '#f59e0b' : '#ef4444' }}>
              Salvar {tipoAdvertencia === 'oral' ? 'Orientação' : 'Advertência'}
            </Button>
          </form>
        </div>

        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: 'var(--sombra-card)' }}>
          <h3 style={{ marginBottom: '15px', fontSize: '16px' }}>Histórico Operacional</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '600px', overflowY: 'auto' }}>
            {advertencias.map(adv => (
              <div key={adv.id} style={{ border: '1px solid #e2e8f0', padding: '15px', borderRadius: '8px', backgroundColor: adv.tipo === 'oral' ? '#fffbeb' : '#fff5f5' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <strong style={{ color: '#1e293b' }}>{adv.funcionarioNome}</strong>
                  <span style={{ fontSize: '11px', fontWeight: 'bold' }}>{adv.dataOcorrencia.split('-').reverse().join('/')}</span>
                </div>
                <p style={{ fontSize: '13px', color: '#475569', margin: '5px 0' }}>{adv.motivo}</p>
                {adv.tipo === 'escrita' && (
                  <Button onClick={() => setTermoParaImprimir(adv)} style={{ width: '100%', backgroundColor: 'white', color: '#ef4444', border: '1px solid #fca5a5', marginTop: '10px' }}>
                    <Printer size={16} /> PDF Formal
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* --- MODAL DE ASSINATURA TELA CHEIA --- */}
      {modalAssinaturaAberto && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'white', zIndex: 10000, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0' }}>
            <h2 style={{ fontSize: '18px', margin: 0 }}>Assinatura do Colaborador</h2>
            <button onClick={() => setModalAssinaturaAberto(false)} style={{ background: 'none', border: 'none' }}><X size={24} /></button>
          </div>
          <div style={{ flex: 1, position: 'relative', backgroundColor: '#fcfcfc' }}>
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%', touchAction: 'none' }} />
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#f1f5f9', pointerEvents: 'none', zIndex: 0, fontSize: '40px', fontWeight: 'bold' }}>ASSINE AQUI</div>
          </div>
          <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', borderTop: '1px solid #e2e8f0' }}>
            <Button onClick={limparAssinatura} style={{ backgroundColor: '#f1f5f9', color: '#475569' }}><Eraser size={20} /> Limpar</Button>
            <Button onClick={confirmarAssinatura} style={{ backgroundColor: '#10b981' }}><Check size={20} /> Confirmar</Button>
          </div>
        </div>
      )}

      {/* PREVIEW DO PDF (INALTERADO) */}
      {termoParaImprimir && (
        <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0, 0.9)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '800px', borderRadius: '8px', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            <div style={{ padding: '15px 20px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: 0 }}>Termo de Advertência</h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                <Button onClick={() => window.print()} style={{ backgroundColor: '#2563eb' }}><Printer size={16} /> Imprimir / PDF</Button>
                <button onClick={() => setTermoParaImprimir(null)} style={{ background: 'none', border: 'none' }}><X size={24} /></button>
              </div>
            </div>
            <div id="print-section" style={{ padding: '40px', overflowY: 'auto', backgroundColor: 'white', color: 'black', fontFamily: 'serif' }}>
              <div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '2px solid black', paddingBottom: '20px' }}>
                <h1 style={{ fontSize: '20px', margin: 0 }}>CARVALHO FUNILARIA E PINTURAS LTDA</h1>
                <p style={{ fontSize: '12px' }}>CNPJ: 31.362.302/0001-33</p>
                <h2 style={{ fontSize: '18px', marginTop: '20px', textDecoration: 'underline' }}>TERMO DE ADVERTÊNCIA DISCIPLINAR</h2>
              </div>
              <div style={{ fontSize: '14px', lineHeight: '1.8' }}>
                <p>Advertimos o(a) Sr(a). <strong>{termoParaImprimir.funcionarioNome}</strong> (CPF: {termoParaImprimir.funcionarioCpf || '___'}) pela ocorrência no dia {termoParaImprimir.dataOcorrencia.split('-').reverse().join('/')}:</p>
                <div style={{ padding: '15px', border: '1px solid black', margin: '20px 0' }}>{termoParaImprimir.motivo}</div>
                <p>Para que surta seus efeitos legais, assinam o presente termo.</p>
                <p style={{ textAlign: 'right' }}>Araraquara/SP, ____ de ________ de _______.</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: '60px', textAlign: 'center' }}>
                <div><div style={{ borderBottom: '1px solid black' }}></div><strong>A EMPRESA</strong></div>
                <div style={{ position: 'relative' }}>
                  {termoParaImprimir.assinaturaBase64 && <img src={termoParaImprimir.assinaturaBase64} style={{ position: 'absolute', bottom: '5px', left: '50%', transform: 'translateX(-50%)', maxHeight: '60px' }} />}
                  <div style={{ borderBottom: '1px solid black', marginTop: '20px' }}></div><strong>{termoParaImprimir.funcionarioNome}</strong>
                </div>
              </div>
              {termoParaImprimir.fotoOcorrenciaBase64 && (
                <div style={{ marginTop: '50px', textAlign: 'center' }}>
                  <p style={{ fontWeight: 'bold' }}>ANEXO FOTOGRÁFICO</p>
                  <img src={termoParaImprimir.fotoOcorrenciaBase64} style={{ maxWidth: '100%', border: '1px solid #ccc' }} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}