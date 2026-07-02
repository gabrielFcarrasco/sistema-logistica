// src/components/prestacao-servicos/CronogramaServicos.tsx
import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoCarvalho from '../../assets/logopdf.png';

import { Calendar, Clock, Plus, Trash2, Share2, Printer, CheckCircle, Edit3 } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';

// Importação do modal de assinatura
import ModalAssinaturaEntrega from '../entrega/ModalAssinaturaEntrega';

interface Props { setorAtivo: string; funcionarios: any[]; avisar: (msg: string, tipo?: 'sucesso'|'erro') => void; }

export default function CronogramaServicos({ setorAtivo, funcionarios, avisar }: Props) {
  const [atividades, setAtividades] = useState<any[]>([]);
  
  // ✨ ESTADOS DO LOTE E EDIÇÃO
  const [loteEmEdicao, setLoteEmEdicao] = useState<any>(null); // Guarda o lote original se estivermos a editar
  const [dataLote, setDataLote] = useState(new Date().toISOString().split('T')[0]);
  const [carrinhoServicos, setCarrinhoServicos] = useState<any[]>([]);
  
  // Estados para Assinatura Local no Aparelho
  const [modalAssinaturaAberto, setModalAssinaturaAberto] = useState(false);
  const [loteParaAssinar, setLoteParaAssinar] = useState<any>(null);
  // O "quemAssina" agora pode ser 'carvalho' ou o Nome do responsável da Rotem
  const [quemAssina, setQuemAssina] = useState<string | null>(null);

  // ✨ ESTADOS DO SERVIÇO TEMPORÁRIO (Adicionamos o responsavelRotem aqui)
  const [servico, setServico] = useState('');
  const [horaInicio, setHoraInicio] = useState('08:00');
  const [horaTermino, setHoraTermino] = useState('17:00');
  const [responsavelRotem, setResponsavelRotem] = useState('');
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
    if (!servico || equipe.length === 0 || !responsavelRotem) {
      return avisar("Preencha o serviço, a equipe e o responsável da Rotem.", "erro");
    }
    setCarrinhoServicos([...carrinhoServicos, { servico, horaInicio, horaTermino, equipe, responsavelRotem }]);
    
    // Limpamos o serviço e equipa, mas mantemos o responsável Rotem e horas para facilitar o próximo lançamento
    setServico(''); 
    setEquipe([]);
  };

  const removerDoLote = (index: number) => {
    setCarrinhoServicos(prev => prev.filter((_, i) => i !== index));
  };

  // ✨ LÓGICA DE SALVAR (CRIAÇÃO OU EDIÇÃO)
  const salvarLote = async () => {
    if (carrinhoServicos.length === 0) return avisar("Adicione pelo menos um serviço.", "erro");
    
    try {
      // 1. Descobrir todos os responsáveis únicos da Rotem neste lote
      const nomesUnicosRotem = Array.from(new Set(carrinhoServicos.map(s => s.responsavelRotem)));
      
      // 2. Preparar o objeto de assinaturas da Rotem
      // Se for edição, mantemos as assinaturas que já existiam para não as apagar
      const assinaturasRotemObj = loteEmEdicao?.assinaturasRotem ? { ...loteEmEdicao.assinaturasRotem } : {};
      
      nomesUnicosRotem.forEach(nome => {
        if (!assinaturasRotemObj[nome]) {
          assinaturasRotemObj[nome] = 'pendente'; // Cria a pendência para novos responsáveis
        }
      });

      const dadosDoLote = {
        setorId: setorAtivo, 
        data: dataLote, 
        servicos: carrinhoServicos,
        assinaturaCarvalho: loteEmEdicao?.assinaturaCarvalho || 'pendente',
        assinaturasRotem: assinaturasRotemObj,
        status: loteEmEdicao?.status || 'Aguardando Assinaturas'
      };

      if (loteEmEdicao) {
        // Se estamos a editar, atualiza o documento existente
        await updateDoc(doc(db, 'diario_obra_lotes', loteEmEdicao.id), dadosDoLote);
        avisar("Diário de Obra atualizado com sucesso!");
      } else {
        // Se é novo, cria um documento do zero
        await addDoc(collection(db, 'diario_obra_lotes'), { ...dadosDoLote, createdAt: serverTimestamp() });
        avisar("Diário de Obra criado com sucesso!");
      }

      // Limpar formulário após salvar
      cancelarEdicao();
      
    } catch (e) { avisar("Erro ao salvar o diário.", "erro"); }
  };

  // ✨ INICIAR E CANCELAR EDIÇÃO
  const iniciarEdicao = (lote: any) => {
    setLoteEmEdicao(lote);
    setDataLote(lote.data);
    setCarrinhoServicos(lote.servicos || []);
    window.scrollTo({ top: 0, behavior: 'smooth' }); // Sobe a página para o formulário
  };

  const cancelarEdicao = () => {
    setLoteEmEdicao(null);
    setDataLote(new Date().toISOString().split('T')[0]);
    setCarrinhoServicos([]);
    setServico('');
    setEquipe([]);
    setResponsavelRotem('');
  };

  const apagarLote = async (id: string) => {
    if (confirm("Deseja mesmo apagar este diário de obra?")) {
      await deleteDoc(doc(db, 'diario_obra_lotes', id));
      avisar("Diário apagado.");
    }
  };

  // ✨ LÓGICA DE ASSINATURA LOCAL DINÂMICA
  const salvarAssinaturaLocal = async (base64: string) => {
    if (!loteParaAssinar || !quemAssina) return;
    
    try {
      const docRef = doc(db, 'diario_obra_lotes', loteParaAssinar.id);
      
      let assinaturaCarvalhoAtual = loteParaAssinar.assinaturaCarvalho;
      let assinaturasRotemAtuais = { ...loteParaAssinar.assinaturasRotem };

      if (quemAssina === 'carvalho') {
        assinaturaCarvalhoAtual = base64;
      } else {
        // O quemAssina é o nome do responsável Rotem (ex: "João", "Maria")
        assinaturasRotemAtuais[quemAssina] = base64;
      }
      
      // Avalia se o status final deve ser concluído (Carvalho + Todos da Rotem)
      const todasRotemAssinadas = Object.values(assinaturasRotemAtuais).every(status => status !== 'pendente');
      const isConcluido = assinaturaCarvalhoAtual !== 'pendente' && todasRotemAssinadas;
      
      await updateDoc(docRef, { 
        assinaturaCarvalho: assinaturaCarvalhoAtual,
        assinaturasRotem: assinaturasRotemAtuais,
        status: isConcluido ? 'Concluído' : 'Assinatura Parcial'
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

  // 📄 GERADOR DE PDF PROFISSIONAL (Suporta as múltiplas assinaturas)
  const gerarPDF = (lote: any) => {
    const doc = new jsPDF('l', 'mm', 'a4');
    try { doc.addImage(logoCarvalho, 'PNG', 15, 10, 35, 10); } catch(e){}
    doc.setFont("helvetica", "bold"); doc.setFontSize(16); 
    doc.text("DIÁRIO DE OBRA - PRESTAÇÃO DE SERVIÇOS", 148.5, 16, { align: 'center' });
    doc.setFontSize(10); 
    doc.text(`Data: ${lote.data.split('-').reverse().join('/')}`, 148.5, 22, { align: 'center' });
    
    const renderTable = typeof autoTable === 'function' ? autoTable : (autoTable as any).default;
    renderTable(doc, {
      startY: 30,
      head: [["Descrição do Serviço", "Horário", "Equipe Envolvida", "Validação Carvalho", "Validação Rotem"]],
      body: lote.servicos.map((s: any) => [`${s.servico}\nResp: ${s.responsavelRotem}`, `${s.horaInicio}\nàs ${s.horaTermino}`, s.equipe.join(', '), '', '']),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3, valign: 'middle' },
      headStyles: { fillColor: [30, 41, 59], halign: 'center' },
      columnStyles: { 
        0: { cellWidth: 70 }, 1: { halign: 'center', cellWidth: 20 }, 
        2: { cellWidth: 50 }, 3: { halign: 'center', cellWidth: 50 }, 4: { halign: 'center', cellWidth: 50 } 
      },
      didDrawCell: (data: any) => {
        if (data.cell.section === 'body' && (data.column.index === 3 || data.column.index === 4)) {
          const rowIndex = data.row.index;
          const servicoReferencia = lote.servicos[rowIndex];
          const isCarvalho = data.column.index === 3;
          
          // Puxa a assinatura correta (A Carvalho é única, a Rotem depende de quem é o responsável por aquele serviço)
          const assinatura = isCarvalho ? lote.assinaturaCarvalho : lote.assinaturasRotem[servicoReferencia.responsavelRotem];
          const nomeLider = isCarvalho ? "Líder Carvalho" : servicoReferencia.responsavelRotem;
          
          if (assinatura && assinatura.startsWith('data:image')) {
            try {
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
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
      
      {/* 1. COLUNA DE LANÇAMENTO E EDIÇÃO */}
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '18px', color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={20} color={loteEmEdicao ? "#f59e0b" : "#3b82f6"} /> 
            {loteEmEdicao ? "Editar Diário de Obra" : "Lançar Serviços do Dia"}
          </h3>
          {loteEmEdicao && (
            <Button onClick={cancelarEdicao} style={{ backgroundColor: '#ef4444', height: '35px', padding: '0 15px', fontSize: '12px' }}>
              Cancelar Edição
            </Button>
          )}
        </div>
        
        <Input label="Data do Relatório" type="date" value={dataLote} onChange={e => setDataLote(e.target.value)} />
        
        <div style={{ marginTop: '20px', padding: '15px', border: '2px dashed #e2e8f0', borderRadius: '12px', backgroundColor: '#f8fafc' }}>
          <h4 style={{ margin: '0 0 15px 0', fontSize: '14px', color: '#475569' }}>Adicionar Novo Serviço</h4>
          
          <Input label="Descrição do Serviço" value={servico} onChange={e => setServico(e.target.value)} placeholder="Ex: Lavagem técnica..." />
          <div style={{ marginTop: '10px' }}>
            <Input label="Responsável Rotem por este serviço" value={responsavelRotem} onChange={e => setResponsavelRotem(e.target.value)} placeholder="Ex: Carlos, Ana..." />
          </div>
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
            <h4 style={{ fontSize: '14px', color: '#1e293b', marginBottom: '10px' }}>Serviços no Diário ({carrinhoServicos.length})</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {carrinhoServicos.map((s, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: '#f1f5f9', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                  <div>
                    <strong style={{ fontSize: '13px', color: '#1e293b', display: 'block' }}>{s.servico}</strong>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      <Clock size={10} style={{ display: 'inline', marginRight: '4px' }}/> {s.horaInicio} - {s.horaTermino} | Rotem: {s.responsavelRotem}
                    </span>
                  </div>
                  <button type="button" onClick={() => removerDoLote(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16}/></button>
                </div>
              ))}
            </div>
          </div>
        )}

        <Button onClick={salvarLote} disabled={carrinhoServicos.length === 0} style={{ marginTop: '20px', backgroundColor: carrinhoServicos.length > 0 ? '#10b981' : '#cbd5e1', width: '100%', height: '50px', fontSize: '15px', fontWeight: 'bold' }}>
          {loteEmEdicao ? "Atualizar Diário de Obra" : "Salvar Diário de Obra"}
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
            // Array com os nomes únicos dos responsáveis da Rotem que estão neste lote
            const nomesRotemNoLote = Object.keys(a.assinaturasRotem || {});
            
            return (
              <div key={a.id} style={{ padding: '15px', border: '1px solid', borderColor: concluido ? '#86efac' : '#e2e8f0', borderRadius: '12px', backgroundColor: concluido ? '#f0fdf4' : '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div>
                    <strong style={{ fontSize: '15px', color: '#1e293b', display: 'block' }}>Data: {a.data.split('-').reverse().join('/')}</strong>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>{a.servicos?.length || 0} serviços prestados</span>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button type="button" onClick={() => iniciarEdicao(a)} style={{ width: '30px', height: '30px', borderRadius: '6px', border: 'none', backgroundColor: '#fef3c7', color: '#d97706', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Editar Diário"><Edit3 size={16}/></button>
                    <button type="button" onClick={() => enviarLinkWhatsApp(a.id)} style={{ width: '30px', height: '30px', borderRadius: '6px', border: 'none', backgroundColor: '#dbeafe', color: '#3b82f6', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Enviar Link"><Share2 size={16}/></button>
                    <button type="button" onClick={() => gerarPDF(a)} style={{ width: '30px', height: '30px', borderRadius: '6px', border: 'none', backgroundColor: '#f1f5f9', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Baixar PDF"><Printer size={16}/></button>
                    <button type="button" onClick={() => apagarLote(a.id)} style={{ width: '30px', height: '30px', borderRadius: '6px', border: 'none', backgroundColor: '#fef2f2', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Apagar"><Trash2 size={16}/></button>
                  </div>
                </div>
                
                {/* BOTÕES DE ASSINATURA LOCAL DINÂMICOS */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '15px' }}>
                  
                  {/* Assinatura Líder Carvalho */}
                  {a.assinaturaCarvalho === 'pendente' ? (
                    <Button onClick={() => { setLoteParaAssinar(a); setQuemAssina('carvalho'); setModalAssinaturaAberto(true); }} style={{ width: '100%', height: '35px', fontSize: '12px', backgroundColor: '#3b82f6' }}>
                      Assinar Líder Carvalho
                    </Button>
                  ) : (
                    <div style={{ width: '100%', height: '35px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', backgroundColor: '#dcfce7', color: '#166534', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold' }}>
                      <CheckCircle size={14}/> Líder Carvalho Validou
                    </div>
                  )}

                  {/* Assinaturas Dinâmicas Rotem (Uma para cada responsável) */}
                  {nomesRotemNoLote.map(nomeRotem => (
                    a.assinaturasRotem[nomeRotem] === 'pendente' ? (
                      <Button key={nomeRotem} onClick={() => { setLoteParaAssinar(a); setQuemAssina(nomeRotem); setModalAssinaturaAberto(true); }} style={{ width: '100%', height: '35px', fontSize: '12px', backgroundColor: '#f59e0b' }}>
                        Assinar Rotem: {nomeRotem}
                      </Button>
                    ) : (
                      <div key={nomeRotem} style={{ width: '100%', height: '35px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', backgroundColor: '#dcfce7', color: '#166534', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold' }}>
                        <CheckCircle size={14}/> {nomeRotem} (Rotem) Validou
                      </div>
                    )
                  ))}

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
