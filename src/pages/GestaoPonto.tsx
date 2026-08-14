// src/pages/GestaoPonto.tsx
import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, query, where, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase'; 
import { dbFolha } from '../services/firebaseFolha'; 

import { Clock, LockOpen, Lock, Edit3, Save, X, UserCheck, AlertCircle, Copy, CheckCircle2, FileText, UserMinus, Handshake, AlertTriangle, Search, MapPin, Settings } from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

const JORNADA_INICIAL = {
  entrada: '08:00',
  saidaAlmoco: '12:00',
  retornoAlmoco: '13:00',
  saidaFim: '17:48',
  limiteAtraso: '08:30', 
  cargaHoraria: '08:48'
};

export default function GestaoPonto() {
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [registrosHoje, setRegistrosHoje] = useState<any[]>([]);
  const [acordosHoje, setAcordosHoje] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [termoBusca, setTermoBusca] = useState('');

  const [horaAtualTexto, setHoraAtualTexto] = useState(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));

  const [modalAberto, setModalAberto] = useState(false);
  const [funcEditando, setFuncEditando] = useState<any>(null);
  
  const [entrada1, setEntrada1] = useState('');
  const [saida1, setSaida1] = useState('');
  const [entrada2, setEntrada2] = useState('');
  const [saida2, setSaida2] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [linkCopiado, setLinkCopiado] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const [jornadaPadrao, setJornadaPadrao] = useState(JORNADA_INICIAL);
  const [cargaHorariaManual, setCargaHorariaManual] = useState(JORNADA_INICIAL.cargaHoraria);
  const [modalConfig, setModalConfig] = useState(false);
  const [configEdit, setConfigEdit] = useState(JORNADA_INICIAL);

  const dataHojeStr = new Date().toISOString().split('T')[0];
  const dataFormatada = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  // ✨ FUNÇÃO INTELIGENTE: Remove os segundos vindos do Firebase ("08:00:15" -> "08:00")
  const formatarHoraLimpa = (hora?: string) => {
    if (!hora || hora === '--:--') return '--:--';
    return hora.substring(0, 5);
  };

  // ✨ FUNÇÃO INTELIGENTE: Específica para preencher o campo do formulário "<input type='time'>"
  const extrairParaInput = (hora?: string) => {
    if (!hora || hora === '--:--') return '';
    return hora.substring(0, 5);
  };

  useEffect(() => {
    const buscarConfiguracoes = async () => {
      try {
        const docRef = doc(dbFolha, 'configuracoes', 'jornada_padrao');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setJornadaPadrao(docSnap.data() as any);
          setConfigEdit(docSnap.data() as any);
        }
      } catch (e) {
        console.error("Erro ao buscar configurações globais.");
      }
    };
    buscarConfiguracoes();
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setHoraAtualTexto(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'funcionarios'), (snap) => {
      const ativos = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter((f: any) => f.status !== 'desligado');
      setFuncionarios(ativos);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(collection(dbFolha, 'registros_ponto'), where('data', '==', dataHojeStr));
    const unsub = onSnapshot(q, (snap) => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setRegistrosHoje(lista);
      setCarregando(false);
    });
    return () => unsub();
  }, [dataHojeStr]);

  useEffect(() => {
    const q = query(collection(db, 'acordos_colaboradores'));
    const unsub = onSnapshot(q, (snap) => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
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
    
    // ✨ AQUI: Usamos a nossa função limpadora de formato para preencher os inputs corretamente
    setEntrada1(extrairParaInput(registro?.entrada1));
    setSaida1(extrairParaInput(registro?.saida1));
    setEntrada2(extrairParaInput(registro?.entrada2));
    setSaida2(extrairParaInput(registro?.saida2));
    
    setCargaHorariaManual(registro?.cargaHorariaPrevista || jornadaPadrao.cargaHoraria);
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
        cargaHorariaPrevista: cargaHorariaManual,
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

  const salvarConfiguracaoGlobal = async () => {
    try {
      await setDoc(doc(dbFolha, 'configuracoes', 'jornada_padrao'), configEdit);
      setJornadaPadrao(configEdit);
      setModalConfig(false);
      alert("Quadro de horários atualizado com sucesso!");
    } catch (error) {
      alert("Erro ao salvar as configurações.");
    }
  };

  const RenderHoraComGps = ({ hora, linkGps }: { hora?: string, linkGps?: string }) => {
    if (!hora || hora === '--:--') {
      return <strong style={{ color: '#cbd5e1', fontSize: '16px', fontWeight: '600' }}>--:--</strong>;
    }
    
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
        <strong style={{ color: '#0f172a', fontSize: '16px', fontWeight: '800' }}>{hora}</strong>
        {linkGps && (
          <a 
            href={linkGps} 
            target="_blank" 
            rel="noopener noreferrer" 
            title="Ver Localização no Google Maps" 
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#eff6ff', padding: '4px', borderRadius: '50%', color: '#3b82f6', transition: '0.2s' }}
          >
            <MapPin size={14} />
          </a>
        )}
      </div>
    );
  };

  const funcionariosFiltrados = funcionarios.filter(f => 
    f.nome.toLowerCase().includes(termoBusca.toLowerCase()) || 
    f.matricula.includes(termoBusca)
  );

  if (carregando) return <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Sincronizando sistemas de RH...</div>;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', padding: isMobile ? '15px 10px' : '30px 20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: '20px', marginBottom: '35px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ backgroundColor: '#eff6ff', padding: '14px', borderRadius: '16px', border: '1px solid #bfdbfe', boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.1)' }}>
              <Clock size={30} color="#2563eb" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 style={{ fontSize: isMobile ? '22px' : '28px', color: '#0f172a', margin: '0 0 4px 0', fontWeight: '800', letterSpacing: '-0.5px' }}>
                  Monitor de Ponto
                </h1>
                <button onClick={() => setModalConfig(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '5px' }} title="Configurar Quadro de Horários">
                  <Settings size={22} />
                </button>
              </div>
              <p style={{ margin: 0, fontSize: '14px', color: '#64748b', fontWeight: '500' }}>
                {dataFormatada} • Jornada: <strong style={{ color: '#475569' }}>{jornadaPadrao.entrada} - {jornadaPadrao.saidaFim}</strong>
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'white', padding: '0 15px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
              <Search size={18} color="#94a3b8" />
              <input 
                type="text" 
                placeholder="Buscar colaborador..." 
                value={termoBusca}
                onChange={e => setTermoBusca(e.target.value)}
                style={{ border: 'none', padding: '12px 10px', outline: 'none', fontSize: '14px', width: isMobile ? '100%' : '200px', backgroundColor: 'transparent' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', backgroundColor: 'white', padding: '8px 8px 8px 15px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
              <span style={{ fontSize: '13px', color: '#475569', fontWeight: '600' }}>Terminal Web:</span>
              <button onClick={copiarLinkPonto} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: linkCopiado ? '#10b981' : '#f1f5f9', border: 'none', color: linkCopiado ? 'white' : '#475569', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', padding: '10px 16px', borderRadius: '8px', transition: 'all 0.2s' }}>
                {linkCopiado ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                {linkCopiado ? 'Copiado!' : 'Copiar Link'}
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {funcionariosFiltrados.map(func => {
            const regHoje = registrosHoje.find(r => r.funcionarioId === func.id);
            const acordoHoje = acordosHoje.find(a => a.funcionarioId === func.id);
            
            const estaLiberado = regHoje?.liberadoParaBater || false;
            const concluido = regHoje?.saida2 && regHoje.saida2 !== '--:--';
            const temFaltaOuAtestado = regHoje?.statusDia === 'Falta' || regHoje?.statusDia === 'Atestado Médico';
            
            const semPontoAinda = !regHoje?.entrada1 && !temFaltaOuAtestado;
            const estaAtrasado = semPontoAinda && (horaAtualTexto > jornadaPadrao.limiteAtraso);

            let corFundo = 'white';
            let corBorda = 'rgba(226, 232, 240, 0.8)'; 
            
            if (temFaltaOuAtestado) { corFundo = '#fff5f5'; corBorda = '#fecaca'; }
            else if (estaAtrasado) { corFundo = '#fffbeb'; corBorda = '#fde68a'; }
            else if (estaLiberado) { corFundo = '#f0fdf4'; corBorda = '#bbf7d0'; }

            return (
              <div key={func.id} style={{ 
                backgroundColor: corFundo, borderRadius: '20px', border: `1px solid ${corBorda}`, 
                padding: isMobile ? '20px' : '24px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', 
                gap: '24px', boxShadow: '0 4px 15px -3px rgba(0,0,0,0.03)', transition: 'all 0.3s ease' 
              }}>
                
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <div style={{ width: '40px', height: '40px', backgroundColor: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontWeight: 'bold', fontSize: '16px' }}>
                      {func.nome.charAt(0)}
                    </div>
                    <div>
                      <strong style={{ display: 'block', fontSize: '17px', color: '#0f172a', fontWeight: '700' }}>{func.nome}</strong>
                      <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>Matrícula: {func.matricula}</span>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingLeft: '52px' }}>
                    {acordoHoje && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', backgroundColor: '#eef2ff', color: '#4f46e5', padding: '4px 10px', borderRadius: '20px', fontWeight: 'bold', border: '1px solid #c7d2fe' }}>
                        <Handshake size={12} /> {acordoHoje.titulo}
                      </span>
                    )}
                    {regHoje?.justificativa && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', backgroundColor: temFaltaOuAtestado ? '#fee2e2' : '#fef3c7', color: temFaltaOuAtestado ? '#b91c1c' : '#d97706', padding: '4px 10px', borderRadius: '20px', fontWeight: 'bold' }}>
                        <AlertCircle size={12} /> {regHoje.justificativa}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ flex: 1.5, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', backgroundColor: 'rgba(248, 250, 252, 0.5)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(226, 232, 240, 0.5)' }}>
                  {[
                    // ✨ AQUI: Renderizamos formatando as horas para esconder os segundos
                    { label: 'ENTRADA', valor: formatarHoraLimpa(regHoje?.entrada1), link: regHoje?.entrada1_local },
                    { label: 'SAÍDA ALM.', valor: formatarHoraLimpa(regHoje?.saida1), link: regHoje?.saida1_local },
                    { label: 'RETORNO', valor: formatarHoraLimpa(regHoje?.entrada2), link: regHoje?.entrada2_local },
                    { label: 'SAÍDA FIM', valor: formatarHoraLimpa(regHoje?.saida2), link: regHoje?.saida2_local }
                  ].map((ponto, idx) => (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700', marginBottom: '4px' }}>{ponto.label}</span>
                      <RenderHoraComGps hora={ponto.valor} linkGps={ponto.link} />
                    </div>
                  ))}
                </div>

                <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', gap: '10px', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch', height: estaAtrasado ? 'auto' : '50px' }}>
                    
                    <div style={{ flex: 3, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {estaAtrasado ? (
                        <>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', height: '40px' }}>
                            <Button onClick={() => lancarAusencia(func.id, func.nome, 'Falta')} style={{ backgroundColor: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5', fontSize: '12px', padding: 0, borderRadius: '10px' }}>
                              <UserMinus size={14} style={{ marginRight: '6px' }}/> Falta
                            </Button>
                            <Button onClick={() => lancarAusencia(func.id, func.nome, 'Atestado Médico')} style={{ backgroundColor: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', fontSize: '12px', padding: 0, borderRadius: '10px' }}>
                              <FileText size={14} style={{ marginRight: '6px' }}/> Atestado
                            </Button>
                          </div>
                          <Button onClick={() => alternarCatraca(func.id, func.nome, estaLiberado)} style={{ backgroundColor: 'white', color: '#475569', border: '1px solid #cbd5e1', fontSize: '12px', height: '36px', borderRadius: '10px' }}>
                            Apenas Liberar Ponto
                          </Button>
                        </>
                      ) : semPontoAinda ? (
                        <Button onClick={() => alternarCatraca(func.id, func.nome, estaLiberado)} style={{ backgroundColor: estaLiberado ? '#ef4444' : '#10b981', fontSize: '14px', height: '100%', width: '100%', borderRadius: '12px' }}>
                          {estaLiberado ? <><Lock size={16} style={{ marginRight: '8px' }}/> Bloquear Catraca</> : <><LockOpen size={16} style={{ marginRight: '8px' }}/> Liberar Entrada</>}
                        </Button>
                      ) : concluido || temFaltaOuAtestado ? (
                        <div style={{ fontSize: '14px', fontWeight: 'bold', color: temFaltaOuAtestado ? '#991b1b' : '#15803d', backgroundColor: temFaltaOuAtestado ? '#fee2e2' : '#dcfce7', borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', height: '100%' }}>
                          {temFaltaOuAtestado ? 'Dia Justificado' : <><UserCheck size={18} /> Dia Concluído</>}
                        </div>
                      ) : (
                        <Button onClick={() => alternarCatraca(func.id, func.nome, estaLiberado)} style={{ backgroundColor: estaLiberado ? '#ef4444' : '#10b981', fontSize: '14px', height: '100%', width: '100%', borderRadius: '12px' }}>
                          {estaLiberado ? <><Lock size={16} style={{ marginRight: '8px' }}/> Bloquear</> : <><LockOpen size={16} style={{ marginRight: '8px' }}/> Liberar Próximo</>}
                        </Button>
                      )}
                    </div>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                       <Button 
                        onClick={() => abrirModalEdicao(func, regHoje)} 
                        style={{ height: '100%', minHeight: estaAtrasado ? '84px' : '100%', backgroundColor: '#f8fafc', color: '#3b82f6', border: '1px solid #cbd5e1', padding: 0, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
                        title="Ajustar Manualmente"
                      >
                        <Edit3 size={20} />
                      </Button>
                    </div>

                  </div>
                </div>

              </div>
            );
          })}
        </div>
      </div>

      {modalConfig && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)', padding: '15px' }}>
          <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '500px', borderRadius: '24px', padding: isMobile ? '24px' : '32px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '20px', marginBottom: '25px' }}>
              <div>
                <h3 style={{ margin: 0, color: '#0f172a', fontSize: '20px', fontWeight: '800' }}>Quadro de Horários Global</h3>
                <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>Edite as regras do ponto para toda a empresa.</p>
              </div>
              <button onClick={() => setModalConfig(false)} style={{ background: '#f8fafc', border: 'none', cursor: 'pointer', padding: '10px', borderRadius: '50%' }}><X size={20} color="#64748b" /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <Input type="time" label="Hora de Entrada" value={configEdit.entrada} onChange={e => setConfigEdit({...configEdit, entrada: e.target.value})} />
              <Input type="time" label="Saída Almoço" value={configEdit.saidaAlmoco} onChange={e => setConfigEdit({...configEdit, saidaAlmoco: e.target.value})} />
              <Input type="time" label="Retorno Almoço" value={configEdit.retornoAlmoco} onChange={e => setConfigEdit({...configEdit, retornoAlmoco: e.target.value})} />
              <Input type="time" label="Saída Fim de Expediente" value={configEdit.saidaFim} onChange={e => setConfigEdit({...configEdit, saidaFim: e.target.value})} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '30px' }}>
              <div style={{ backgroundColor: '#fffbeb', padding: '10px', borderRadius: '12px', border: '1px solid #fde68a' }}>
                <Input type="time" label="Limite para Atraso" value={configEdit.limiteAtraso} onChange={e => setConfigEdit({...configEdit, limiteAtraso: e.target.value})} />
                <p style={{ margin: '5px 0 0 0', fontSize: '11px', color: '#b45309' }}>Após este horário, o sistema alerta o gestor para lançar falta.</p>
              </div>
              <div style={{ backgroundColor: '#f0fdf4', padding: '10px', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                <Input type="time" label="Carga Horária / Jornada" value={configEdit.cargaHoraria} onChange={e => setConfigEdit({...configEdit, cargaHoraria: e.target.value})} />
                <p style={{ margin: '5px 0 0 0', fontSize: '11px', color: '#166534' }}>Horas previstas por dia (ex: 08:48).</p>
              </div>
            </div>

            <Button onClick={salvarConfiguracaoGlobal} style={{ width: '100%', height: '56px', fontSize: '16px', backgroundColor: '#0f172a', display: 'flex', justifyContent: 'center', gap: '10px', borderRadius: '14px', fontWeight: 'bold' }}>
              <Save size={20} /> Salvar Regras no Sistema
            </Button>
          </div>
        </div>
      )}

      {modalAberto && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)', padding: '15px' }}>
          <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '500px', borderRadius: '24px', padding: isMobile ? '24px' : '32px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '20px', marginBottom: '25px' }}>
              <div>
                <h3 style={{ margin: 0, color: '#0f172a', fontSize: '20px', fontWeight: '800' }}>Ajuste Manual</h3>
                <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>{funcEditando?.nome}</p>
              </div>
              <button onClick={() => setModalAberto(false)} style={{ background: '#f8fafc', border: 'none', cursor: 'pointer', padding: '10px', borderRadius: '50%' }}><X size={20} color="#64748b" /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px', marginBottom: '25px' }}>
              <Input type="time" label="Entrada" value={entrada1} onChange={e => setEntrada1(e.target.value)} />
              <Input type="time" label="Saída Almoço" value={saida1} onChange={e => setSaida1(e.target.value)} />
              <Input type="time" label="Retorno Almoço" value={entrada2} onChange={e => setEntrada2(e.target.value)} />
              <Input type="time" label="Saída Final" value={saida2} onChange={e => setSaida2(e.target.value)} />
            </div>

            <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '25px' }}>
              <label style={{ fontSize: '13px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '8px' }}>Carga Horária Prevista</label>
              <Input type="time" label="" value={cargaHorariaManual} onChange={e => setCargaHorariaManual(e.target.value)} />
            </div>

            <div style={{ marginBottom: '30px' }}>
              <label style={{ fontSize: '13px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '8px' }}>Justificativa (Opcional)</label>
              <textarea 
                value={justificativa} 
                onChange={e => setJustificativa(e.target.value)} 
                placeholder="Ex: Esqueceu de bater o ponto na entrada..."
                style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', minHeight: '90px', fontFamily: 'inherit', boxSizing: 'border-box', fontSize: '14px' }}
              />
            </div>

            <Button onClick={salvarEdicaoPonto} style={{ width: '100%', height: '56px', fontSize: '16px', backgroundColor: '#3b82f6', display: 'flex', justifyContent: 'center', gap: '10px', borderRadius: '14px', fontWeight: 'bold' }}>
              <Save size={20} /> Salvar Alterações
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}