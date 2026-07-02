// src/components/prestacao-servicos/CronogramaServicos.tsx
import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoCarvalho from '../../assets/logopdf.png';

import { Calendar, Clock, Users, Plus, Trash2, Share2, Printer, CheckCircle, AlertCircle } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';

// IMPORTANTE: Importação do modal de assinatura que já usas noutras partes do sistema
import ModalAssinaturaEntrega from '../entrega/ModalAssinaturaEntrega';

interface Props { setorAtivo: string; funcionarios: any[]; avisar: (msg: string, tipo?: 'sucesso'|'erro') => void; }

export default function CronogramaServicos({ setorAtivo, funcionarios, avisar }: Props) {
  const [atividades, setAtividades] = useState<any[]>([]);
  const [dataLote, setDataLote] = useState(new Date().toISOString().split('T')[0]);
  const [responsavelRotem, setResponsavelRotem] = useState('');
  const [carrinhoServicos, setCarrinhoServicos] = useState<any[]>([]);
  
  // ✨ Estados para Assinatura Local no Aparelho
  const [modalAssinaturaAberto, setModalAssinaturaAberto] = useState(false);
  const [loteParaAssinar, setLoteParaAssinar] = useState<any>(null);
  const [quemAssina, setQuemAssina] = useState<'carvalho' | 'rotem' | null>(null);

  // Estados do item temporário (Serviço atual a ser adicionado)
  const [servico, setServico] = useState('');
  const [horaInicio, setHoraInicio] = useState('08:00');
  const [horaTermino, setHoraTermino] = useState('17:00');
  const [equipe, setEquipe] = useState<string[]>([]);

  // Escutar Registos do Firestore
  useEffect(() => {
    if (!setorAtivo) return;
    const q = query(collection(db, 'diario_obra_lotes'), where('setorId', '==', setorAtivo));
    const unsub = onSnapshot(q, (snap) => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      lista.sort((a: any, b: any) => new Date(b.data).getTime() - new Date(a.data).getTime());
      setAtividades(lista);
    });
    return () => unsub();
  }, [setorAtivo]);

  const adicionarAoLote = () => {
    if (!servico || equipe.length === 0) return avisar("Preencha o serviço e selecione a equipe.", "erro");
    setCarrinhoServicos([...carrinhoServicos, { servico, horaInicio, horaTermino, equipe }]);
    setServico(''); setEquipe([]);
  };

  const removerDoLote = (index: number) => {
    setCarrinhoServicos(prev => prev.filter((_, i) => i !== index));
  };

  const salvarLote = async () => {
    if (carrinhoServicos.length === 0 || !responsavelRotem) return avisar("Adicione serviços e informe o responsável.", "erro");
    try {
      await addDoc(collection(db, 'diario_obra_lotes'), {
        setorId: setorAtivo, 
        data: dataLote, 
        responsavelRotem,
        servicos: carrinhoServicos,
        assinaturaCarvalho: 'pendente', nomeCarvalho: '',
        assinaturaRotem: 'pendente', nomeRotem: '',
        status: 'Aguardando Assinaturas',
        createdAt: serverTimestamp()
      });
      avisar("Diário de Obra salvo com sucesso!");
      setCarrinhoServicos([]); setResponsavelRotem('');
    } catch (e) { avisar("Erro ao salvar o diário.", "erro"); }
  };

  const apagarLote = async (id: string) => {
    if (confirm("Deseja mesmo apagar este diário de obra?")) {
      await deleteDoc(doc(db, 'diario_obra_lotes', id));
      avisar("Diário apagado.");
    }
  };

  // ✨ LÓGICA DE ASSINATURA LOCAL
  const salvarAssinaturaLocal = async (base64: string) => {
    if (!loteParaAssinar || !quemAssina) return;
    
    try {
      const atualizacoes: any = {};
      if (quemAssina === 'carvalho') {
        atualizacoes.assinaturaCarvalho = base64;
        atualizacoes.nomeCarvalho = "Líder Carvalho";
      } else {
        atualizacoes.assinaturaRotem = base64;
        atualizacoes.nomeRotem = loteParaAssinar.responsavelRotem;
      }
      
      const docRef = doc(db, 'diario_obra_lotes', loteParaAssinar.id);
      
      // Avalia se com esta assinatura o documento fica completo
      const statusCarvalho = atualizacoes.assinaturaCarvalho || loteParaAssinar.assinaturaCarvalho;
      const statusRotem = atualizacoes.assinaturaRotem || loteParaAssinar.assinaturaRotem;
      
      await updateDoc(docRef, { 
        ...atualizacoes,
        status: (statusCarvalho !== 'pendente' && statusRotem !== 'pendente') ? 'Concluído' : 'Assinatura Parcial'
      });
      
      avisar("Assinatura guardada com sucesso!");
      setModalAssinaturaAberto(false);
    } catch (e) { avisar("Erro ao salvar assinatura.", "erro"); }
  };

  const enviarLinkWhatsApp = (id: string) => {
    const url = `${window.location.origin}/assinar-cronograma/${id}`;
    const texto = `Olá! O Diário de Obra da Carvalho Pintura está disponível para assinatura.\n\n🔗 Acessar: ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
  };

  // 📄 GERADOR DE PDF PROFISSIONAL (AGORA COM IMAGENS DAS ASSINATURAS)
  const gerarPDF = (lote: any) => {
    const doc = new jsPDF('l', 'mm', 'a4');
    try { doc.addImage(logoCarvalho, 'PNG', 15, 10, 35, 10); } catch(e){}
    doc.setFont("helvetica", "bold"); doc.setFontSize(16); 
    doc.text("DIÁRIO DE OBRA - PRESTAÇÃO DE SERVIÇOS", 148.5, 16, { align: 'center' });
    doc.setFontSize(10); 
    doc.text(`Data: ${lote.data.split('-').reverse().join('/')} | Responsável Hyundai Rotem: ${lote.responsavelRotem}`, 148.5, 22, { align: 'center' });
    
    const renderTable = typeof autoTable === 'function' ? autoTable : (autoTable as any).default;
    renderTable(doc, {
      startY: 30,
      head: [["Descrição do Serviço", "Início", "Término", "Equipe Envolvida", "Validação Carvalho", "Validação Rotem"]],
      body: lote.servicos.map((s: any) => [s.servico, s.horaInicio, s.horaTermino, s.equipe.join(', '), '', '']),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3, valign: 'middle' },
      headStyles: { fillColor: [30, 41, 59], halign: 'center' },
      columnStyles: { 
        0: { cellWidth: 70 }, 1: { halign: 'center', cellWidth: 20 }, 2: { halign: 'center', cellWidth: 20 }, 
        3: { cellWidth: 50 }, 4: { halign: 'center', cellWidth: 50 }, 5: { halign: 'center', cellWidth: 50 } 
      },
      didDrawCell: (data: any) => {
        // ✨ INSERE AS IMAGENS DAS ASSINATURAS NO PDF
        if (data.cell.section === 'body' && (data.column.index === 4 || data.column.index === 5)) {
          const isCarvalho = data.column.index === 4;
          const assinatura = isCarvalho ? lote.assinaturaCarvalho : lote.assinaturaRotem;
          const nomeLider = isCarvalho ? (lote.nomeCarvalho || "Líder Carvalho") : (lote.nomeRotem || lote.responsavelRotem);
          
          if (assinatura && assinatura.startsWith('data:image')) {
            try {
              // Geometria para encaixar a assinatura perfeitamente
              doc.addImage(assinatura, 'JPEG', data.cell.x + 5, data.cell.y + 2, 40, 10);
              doc.setFontSize(6); 
              doc.text(nomeLider, data.cell.x + 25, data.cell.y + 15, { align: 'center' });
            } catch(e) {}
          } else {
            doc.setFontSize(8); doc.setTextColor(220, 38, 38);
            doc.text("PENDENTE", data.cell.x + 25, data.cell.y + 10, { align: 'center' });
            doc.setTextColor(0,0,0);
          }
        }
      }
    });
    doc.save(`Diario_Obra_Rotem_${lote.data}.pdf`);
  };

  return (
    // ✨ LAYOUT MOBILE-FIRST: O "auto-fit" e o "minmax(320px, 1fr)" resolvem a tela no celular
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
      
      {/* 1. COLUNA DE LANÇAMENTO */}
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        <h3 style={{ fontSize: '18px', color: '#1e293b', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={20} color="#3b82f6" /> Lançar Serviços do Dia
        </h3>
        
        <Input label="Data do Relatório" type="date" value={dataLote} onChange={e => setDataLote(e.target.value)} />
        <div style={{ marginTop: '10px' }}>
          <Input label="Responsável Hyundai Rotem" value={responsavelRotem} onChange={e => setResponsavelRotem(e.target.value)} placeholder="Nome de quem vai validar o dia..." />
        </div>
        
        <div style={{ marginTop: '20px', padding: '15px', border: '2px dashed #e2e8f0', borderRadius: '12px', backgroundColor: '#f8fafc' }}>
          <h4 style={{ margin: '0 0 15px 0', fontSize: '14px', color: '#475569' }}>Adicionar Novo Serviço</h4>
          
          <Input label="Descrição do Serviço" value={servico} onChange={e => setServico(e.target.value)} placeholder="Ex: Lavagem técnica..." />
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <Input label="Início" type="time" value={horaInicio} onChange={e => setHoraInicio(e.target.value)} />
            <Input label="Término" type="time" value={horaTermino} onChange={e => setHoraTermino(e.target.value)} />
          </div>
          
          <div style={{ margin: '15px 0' }}>
            <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '8px' }}>
              Equipe Envolvida ({equipe.length})
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '120px', overflowY: 'auto', padding: '5px' }}>
              {funcionarios.map(f => (
                <button type="button" key={f.id} onClick={() => setEquipe(prev => prev.includes(f.nome) ? prev.filter(n => n !== f.nome) : [...prev, f.nome])} 
                  style={{ padding: '6px 12px', borderRadius: '50px', border: 'none', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s', backgroundColor: equipe.includes(f.nome) ? '#3b82f6' : '#e2e8f0', color: equipe.includes(f.nome) ? 'white' : '#475569' }}>
                  {f.nome.split(' ')[0]} {f.nome.split(' ')[1] || ''}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={adicionarAoLote} style={{ width: '100%', height: '40px', backgroundColor: '#475569', display: 'flex', justifyContent: 'center', gap: '8px' }}>
            <Plus size={16}/> Adicionar Serviço ao Lote
          </Button>
        </div>

        {/* PRÉ-VISUALIZAÇÃO DO CARRINHO DE SERVIÇOS */}
        {carrinhoServicos.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <h4 style={{ fontSize: '14px', color: '#1e293b', marginBottom: '10px' }}>Serviços Adicionados ({carrinhoServicos.length})</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {carrinhoServicos.map((s, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: '#f1f5f9', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                  <div>
                    <strong style={{ fontSize: '13px', color: '#1e293b', display: 'block' }}>{s.servico}</strong>
                    <span style={{ fontSize: '11px', color: '#64748b' }}><Clock size={10} style={{ display: 'inline', marginRight: '4px' }}/> {s.horaInicio} - {s.horaTermino} | {s.equipe.length} pessoas</span>
                  </div>
                  <button type="button" onClick={() => removerDoLote(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16}/></button>
                </div>
              ))}
            </div>
          </div>
        )}

        <Button onClick={salvarLote} disabled={carrinhoServicos.length === 0} style={{ marginTop: '20px', backgroundColor: carrinhoServicos.length > 0 ? '#10b981' : '#cbd5e1', width: '100%', height: '50px', fontSize: '15px', fontWeight: 'bold' }}>
          Salvar Diário de Obra 
        </Button>
      </div>

      {/* 2. COLUNA DE LISTAGEM E ASSINATURAS */}
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        <h3 style={{ fontSize: '18px', color: '#1e293b', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={20} color="#f59e0b" /> Histórico de Diários
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {atividades.map((a: any) => {
            const concluido = a.status === 'Concluído';
            
            return (
              <div key={a.id} style={{ padding: '15px', border: '1px solid', borderColor: concluido ? '#86efac' : '#e2e8f0', borderRadius: '12px', backgroundColor: concluido ? '#f0fdf4' : '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div>
                    <strong style={{ fontSize: '15px', color: '#1e293b', display: 'block' }}>Data: {a.data.split('-').reverse().join('/')}</strong>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Resp: {a.responsavelRotem} • {a.servicos?.length || 0} serviços</span>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button type="button" onClick={() => enviarLinkWhatsApp(a.id)} style={{ width: '30px', height: '30px', borderRadius: '6px', border: 'none', backgroundColor: '#dbeafe', color: '#3b82f6', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Enviar Link"><Share2 size={16}/></button>
                    <button type="button" onClick={() => gerarPDF(a)} style={{ width: '30px', height: '30px', borderRadius: '6px', border: 'none', backgroundColor: '#f1f5f9', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Baixar PDF"><Printer size={16}/></button>
                    <button type="button" onClick={() => apagarLote(a.id)} style={{ width: '30px', height: '30px', borderRadius: '6px', border: 'none', backgroundColor: '#fef2f2', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Apagar"><Trash2 size={16}/></button>
                  </div>
                </div>
                
                {/* BOTÕES DE ASSINATURA LOCAL */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '15px', flexWrap: 'wrap' }}>
                  {a.assinaturaCarvalho === 'pendente' ? (
                    <Button onClick={() => { setLoteParaAssinar(a); setQuemAssina('carvalho'); setModalAssinaturaAberto(true); }} style={{ flex: 1, height: '40px', fontSize: '12px', padding: '0 10px', backgroundColor: '#3b82f6' }}>
                      Assinar Carvalho
                    </Button>
                  ) : (
                    <div style={{ flex: 1, height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', backgroundColor: '#dcfce7', color: '#166534', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold' }}><CheckCircle size={14}/> Líd. Carvalho OK</div>
                  )}

                  {a.assinaturaRotem === 'pendente' ? (
                    <Button onClick={() => { setLoteParaAssinar(a); setQuemAssina('rotem'); setModalAssinaturaAberto(true); }} style={{ flex: 1, height: '40px', fontSize: '12px', padding: '0 10px', backgroundColor: '#f59e0b' }}>
                      Assinar Rotem
                    </Button>
                  ) : (
                    <div style={{ flex: 1, height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', backgroundColor: '#dcfce7', color: '#166534', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold' }}><CheckCircle size={14}/> Resp. Rotem OK</div>
                  )}
                </div>
                
              </div>
            );
          })}
          {atividades.length === 0 && <p style={{ fontSize: '13px', color: '#94a3b8', textAlign: 'center' }}>Nenhum diário registado ainda.</p>}
        </div>
      </div>

      {/* COMPONENTE MODAL DE ASSINATURA LOCAL */}
      <ModalAssinaturaEntrega 
        aberto={modalAssinaturaAberto} 
        onClose={() => setModalAssinaturaAberto(false)} 
        onConfirm={salvarAssinaturaLocal} 
      />
    </div>
  );
}
