// src/pages/GestaoPonto.tsx
import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, query, where, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase'; 
import { dbFolha } from '../services/firebaseFolha'; 

import { 
  Clock, Settings, CalendarDays, FileSpreadsheet, Search, CheckCircle2, AlertCircle, ExternalLink, CalendarX2,
  TrendingUp, TrendingDown, AlertTriangle, UserX, CalendarPlus, Plane
} from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

import DashboardEstatisticas from '../components/ponto/DashboardEstatisticas';
import CartaoColaborador from '../components/ponto/CartaoColaborador';
import ModalConfigPonto from '../components/ponto/ModalConfigPonto';
import ModalEdicaoPonto from '../components/ponto/ModalEdicaoPonto';
import ModalExportacaoPonto from '../components/ponto/ModalExportacaoPonto';

const JORNADA_INICIAL = { 
  entrada: '08:00', saidaAlmoco: '12:00', retornoAlmoco: '13:00', saidaFim: '17:48', limiteAtraso: '08:30', cargaHoraria: '08:48',
  latOficial: '', lngOficial: '', latOficial2: '', lngOficial2: '', raioMetros: '50'
};

const FERIADOS_SP = [
  '01-01', '01-25', '04-21', '05-01', '07-09', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25'
];

const converterParaMinutos = (horaStr?: string) => {
  if (!horaStr || horaStr === '--:--') return 0;
  const [h, m] = horaStr.substring(0, 5).split(':').map(Number);
  return (h * 60) + m;
};

const formatarMinutosParaHoras = (totalMinutos: number) => {
  if (totalMinutos === 0) return '00:00';
  const horas = Math.floor(Math.abs(totalMinutos) / 60);
  const mins = Math.abs(totalMinutos) % 60;
  return `${String(horas).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

export default function GestaoPonto() {
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [registrosHoje, setRegistrosHoje] = useState<any[]>([]);
  const [registrosMes, setRegistrosMes] = useState<any[]>([]);
  const [acordosHoje, setAcordosHoje] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [termoBusca, setTermoBusca] = useState('');
  const [abaAtiva, setAbaAtiva] = useState<'diario' | 'banco'>('diario');
  const [horaAtualTexto, setHoraAtualTexto] = useState(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));

  const [modalAberto, setModalAberto] = useState(false);
  const [funcEditando, setFuncEditando] = useState<any>(null);
  const [entrada1, setEntrada1] = useState('');
  const [saida1, setSaida1] = useState('');
  const [entrada2, setEntrada2] = useState('');
  const [saida2, setSaida2] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const [jornadaPadrao, setJornadaPadrao] = useState(JORNADA_INICIAL);
  const [cargaHorariaManual, setCargaHorariaManual] = useState(JORNADA_INICIAL.cargaHoraria);
  const [modalConfig, setModalConfig] = useState(false);
  const [configEdit, setConfigEdit] = useState(JORNADA_INICIAL);

  const hojeString = new Date().toISOString().split('T')[0];
  const [dataFiltro, setDataFiltro] = useState(hojeString);
  const dataFormatadaVisual = new Date(`${dataFiltro}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  const [modalExport, setModalExport] = useState(false);
  const [mesExport, setMesExport] = useState(hojeString.substring(0, 7)); 
  const [exportando, setExportando] = useState(false);

  const [notificacao, setNotificacao] = useState<{msg: string, tipo: 'sucesso' | 'erro'} | null>(null);

  // 🚀 ESTADOS DO MODAL DE FÉRIAS / AFASTAMENTO EM LOTE
  const [modalLoteAberto, setModalLoteAberto] = useState(false);
  const [loteFuncId, setLoteFuncId] = useState('');
  const [loteTipo, setLoteTipo] = useState('Férias');
  const [loteInicio, setLoteInicio] = useState(hojeString);
  const [loteFim, setLoteFim] = useState(hojeString);

  const dataObjetoFiltro = new Date(`${dataFiltro}T12:00:00`);
  const isFimDeSemana = dataObjetoFiltro.getDay() === 0 || dataObjetoFiltro.getDay() === 6;
  const mesDiaFiltro = dataFiltro.substring(5);
  const isFeriado = FERIADOS_SP.includes(mesDiaFiltro);
  const isDiaInativo = isFimDeSemana || isFeriado; 

  const mostrarAviso = (msg: string, tipo: 'sucesso' | 'erro' = 'sucesso') => {
    setNotificacao({ msg, tipo });
    setTimeout(() => setNotificacao(null), 4000); 
  };

  const formatarHoraLimpa = (hora?: string) => hora && hora !== '--:--' ? hora.substring(0, 5) : '--:--';
  const extrairParaInput = (hora?: string) => hora && hora !== '--:--' ? hora.substring(0, 5) : '';

  useEffect(() => {
    const buscarConfiguracoes = async () => {
      try {
        const docRef = doc(dbFolha, 'configuracoes', 'jornada_padrao');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setJornadaPadrao(docSnap.data() as any);
          setConfigEdit(docSnap.data() as any);
        }
      } catch (e) { console.error("Erro."); }
    };
    buscarConfiguracoes();
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    const timer = setInterval(() => setHoraAtualTexto(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })), 60000);
    return () => { window.removeEventListener('resize', handleResize); clearInterval(timer); };
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'funcionarios'), (snap) => setFuncionarios(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter((f: any) => f.status !== 'desligado')));
    return () => unsub();
  }, []);

  useEffect(() => {
    setCarregando(true);
    const unsub = onSnapshot(query(collection(dbFolha, 'registros_ponto'), where('data', '==', dataFiltro)), (snap) => {
      setRegistrosHoje(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setCarregando(false);
    });
    return () => unsub();
  }, [dataFiltro]);

  useEffect(() => {
    const mesAtual = dataFiltro.substring(0, 7);
    const unsub = onSnapshot(query(collection(dbFolha, 'registros_ponto'), where('data', '>=', `${mesAtual}-01`), where('data', '<=', `${mesAtual}-31`)), (snap) => {
      setRegistrosMes(snap.docs.map(d => d.data()));
    });
    return () => unsub();
  }, [dataFiltro]);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'acordos_colaboradores')), (snap) => {
      setAcordosHoje(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter((a: any) => a.createdAt && a.createdAt.toDate().toISOString().split('T')[0] === dataFiltro));
    });
    return () => unsub();
  }, [dataFiltro]);

  // Função herdada para quando se clica num botão de falta rápida no cartão
  const lancarAusencia = (funcId: string, funcNome: string, tipo: string) => {
    setLoteFuncId(funcId);
    setLoteTipo(tipo);
    setLoteInicio(dataFiltro);
    setLoteFim(dataFiltro);
    setModalLoteAberto(true);
  };

  // 🚀 O MOTOR DE FÉRIAS E ATESTADOS EM LOTE
  const processarLancamentoLote = async () => {
    if (!loteFuncId) return mostrarAviso("Selecione um colaborador.", "erro");
    if (loteInicio > loteFim) return mostrarAviso("A data de início não pode ser superior à data de fim.", "erro");

    const func = funcionarios.find(f => f.id === loteFuncId);
    if (!func) return;

    try {
      let dataAtual = new Date(`${loteInicio}T12:00:00`);
      const dataFinal = new Date(`${loteFim}T12:00:00`);

      // Assinatura automática do RH
      let assinaturaAutomatica = loteTipo !== 'Falta' ? `Sistema: Registo em Lote RH (${loteTipo})` : null;

      while (dataAtual <= dataFinal) {
        const diaISO = dataAtual.toISOString().split('T')[0];
        
        const dadosSalvar: any = {
          funcionarioId: func.id, nomeFuncionario: func.nome, data: diaISO, 
          statusDia: loteTipo, justificativa: loteTipo,
          entrada1: '--:--', saida1: '--:--', entrada2: '--:--', saida2: '--:--', 
          ultimaAtualizacao: serverTimestamp()
        };
        
        if (assinaturaAutomatica) dadosSalvar.assinatura = assinaturaAutomatica;

        await setDoc(doc(dbFolha, 'registros_ponto', `${func.id}_${diaISO}`), dadosSalvar, { merge: true });
        
        // Avança um dia
        dataAtual.setDate(dataAtual.getDate() + 1); 
      }

      mostrarAviso(`"${loteTipo}" registado(a) com sucesso de ${loteInicio.split('-').reverse().join('/')} até ${loteFim.split('-').reverse().join('/')}!`, 'sucesso');
      
      // Limpa os dados do modal e fecha
      setModalLoteAberto(false);
      setLoteFuncId('');
      setLoteTipo('Férias');
      setLoteInicio(hojeString);
      setLoteFim(hojeString);
      
    } catch (error) { 
      mostrarAviso(`Erro ao processar as datas.`, 'erro'); 
    }
  };

  const abrirModalEdicao = (func: any, registro: any) => {
    setFuncEditando({ ...func, idRegistro: `${func.id}_${dataFiltro}` });
    setEntrada1(extrairParaInput(registro?.entrada1)); setSaida1(extrairParaInput(registro?.saida1));
    setEntrada2(extrairParaInput(registro?.entrada2)); setSaida2(extrairParaInput(registro?.saida2));
    setCargaHorariaManual(registro?.cargaHorariaPrevista || jornadaPadrao.cargaHoraria);
    setJustificativa(registro?.justificativa || '');
    setModalAberto(true);
  };

  const salvarEdicaoPonto = async () => {
    if (!funcEditando) return;
    try {
      await setDoc(doc(dbFolha, 'registros_ponto', funcEditando.idRegistro), {
        funcionarioId: funcEditando.id, nomeFuncionario: funcEditando.nome, data: dataFiltro,
        entrada1, saida1, entrada2, saida2, cargaHorariaPrevista: cargaHorariaManual, justificativa,
        statusDia: justificativa || 'Ajustado', ultimaAtualizacao: serverTimestamp(), editadoManualmente: true
      }, { merge: true });
      setModalAberto(false);
      mostrarAviso("Ponto ajustado manualmente!", "sucesso");
    } catch (error) { mostrarAviso("Erro ao salvar.", "erro"); }
  };

  const salvarConfiguracaoGlobal = async () => {
    try {
      await setDoc(doc(dbFolha, 'configuracoes', 'jornada_padrao'), configEdit);
      setJornadaPadrao(configEdit); setModalConfig(false); mostrarAviso("Quadro de horários atualizado!", "sucesso");
    } catch (error) { mostrarAviso("Erro ao salvar.", "erro"); }
  };

  const calcularBancoHorasDia = (registro: any, funcDataContratacao?: string, dataRef?: string) => {
    const dataAlvo = registro?.data || dataRef;
    
    if (funcDataContratacao && dataAlvo && dataAlvo < funcDataContratacao) {
      return { val: 0, ignorar: true }; // Pré-contrato
    }

    if (!registro) return { val: 0 };

    if (registro.statusDia === 'Falta') {
      return { val: 0, isFalta: true }; // Falta é tratada como Dia Perdido, não horas negativas
    }
    
    // Todos estes cenários não geram débito nem crédito
    const tiposAbonados = ['Atestado Médico', 'Falta Justificada', 'Comprovante de Horas', 'Acordo (Pago/Abonado)', 'Férias', 'Licença'];
    if (tiposAbonados.includes(registro.statusDia) || tiposAbonados.includes(registro.justificativa)) {
      return { val: 0 }; 
    }

    const minutosEsperados = converterParaMinutos(registro.cargaHorariaPrevista || jornadaPadrao.cargaHoraria);
    const e1 = converterParaMinutos(registro.entrada1); const s1 = converterParaMinutos(registro.saida1);
    const e2 = converterParaMinutos(registro.entrada2); const s2 = converterParaMinutos(registro.saida2);

    const batidasValidas = [e1, s1, e2, s2].filter(tempo => tempo > 0);
    const diaPassado = registro.data < hojeString;
    const temSaidaFinal = registro.saida2 && registro.saida2 !== '--:--';
    
    if (!diaPassado && !temSaidaFinal) return null; // Dia ainda a decorrer
    if (diaPassado && batidasValidas.length % 2 !== 0) return { val: 0, erro: true }; 

    let minutosTrabalhados = 0;
    for (let i = 0; i < batidasValidas.length - 1; i += 2) {
        minutosTrabalhados += (batidasValidas[i + 1] - batidasValidas[i]);
    }

    const diferencaMinutos = minutosTrabalhados - minutosEsperados;
    if (Math.abs(diferencaMinutos) <= 10) return { val: 0 }; // Tolerância 10 minutos

    return { val: diferencaMinutos }; // Se for +, é extra. Se for -, é atraso.
  };

  const calcularSaldoMensalDetalhado = (funcId: string, funcDataContratacao?: string) => {
    const registrosFunc = registrosMes.filter(r => r.funcionarioId === funcId);
    let totalExtras = 0;
    let totalAtrasos = 0;
    let diasFalta = 0;
    let pendencias = 0;

    registrosFunc.forEach(reg => {
      const calculoDia = calcularBancoHorasDia(reg, funcDataContratacao);
      if (calculoDia && !calculoDia.ignorar) {
        if (calculoDia.isFalta) {
          diasFalta++;
        } else if (calculoDia.val !== undefined) {
          if (calculoDia.val > 0) totalExtras += calculoDia.val;
          else if (calculoDia.val < 0) totalAtrasos += Math.abs(calculoDia.val);
        }
      }
      if (calculoDia?.erro) pendencias++;
    });

    return { 
      extras: formatarMinutosParaHoras(totalExtras), 
      atrasos: formatarMinutosParaHoras(totalAtrasos), 
      faltas: diasFalta, 
      pendencias 
    };
  };

  const funcionariosFiltrados = funcionarios.filter(f => f.nome.toLowerCase().includes(termoBusca.toLowerCase()) || f.matricula.includes(termoBusca));

  let statsPresentes = 0; let statsAtrasados = 0; let statsAusentes = 0;

  funcionariosFiltrados.forEach(func => {
    const antesDaContratacao = func.dataContratacao && dataFiltro < func.dataContratacao;
    if (antesDaContratacao) return; 

    const regHoje = registrosHoje.find(r => r.funcionarioId === func.id);
    const tiposAbonados = ['Atestado Médico', 'Falta Justificada', 'Comprovante de Horas', 'Acordo (Pago/Abonado)', 'Férias', 'Licença'];
    
    if (regHoje?.statusDia === 'Falta' || tiposAbonados.includes(regHoje?.statusDia)) { statsAusentes++; } 
    else if (regHoje?.entrada1 && regHoje.entrada1 !== '--:--') {
      statsPresentes++;
      if (regHoje.entrada1 > jornadaPadrao.limiteAtraso) statsAtrasados++;
    } else {
      if (!isDiaInativo) {
        if (dataFiltro < hojeString || (dataFiltro === hojeString && horaAtualTexto > jornadaPadrao.limiteAtraso)) { statsAtrasados++; }
      }
    }
  });

  if (carregando) return <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>A sincronizar sistemas de RH...</div>;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', padding: isMobile ? '15px 10px' : '30px 20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {notificacao && (
          <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 999999, backgroundColor: notificacao.tipo === 'sucesso' ? '#10b981' : '#ef4444', color: 'white', padding: '12px 24px', borderRadius: '50px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold', animation: 'fadeIn 0.3s' }}>
            {notificacao.tipo === 'sucesso' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />} {notificacao.msg}
          </div>
        )}

        {/* HEADER DA PÁGINA */}
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: '20px', marginBottom: '25px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ backgroundColor: '#eff6ff', padding: '14px', borderRadius: '16px', border: '1px solid #bfdbfe', boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.1)' }}>
              <Clock size={30} color="#2563eb" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 style={{ fontSize: isMobile ? '22px' : '28px', color: '#0f172a', margin: '0 0 4px 0', fontWeight: '800', letterSpacing: '-0.5px' }}>Gestão de Ponto</h1>
                <button onClick={() => setModalConfig(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '5px' }} title="Configurar Quadro"><Settings size={22} /></button>
              </div>
              <p style={{ margin: 0, fontSize: '14px', color: '#64748b', fontWeight: '500' }}>Jornada Oficial: <strong style={{ color: '#475569' }}>{jornadaPadrao.entrada} - {jornadaPadrao.saidaFim}</strong></p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* 🚀 NOVO BOTÃO DE FÉRIAS / AFASTAMENTOS */}
            <Button onClick={() => setModalLoteAberto(true)} style={{ backgroundColor: '#fdf4ff', color: '#c026d3', border: '1px solid #f5d0fe', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '12px', fontWeight: 'bold' }}>
              <Plane size={16} /> Lançar Afastamento
            </Button>

            <Button onClick={() => window.open('/ponto', '_blank')} style={{ backgroundColor: '#eef2ff', color: '#3b82f6', border: '1px solid #c7d2fe', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '12px' }}>
              <ExternalLink size={16} /> Terminal
            </Button>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'white', padding: '8px 15px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
              <CalendarDays size={18} color="#6366f1" />
              <input type="date" value={dataFiltro} max={hojeString} onChange={e => setDataFiltro(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: '14px', fontWeight: 'bold', color: '#1e293b' }} />
            </div>

            <Button onClick={() => setModalExport(true)} style={{ backgroundColor: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '12px' }}>
              <FileSpreadsheet size={16} /> Exportar
            </Button>
          </div>
        </div>

        <DashboardEstatisticas total={funcionariosFiltrados.length} presentes={statsPresentes} atrasados={statsAtrasados} ausentes={statsAusentes} />

        <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', backgroundColor: 'white', padding: '6px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <button onClick={() => setAbaAtiva('diario')} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s', backgroundColor: abaAtiva === 'diario' ? '#3b82f6' : 'transparent', color: abaAtiva === 'diario' ? 'white' : '#64748b' }}>
            Visão Diária ({dataFormatadaVisual})
          </button>
          <button onClick={() => setAbaAtiva('banco')} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s', backgroundColor: abaAtiva === 'banco' ? '#8b5cf6' : 'transparent', color: abaAtiva === 'banco' ? 'white' : '#64748b' }}>
            Extrato Mensal ({dataFiltro.substring(0, 7).split('-').reverse().join('/')})
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'white', padding: '0 15px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <Search size={18} color="#94a3b8" />
            <input type="text" placeholder="Procurar funcionário..." value={termoBusca} onChange={e => setTermoBusca(e.target.value)} style={{ border: 'none', padding: '12px 10px', outline: 'none', fontSize: '14px', width: isMobile ? '100%' : '200px' }} />
          </div>
        </div>

        {abaAtiva === 'diario' && isDiaInativo && (
          <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '16px', padding: '20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '15px', animation: 'fadeIn 0.5s' }}>
             <div style={{ backgroundColor: '#dbeafe', padding: '10px', borderRadius: '50%' }}><CalendarX2 size={28} color="#2563eb" /></div>
             <div>
               <h3 style={{ margin: '0 0 5px 0', color: '#1e3a8a', fontSize: '16px', fontWeight: 'bold' }}>{isFeriado ? 'Feriado' : 'Fim de Semana'}</h3>
               <p style={{ margin: 0, color: '#3b82f6', fontSize: '13px' }}>Neste dia o expediente não é cobrado.</p>
             </div>
          </div>
        )}

        {abaAtiva === 'diario' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'fadeIn 0.4s' }}>
            {funcionariosFiltrados.map(func => {
              const regHoje = registrosHoje.find(r => r.funcionarioId === func.id);
              const acordoHoje = acordosHoje.find(a => a.funcionarioId === func.id);
              
              if (func.dataContratacao && dataFiltro < func.dataContratacao) {
                return (
                  <div key={func.id} style={{ backgroundColor: '#f8fafc', borderRadius: '20px', border: '1px dashed #cbd5e1', padding: '20px', display: 'flex', alignItems: 'center', gap: '15px', opacity: 0.7 }}>
                    <div style={{ width: '40px', height: '40px', backgroundColor: '#e2e8f0', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>{func.nome.charAt(0)}</div>
                    <div>
                      <strong style={{ display: 'block', fontSize: '16px', color: '#64748b' }}>{func.nome}</strong>
                      <span style={{ fontSize: '12px', color: '#94a3b8' }}>Admissão: {func.dataContratacao.split('-').reverse().join('/')}</span>
                    </div>
                    <div style={{ marginLeft: 'auto', backgroundColor: '#e2e8f0', padding: '6px 12px', borderRadius: '12px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Pré-Contrato</div>
                  </div>
                );
              }

              const concluido = regHoje?.saida2 && regHoje.saida2 !== '--:--';
              const tiposAbonados = ['Atestado Médico', 'Falta Justificada', 'Comprovante de Horas', 'Acordo (Pago/Abonado)', 'Férias', 'Licença'];
              const temFaltaOuAtestado = regHoje?.statusDia === 'Falta' || tiposAbonados.includes(regHoje?.statusDia);
              const semPontoAinda = !regHoje?.entrada1 && !temFaltaOuAtestado;
              
              const atrasadoHoje = !isDiaInativo && dataFiltro === hojeString && semPontoAinda && (horaAtualTexto > jornadaPadrao.limiteAtraso);
              const atrasadoPassado = !isDiaInativo && dataFiltro < hojeString && semPontoAinda;
              const estaAtrasado = atrasadoHoje || atrasadoPassado;
              
              const bancoHorasDia = calcularBancoHorasDia(regHoje, func.dataContratacao, dataFiltro);

              return (
                <CartaoColaborador 
                  key={func.id} func={func} regHoje={regHoje} acordoHoje={acordoHoje}
                  estaAtrasado={estaAtrasado} temFaltaOuAtestado={temFaltaOuAtestado}
                  semPontoAinda={semPontoAinda} concluido={concluido} bancoHorasDia={bancoHorasDia}
                  isMobile={isMobile} lancarAusencia={lancarAusencia} 
                  abrirModalEdicao={abrirModalEdicao} formatarHoraLimpa={formatarHoraLimpa}
                />
              );
            })}
          </div>
        )}

        {abaAtiva === 'banco' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px', animation: 'fadeIn 0.4s' }}>
            {funcionariosFiltrados.map(func => {
              const detalheMensal = calcularSaldoMensalDetalhado(func.id, func.dataContratacao);

              return (
                <div key={func.id} style={{ backgroundColor: 'white', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '24px', display: 'flex', flexDirection: 'column', gap: '15px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '45px', height: '45px', backgroundColor: '#f8fafc', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontWeight: 'bold', fontSize: '18px', border: '1px solid #e2e8f0' }}>{func.nome.charAt(0)}</div>
                    <div>
                      <strong style={{ display: 'block', fontSize: '16px', color: '#0f172a', fontWeight: '800' }}>{func.nome}</strong>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>Mat: {func.matricula}</span>
                    </div>
                  </div>
                  
                  {detalheMensal.pendencias > 0 && (
                     <div style={{ fontSize: '11px', color: '#b45309', backgroundColor: '#fffbeb', padding: '8px', borderRadius: '8px', border: '1px solid #fde68a', display: 'flex', gap: '6px', alignItems: 'center' }}>
                       <AlertTriangle size={14}/> {detalheMensal.pendencias} dia(s) incompleto(s) no mês.
                     </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#166534', display: 'flex', alignItems: 'center', gap: '4px' }}><TrendingUp size={14}/> Horas Extras</span>
                      <strong style={{ fontSize: '20px', color: '#10b981' }}>{detalheMensal.extras}</strong>
                    </div>

                    <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '4px' }}><TrendingDown size={14}/> Atrasos/Saídas</span>
                      <strong style={{ fontSize: '20px', color: '#ef4444' }}>{detalheMensal.atrasos}</strong>
                    </div>
                    
                    <div style={{ gridColumn: 'span 2', backgroundColor: '#fff7ed', border: '1px solid #ffedd5', borderRadius: '12px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#9a3412', display: 'flex', alignItems: 'center', gap: '6px' }}><UserX size={16}/> Faltas Acumuladas</span>
                      <strong style={{ fontSize: '18px', color: '#ea580c' }}>{detalheMensal.faltas} dia(s)</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* 🚀 NOVO MODAL: LANÇAMENTO DE FÉRIAS E AFASTAMENTOS */}
      {modalLoteAberto && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.85)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
           <div style={{ backgroundColor: 'white', borderRadius: '24px', padding: '30px', maxWidth: '450px', width: '100%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', animation: 'fadeIn 0.3s' }}>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                 <div style={{ backgroundColor: '#fdf4ff', padding: '10px', borderRadius: '50%' }}><CalendarPlus size={24} color="#c026d3" /></div>
                 <div>
                    <h3 style={{ margin: '0 0 2px 0', color: '#0f172a', fontSize: '18px', fontWeight: 'bold' }}>Afastamentos e Férias</h3>
                    <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>Preenchimento automático em lote</p>
                 </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '25px' }}>
                 
                 <div>
                   <label style={{ fontSize: '12px', color: '#475569', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>1. Colaborador</label>
                   <select value={loteFuncId} onChange={e => setLoteFuncId(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}>
                     <option value="">Selecione quem irá se ausentar...</option>
                     {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                   </select>
                 </div>

                 <div>
                   <label style={{ fontSize: '12px', color: '#475569', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>2. Tipo de Ocorrência</label>
                   <select value={loteTipo} onChange={e => setLoteTipo(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}>
                     <option value="Férias">Férias</option>
                     <option value="Atestado Médico">Atestado Médico (Dias Corridos)</option>
                     <option value="Falta">Falta (Descontar dias)</option>
                     <option value="Licença">Licença Maternidade/Paternidade</option>
                     <option value="Suspensão">Suspensão Disciplinar</option>
                   </select>
                 </div>

                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', backgroundColor: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <Input label="De (Data Inicial)" type="date" value={loteInicio} onChange={e => setLoteInicio(e.target.value)} />
                    <Input label="Até (Data Final)" type="date" value={loteFim} onChange={e => setLoteFim(e.target.value)} />
                 </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <Button onClick={() => setModalLoteAberto(false)} style={{ flex: 1, backgroundColor: '#f1f5f9', color: '#475569', height: '45px' }}>Cancelar</Button>
                <Button onClick={processarLancamentoLote} style={{ flex: 1, backgroundColor: '#c026d3', height: '45px', fontWeight: 'bold' }}>Processar Período</Button>
              </div>
           </div>
        </div>
      )}

      <ModalConfigPonto aberto={modalConfig} onClose={() => setModalConfig(false)} configEdit={configEdit} setConfigEdit={setConfigEdit} salvarConfiguracao={salvarConfiguracaoGlobal} isMobile={isMobile} />
      <ModalEdicaoPonto aberto={modalAberto} onClose={() => setModalAberto(false)} funcEditando={funcEditando} dataFiltro={dataFiltro} entrada1={entrada1} setEntrada1={setEntrada1} saida1={saida1} setSaida1={setSaida1} entrada2={entrada2} setEntrada2={setEntrada2} saida2={saida2} setSaida2={setSaida2} cargaHorariaManual={cargaHorariaManual} setCargaHorariaManual={setCargaHorariaManual} justificativa={justificativa} setJustificativa={setJustificativa} salvarEdicaoPonto={salvarEdicaoPonto} isMobile={isMobile} />
      <ModalExportacaoPonto aberto={modalExport} onClose={() => setModalExport(false)} mesExport={mesExport} setMesExport={setMesExport} funcionarios={funcionarios} exportando={exportando} setExportando={setExportando} jornadaPadrao={jornadaPadrao} />
    </div>
  );
}