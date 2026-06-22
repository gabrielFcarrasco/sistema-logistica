// src/components/prestacao-servicos/KanbanTruques.tsx
import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoCarvalho from '../../assets/LogoLimpa.webp'; // Verifique o caminho da logo

import { TrainFront, ArrowRight, Check, Printer } from 'lucide-react';
import Button from '../ui/Button';

interface Props { setorAtivo: string; funcionarios: any[]; avisar: (msg: string, tipo?: 'sucesso'|'erro') => void; }

export default function KanbanTruques({ setorAtivo, funcionarios, avisar }: Props) {
  const [truques, setTruques] = useState<any[]>([]);
  const [truqueId, setTruqueId] = useState('');
  const [colaboradorJateouId, setColaboradorJateouId] = useState('');
  const [jaPintado, setJaPintado] = useState(false);
  const [operadoresKanban, setOperadoresKanban] = useState<Record<string, string>>({});
  
  // NOVOS ESTADOS PARA A RECONTAGEM
  const [idsOcultos, setIdsOcultos] = useState<string[]>([]);
  const [novoValorGalpao, setNovoValorGalpao] = useState('');

  useEffect(() => {
    if (!setorAtivo) return;
    const q = query(collection(db, 'truques_producao'), where('setorId', '==', setorAtivo));
    const unsub = onSnapshot(q, (snap) => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      lista.sort((a: any, b: any) => (b.dataCadastro?.toMillis() || 0) - (a.dataCadastro?.toMillis() || 0));
      setTruques(lista);
    });
    return () => unsub();
  }, [setorAtivo]);

  const registrarTruque = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!truqueId) return avisar("Preencha os números da Plaquinha.", "erro");
    if (!/^M\d{3}$/.test(truqueId)) return avisar("A plaquinha deve conter M e 3 números. Ex: M001.", "erro");
    if (jaPintado && !colaboradorJateouId) return avisar("Informe quem realizou o serviço.", "erro");

    try {
      const funcNome = colaboradorJateouId ? funcionarios.find(f => f.id === colaboradorJateouId)?.nome || 'Desconhecido' : 'A Definir';
      await addDoc(collection(db, 'truques_producao'), {
        setorId: setorAtivo, identificacao: truqueId, colaboradorJateouId: colaboradorJateouId || 'pendente', 
        colaboradorJateouNome: funcNome, status: jaPintado ? 'pintado' : 'pronto_jateamento', dataCadastro: serverTimestamp(),
        ...(jaPintado ? { dataPintura: serverTimestamp(), dataPM: serverTimestamp() } : {})
      });
      avisar(jaPintado ? "Truque registrado (Pintado)!" : "Truque cadastrado para Lavagem.");
      setTruqueId(''); setColaboradorJateouId(''); setJaPintado(false);
    } catch (error) { avisar("Erro ao registrar.", "erro"); }
  };

  const avancarParaPM = async (t: any) => {
    let colabId = t.colaboradorJateouId; let colabNome = t.colaboradorJateouNome;
    if (!colabId || colabId === 'pendente') {
      const sel = operadoresKanban[t.id];
      if (!sel) return avisar("Selecione quem jateou antes de avançar!", "erro");
      colabId = sel; colabNome = funcionarios.find(f => f.id === sel)?.nome || 'Desconhecido';
    }
    try {
      await updateDoc(doc(db, 'truques_producao', t.id), { status: 'analisado_pm', dataPM: serverTimestamp(), colaboradorJateouId: colabId, colaboradorJateouNome: colabNome });
      avisar("Liberado para Pintura.");
    } catch (e) { avisar("Erro ao avançar.", "erro"); }
  };

  const marcarComoPintado = async (id: string) => {
    try { await updateDoc(doc(db, 'truques_producao', id), { status: 'pintado', dataPintura: serverTimestamp() }); avisar("Pintura Concluída."); } 
    catch (e) { avisar("Erro.", "erro"); }
  };

  // NOVA FUNÇÃO DE RECONTAGEM
  const aplicarRecontagem = () => {
    const valor = parseInt(novoValorGalpao, 10);
    const todosPintados = truques.filter(t => t.status === 'pintado');
    
    if (isNaN(valor) || valor < 0) {
      return avisar("Insira um valor válido para a recontagem.", "erro");
    }
    if (valor > todosPintados.length) {
      return avisar("O novo valor não pode ser maior que o total real do banco.", "erro");
    }

    const quantidadeRemover = todosPintados.length - valor;
    
    // Se o valor for igual ao total real, limpa a lista de ocultos
    if (quantidadeRemover === 0) {
      setIdsOcultos([]);
      setNovoValorGalpao('');
      avisar("Contagem restaurada para o valor original.");
      return;
    }

    // Embaralha a lista e pega N itens aleatórios para esconder
    const embaralhados = [...todosPintados].sort(() => 0.5 - Math.random());
    const paraOcultar = embaralhados.slice(0, quantidadeRemover).map(t => t.id);

    setIdsOcultos(paraOcultar);
    setNovoValorGalpao('');
    avisar(`Contagem ajustada. ${quantidadeRemover} truques removidos visualmente.`);
  };

  const gerarRelatorioTruques = () => {
    const docPdf = new jsPDF('p', 'mm', 'a4');
    const dataAtual = new Date().toLocaleDateString('pt-BR');
    try { docPdf.addImage(logoCarvalho, 'WEBP', 15, 10, 40, 14); } catch(e){}
    docPdf.setFont("helvetica", "bold"); docPdf.setFontSize(16); docPdf.setTextColor(30, 41, 59);
    docPdf.text("RELATÓRIO DE PRODUÇÃO - TRUQUES", 105, 18, { align: 'center' });
    docPdf.setFontSize(10); docPdf.setTextColor(100, 100, 100); docPdf.text(`Emissão: ${dataAtual}`, 195, 20, { align: 'right' });
    docPdf.setLineWidth(0.5); docPdf.line(15, 26, 195, 26);
    docPdf.setFontSize(11); docPdf.setTextColor(0, 0, 0); docPdf.text("RESUMO DO PÁTIO / GALPÃO", 15, 35);
    docPdf.setFontSize(10); docPdf.setFont("helvetica", "normal");
    docPdf.text(`1. Lavagem e Jateamento: ${truquesAguardandoJateamento.length} peça(s)`, 15, 42);
    docPdf.text(`2. Analisados c/ Partículas Magnéticas (Prontos p/ Pintar): ${truquesAguardandoPintura.length} peça(s)`, 15, 48);
    docPdf.text(`3. Pintura Concluída: ${truquesConcluidos.length} peça(s)`, 15, 54);

    const renderTable = typeof autoTable === 'function' ? autoTable : (autoTable as any).default;
    renderTable(docPdf, {
      startY: 65, head: [["PLAQUETA", "STATUS ATUAL", "COLABORADOR (JAT)"]],
      body: [
        ...truquesAguardandoJateamento.map(t => [t.identificacao, 'Lavagem / Jateamento', t.colaboradorJateouNome]),
        ...truquesAguardandoPintura.map(t => [t.identificacao, 'Aguardando Pintura', t.colaboradorJateouNome]),
        ...truquesConcluidos.map(t => [t.identificacao, 'Concluído (Galpão)', t.colaboradorJateouNome])
      ],
      theme: 'grid', styles: { fontSize: 9, cellPadding: 4 }
    });
    docPdf.save(`Relatorio_Truques_${dataAtual.replace(/\//g, '-')}.pdf`);
  };

  const truquesAguardandoJateamento = truques.filter(t => t.status === 'pronto_jateamento');
  const truquesAguardandoPintura = truques.filter(t => t.status === 'analisado_pm');
  // Filtra os concluídos ignorando os IDs que estão na lista de ocultos
  const truquesConcluidos = truques.filter(t => t.status === 'pintado' && !idsOcultos.includes(t.id));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
      {/* Coluna 1: Cadastro */}
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', height: 'fit-content' }}>
        <h3 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 20px 0', color: '#1e293b' }}>
          <TrainFront size={18} color="#3b82f6" /> Lançar Truque
        </h3>
        <form onSubmit={registrarTruque} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <label style={{ fontSize: '13px', color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Código da Plaquinha *</label>
            <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
              <span style={{ padding: '12px 15px', backgroundColor: '#e2e8f0', fontWeight: 'bold' }}>M</span>
              <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={3} value={truqueId.replace('M', '')} onChange={e => setTruqueId(e.target.value.replace(/\D/g, '') ? `M${e.target.value.replace(/\D/g, '')}` : '')} placeholder="000" style={{ width: '100%', padding: '12px', border: 'none', background: 'transparent', outline: 'none', fontSize: '16px', fontWeight: 'bold' }} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: '13px', color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Colaborador (Jateamento) {jaPintado ? <span style={{fontWeight: 'normal'}}>(Opc)</span> : ''}</label>
            <select value={colaboradorJateouId} onChange={e => setColaboradorJateouId(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <option value="">{jaPintado ? 'Não informado...' : 'Definir depois...'}</option>
              {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 'bold', backgroundColor: jaPintado ? '#dcfce7' : '#f8fafc', padding: '12px', borderRadius: '8px' }}>
            <input type="checkbox" checked={jaPintado} onChange={e => setJaPintado(e.target.checked)} /> O truque já está finalizado (Galpão)
          </label>
          <Button type="submit" style={{ height: '50px', backgroundColor: jaPintado ? '#10b981' : '#3b82f6' }}>{jaPintado ? 'Registrar Concluído' : 'Iniciar Preparação'}</Button>
          <Button type="button" onClick={gerarRelatorioTruques} style={{ backgroundColor: '#1e293b', marginTop: '10px' }}><Printer size={16}/> PDF Produção</Button>
        </form>
      </div>

      {/* Coluna 2: Kanban */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ backgroundColor: '#f1f5f9', padding: '20px', borderRadius: '16px' }}>
          <h4 style={{ margin: '0 0 15px 0', color: '#334155' }}>1. Lavagem / Jateamento ({truquesAguardandoJateamento.length})</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '250px', overflowY: 'auto' }}>
            {truquesAguardandoJateamento.map(t => (
              <div key={t.id} style={{ backgroundColor: 'white', padding: '15px', borderRadius: '12px', border: '1px solid #94a3b8' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><strong>{t.identificacao}</strong></div>
                {(!t.colaboradorJateouId || t.colaboradorJateouId === 'pendente') && (
                  <select value={operadoresKanban[t.id] || ''} onChange={e => setOperadoresKanban({...operadoresKanban, [t.id]: e.target.value})} style={{ width: '100%', padding: '8px', marginTop: '10px', borderRadius: '6px' }}>
                    <option value=""> Quem realizou?</option>
                    {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>
                )}
                <Button onClick={() => avancarParaPM(t)} style={{ backgroundColor: '#f59e0b', marginTop: '10px', width: '100%' }}>Avançar p/ Partículas Magnéticas<ArrowRight size={14}/></Button>
              </div>
            ))}
          </div>
        </div>
        
        <div style={{ backgroundColor: '#fffbeb', padding: '20px', borderRadius: '16px' }}>
          <h4 style={{ margin: '0 0 15px 0', color: '#b45309' }}>2. Análise c/ Partículas Magnéticas ({truquesAguardandoPintura.length})</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto' }}>
            {truquesAguardandoPintura.map(t => (
              <div key={t.id} style={{ backgroundColor: 'white', padding: '15px', borderRadius: '12px', border: '1px solid #fde047', display: 'flex', justifyContent: 'space-between' }}>
                <strong>{t.identificacao}</strong>
                <Button onClick={() => marcarComoPintado(t.id)} style={{ backgroundColor: '#10b981', padding: '8px' }}>Concluir <Check size={14}/></Button>
              </div>
            ))}
          </div>
        </div>

        <div style={{ backgroundColor: '#f0fdf4', padding: '20px', borderRadius: '16px' }}>
          {/* CABEÇALHO DO GALPÃO COM O INPUT DE RECONTAGEM */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h4 style={{ margin: 0, color: '#166534' }}>3. Galpão ({truquesConcluidos.length})</h4>
            <div style={{ display: 'flex', gap: '5px' }}>
              <input 
                type="number" 
                value={novoValorGalpao} 
                onChange={e => setNovoValorGalpao(e.target.value)} 
                placeholder="Qtd atual" 
                style={{ width: '70px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #86efac', outline: 'none', fontSize: '13px' }} 
              />
              <Button onClick={aplicarRecontagem} style={{ padding: '4px 10px', fontSize: '12px', backgroundColor: '#166534' }}>Ajustar</Button>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
            {truquesConcluidos.map(t => (
              <div key={t.id} style={{ backgroundColor: 'white', padding: '10px 15px', borderRadius: '8px', border: '1px solid #86efac', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 'bold' }}>{t.identificacao}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
