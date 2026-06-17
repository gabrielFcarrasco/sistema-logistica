// src/components/advertencias/FormularioAdvertencia.tsx
import { useState, useRef } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';

import { MessageSquare, FileSignature, Camera, PenTool, X, Users, AlertTriangle, Printer } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import ModalAssinaturaAdv from './ModalAssinaturaAdv';

const INFRACÕES_COMUNS = [
  "Não utilização de EPI obrigatório (Óculos, Luvas, Bota, etc)",
  "Uso de celular em área operacional",
  "Atraso injustificado ao posto de trabalho",
  "Falta injustificada",
  "Desrespeito às normas de segurança da empresa",
  "Desperdício ou mau uso de materiais/EPIs",
  "Insubordinação / Descumprimento de Ordem",
  "Outros (Especificar nos detalhes)"
];

interface Props {
  funcionarios: any[];
  avisar: (msg: string, tipo?: 'sucesso' | 'erro') => void;
}

export default function FormularioAdvertencia({ funcionarios, avisar }: Props) {
  const [funcionarioId, setFuncionarioId] = useState('');
  const [tipoAdvertencia, setTipoAdvertencia] = useState<'oral' | 'escrita'>('escrita');
  
  const [dataOcorrencia, setDataOcorrencia] = useState('');
  const [horaOcorrencia, setHoraOcorrencia] = useState('');
  const [motivoComum, setMotivoComum] = useState('');
  const [detalhesMotivo, setDetalhesMotivo] = useState('');
  
  const [fotoOcorrenciaBase64, setFotoOcorrenciaBase64] = useState('');
  const fotoInputRef = useRef<HTMLInputElement>(null);
  
  const [metodoAssinatura, setMetodoAssinatura] = useState<'digital' | 'fisica' | 'recusa'>('digital');
  const [modalAssinaturaAberto, setModalAssinaturaAberto] = useState(false);
  const [assinaturaBase64, setAssinaturaBase64] = useState('');
  
  const [nomeTestemunha1, setNomeTestemunha1] = useState('');
  const [nomeTestemunha2, setNomeTestemunha2] = useState('');

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
    
    // Validações Básicas
    if (!funcionarioId || !dataOcorrencia) return avisar("Preencha Colaborador e Data.", "erro");
    
    // Validações Jurídicas Dinâmicas
    if (tipoAdvertencia === 'escrita') {
      if (metodoAssinatura === 'digital' && !assinaturaBase64) {
        return avisar("Recolha a assinatura digital no aparelho ou mude o método de assinatura.", "erro");
      }
      // ✨ Alteração: Exige apenas a Testemunha 1 para não bloquear a operação
      if (metodoAssinatura === 'recusa' && !nomeTestemunha1) {
        return avisar("Em caso de recusa, preencha pelo menos o nome de UMA testemunha.", "erro");
      }
    }

    const func = funcionarios.find(f => f.id === funcionarioId);
    const motivoFinal = motivoComum === 'Outros (Especificar nos detalhes)' ? detalhesMotivo : `${motivoComum}. ${detalhesMotivo}`;

    try {
      await addDoc(collection(db, 'advertencias'), {
        funcionarioId: func.id, 
        funcionarioNome: func.nome, 
        funcionarioCpf: func.cpf || '', 
        funcionarioRg: func.rg || '',
        tipo: tipoAdvertencia, 
        motivo: motivoFinal, 
        dataOcorrencia,
        horaOcorrencia,
        metodoAssinatura: tipoAdvertencia === 'oral' ? 'fisica' : metodoAssinatura,
        assinaturaBase64: (tipoAdvertencia === 'escrita' && metodoAssinatura === 'digital') ? assinaturaBase64 : '', 
        recusouAssinar: metodoAssinatura === 'recusa',
        nomeTestemunha1: metodoAssinatura === 'recusa' ? nomeTestemunha1 : '', 
        nomeTestemunha2: metodoAssinatura === 'recusa' ? nomeTestemunha2 : '', 
        fotoOcorrenciaBase64, 
        createdAt: serverTimestamp()
      });
      
      avisar("Registro disciplinar salvo com sucesso!");
      
      setFuncionarioId(''); setMotivoComum(''); setDetalhesMotivo(''); 
      setDataOcorrencia(''); setHoraOcorrencia(''); setAssinaturaBase64(''); 
      setFotoOcorrenciaBase64(''); setMetodoAssinatura('digital');
      setNomeTestemunha1(''); setNomeTestemunha2('');
      
    } catch (error) { 
      avisar("Erro ao salvar no Firestore.", "erro"); 
    }
  };

  return (
    <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: 'var(--sombra-card)', borderTop: '4px solid #ef4444', height: 'fit-content' }}>
      <form onSubmit={registrarAdvertencia} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* BLOCO 1: TIPO DE REGISTRO */}
        <div style={{ display: 'flex', gap: '10px', backgroundColor: '#f1f5f9', padding: '5px', borderRadius: '8px' }}>
          <button type="button" onClick={() => setTipoAdvertencia('oral')} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', backgroundColor: tipoAdvertencia === 'oral' ? '#f59e0b' : 'transparent', color: tipoAdvertencia === 'oral' ? 'white' : '#64748b', transition: 'all 0.2s' }}>
            <MessageSquare size={18} /> Orientação Oral
          </button>
          <button type="button" onClick={() => setTipoAdvertencia('escrita')} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', backgroundColor: tipoAdvertencia === 'escrita' ? '#ef4444' : 'transparent', color: tipoAdvertencia === 'escrita' ? 'white' : '#64748b', transition: 'all 0.2s' }}>
            <FileSignature size={18} /> Advertência Escrita
          </button>
        </div>

        {/* BLOCO 2: DADOS DA OCORRÊNCIA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h4 style={{ margin: 0, fontSize: '14px', color: '#64748b', textTransform: 'uppercase' }}>1. Dados da Ocorrência</h4>
          
          <select value={funcionarioId} onChange={e => setFuncionarioId(e.target.value)} style={{ width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', outline: 'none' }}>
            <option value="">Selecione o Colaborador...</option>
            {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>

          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 2 }}>
              <Input label="Data *" type="date" value={dataOcorrencia} onChange={e => setDataOcorrencia(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <Input label="Hora (Opcional)" type="time" value={horaOcorrencia} onChange={e => setHoraOcorrencia(e.target.value)} />
            </div>
          </div>
        </div>

        {/* BLOCO 3: RELATO E EVIDÊNCIAS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px dashed #cbd5e1', paddingTop: '15px' }}>
          <h4 style={{ margin: 0, fontSize: '14px', color: '#64748b', textTransform: 'uppercase' }}>2. Relato e Provas</h4>

          <select value={motivoComum} onChange={e => setMotivoComum(e.target.value)} style={{ width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', outline: 'none' }}>
            <option value="">Motivo Principal da Infração...</option>
            {INFRACÕES_COMUNS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          <textarea value={detalhesMotivo} onChange={e => setDetalhesMotivo(e.target.value)} placeholder="Cole aqui a redação formal e jurídica da ocorrência..." style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', minHeight: '100px', outline: 'none', fontFamily: 'inherit', resize: 'vertical' }} />

          <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
            {fotoOcorrenciaBase64 ? (
              <div style={{ position: 'relative', height: '120px' }}>
                <img src={fotoOcorrenciaBase64} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px' }} alt="Evidência" />
                <button type="button" onClick={() => setFotoOcorrenciaBase64('')} style={{ position: 'absolute', top: 5, right: 5, backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: '25px', height: '25px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={14}/></button>
              </div>
            ) : (
              <Button type="button" onClick={() => fotoInputRef.current?.click()} style={{ width: '100%', backgroundColor: 'white', color: '#3b82f6', border: '1px solid #bfdbfe' }}>
                <Camera size={18} style={{ marginRight: '8px' }} /> Anexar Foto de Evidência
              </Button>
            )}
            <input type="file" accept="image/*" capture="environment" ref={fotoInputRef} onChange={processarFotoOcorrencia} style={{ display: 'none' }} />
          </div>
        </div>

        {/* BLOCO 4: VALIDAÇÃO JURÍDICA DINÂMICA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px dashed #cbd5e1', paddingTop: '15px' }}>
          <h4 style={{ margin: 0, fontSize: '14px', color: '#64748b', textTransform: 'uppercase' }}>3. Validação Jurídica</h4>

          {tipoAdvertencia === 'oral' ? (
            <div style={{ padding: '15px', backgroundColor: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a', fontSize: '13px', color: '#92400e' }}>
              <strong>Nota Legal:</strong> A Orientação Oral não exige assinatura ou testemunhas. O registo será salvo no histórico do RH como prova de que a empresa fiscalizou e orientou o colaborador.
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569' }}>Como será colhida a assinatura?</label>
                <select value={metodoAssinatura} onChange={e => setMetodoAssinatura(e.target.value as any)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}>
                  <option value="digital">Assinar agora no aparelho (Digital)</option>
                  <option value="fisica">Imprimir e assinar a caneta depois (Física)</option>
                  <option value="recusa">O colaborador recusou-se a assinar</option>
                </select>
              </div>

              {metodoAssinatura === 'digital' && (
                <div onClick={() => setModalAssinaturaAberto(true)} style={{ padding: '15px', border: '2px dashed #cbd5e1', borderRadius: '8px', textAlign: 'center', cursor: 'pointer', backgroundColor: '#f8fafc' }}>
                  {assinaturaBase64 ? (
                    <img src={assinaturaBase64} style={{ maxHeight: '80px', margin: '0 auto' }} alt="Assinatura" />
                  ) : (
                    <div style={{ color: '#64748b' }}>
                      <PenTool size={24} style={{ margin: '0 auto 5px' }} />
                      <p style={{ fontSize: '13px', fontWeight: 'bold', margin: 0 }}>Recolher Assinatura Digital Agora</p>
                    </div>
                  )}
                </div>
              )}

              {metodoAssinatura === 'fisica' && (
                <div style={{ padding: '12px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', fontSize: '13px', color: '#166534', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Printer size={18} /> O PDF será gerado com o espaço em branco para assinatura manual.
                </div>
              )}

              {metodoAssinatura === 'recusa' && (
                <div style={{ padding: '12px', backgroundColor: '#fff1f2', borderRadius: '8px', border: '1px solid #fca5a5' }}>
                  <p style={{ fontSize: '13px', color: '#e11d48', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}>
                    <AlertTriangle size={16} /> OBRIGATÓRIO: Forneça pelo menos UMA testemunha
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* ✨ O Placeholder também reflete que apenas a 1ª é obrigatória */}
                    <Input placeholder="Testemunha 1 (Nome Completo) *" value={nomeTestemunha1} onChange={e => setNomeTestemunha1(e.target.value)} />
                    <Input placeholder="Testemunha 2 (Opcional)" value={nomeTestemunha2} onChange={e => setNomeTestemunha2(e.target.value)} />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <Button type="submit" style={{ height: '50px', backgroundColor: tipoAdvertencia === 'oral' ? '#f59e0b' : '#ef4444', fontSize: '15px', fontWeight: 'bold', marginTop: '10px' }}>
          Gravar Registro no Sistema
        </Button>
      </form>

      <ModalAssinaturaAdv 
        aberto={modalAssinaturaAberto} 
        onClose={() => setModalAssinaturaAberto(false)} 
        onSave={(base64) => { setAssinaturaBase64(base64); setModalAssinaturaAberto(false); }} 
      />
    </div>
  );
}