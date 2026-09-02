// src/pages/GestaoPonto.tsx
import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, query, where, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase'; 
import { dbFolha } from '../services/firebaseFolha'; 

import { 
  Clock, Settings, CalendarDays, FileSpreadsheet, Search, CheckCircle2, AlertCircle, ExternalLink, CalendarX2
} from 'lucide-react';
import Button from '../components/ui/Button';

// COMPONENTES VISUAIS MODULARIZADOS
import DashboardEstatisticas from '../components/ponto/DashboardEstatisticas';
import CartaoColaborador from '../components/ponto/CartaoColaborador';

// MODAIS
import ModalConfigPonto from '../components/ponto/ModalConfigPonto';
import ModalEdicaoPonto from '../components/ponto/ModalEdicaoPonto';
import ModalExportacaoPonto from '../components/ponto/ModalExportacaoPonto';

const JORNADA_INICIAL = { entrada: '08:00', saidaAlmoco: '12:00', retornoAlmoco: '13:00', saidaFim: '17:48', limiteAtraso: '08:30', cargaHoraria: '08:48' };

const converterParaMinutos = (horaStr?: string) => {
  if (!horaStr || horaStr === '--:--') return 0;
  const [h, m] = horaStr.substring(0, 5).split(':').map(Number);
  return (h * 60) + m;
};

const formatarMinutosParaHoras = (totalMinutos: number) => {
  if (totalMinutos === 0) return '00:00';
  const horas = Math.floor(Math.abs(totalMinutos) / 60);
  const mins = Math.abs(totalMinutos) % 60;
  const sinal = totalMinutos > 0 ? '+' : '-';
  return `${sinal}${String(horas).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
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

  // 🎨 VISUAL E UX: Estados para substituir os 'Alerts' e 'Confirms' nativos do navegador
  const [notificacao, setNotificacao] = useState<{msg: string, tipo: 'sucesso' | 'erro'} | null>(null);
  const [dialogoConfirmacao, setDialogoConfirmacao] = useState<{visivel: boolean, titulo: string, mensagem: string, acaoConfirmar: () => void} | null>(null);

  const mostrarAviso = (msg: string, tipo: 'sucesso' | 'erro' = 'sucesso') => {
    setNotificacao({ msg, tipo });
    setTimeout(() => setNotificacao(null), 4000); // Some sozinho após 4 segundos
  };

  const formatarHoraLimpa = (hora?: string) => {
    if (!hora || hora === '--:--') return '--:--';
    return hora.substring(0, 5);
  };

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
      } catch (e) { console.error("Erro ao buscar configurações."); }
    };
    buscarConfiguracoes();
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => { setHoraAtualTexto(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })); }, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'funcionarios'), (snap) => {
      setFuncionarios(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter((f: any) => f.status !== 'desligado'));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    setCarregando(true);
    const q = query(collection(dbFolha, 'registros_ponto'), where('data', '==', dataFiltro));
    const unsub = onSnapshot(q, (snap) => {
      setRegistrosHoje(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setCarregando(false);
    });
    return () => unsub();
  }, [dataFiltro]);

  useEffect(() => {
    const mesAtual = dataFiltro.substring(0, 7);
    const inicioMes = `${mesAtual}-01`;
    const fimMes = `${mesAtual}-31`;
    const q = query(collection(dbFolha, 'registros_ponto'), where('data', '>=', inicioMes), where('data', '<=', fimMes));
    const unsub = onSnapshot(q, (snap) => { setRegistrosMes(snap.docs.map(d => d.data())); });
    return () => unsub();
  }, [dataFiltro]);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'acordos_colaboradores')), (snap) => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAcordosHoje(lista.filter((a: any) => a.createdAt && a.createdAt.toDate().toISOString().split('T')[0] === dataFiltro));
    });
    return () => unsub();
  }, [dataFiltro]);

  // 🎨 VISUAL E UX: Lançamento de ausência agora usa o nosso Modal Customizado Seguro
  const lancarAusencia = (funcId: string, funcNome: string, tipo: 'Falta' | 'Atestado Médico' | 'Falta Justificada') => {
    setDialogoConfirmacao({
      visivel: true,
      titulo: `Confirmar ${tipo}`,
      mensagem: `Deseja realmente lançar "${tipo}" para ${funcNome} no dia ${dataFiltro.split('-').reverse().join('/')}?`,
      acaoConfirmar: async () => {
        let assinaturaAutomatica = null;
        if (tipo === 'Atestado Médico' || tipo === 'Falta Justificada') {
          assinaturaAutomatica = `Sistema: Abonado pelo RH (${tipo})`;
        }

        try {
          const dadosSalvar: any = {
            funcionarioId: funcId, nomeFuncionario: funcNome, data: dataFiltro, statusDia: tipo, justificativa: tipo,
            entrada1: '--:--', saida1: '--:--', entrada2: '--:--', saida2: '--:--', ultimaAtualizacao: serverTimestamp()
          };
          if (assinaturaAutomatica) dadosSalvar.assinatura = assinaturaAutomatica;

          await setDoc(doc(dbFolha, 'registros_ponto', `${funcId}_${dataFiltro}`), dadosSalvar, { merge: true });
          mostrarAviso(`${tipo} lançada com sucesso!`, 'sucesso');
        } catch (error) { 
          mostrarAviso(`Erro ao lançar ${tipo}.`, 'erro'); 
        }
      }
    });
  };

  const abrirModalEdicao = (func: any, registro: any) => {
    setFuncEditando({ ...func, idRegistro: `${func.id}_${dataFiltro}` });
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
        funcionarioId: funcEditando.id, nomeFuncionario: funcEditando.nome, data: dataFiltro,
        entrada1, saida1, entrada2, saida2, cargaHorariaPrevista: cargaHorariaManual, justificativa,
        statusDia: 'Ajustado', ultimaAtualizacao: serverTimestamp(), editadoManualmente: true
      }, { merge: true });
      setModalAberto(false);
      mostrarAviso("Ponto ajustado manualmente com sucesso!", "sucesso");
    } catch (error) { mostrarAviso("Erro ao salvar os dados manualmente.", "erro"); }
  };

  const salvarConfiguracaoGlobal = async () => {
    try {
      await setDoc(doc(dbFolha, 'configuracoes', 'jornada_padrao'), configEdit);
      setJornadaPadrao(configEdit);
      setModalConfig(false);
      mostrarAviso("Quadro de horários global atualizado!", "sucesso");
    } catch (error) { mostrarAviso("Erro ao salvar as configurações.", "erro"); }
  };

  const calcularBancoHorasDia = (registro: any) => {
    if (!registro) return { val: 0, text: '00:00' };
    const minutosEsperados = converterParaMinutos(registro.cargaHorariaPrevista || jornadaPadrao.cargaHoraria);

    if (registro.statusDia === 'Falta') return { val: -minutosEsperados, text: formatarMinutosParaHoras(-minutosEsperados) };
    if (registro.statusDia === 'Atestado Médico' || registro.statusDia === 'Falta Justificada') return { val: 0, text: 'JUSTIFICADO' };

    const e1 = converterParaMinutos(registro.entrada1);
    const s1 = converterParaMinutos(registro.saida1);
    const e2 = converterParaMinutos(registro.entrada2);
    const s2 = converterParaMinutos(registro.saida2);

    const batidasValidas = [e1, s1, e2, s2].filter(tempo => tempo > 0);
    const diaPassado = registro.data < hojeString;
    const temSaidaFinal = registro.saida2 && registro.saida2 !== '--:--';
    
    if (!diaPassado && !temSaidaFinal) return null;

    if (diaPassado && batidasValidas.length % 2 !== 0) {
       return { val: 0, text: 'INCOMPLETO', erro: true }; 
    }

    let minutosTrabalhados = 0;
    for (let i = 0; i < batidasValidas.length - 1; i += 2) {
        minutosTrabalhados += (batidasValidas[i + 1] - batidasValidas[i]);
    }

    const diferencaMinutos = minutosTrabalhados - minutosEsperados;
    if (Math.abs(diferencaMinutos) <= 10) return { val: 0, text: 'OK' };

    return { val: diferencaMinutos, text: formatarMinutosParaHoras(diferencaMinutos) };
  };

  const calcularSaldoMensal = (funcId: string) => {
    const registrosFunc = registrosMes.filter(r => r.funcionarioId === funcId);
    let saldoTotalMinutos = 0;
    let pendencias = 0;

    registrosFunc.forEach(reg => {
      const calculoDia = calcularBancoHorasDia(reg);
      if (calculoDia && calculoDia.val !== undefined) saldoTotalMinutos += calculoDia.val;
      if (calculoDia?.erro) pendencias++;
    });

    return { val: saldoTotalMinutos, text: formatarMinutosParaHoras(saldoTotalMinutos), pendencias };
  };

  const funcionariosFiltrados = funcionarios.filter(f => f.nome.toLowerCase().includes(termoBusca.toLowerCase()) || f.matricula.includes(termoBusca));

  // 🎨 VISUAL E UX: Lógica para identificar se a data filtrada caiu no Fim de Semana
  const dataObjetoFiltro = new Date(`${dataFiltro}T12:00:00`);
  const isFimDeSemana = dataObjetoFiltro.getDay() === 0 || dataObjetoFiltro.getDay() === 6;

  let statsPresentes = 0; let statsAtrasados = 0; let statsAusentes = 0;

  funcionariosFiltrados.forEach(func => {
    const regHoje = registrosHoje.find(r => r.funcionarioId === func.id);
    const temFalta = regHoje?.statusDia === 'Falta' || regHoje?.statusDia === 'Atestado Médico' || regHoje?.statusDia === 'Falta Justificada';
    
    if (temFalta) { statsAusentes++; } 
    else if (regHoje?.entrada1 && regHoje.entrada1 !== '--:--') {
      statsPresentes++;
      if (regHoje.entrada1 > jornadaPadrao.limiteAtraso) statsAtrasados++;
    } else {
      // Se for fim de semana, não consideramos quem não bateu o ponto como atrasado
      if (!isFimDeSemana) {
        if (dataFiltro < hojeString || (dataFiltro === hojeString && horaAtualTexto > jornadaPadrao.limiteAtraso)) { statsAtrasados++; }
      }
    }
  });

  if (carregando) return <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Sincronizando sistemas de RH...</div>;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', padding: isMobile ? '15px 10px' : '30px 20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* 🎨 VISUAL E UX: Sistema de Notificações Toast (Substitui os Alerts antigos) */}
        {notificacao && (
          <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 999999, backgroundColor: notificacao.tipo === 'sucesso' ? '#10b981' : '#ef4444', color: 'white', padding: '12px 24px', borderRadius: '50px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold', animation: 'fadeIn 0.3s' }}>
            {notificacao.tipo === 'sucesso' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />} {notificacao.msg}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: '20px', marginBottom: '25px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ backgroundColor: '#eff6ff', padding: '14px', borderRadius: '16px', border: '1px solid #bfdbfe', boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.1)' }}>
              <Clock size={30} color="#2563eb" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 style={{ fontSize: isMobile ? '22px' : '28px', color: '#0f172a', margin: '0 0 4px 0', fontWeight: '800', letterSpacing: '-0.5px' }}>Gestão de Ponto</h1>
                <button onClick={() => setModalConfig(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '5px' }} title="Configurar Quadro de Horários"><Settings size={22} /></button>
              </div>
              <p style={{ margin: 0, fontSize: '14px', color: '#64748b', fontWeight: '500' }}>Jornada Oficial: <strong style={{ color: '#475569' }}>{jornadaPadrao.entrada} - {jornadaPadrao.saidaFim}</strong></p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '10px', alignItems: 'center' }}>
            {/* 🎨 VISUAL E UX: Link de acesso rápido ao Terminal Público adicionado aqui */}
            <Button onClick={() => window.open('/ponto', '_blank')} style={{ backgroundColor: '#eef2ff', color: '#3b82f6', border: '1px solid #c7d2fe', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '12px' }} title="Abrir o Terminal de Batida de Ponto">
              <ExternalLink size={16} /> Terminal
            </Button>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'white', padding: '8px 15px', borderRadius: '12px', border: '1px solid #cbd5e1', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
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
            Banco de Horas Mensal ({dataFiltro.substring(0, 7).split('-').reverse().join('/')})
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'white', padding: '0 15px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <Search size={18} color="#94a3b8" />
            <input type="text" placeholder="Buscar funcionário..." value={termoBusca} onChange={e => setTermoBusca(e.target.value)} style={{ border: 'none', padding: '12px 10px', outline: 'none', fontSize: '14px', width: isMobile ? '100%' : '200px', backgroundColor: 'transparent' }} />
          </div>
        </div>

        {/* 🎨 VISUAL E UX: Aviso elegante de final de semana na visão diária */}
        {abaAtiva === 'diario' && isFimDeSemana && (
          <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '16px', padding: '20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '15px', animation: 'fadeIn 0.5s' }}>
             <div style={{ backgroundColor: '#dbeafe', padding: '10px', borderRadius: '50%' }}>
               <CalendarX2 size={28} color="#2563eb" />
             </div>
             <div>
               <h3 style={{ margin: '0 0 5px 0', color: '#1e3a8a', fontSize: '16px', fontWeight: 'bold' }}>Fim de Semana (Sábado/Domingo)</h3>
               <p style={{ margin: 0, color: '#3b82f6', fontSize: '13px' }}>Neste dia o expediente padrão não é cobrado. O painel está em modo de observação.</p>
             </div>
          </div>
        )}

        {abaAtiva === 'diario' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'fadeIn 0.4s' }}>
            {funcionariosFiltrados.map(func => {
              const regHoje = registrosHoje.find(r => r.funcionarioId === func.id);
              const acordoHoje = acordosHoje.find(a => a.funcionarioId === func.id);
              const concluido = regHoje?.saida2 && regHoje.saida2 !== '--:--';
              const temFaltaOuAtestado = regHoje?.statusDia === 'Falta' || regHoje?.statusDia === 'Atestado Médico' || regHoje?.statusDia === 'Falta Justificada';
              const semPontoAinda = !regHoje?.entrada1 && !temFaltaOuAtestado;
              
              // Se for fim de semana, desligamos o alerta de atraso para quem não bateu o ponto
              const atrasadoHoje = !isFimDeSemana && dataFiltro === hojeString && semPontoAinda && (horaAtualTexto > jornadaPadrao.limiteAtraso);
              const atrasadoPassado = !isFimDeSemana && dataFiltro < hojeString && semPontoAinda;
              const estaAtrasado = atrasadoHoje || atrasadoPassado;
              
              const bancoHorasDia = calcularBancoHorasDia(regHoje);

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

      </div>

      {/* RENDERIZAÇÃO DOS MODAIS EXISTENTES */}
      <ModalConfigPonto aberto={modalConfig} onClose={() => setModalConfig(false)} configEdit={configEdit} setConfigEdit={setConfigEdit} salvarConfiguracao={salvarConfiguracaoGlobal} isMobile={isMobile} />
      <ModalEdicaoPonto aberto={modalAberto} onClose={() => setModalAberto(false)} funcEditando={funcEditando} dataFiltro={dataFiltro} entrada1={entrada1} setEntrada1={setEntrada1} saida1={saida1} setSaida1={setSaida1} entrada2={entrada2} setEntrada2={setEntrada2} saida2={saida2} setSaida2={setSaida2} cargaHorariaManual={cargaHorariaManual} setCargaHorariaManual={setCargaHorariaManual} justificativa={justificativa} setJustificativa={setJustificativa} salvarEdicaoPonto={salvarEdicaoPonto} isMobile={isMobile} />
      <ModalExportacaoPonto aberto={modalExport} onClose={() => setModalExport(false)} mesExport={mesExport} setMesExport={setMesExport} funcionarios={funcionarios} exportando={exportando} setExportando={setExportando} jornadaPadrao={jornadaPadrao} />
      
      {/* 🎨 VISUAL E UX: Dialogo de Confirmação Seguro (Substitui o window.confirm nativo) */}
      {dialogoConfirmacao && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.85)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', padding: '20px' }}>
           <div style={{ backgroundColor: 'white', borderRadius: '24px', padding: '30px', maxWidth: '400px', width: '100%', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', animation: 'fadeIn 0.3s' }}>
              <div style={{ backgroundColor: '#fef2f2', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
                 <AlertCircle size={30} color="#ef4444" />
              </div>
              <h3 style={{ margin: '0 0 10px 0', color: '#0f172a', fontSize: '20px', fontWeight: '800' }}>{dialogoConfirmacao.titulo}</h3>
              <p style={{ margin: '0 0 25px 0', color: '#64748b', fontSize: '15px', lineHeight: '1.5' }}>{dialogoConfirmacao.mensagem}</p>
              
              <div style={{ display: 'flex', gap: '10px' }}>
                <Button onClick={() => setDialogoConfirmacao(null)} style={{ flex: 1, backgroundColor: '#f1f5f9', color: '#475569', border: 'none', height: '45px', fontWeight: 'bold' }}>
                  Cancelar
                </Button>
                <Button onClick={() => { dialogoConfirmacao.acaoConfirmar(); setDialogoConfirmacao(null); }} style={{ flex: 1, backgroundColor: '#ef4444', color: 'white', border: 'none', height: '45px', fontWeight: 'bold' }}>
                  Confirmar Ação
                </Button>
              </div>
           </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}