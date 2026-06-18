// src/components/treinamentos/ModalTreinamentos.tsx
import { useState, useEffect, useRef } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';

import jsPDF from "jspdf";
import logoCarvalho from '../../assets/logopdf.png'; // Padronizado

import { GraduationCap, X, Plus, Award, Send, Smartphone, PenTool } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';

interface Props {
  aberto: boolean;
  onClose: () => void;
  funcionarios: any[];
  treinamentosGlobais: any[];
  avisar: (msg: string, tipo?: 'sucesso' | 'erro') => void;
}

export default function ModalTreinamentos({ aberto, onClose, funcionarios, treinamentosGlobais, avisar }: Props) {
  const [tStep, setTStep] = useState(0); 
  const [tTitulo, setTTitulo] = useState('');
  const [tData, setTData] = useState('');
  const [tInstrutor, setTInstrutor] = useState('');
  const [tCargaHoraria, setTCargaHoraria] = useState('1');
  const [tSelecionados, setTSelecionados] = useState<string[]>([]);
  const [tAssinaturaInstrutor, setTAssinaturaInstrutor] = useState('');
  const [tAssinaturasFuncs, setTAssinaturasFuncs] = useState<Record<string, string>>({});
  const [tCurrentFuncIndex, setTCurrentFuncIndex] = useState(0);
  
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const desenhandoRef = useRef(false);

  useEffect(() => {
    const handleResize = () => setIsPortrait(window.innerHeight > window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const iniciarNovoTreinamento = () => {
    setTTitulo(''); setTData(''); setTInstrutor(''); setTCargaHoraria('1');
    setTSelecionados([]); setTAssinaturaInstrutor(''); setTAssinaturasFuncs({});
    setTCurrentFuncIndex(0); setTStep(1);
  };

  const toggleFuncTreino = (id: string) => {
    if (tSelecionados.includes(id)) setTSelecionados(tSelecionados.filter(i => i !== id));
    else setTSelecionados([...tSelecionados, id]);
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
    if ((tStep === 2 || tStep === 3) && !isPortrait) setupCanvas();
  }, [tStep, isPortrait, tCurrentFuncIndex]);

  const limparCanvas = () => {
    const canvas = canvasRef.current; const ctx = canvas?.getContext('2d');
    if (ctx && canvas) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); desenhandoRef.current = false; }
  };

  const confirmarAssinaturaTreino = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const jpegBase64 = canvas.toDataURL('image/jpeg', 0.6);

    if (tStep === 2) {
      setTAssinaturaInstrutor(jpegBase64);
      setTStep(3);
    } else if (tStep === 3) {
      const funcId = tSelecionados[tCurrentFuncIndex];
      setTAssinaturasFuncs(prev => ({ ...prev, [funcId]: jpegBase64 }));
      
      if (tCurrentFuncIndex + 1 < tSelecionados.length) {
        setTCurrentFuncIndex(tCurrentFuncIndex + 1);
      } else {
        try {
          const participantesData = tSelecionados.map(id => {
            const f = funcionarios.find(x => x.id === id);
            return {
              funcionarioId: id,
              nome: f?.nome || 'Desconhecido',
              cpf: f?.cpf || 'Não Informado',
              assinaturaFunc: tAssinaturasFuncs[id] || jpegBase64 
            };
          });

          await addDoc(collection(db, 'treinamentos'), {
            titulo: tTitulo, data: tData, instrutor: tInstrutor, cargaHoraria: tCargaHoraria,
            assinaturaInstrutor: tAssinaturaInstrutor, participantes: participantesData, createdAt: serverTimestamp()
          });
          avisar("Treinamento registrado com sucesso!");
          setTStep(0);
        } catch (e) { avisar("Erro ao salvar treinamento.", "erro"); }
      }
    }
  };

  const gerarCertificadoPDF = (treino: any, part: any, viaWhatsApp: boolean) => {
    try {
      const doc = new jsPDF('landscape'); 
      const azul = [30, 41, 59];
      const dourado = [218, 165, 32];

      doc.setDrawColor(azul[0], azul[1], azul[2]);
      doc.setLineWidth(3); doc.rect(10, 10, 277, 190);
      doc.setDrawColor(dourado[0], dourado[1], dourado[2]);
      doc.setLineWidth(1); doc.rect(13, 13, 271, 184);

      // ✨ Atualizado para formato PNG do logopdf.png
      try { doc.addImage(logoCarvalho, 'PNG', 125, 20, 45, 15); } catch(e){}

      doc.setTextColor(azul[0], azul[1], azul[2]);
      doc.setFont("helvetica", "bold"); doc.setFontSize(28);
      doc.text("CERTIFICADO DE CONCLUSÃO", 148, 55, { align: 'center' });

      doc.setTextColor(50, 50, 50);
      doc.setFont("helvetica", "normal"); doc.setFontSize(14);
      doc.text(`Certificamos para os devidos fins que o(a) colaborador(a)`, 148, 80, { align: 'center' });
      
      doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(0, 0, 0);
      doc.text(part.nome.toUpperCase(), 148, 95, { align: 'center' });
      
      doc.setFont("helvetica", "normal"); doc.setFontSize(14); doc.setTextColor(50, 50, 50);
      const docFunc = part.cpf !== 'Não Informado' ? `inscrito(a) no CPF: ${part.cpf}` : `colaborador(a) desta empresa`;
      const dataFormatada = new Date(`${treino.data}T12:00:00`).toLocaleDateString('pt-BR');
      
      const textoCorpo = `${docFunc}, participou com êxito do treinamento\n"${treino.titulo.toUpperCase()}", realizado em ${dataFormatada},\ncom carga horária total de ${treino.cargaHoraria} hora(s).`;
      doc.text(textoCorpo, 148, 115, { align: 'center', lineHeightFactor: 1.5 });

      try { doc.addImage(treino.assinaturaInstrutor, 'JPEG', 50, 150, 50, 20); } catch(e){}
      doc.setDrawColor(0,0,0); doc.setLineWidth(0.5); doc.line(40, 172, 110, 172);
      doc.setFontSize(12); doc.text(treino.instrutor, 75, 178, { align: 'center' });
      doc.setFontSize(10); doc.text("Instrutor Responsável", 75, 183, { align: 'center' });

      try { doc.addImage(part.assinaturaFunc, 'JPEG', 180, 150, 50, 20); } catch(e){}
      doc.line(170, 172, 240, 172);
      doc.setFontSize(12); doc.text(part.nome, 205, 178, { align: 'center' });
      doc.setFontSize(10); doc.text("Colaborador(a)", 205, 183, { align: 'center' });

      // Nome do Ficheiro Limpo com a Data
      const dataArquivo = treino.data.split('-').reverse().join('-');
      const fileName = `Certificado_${part.nome.replace(/\s+/g, '_')}_${dataArquivo}.pdf`;
      doc.save(fileName);

      if (viaWhatsApp) {
        const msg = `Olá ${part.nome.split(' ')[0]}! Tudo bem?\n\nSegue em anexo o seu *Certificado de Conclusão* do treinamento de _"${treino.titulo}"_ que realizamos em ${dataFormatada}.\n\nPara visualizar, basta eu te enviar o PDF que acabei de baixar!`;
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
      }

    } catch (e) { alert("Erro ao gerar certificado."); }
  };

  if (!aberto) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'white', zIndex: 15000, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '15px 20px', backgroundColor: '#1e293b', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}><GraduationCap/> Gestão de Treinamentos</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X size={28}/></button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', backgroundColor: '#f8fafc' }}>
        {tStep === 0 && (
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#1e293b' }}>Treinamentos Realizados</h3>
              <Button onClick={iniciarNovoTreinamento} style={{ backgroundColor: '#8b5cf6' }}><Plus size={18} style={{marginRight:'5px'}}/> Registrar Novo Treinamento</Button>
            </div>
            {treinamentosGlobais.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px', backgroundColor: 'white', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
                <GraduationCap size={48} color="#cbd5e1" style={{ margin: '0 auto 15px' }} />
                <p style={{ color: '#64748b' }}>Nenhum treinamento registrado na empresa.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {treinamentosGlobais.map(t => (
                  <div key={t.id} style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                      <div>
                        <strong style={{ fontSize: '18px', color: '#4c1d95', display: 'block' }}>{t.titulo}</strong>
                        <span style={{ fontSize: '13px', color: '#64748b' }}>Ministrado por: {t.instrutor} | Carga: {t.cargaHoraria}h | Data: {new Date(`${t.data}T12:00:00`).toLocaleDateString('pt-BR')}</span>
                      </div>
                      <span style={{ backgroundColor: '#f3e8ff', color: '#7c3aed', padding: '6px 12px', borderRadius: '50px', fontSize: '12px', fontWeight: 'bold' }}>
                        {t.participantes?.length || 0} Participantes
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', borderTop: '1px solid #f1f5f9', paddingTop: '15px' }}>
                      {t.participantes?.map((p:any, idx:number) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#1e293b' }}>{p.nome.split(' ')[0]}</span>
                          <button onClick={() => gerarCertificadoPDF(t, p, false)} style={{ background: 'none', border: 'none', color: '#8b5cf6', cursor: 'pointer' }} title="Baixar"><Award size={16}/></button>
                          <button onClick={() => gerarCertificadoPDF(t, p, true)} style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer' }} title="WhatsApp"><Send size={16}/></button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tStep === 1 && (
          <div style={{ maxWidth: '700px', margin: '0 auto', backgroundColor: 'white', padding: '30px', borderRadius: '20px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '20px', color: '#1e293b', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px' }}>Passo 1: Dados do Treinamento</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '30px' }}>
              <Input label="Título / Tema *" placeholder="Ex: NR-35 Trabalho em Altura" value={tTitulo} onChange={e => setTTitulo(e.target.value)} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <Input label="Data *" type="date" value={tData} onChange={e => setTData(e.target.value)} />
                <Input label="Carga Horária *" type="number" value={tCargaHoraria} onChange={e => setTCargaHoraria(e.target.value)} />
              </div>
              <Input label="Nome do Instrutor *" placeholder="Ex: João Engenheiro" value={tInstrutor} onChange={e => setTInstrutor(e.target.value)} />
            </div>

            <h4 style={{ fontSize: '14px', color: '#475569', marginBottom: '10px' }}>Selecione os Participantes ({tSelecionados.length})</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', maxHeight: '300px', overflowY: 'auto', padding: '10px', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
              {funcionarios.filter(f => f.status !== 'desligado').map(f => (
                <label key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', backgroundColor: tSelecionados.includes(f.id) ? '#f3e8ff' : '#f8fafc', border: `1px solid ${tSelecionados.includes(f.id) ? '#c084fc' : '#e2e8f0'}`, borderRadius: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={tSelecionados.includes(f.id)} onChange={() => toggleFuncTreino(f.id)} style={{ width: '18px', height: '18px' }} />
                  <span style={{ fontSize: '14px', fontWeight: tSelecionados.includes(f.id) ? 'bold' : 'normal' }}>{f.nome}</span>
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '15px', marginTop: '30px' }}>
              <Button onClick={() => setTStep(0)} style={{ flex: 1, backgroundColor: '#f1f5f9', color: '#475569' }}>Cancelar</Button>
              <Button onClick={() => setTStep(2)} disabled={!tTitulo || !tData || !tInstrutor || tSelecionados.length === 0} style={{ flex: 2, backgroundColor: '#8b5cf6' }}>Avançar para Assinaturas</Button>
            </div>
          </div>
        )}

        {(tStep === 2 || tStep === 3) && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'white', zIndex: 16000, display: 'flex', flexDirection: 'column' }}>
            {isPortrait ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e293b', color: 'white', padding: '20px', textAlign: 'center' }}>
                <Smartphone size={70} style={{ marginBottom: '20px', transform: 'rotate(-90deg)', color: '#8b5cf6' }} />
                <h2>Gire o Celular</h2>
                <p style={{ color: '#cbd5e1', maxWidth: '300px' }}>Para coletar as assinaturas no formato perfeito para o certificado, coloque o aparelho na <strong>horizontal</strong>.</p>
                <Button onClick={() => setTStep(1)} style={{ backgroundColor: '#475569', marginTop: '20px' }}>Voltar</Button>
              </div>
            ) : (
              <>
                <div style={{ padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <div>
                    <h2 style={{ fontSize: '18px', margin: 0, color: '#1e293b' }}>
                      {tStep === 2 ? `Assinatura do Instrutor: ${tInstrutor}` : `Assinatura do Aluno: ${funcionarios.find(f => f.id === tSelecionados[tCurrentFuncIndex])?.nome}`}
                    </h2>
                    {tStep === 3 && <span style={{ fontSize: '12px', color: '#8b5cf6', fontWeight: 'bold' }}>Coletando: {tCurrentFuncIndex + 1} de {tSelecionados.length}</span>}
                  </div>
                  <button onClick={() => setTStep(1)} style={{ background: '#e2e8f0', border: 'none', borderRadius: '50%', padding: '8px' }}><X/></button>
                </div>
                <div style={{ flex: 1, position: 'relative', touchAction: 'none' }}>
                  <canvas ref={canvasRef} style={{ width: '100%', height: '100%', cursor: 'crosshair', display: 'block' }} />
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', opacity: 0.1, textAlign: 'center' }}>
                    <PenTool size={60} style={{ margin: '0 auto' }} />
                    <p style={{ fontSize: '18px', fontWeight: 'bold' }}>Assine Aqui</p>
                  </div>
                </div>
                <div style={{ padding: '15px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '15px', backgroundColor: '#f8fafc' }}>
                  <Button onClick={limparCanvas} style={{ flex: 1, backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}>Limpar</Button>
                  <Button onClick={confirmarAssinaturaTreino} style={{ flex: 2, backgroundColor: '#10b981', fontWeight: 'bold' }}>
                    {tStep === 3 && tCurrentFuncIndex + 1 === tSelecionados.length ? 'Finalizar Treinamento' : 'Confirmar e Avançar'}
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