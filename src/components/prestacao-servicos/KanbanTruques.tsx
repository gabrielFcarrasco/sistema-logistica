// src/components/prestacao-servicos/KanbanTruques.tsx
import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';

import { ArrowRight, Check, Paintbrush, Undo2, ClipboardCheck, FileDown } from 'lucide-react';
import Button from '../ui/Button';

// ✨ Componentes Isolados e Ferramentas importadas
import ModalChecklistJateamento from './ModalChecklistJateamento';
import FormularioLancarTruque from './FormularioLancarTruque';
import { baixarChecklistIndividual, baixarChecklistsDaSemana, gerarRelatorioTruques } from '../../utils/pdfTruques';

// ✨ 1. Importar o novo Modal de Pintura
import ModalRelatorioPintura from './ModalRelatorioPintura';

interface Props { setorAtivo: string; funcionarios: any[]; avisar: (msg: string, tipo?: 'sucesso'|'erro') => void; }

export default function KanbanTruques({ setorAtivo, funcionarios, avisar }: Props) {
  const [truques, setTruques] = useState<any[]>([]);
  const [idsOcultos, setIdsOcultos] = useState<string[]>([]);
  const [novoValorGalpao, setNovoValorGalpao] = useState('');

  // Estados para o Modal de Jateamento (Existente)[cite: 6]
  const [modalChecklistAberto, setModalChecklistAberto] = useState(false);
  const [truqueParaChecklist, setTruqueParaChecklist] = useState<any>(null);

  // ✨ 2. Novos Estados para o Modal de Relatório de Pintura
  const [modalPinturaAberto, setModalPinturaAberto] = useState(false);
  const [truqueParaPintura, setTruqueParaPintura] = useState<any>(null);

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

  const avancarParaPintura = async (id: string) => {
    try { await updateDoc(doc(db, 'truques_producao', id), { status: 'pronto_pintura' }); avisar("Liberado para Pintura."); } 
    catch (e) { avisar("Erro ao enviar para pintura.", "erro"); }
  };

  // Esta função não vai ser mais chamada pelo botão diretamente, pois o modal tratará disso, mas mantemos para histórico
  const marcarComoPintado = async (id: string) => {
    try { await updateDoc(doc(db, 'truques_producao', id), { status: 'pintado', dataPintura: serverTimestamp() }); avisar("Enviado ao Galpão."); } 
    catch (e) { avisar("Erro.", "erro"); }
  };

  const voltarEtapa = async (id: string, statusAnterior: string) => {
    try { await updateDoc(doc(db, 'truques_producao', id), { status: statusAnterior }); avisar("Peça retornada para a etapa anterior."); } 
    catch (e) { avisar("Erro.", "erro"); }
  };

  const aplicarRecontagem = async () => {
    const valor = parseInt(novoValorGalpao, 10);
    const todosPintados = truques.filter(t => t.status === 'pintado');
    
    if (isNaN(valor) || valor < 0) return avisar("Insira um valor válido.", "erro");
    if (valor > todosPintados.length) return avisar("Não pode ser maior que o total real.", "erro");

    const quantidadeRemover = todosPintados.length - valor;
    
    if (quantidadeRemover === 0) {
      avisar("A quantidade já está correta.");
      return;
    }

    const paraRemover = [...todosPintados].sort(() => 0.5 - Math.random()).slice(0, quantidadeRemover);

    try {
      for (const t of paraRemover) {
        await updateDoc(doc(db, 'truques_producao', t.id), { 
          status: 'ajustado_galpao' 
        });
      }
      setNovoValorGalpao('');
      avisar(`Sucesso! ${quantidadeRemover} peças foram movidas para o inventário.`);
    } catch (e) {
      avisar("Erro ao atualizar o banco de dados.", "erro");
    }
  };

  const truquesAguardandoJateamento = truques.filter(t => t.status === 'pronto_jateamento');
  const truquesAguardandoPM = truques.filter(t => t.status === 'analisado_pm');
  const truquesAguardandoPintura = truques.filter(t => t.status === 'pronto_pintura');
  const truquesConcluidos = truques.filter(t => t.status === 'pintado' && !idsOcultos.includes(t.id));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
      
      {/* MÓDULO LATERAL ISOLADO */}
      <FormularioLancarTruque 
        setorAtivo={setorAtivo}
        avisar={avisar}
        onGerarRelatorio={() => gerarRelatorioTruques(truquesAguardandoJateamento, truquesAguardandoPM, truquesAguardandoPintura, truquesConcluidos)}
        onBaixarChecklistsSemana={() => baixarChecklistsDaSemana(truques, avisar)}
      />

      {/* COLUNAS DO KANBAN */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Coluna Jateamento (Mantida igual)[cite: 6] */}
        <div style={{ backgroundColor: '#f1f5f9', padding: '20px', borderRadius: '16px' }}>
          <h4 style={{ margin: '0 0 15px 0', color: '#334155' }}>1. Lavagem / Jateamento ({truquesAguardandoJateamento.length})</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '250px', overflowY: 'auto' }}>
            {truquesAguardandoJateamento.map(t => (
              <div key={t.id} style={{ backgroundColor: 'white', padding: '15px', borderRadius: '12px', border: '1px solid #94a3b8' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><strong>{t.identificacao}</strong></div>
                <Button onClick={() => { setTruqueParaChecklist(t); setModalChecklistAberto(true); }} style={{ backgroundColor: '#f59e0b', marginTop: '10px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <ClipboardCheck size={16}/> Preencher Checklist (NR)
                </Button>
              </div>
            ))}
          </div>
        </div>
        
        {/* Coluna PM (Mantida igual)[cite: 6] */}
        <div style={{ backgroundColor: '#fffbeb', padding: '20px', borderRadius: '16px' }}>
          <h4 style={{ margin: '0 0 15px 0', color: '#b45309' }}>2. Partículas Magnéticas (PM) ({truquesAguardandoPM.length})</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto' }}>
            {truquesAguardandoPM.map(t => (
              <div key={t.id} style={{ backgroundColor: 'white', padding: '15px', borderRadius: '12px', border: '1px solid #fde047', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{t.identificacao}</strong>
                  {t.checklistJateamento && (
                    <button onClick={() => baixarChecklistIndividual(t)} style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer' }} title="Baixar Checklist Original">
                      <FileDown size={20} />
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button onClick={() => voltarEtapa(t.id, 'pronto_jateamento')} style={{ backgroundColor: '#f1f5f9', color: '#64748b', padding: '8px 10px' }} title="Voltar para Lavagem">
                    <Undo2 size={16}/>
                  </Button>
                  <Button onClick={() => avancarParaPintura(t.id)} style={{ backgroundColor: '#8b5cf6', padding: '8px 12px', flex: 1 }}>
                    Ir p/ Pintura <ArrowRight size={14}/>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Coluna Pintura (ATUALIZADA) */}
        <div style={{ backgroundColor: '#eff6ff', padding: '20px', borderRadius: '16px' }}>
          <h4 style={{ margin: '0 0 15px 0', color: '#1d4ed8', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Paintbrush size={18} /> 3. Pintura ({truquesAguardandoPintura.length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto' }}>
            {truquesAguardandoPintura.map(t => (
              <div key={t.id} style={{ backgroundColor: 'white', padding: '15px', borderRadius: '12px', border: '1px solid #bfdbfe', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{t.identificacao}</strong>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button onClick={() => voltarEtapa(t.id, 'analisado_pm')} style={{ backgroundColor: '#f1f5f9', color: '#64748b', padding: '8px 10px' }} title="Voltar para PM">
                    <Undo2 size={16}/>
                  </Button>
                  {/* ✨ 3. O botão agora abre o Modal em vez de apenas marcar como pintado */}
                  <Button onClick={() => { setTruqueParaPintura(t); setModalPinturaAberto(true); }} style={{ backgroundColor: '#10b981', padding: '8px 12px', flex: 1 }}>
                    Aprovar Pintura <Check size={14}/>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Coluna Galpão (Mantida igual)[cite: 6] */}
        <div style={{ backgroundColor: '#f0fdf4', padding: '20px', borderRadius: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h4 style={{ margin: 0, color: '#166534' }}>4. Galpão ({truquesConcluidos.length})</h4>
            <div style={{ display: 'flex', gap: '5px' }}>
              <input type="number" value={novoValorGalpao} onChange={e => setNovoValorGalpao(e.target.value)} placeholder="Qtd atual" style={{ width: '70px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #86efac', outline: 'none', fontSize: '13px' }} />
              <Button onClick={aplicarRecontagem} style={{ padding: '4px 10px', fontSize: '12px', backgroundColor: '#166534' }}>Ajustar</Button>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
            {truquesConcluidos.map(t => (
              <div key={t.id} style={{ backgroundColor: 'white', padding: '10px 15px', borderRadius: '8px', border: '1px solid #86efac', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold', color: '#15803d' }}>{t.identificacao}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Button onClick={() => voltarEtapa(t.id, 'pronto_pintura')} style={{ backgroundColor: 'transparent', color: '#15803d', padding: '4px', border: 'none' }} title="Desfazer (Voltar para Pintura)">
                    <Undo2 size={16}/>
                  </Button>
                  <Check size={16} color="#15803d" />
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Renderização dos Modais */}
      <ModalChecklistJateamento 
        aberto={modalChecklistAberto}
        truque={truqueParaChecklist}
        funcionarios={funcionarios}
        onClose={() => { setModalChecklistAberto(false); setTruqueParaChecklist(null); }}
        avisar={avisar}
      />

      {/* ✨ 4. Componente do Modal de Relatório de Pintura */}
      <ModalRelatorioPintura 
        aberto={modalPinturaAberto}
        truque={truqueParaPintura}
        onClose={() => { setModalPinturaAberto(false); setTruqueParaPintura(null); }}
        avisar={avisar}
      />
    </div>
  );
}