// src/pages/GestaoPonto.tsx
import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase'; 
import { dbFolha } from '../services/firebaseFolha'; 

import { Clock, LockOpen, Lock, Edit3, Save, X, UserCheck, AlertCircle, Copy, CheckCircle2, FileText, UserMinus, Handshake, AlertTriangle } from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

// ⚙️ CONFIG: Horários Universais da Empresa
const JORNADA_PADRAO = {
  entrada: '08:00',
  saidaAlmoco: '12:00',
  retornoAlmoco: '13:00',
  saidaFim: '17:48',
  limiteAtraso: '08:30', // A partir deste horário, se não bateu, pede Falta/Atestado
  cargaHoraria: '08:48'
};

export default function GestaoPonto() {
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [registrosHoje, setRegistrosHoje] = useState<any[]>([]);
  const [acordosHoje, setAcordosHoje] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Relógio em tempo real para calcular atrasos
  const [horaAtualTexto, setHoraAtualTexto] = useState(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));

  const [modalAberto, setModalAberto] = useState(false);
  const [funcEditando, setFuncEditando] = useState<any>(null);
  
  const [entrada1, setEntrada1] = useState('');
  const [saida1, setSaida1] = useState('');
  const [entrada2, setEntrada2] = useState('');
  const [saida2, setSaida2] = useState('');
  const [cargaHoraria, setCargaHoraria] = useState(JORNADA_PADRAO.cargaHoraria);
  const [justificativa, setJustificativa] = useState('');
  const [linkCopiado, setLinkCopiado] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const dataHojeStr = new Date().toISOString().split('T')[0];
  const dataFormatada = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  // Responsividade
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Relógio
  useEffect(() => {
    const timer = setInterval(() => {
      setHoraAtualTexto(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    }, 60000); // Atualiza a cada minuto
    return () => clearInterval(timer);
  }, []);

  // 1. Carregar Funcionários
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'funcionarios'), (snap) => {
      const ativos = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter((f: any) => f.status !== 'desligado');
      setFuncionarios(ativos);
    });
    return () => unsub();
  }, []);

  // 2. Carregar Registos de Ponto
  useEffect(() => {
    const q = query(collection(dbFolha, 'registros_ponto'), where('data', '==', dataHojeStr));
    const unsub = onSnapshot(q, (snap) => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setRegistrosHoje(lista);
      setCarregando(false);
    });
    return () => unsub();
  }, [dataHojeStr]);

  // 3. 🧠 INTELIGÊNCIA: Carregar Acordos da coleção real do sistema
  useEffect(() => {
    // Busca na coleção acordos_colaboradores para integrar os sistemas
    const q = query(collection(db, 'acordos_colaboradores'));
    const unsub = onSnapshot(q, (snap) => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Filtra apenas os acordos criados no dia de hoje (baseado no createdAt)
      const acordosDeHoje = lista.filter((acordo: any) => {
        if (!acordo.createdAt) return false;
        const dataAcordo = acordo.createdAt.toDate().toISOString().split('T')[0];
        return dataAcordo === dataHojeStr;
      });
      
      setAcordosHoje(acordosDeHoje);
    });
    return () => unsub();
  }, [dataHojeStr]);

  const copiarLinkPonto = () => {
    const url = `${window.location.origin}/ponto`;
    navigator.clipboard.writeText(url);
    setLinkCopiado(true);
    setTimeout(() => setLinkCopiado(false), 3000);
  };

  const alternarCatraca = async (funcId: string, funcNome: string, statusAtual: boolean) => {
    const idRegistro = `${funcId}_${dataHojeStr}`;
    try {
      await setDoc(doc(dbFolha, 'registros_ponto', idRegistro), {
        funcionarioId: funcId,
        nomeFuncionario: funcNome,
        data: dataHojeStr,
        liberadoParaBater: !statusAtual,
        ultimaAtualizacao: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      alert("Erro ao alterar liberação do ponto.");
    }
  };

  const lancarAusencia = async (funcId: string, funcNome: string, tipo: 'Falta' | 'Atestado Médico') => {
    const confirmar = window.confirm(`Confirmar o lançamento de "${tipo}" para ${funcNome}? O dia será fechado.`);
    if (!confirmar) return;

    const idRegistro = `${funcId}_${dataHojeStr}`;
    try {
      await setDoc(doc(dbFolha, 'registros_ponto', idRegistro), {
        funcionarioId: funcId,
        nomeFuncionario: funcNome,
        data: dataHojeStr,
        statusDia: tipo, 
        justificativa: tipo,
        liberadoParaBater: false, 
        entrada1: '--:--', saida1: '--:--', entrada2: '--:--', saida2: '--:--',
        ultimaAtualizacao: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      alert("Erro ao lançar ausência.");
    }
  };

  const abrirModalEdicao = (func: any, registro: any) => {
    setFuncEditando({ ...func, idRegistro: `${func.id}_${dataHojeStr}` });
    setEntrada1(registro?.entrada1 && registro.entrada1 !== '--:--' ? registro.entrada1 : '');
    setSaida1(registro?.saida1 && registro.saida1 !== '--:--' ? registro.saida1 : '');
    setEntrada2(registro?.entrada2 && registro.entrada2 !== '--:--' ? registro.entrada2 : '');
    setSaida2(registro?.saida2 && registro.saida2 !== '--:--' ? registro.saida2 : '');
    setCargaHoraria(registro?.cargaHorariaPrevista || JORNADA_PADRAO.cargaHoraria);
    setJustificativa(registro?.justificativa || '');
    setModalAberto(true);
  };

  const salvarEdicaoPonto = async () => {
    if (!funcEditando) return;
    try {
      await setDoc(doc(dbFolha, 'registros_ponto', funcEditando.idRegistro), {
        funcionarioId: funcEditando.id,
        nomeFuncionario: funcEditando.nome,
        data: dataHojeStr,
        entrada1, saida1, entrada2, saida2,
        cargaHorariaPrevista: cargaHoraria,
        justificativa,
        statusDia: 'Ajustado',
        ultimaAtualizacao: serverTimestamp(),
        editadoManualmente: true
      }, { merge: true });
      
      setModalAberto(false);
      alert("Ponto atualizado com sucesso!");
    } catch (error) {
      alert("Erro ao salvar os dados manualmente.");
    }
  };

  if (carregando) return <div style={{ padding: '40px', textAlign: 'center' }}>Sincronizando sistemas...</div>;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '10px' : '20px' }}>
      
      {/* Cabeçalho */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: '20px', marginBottom: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ backgroundColor: '#e0f2fe', padding: '12px', borderRadius: '12px' }}>
            <Clock size={28} color="#0ea5e9" />
          </div>
          <div>
            <h1 style={{ fontSize: isMobile ? '20px' : '24px', color: '#1e293b', margin: 0, fontWeight: '800' }}>Painel Inteligente de Ponto</h1>
            <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>{dataFormatada} • Jornada: {JORNADA_PADRAO.entrada} às {JORNADA_PADRAO.saidaFim}</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', backgroundColor: 'white', padding: '10px 15px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <span style={{ fontSize: '13px', color: '#475569', fontWeight: 'bold' }}>Terminal Público:</span>
          <button onClick={copiarLinkPonto} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: linkCopiado ? '#10b981' : '#f1f5f9', border: 'none', color: linkCopiado ? 'white' : '#475569', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', padding: '8px 12px', borderRadius: '6px', transition: 'all 0.2s' }}>
            {linkCopiado ? <CheckCircle2 size={16} /> : <Copy size={16} />}
            {linkCopiado ? 'Copiado!' : 'Copiar Link'}
          </button>
        </div>
      </div>

      {/* Lista de Funcionários */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {funcionarios.map(func => {
          const regHoje = registrosHoje.find(r => r.funcionarioId === func.id);
          
          // 🧠 INTELIGÊNCIA: Verifica se existe acordo assinado na coleção de acordos
          const acordoHoje = acordosHoje.find(a => a.funcionarioId === func.id);
          const tituloAcordo = acordoHoje ? acordoHoje.titulo : null;
          
          const estaLiberado = regHoje?.liberadoParaBater || false;
          const concluido = regHoje?.saida2 && regHoje.saida2 !== '--:--';
          const temFaltaOuAtestado = regHoje?.statusDia === 'Falta' || regHoje?.statusDia === 'Atestado Médico';
          
          // 🧠 INTELIGÊNCIA: Lógica de Alerta de Atraso
          const semPontoAinda = !regHoje?.entrada1 && !temFaltaOuAtestado;
          const estaAtrasado = semPontoAinda && (horaAtualTexto > JORNADA_PADRAO.limiteAtraso);

          // Cores dinâmicas do cartão baseadas no status
          let corFundo = 'white';
          let corBorda = '#e2e8f0';
          if (temFaltaOuAtestado) { corFundo = '#fef2f2'; corBorda = '#fca5a5'; }
          else if (estaAtrasado) { corFundo = '#fffbeb'; corBorda = '#fcd34d'; }
          else if (estaLiberado) { corFundo = '#f0fdf4'; corBorda = '#bbf7d0'; }

          return (
            <div key={func.id} style={{ 
              backgroundColor: corFundo, borderRadius: '16px', border: `1px solid ${corBorda}`, 
              padding: '20px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', 
              gap: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', transition: 'all 0.3s' 
            }}>
              
              {/* Bloco 1: Identificação */}
              <div style={{ flex: 1 }}>
                <strong style={{ display: 'block', fontSize: '16px', color: '#1e293b' }}>{func.nome}</strong>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Matrícula: {func.matricula}</span>
                
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                  {/* Selo Automático de Acordo */}
                  {acordoHoje && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', backgroundColor: '#e0e7ff', color: '#4338ca', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold', border: '1px solid #c7d2fe' }}>
                      <Handshake size={12} /> {tituloAcordo}
                    </span>
                  )}
                  {/* Selo de Justificativa */}
                  {regHoje?.justificativa && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', backgroundColor: temFaltaOuAtestado ? '#fee2e2' : '#fef3c7', color: temFaltaOuAtestado ? '#b91c1c' : '#d97706', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
                      <AlertCircle size={12} /> {regHoje.justificativa}
                    </span>
                  )}
                </div>
              </div>

              {/* Bloco 2: Grelha de Horários */}
              <div style={{ flex: 2, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', backgroundColor: 'rgba(255,255,255,0.6)', padding: '15px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)' }}>
                <div style={{ textAlign: 'center' }}><span style={{ fontSize: '10px', color: '#94a3b8', display: 'block', fontWeight: 'bold' }}>ENTRADA</span><strong style={{ color: regHoje?.entrada1 ? '#10b981' : '#94a3b8', fontSize: '15px' }}>{regHoje?.entrada1 || '--:--'}</strong></div>
                <div style={{ textAlign: 'center' }}><span style={{ fontSize: '10px', color: '#94a3b8', display: 'block', fontWeight: 'bold' }}>SAÍDA ALM.</span><strong style={{ color: regHoje?.saida1 ? '#10b981' : '#94a3b8', fontSize: '15px' }}>{regHoje?.saida1 || '--:--'}</strong></div>
                <div style={{ textAlign: 'center' }}><span style={{ fontSize: '10px', color: '#94a3b8', display: 'block', fontWeight: 'bold' }}>RETORNO</span><strong style={{ color: regHoje?.entrada2 ? '#10b981' : '#94a3b8', fontSize: '15px' }}>{regHoje?.entrada2 || '--:--'}</strong></div>
                <div style={{ textAlign: 'center' }}><span style={{ fontSize: '10px', color: '#94a3b8', display: 'block', fontWeight: 'bold' }}>SAÍDA FIM</span><strong style={{ color: regHoje?.saida2 ? '#10b981' : '#94a3b8', fontSize: '15px' }}>{regHoje?.saida2 || '--:--'}</strong></div>
              </div>

              {/* Bloco 3: Ações e Decisões */}
              <div style={{ flex: 1.5, display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
                
                {/* 🧠 INTELIGÊNCIA: Painel de Decisão se estiver atrasado */}
                {estaAtrasado ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#b45309', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertTriangle size={14} /> Passou das {JORNADA_PADRAO.limiteAtraso}. O que fazer?
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <Button onClick={() => lancarAusencia(func.id, func.nome, 'Falta')} style={{ backgroundColor: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5', fontSize: '12px', height: '35px', padding: 0 }}>
                        <UserMinus size={14} style={{ marginRight: '4px' }}/> Falta
                      </Button>
                      <Button onClick={() => lancarAusencia(func.id, func.nome, 'Atestado Médico')} style={{ backgroundColor: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', fontSize: '12px', height: '35px', padding: 0 }}>
                        <FileText size={14} style={{ marginRight: '4px' }}/> Atestado
                      </Button>
                    </div>
                    <Button onClick={() => alternarCatraca(func.id, func.nome, estaLiberado)} style={{ width: '100%', backgroundColor: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1', fontSize: '12px', height: '30px' }}>
                      Apenas Liberar Ponto
                    </Button>
                  </div>
                ) : semPontoAinda ? (
                  // Ainda não bateu ponto, mas não está atrasado
                  <Button onClick={() => alternarCatraca(func.id, func.nome, estaLiberado)} style={{ backgroundColor: estaLiberado ? '#ef4444' : '#10b981', fontSize: '13px', height: '45px', width: '100%' }}>
                    {estaLiberado ? <><Lock size={16} style={{ marginRight: '5px' }}/> Bloquear Catraca</> : <><LockOpen size={16} style={{ marginRight: '5px' }}/> Liberar Entrada</>}
                  </Button>
                ) : (
                  // Já tem ponto batido ou está com falta
                  <div style={{ display: 'flex', gap: '10px', height: '100%', alignItems: 'center' }}>
                    <div style={{ flex: 3 }}>
                      {concluido || temFaltaOuAtestado ? (
                        <div style={{ fontSize: '13px', fontWeight: 'bold', color: temFaltaOuAtestado ? '#991b1b' : '#166534', backgroundColor: temFaltaOuAtestado ? '#fee2e2' : '#dcfce7', padding: '10px', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '5px' }}>
                          {temFaltaOuAtestado ? 'Dia Justificado' : <><UserCheck size={16} /> Dia Concluído</>}
                        </div>
                      ) : estaLiberado ? (
                        <Button onClick={() => alternarCatraca(func.id, func.nome, estaLiberado)} style={{ backgroundColor: '#ef4444', fontSize: '13px', height: '45px', width: '100%' }}>
                          <Lock size={16} style={{ marginRight: '5px' }}/> Bloquear
                        </Button>
                      ) : (
                        <Button onClick={() => alternarCatraca(func.id, func.nome, estaLiberado)} style={{ backgroundColor: '#10b981', fontSize: '13px', height: '45px', width: '100%' }}>
                          <LockOpen size={16} style={{ marginRight: '5px' }}/> Liberar Próximo
                        </Button>
                      )}
                    </div>
                    <Button onClick={() => abrirModalEdicao(func, regHoje)} style={{ flex: 1, backgroundColor: '#f1f5f9', color: '#3b82f6', border: '1px solid #cbd5e1', padding: 0, height: '45px' }}>
                      <Edit3 size={18} />
                    </Button>
                  </div>
                )}
              </div>

            </div>
          );
        })}
      </div>

      {/* Modal de Edição */}
      {modalAberto && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', padding: '15px' }}>
          <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '500px', borderRadius: '20px', padding: isMobile ? '20px' : '25px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: 0, color: '#1e293b', fontSize: '18px' }}>Ajuste Manual</h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>{funcEditando?.nome}</p>
              </div>
              <button onClick={() => setModalAberto(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} color="#64748b" /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
              <Input type="time" label="Entrada" value={entrada1} onChange={e => setEntrada1(e.target.value)} />
              <Input type="time" label="Saída Almoço" value={saida1} onChange={e => setSaida1(e.target.value)} />
              <Input type="time" label="Retorno Almoço" value={entrada2} onChange={e => setEntrada2(e.target.value)} />
              <Input type="time" label="Saída Final" value={saida2} onChange={e => setSaida2(e.target.value)} />
            </div>

            <div style={{ backgroundColor: '#f8fafc', padding: '15px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '8px' }}>Carga Horária Prevista</label>
              <Input type="time" label="" value={cargaHoraria} onChange={e => setCargaHoraria(e.target.value)} />
              <p style={{ fontSize: '11px', color: '#94a3b8', margin: '5px 0 0 0' }}>Jornada padrão: {JORNADA_PADRAO.cargaHoraria}</p>
            </div>

            <div style={{ marginBottom: '25px' }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '8px' }}>Justificativa (Opcional)</label>
              <textarea 
                value={justificativa} 
                onChange={e => setJustificativa(e.target.value)} 
                placeholder="Ex: Esqueceu de bater..."
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', minHeight: '80px', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>

            <Button onClick={salvarEdicaoPonto} style={{ width: '100%', height: '50px', fontSize: '16px', backgroundColor: '#3b82f6', display: 'flex', justifyContent: 'center', gap: '8px' }}>
              <Save size={20} /> Salvar Alterações
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
