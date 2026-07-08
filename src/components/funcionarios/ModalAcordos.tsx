// src/components/funcionarios/ModalAcordos.tsx
import { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import jsPDF from "jspdf";
import logoCarvalho from '../../assets/logopdf.png';
import { DADOS_EMPRESA } from '../../config/empresa';

import { X, Handshake, FileText, CheckCircle2, PenTool, Printer, Clock, Users } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';

import ModalAssinaturaEntrega from '../entrega/ModalAssinaturaEntrega';

interface Props {
  aberto: boolean;
  onClose: () => void;
  funcionarios: any[];
  avisar: (msg: string, tipo?: 'sucesso' | 'erro') => void;
}

// 📝 TEMPLATES PRÉ-PRONTOS (Atualizados sem a palavra "INDIVIDUAL")
const TEMPLATES = [
  { 
    id: 'feriado_9_julho', 
    nome: 'Troca de Feriado', 
    titulo: 'ACORDO DE COMPENSAÇÃO DE FERIADO', 
    texto: 'Pelo presente instrumento, acordam a EMPRESA e o COLABORADOR que haverá expediente normal de trabalho no feriado do dia 09/07/2026 (Quinta-feira).\n\nEm compensação, o colaborador gozará de folga no dia 10/07/2026 (Sexta-feira), não havendo descontos em sua remuneração nem pagamento de horas extras referentes a esta troca, conforme preceitua a legislação trabalhista vigente e o mútuo acordo entre as partes.' 
  },
  { 
    id: 'banco_horas', 
    nome: 'Banco de Horas', 
    titulo: 'ACORDO DE BANCO DE HORAS', 
    texto: 'Pelo presente, o COLABORADOR concorda com a instituição do sistema de compensação de horas de trabalho (Banco de Horas). As horas excedentes trabalhadas em um dia serão compensadas com a correspondente diminuição em outro dia, conforme a necessidade da empresa e alinhamento prévio.' 
  },
  { 
    id: 'livre', 
    nome: 'Em Branco', 
    titulo: 'TERMO DE ACORDO', 
    texto: '' 
  }
];

export default function ModalAcordos({ aberto, onClose, funcionarios, avisar }: Props) {
  const [abaAtiva, setAbaAtiva] = useState<'novo' | 'lista'>('novo');
  const [acordos, setAcordos] = useState<any[]>([]);
  
  // ✨ NOVO: Array para guardar múltiplos funcionários selecionados
  const [funcionariosSelecionados, setFuncionariosSelecionados] = useState<string[]>([]);
  const [titulo, setTitulo] = useState('');
  const [conteudo, setConteudo] = useState('');
  
  const [modalAssinatura, setModalAssinatura] = useState(false);
  const [acordoParaAssinar, setAcordoParaAssinar] = useState<any>(null);

  useEffect(() => {
    if (!aberto) return;
    const q = query(collection(db, 'acordos_colaboradores'));
    const unsub = onSnapshot(q, (snap) => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      lista.sort((a: any, b: any) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setAcordos(lista);
    });
    return () => unsub();
  }, [aberto]);

  const aplicarTemplate = (idTemplate: string) => {
    const template = TEMPLATES.find(t => t.id === idTemplate);
    if (template) {
      setTitulo(template.titulo);
      setConteudo(template.texto);
    }
  };

  // ✨ NOVO: Função para alternar a seleção de um funcionário
  const toggleFuncionario = (id: string) => {
    setFuncionariosSelecionados(prev => 
      prev.includes(id) ? prev.filter(fId => fId !== id) : [...prev, id]
    );
  };

  // ✨ NOVO: Salva um documento para CADA funcionário selecionado
  const salvarNovoAcordo = async () => {
    if (funcionariosSelecionados.length === 0) return avisar("Selecione pelo menos um colaborador.", "erro");
    if (!titulo || !conteudo) return avisar("Preencha o título e o conteúdo do acordo.", "erro");
    
    try {
      // Loop: Cria um documento individual no Firebase para cada pessoa selecionada
      for (const id of funcionariosSelecionados) {
        const func = funcionarios.find(f => f.id === id);
        if (func) {
          await addDoc(collection(db, 'acordos_colaboradores'), {
            funcionarioId: func.id,
            funcionarioNome: func.nome,
            funcionarioCpf: func.cpf || 'Não informado',
            titulo,
            conteudo,
            status: 'pendente',
            assinaturaBase64: '',
            createdAt: serverTimestamp()
          });
        }
      }
      
      avisar(`Acordo gerado para ${funcionariosSelecionados.length} colaborador(es)!`);
      
      // Limpa o formulário
      setFuncionariosSelecionados([]); 
      setTitulo(''); 
      setConteudo(''); 
      setAbaAtiva('lista');
      
    } catch (e) {
      avisar("Erro ao salvar acordos.", "erro");
    }
  };

  const salvarAssinaturaLocal = async (base64: string) => {
    if (!acordoParaAssinar) return;
    try {
      await updateDoc(doc(db, 'acordos_colaboradores', acordoParaAssinar.id), {
        assinaturaBase64: base64,
        status: 'assinado',
        dataAssinatura: new Date().toISOString()
      });
      avisar("Acordo assinado com sucesso!");
      setModalAssinatura(false);
      setAcordoParaAssinar(null);
    } catch (e) {
      avisar("Erro ao salvar assinatura.", "erro");
    }
  };

  // 📄 GERADOR DE PDF PROFISSIONAL (Com Espaçamento Corrigido)
  const gerarPDF = (acordo: any, tipo: 'digital' | 'branco') => {
    const docPdf = new jsPDF('p', 'mm', 'a4');
    
    // 1. Cabeçalho
    try { docPdf.addImage(logoCarvalho, 'PNG', 15, 10, 35, 10); } catch(e){}
    docPdf.setFont("helvetica", "bold"); docPdf.setFontSize(12); 
    docPdf.text(DADOS_EMPRESA.razaoSocial, 105, 14, { align: 'center' });
    docPdf.setFont("helvetica", "normal"); docPdf.setFontSize(9);
    docPdf.text(`CNPJ: ${DADOS_EMPRESA.cnpj}`, 105, 19, { align: 'center' });
    docPdf.text(`${DADOS_EMPRESA.endereco} | ${DADOS_EMPRESA.cidadeEstado}`, 105, 23, { align: 'center' });
    
    docPdf.setLineWidth(0.5); docPdf.line(15, 27, 195, 27);

    // 2. Corpo do Acordo
    docPdf.setFont("helvetica", "bold"); docPdf.setFontSize(14); 
    docPdf.text(acordo.titulo, 105, 40, { align: 'center' });

    docPdf.setFontSize(11); docPdf.setFont("helvetica", "normal");
    
    const intro = `Pelo presente instrumento, de um lado a empresa ${DADOS_EMPRESA.razaoSocial}, inscrita no CNPJ sob o nº ${DADOS_EMPRESA.cnpj}, e de outro lado o colaborador ${acordo.funcionarioNome.toUpperCase()}, portador(a) do CPF ${acordo.funcionarioCpf}, firmam o seguinte acordo:`;
    const splitIntro = docPdf.splitTextToSize(intro, 170);
    docPdf.text(splitIntro, 20, 52);

    const yConteudo = 52 + (splitIntro.length * 6) + 10;
    const splitConteudo = docPdf.splitTextToSize(acordo.conteudo, 170);
    docPdf.text(splitConteudo, 20, yConteudo);

    // ✨ CORREÇÃO AQUI: Aumentámos o salto (espaço) para a área de assinatura
    const yAssinatura = yConteudo + (splitConteudo.length * 6) + 50;
    
    const dataFormatada = acordo.dataAssinatura 
      ? new Date(acordo.dataAssinatura).toLocaleDateString('pt-BR') 
      : new Date().toLocaleDateString('pt-BR');
      
    const cidade = DADOS_EMPRESA.cidadeEstado.split(' - ')[0];
    
    // A data fica 30 milímetros acima da linha
    docPdf.text(`${cidade}, ${dataFormatada}`, 105, yAssinatura - 30, { align: 'center' });

    // A linha de assinatura
    docPdf.setDrawColor(0,0,0);
    docPdf.line(60, yAssinatura, 150, yAssinatura);
    
    // A imagem apoia-se exatamente na linha (yAssinatura - 25), sem sobrepor a data
    if (tipo === 'digital' && acordo.assinaturaBase64) {
      try { docPdf.addImage(acordo.assinaturaBase64, 'JPEG', 85, yAssinatura - 25, 40, 20); } catch(e){}
    }

    docPdf.setFont("helvetica", "bold"); docPdf.setFontSize(10);
    docPdf.text(acordo.funcionarioNome, 105, yAssinatura + 5, { align: 'center' });
    docPdf.setFont("helvetica", "normal");
    docPdf.text(`CPF: ${acordo.funcionarioCpf}`, 105, yAssinatura + 10, { align: 'center' });

    docPdf.save(`Acordo_${acordo.funcionarioNome.split(' ')[0]}_${acordo.titulo.substring(0, 15)}.pdf`);
  };

  if (!aberto) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.85)', zIndex: 15000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
      <div style={{ backgroundColor: '#f8fafc', width: '100%', maxWidth: '800px', height: '90vh', borderRadius: '20px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
        
        <div style={{ padding: '20px', backgroundColor: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ backgroundColor: '#f0fdf4', padding: '10px', borderRadius: '10px' }}><Handshake size={24} color="#10b981" /></div>
            <div>
              <h2 style={{ fontSize: '20px', color: '#1e293b', margin: 0, fontWeight: '800' }}>Acordos e Termos</h2>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Gestão de acordos de folga, banco de horas e termos diversos.</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', padding: '10px', borderRadius: '50%', cursor: 'pointer' }}><X size={20} color="#475569" /></button>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', backgroundColor: 'white' }}>
          <button onClick={() => setAbaAtiva('novo')} style={{ flex: 1, padding: '15px', border: 'none', background: abaAtiva === 'novo' ? '#f8fafc' : 'white', borderBottom: abaAtiva === 'novo' ? '3px solid #10b981' : '3px solid transparent', fontWeight: 'bold', color: abaAtiva === 'novo' ? '#10b981' : '#64748b', cursor: 'pointer' }}>Gerar Acordo</button>
          <button onClick={() => setAbaAtiva('lista')} style={{ flex: 1, padding: '15px', border: 'none', background: abaAtiva === 'lista' ? '#f8fafc' : 'white', borderBottom: abaAtiva === 'lista' ? '3px solid #3b82f6' : '3px solid transparent', fontWeight: 'bold', color: abaAtiva === 'lista' ? '#3b82f6' : '#64748b', cursor: 'pointer' }}>Histórico / Pendências ({acordos.length})</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          
          {abaAtiva === 'novo' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* ✨ NOVO: Painel de Seleção Múltipla de Funcionários */}
              <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '12px' }}>
                  <Users size={16}/> 1. Selecione os Colaboradores ({funcionariosSelecionados.length} selecionados)
                </label>
                
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '150px', overflowY: 'auto', padding: '5px' }}>
                  {funcionarios.filter(f => f.status !== 'desligado').map(f => (
                    <button 
                      key={f.id} 
                      onClick={() => toggleFuncionario(f.id)}
                      style={{ 
                        padding: '8px 12px', borderRadius: '50px', border: 'none', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s', 
                        backgroundColor: funcionariosSelecionados.includes(f.id) ? '#10b981' : '#f1f5f9', 
                        color: funcionariosSelecionados.includes(f.id) ? 'white' : '#475569' 
                      }}
                    >
                      {f.nome.split(' ')[0]} {f.nome.split(' ')[1] || ''}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '8px' }}>2. Escolha um Modelo Pré-pronto (Opcional)</label>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
                  {TEMPLATES.map(t => (
                    <button key={t.id} onClick={() => aplicarTemplate(t.id)} style={{ padding: '8px 15px', borderRadius: '50px', border: '1px solid #10b981', backgroundColor: '#f0fdf4', color: '#166534', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                      {t.nome}
                    </button>
                  ))}
                </div>

                <Input label="Título do Acordo" value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Acordo de Compensação..." />
                
                <div style={{ marginTop: '15px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '8px' }}>Corpo do Acordo (Editável)</label>
                  <textarea 
                    value={conteudo} 
                    onChange={e => setConteudo(e.target.value)} 
                    placeholder="Redija o texto do acordo aqui..." 
                    style={{ width: '100%', padding: '15px', borderRadius: '8px', border: '1px solid #cbd5e1', minHeight: '180px', fontFamily: 'inherit', resize: 'vertical', outline: 'none' }}
                  />
                </div>
              </div>

              <Button onClick={salvarNovoAcordo} style={{ height: '55px', fontSize: '16px', backgroundColor: '#10b981', fontWeight: 'bold' }}>
                Gerar Acordos e Enviar para Assinatura
              </Button>
            </div>
          )}

          {abaAtiva === 'lista' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {acordos.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#94a3b8', marginTop: '40px' }}>Nenhum acordo registado no sistema.</p>
              ) : (
                acordos.map(acordo => (
                  <div key={acordo.id} style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h4 style={{ margin: '0 0 5px 0', color: '#1e293b', fontSize: '15px' }}>{acordo.titulo}</h4>
                      <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#64748b' }}>Colaborador: <strong>{acordo.funcionarioNome}</strong></p>
                      
                      {acordo.status === 'pendente' ? (
                        <span style={{ backgroundColor: '#fef3c7', color: '#d97706', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Clock size={12}/> Pendente de Assinatura</span>
                      ) : (
                        <span style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={12}/> Assinado</span>
                      )}
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {acordo.status === 'pendente' && (
                        <Button onClick={() => { setAcordoParaAssinar(acordo); setModalAssinatura(true); }} style={{ backgroundColor: '#3b82f6', fontSize: '12px', height: '35px' }}>
                          <PenTool size={14} style={{ marginRight: '6px' }}/> Assinar Agora
                        </Button>
                      )}
                      
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <Button onClick={() => gerarPDF(acordo, 'digital')} disabled={acordo.status === 'pendente'} style={{ backgroundColor: acordo.status === 'pendente' ? '#cbd5e1' : '#10b981', fontSize: '12px', flex: 1 }} title="PDF com Assinatura Digital">
                          <FileText size={14} /> PDF Assinado
                        </Button>
                        <Button onClick={() => gerarPDF(acordo, 'branco')} style={{ backgroundColor: '#64748b', fontSize: '12px', flex: 1 }} title="Imprimir PDF com linha em branco para assinar à caneta">
                          <Printer size={14} /> Físico
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <ModalAssinaturaEntrega 
        aberto={modalAssinatura} 
        onClose={() => { setModalAssinatura(false); setAcordoParaAssinar(null); }} 
        onConfirm={salvarAssinaturaLocal} 
      />
    </div>
  );
}