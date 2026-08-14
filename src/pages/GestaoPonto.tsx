// src/pages/GestaoPonto.tsx
import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, query, where, serverTimestamp, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase'; 
import { dbFolha } from '../services/firebaseFolha'; 
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoCarvalho from '../assets/logopdf.png'; 

import { 
  Clock, LockOpen, Lock, Edit3, Save, X, UserCheck, AlertCircle, Copy, CheckCircle2, FileText, UserMinus, Handshake, AlertTriangle, Search, MapPin, Settings, CalendarDays, Download, BarChart2, FileSpreadsheet, Scale, TrendingUp, TrendingDown 
} from 'lucide-react';
import Button from '../components/ui/Button';

// ✨ IMPORTAÇÃO DOS NOVOS MODAIS LIMPOS!
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
  const [funcExportId, setFuncExportId] = useState('');
  const [exportando, setExportando] = useState(false);

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
      } catch (e) {
        console.error("Erro ao buscar configurações.");
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

  const lancarAusencia = async (funcId: string, funcNome: string, tipo: 'Falta' | 'Atestado Médico') => {
    const confirmar = window.confirm(`Confirmar o lançamento de "${tipo}" para ${funcNome} no dia ${dataFiltro}? O dia será fechado.`);
    if (!confirmar) return;
    try {
      await setDoc(doc(dbFolha, 'registros_ponto', `${funcId}_${dataFiltro}`), {
        funcionarioId: funcId, nomeFuncionario: funcNome, data: dataFiltro, statusDia: tipo, justificativa: tipo,
        entrada1: '--:--', saida1: '--:--', entrada2: '--:--', saida2: '--:--', ultimaAtualizacao: serverTimestamp()
      }, { merge: true });
    } catch (error) { alert("Erro ao lançar ausência."); }
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
      alert("Ponto atualizado com sucesso!");
    } catch (error) { alert("Erro ao salvar os dados manualmente."); }
  };

  const salvarConfiguracaoGlobal = async () => {
    try {
      await setDoc(doc(dbFolha, 'configuracoes', 'jornada_padrao'), configEdit);
      setJornadaPadrao(configEdit);
      setModalConfig(false);
      alert("Quadro de horários atualizado com sucesso!");
    } catch (error) { alert("Erro ao salvar as configurações."); }
  };

  const calcularBancoHorasDia = (registro: any) => {
    if (!registro) return { val: 0, text: '00:00' };
    const minutosEsperados = converterParaMinutos(registro.cargaHorariaPrevista || jornadaPadrao.cargaHoraria);

    if (registro.statusDia === 'Falta') return { val: -minutosEsperados, text: formatarMinutosParaHoras(-minutosEsperados) };
    if (registro.statusDia === 'Atestado Médico') return { val: 0, text: 'JUSTIFICADO' };

    const e1 = converterParaMinutos(registro.entrada1);
    const s1 = converterParaMinutos(registro.saida1);
    const e2 = converterParaMinutos(registro.entrada2);
    const s2 = converterParaMinutos(registro.saida2);

    const batidasValidas = [e1, s1, e2, s2].filter(tempo => tempo > 0);
    const diaPassado = registro.data < hojeString;
    const temSaidaFinal = registro.saida2 && registro.saida2 !== '--:--';
    
    if (!diaPassado && !temSaidaFinal) return null;

    let minutosTrabalhados = 0;
    for (let i = 0; i < batidasValidas.length - 1; i += 2) {
        minutosTrabalhados += (batidasValidas[i + 1] - batidasValidas[i]);
    }

    const diferencaMinutos = minutosTrabalhados - minutosEsperados;
    if (Math.abs(diferencaMinutos) <= 5) return { val: 0, text: 'OK' };

    return { val: diferencaMinutos, text: formatarMinutosParaHoras(diferencaMinutos) };
  };

  const calcularSaldoMensal = (funcId: string) => {
    const registrosFunc = registrosMes.filter(r => r.funcionarioId === funcId);
    let saldoTotalMinutos = 0;
    registrosFunc.forEach(reg => {
      const calculoDia = calcularBancoHorasDia(reg);
      if (calculoDia && calculoDia.val !== undefined) saldoTotalMinutos += calculoDia.val;
    });
    return { val: saldoTotalMinutos, text: formatarMinutosParaHoras(saldoTotalMinutos) };
  };

  const gerarEspelhoPonto = async () => {
    if (!funcExportId) return alert("Selecione um colaborador.");
    setExportando(true);
    
    try {
      const funcionarioAlvo = funcionarios.find(f => f.id === funcExportId);
      const inicioMes = `${mesExport}-01`;
      const fimMes = `${mesExport}-31`;
      
      const q = query(collection(dbFolha, 'registros_ponto'), where('funcionarioId', '==', funcExportId), where('data', '>=', inicioMes), where('data', '<=', fimMes));
      const snap = await getDocs(q);
      const registros = snap.docs.map(d => d.data());
      registros.sort((a: any, b: any) => a.data.localeCompare(b.data));

      const docPdf = new jsPDF('p', 'mm', 'a4');
      const azul = [30, 41, 59];
      
      try { docPdf.addImage(logoCarvalho, 'PNG', 14, 10, 35, 12); } catch (e) {}

      docPdf.setFont("helvetica", "bold"); docPdf.setFontSize(14); docPdf.setTextColor(azul[0], azul[1], azul[2]);
      docPdf.text("ESPELHO DE PONTO MENSAL", 105, 16, { align: 'center' });
      docPdf.setFontSize(10); docPdf.setTextColor(100);
      docPdf.text(`Período de Apuração: ${mesExport.split('-')[1]}/${mesExport.split('-')[0]}`, 105, 22, { align: 'center' });

      docPdf.setDrawColor(200); docPdf.setFillColor(248, 250, 252);
      docPdf.rect(14, 28, 182, 18, "FD");
      docPdf.setFontSize(9); docPdf.setTextColor(0);
      docPdf.setFont("helvetica", "bold"); docPdf.text("Colaborador:", 18, 34); docPdf.setFont("helvetica", "normal"); docPdf.text(funcionarioAlvo.nome.toUpperCase(), 42, 34);
      docPdf.setFont("helvetica", "bold"); docPdf.text("Matrícula:", 18, 40); docPdf.setFont("helvetica", "normal"); docPdf.text(funcionarioAlvo.matricula, 38, 40);
      docPdf.setFont("helvetica", "bold"); docPdf.text("Empresa:", 120, 34); docPdf.setFont("helvetica", "normal"); docPdf.text("CARVALHO FUNILARIA E PINTURAS LTDA", 138, 34);

      const renderTable = typeof autoTable === 'function' ? autoTable : (autoTable as any).default;
      
      const tableData = registros.map((r: any) => {
        const dataPt = new Date(`${r.data}T12:00:00`).toLocaleDateString('pt-BR');
        const bh = calcularBancoHorasDia(r);
        let status = '';
        if (r.statusDia === 'Falta' || r.statusDia === 'Atestado Médico') status = r.statusDia;
        else if (bh) status = `BH: ${bh.text}`;

        return [
          dataPt, formatarHoraLimpa(r.entrada1), formatarHoraLimpa(r.saida1),
          formatarHoraLimpa(r.entrada2), formatarHoraLimpa(r.saida2), status, r.justificativa || '-'
        ];
      });

      renderTable(docPdf, {
        startY: 52,
        head: [["Data", "Entrada", "Saída Alm.", "Retorno", "Saída Final", "Saldo/Status", "Ocorrências"]],
        body: tableData,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 3, halign: 'center' },
        headStyles: { fillColor: azul, textColor: 255 },
        columnStyles: { 6: { halign: 'left' } }
      });

      const finalY = (docPdf as any).lastAutoTable.finalY + 30;
      docPdf.line(60, finalY, 150, finalY);
      docPdf.setFont("helvetica", "bold"); docPdf.setFontSize(9);
      docPdf.text(funcionarioAlvo.nome, 105, finalY + 5, { align: 'center' });
      docPdf.setFont("helvetica", "normal"); docPdf.text("Assinatura do Colaborador", 105, finalY + 10, { align: 'center' });

      docPdf.save(`Folha_Ponto_${funcionarioAlvo.nome.replace(/\s+/g, '_')}_${mesExport}.pdf`);
      setModalExport(false);
      alert("Relatório exportado com sucesso!");
    } catch (e) { alert("Erro ao compilar o PDF."); }
    setExportando(false);
  };

  const RenderHoraComGps = ({ hora, linkGps }: { hora?: string, linkGps?: string }) => {
    if (!hora || hora === '--:--') return <strong style={{ color: '#cbd5e1', fontSize: '16px', fontWeight: '600' }}>--:--</strong>;
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
        <strong style={{ color: '#0f172a', fontSize: '16px', fontWeight: '800' }}>{hora}</strong>
        {linkGps && (
          <a href={linkGps} target="_blank" rel="noopener noreferrer" title="Ver no Maps" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#eff6ff', padding: '4px', borderRadius: '50%', color: '#3b82f6', transition: '0.2s' }}>
            <MapPin size={14} />
          </a>
        )}
      </div>
    );
  };

  const funcionariosFiltrados = funcionarios.filter(f => f.nome.toLowerCase().includes(termoBusca.toLowerCase()) || f.matricula.includes(termoBusca));

  const statsTotal = funcionariosFiltrados.length;
  let statsPresentes = 0; let statsAtrasados = 0; let statsAusentes = 0;

  funcionariosFiltrados.forEach(func => {
    const regHoje = registrosHoje.find(r => r.funcionarioId === func.id);
    const temFalta = regHoje?.statusDia === 'Falta' || regHoje?.statusDia === 'Atestado Médico';
    
    if (temFalta) { statsAusentes++; } 
    else if (regHoje?.entrada1 && regHoje.entrada1 !== '--:--') {
      statsPresentes++;
      if (regHoje.entrada1 > jornadaPadrao.limiteAtraso) statsAtrasados++;
    } else {
      if (dataFiltro < hojeString || (dataFiltro === hojeString && horaAtualTexto > jornadaPadrao.limiteAtraso)) { statsAtrasados++; }
    }
  });

  if (carregando) return <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Sincronizando sistemas de RH...</div>;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', padding: isMobile ? '15px 10px' : '30px 20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: '20px', marginBottom: '25px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ backgroundColor: '#eff6ff', padding: '14px', borderRadius: '16px', border: '1px solid #bfdbfe', boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.1)' }}>
              <Clock size={30} color="#2563eb" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 style={{ fontSize: isMobile ? '22px' : '28px', color: '#0f172a', margin: '0 0 4px 0', fontWeight: '800', letterSpacing: '-0.5px' }}>Gestão de Ponto & Banco</h1>
                <button onClick={() => setModalConfig(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '5px' }} title="Configurar Quadro de Horários"><Settings size={22} /></button>
              </div>
              <p style={{ margin: 0, fontSize: '14px', color: '#64748b', fontWeight: '500' }}>Jornada Oficial: <strong style={{ color: '#475569' }}>{jornadaPadrao.entrada} - {jornadaPadrao.saidaFim}</strong></p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '10px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'white', padding: '8px 15px', borderRadius: '12px', border: '1px solid #cbd5e1', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
              <CalendarDays size={18} color="#6366f1" />
              <input type="date" value={dataFiltro} max={hojeString} onChange={e => setDataFiltro(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: '14px', fontWeight: 'bold', color: '#1e293b' }} />
            </div>
            <Button onClick={() => setModalExport(true)} style={{ backgroundColor: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '12px' }}>
              <FileSpreadsheet size={16} /> Exportar
            </Button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '30px' }}>
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ backgroundColor: '#f1f5f9', padding: '12px', borderRadius: '12px' }}><BarChart2 size={24} color="#475569" /></div>
            <div>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Total Equipe</p>
              <h3 style={{ margin: 0, fontSize: '24px', color: '#0f172a' }}>{statsTotal}</h3>
            </div>
          </div>
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ backgroundColor: '#f0fdf4', padding: '12px', borderRadius: '12px' }}><UserCheck size={24} color="#16a34a" /></div>
            <div>
              <p style={{ margin: '0', fontSize: '12px', color: '#166534', fontWeight: 'bold', textTransform: 'uppercase' }}>Presentes</p>
              <h3 style={{ margin: 0, fontSize: '24px', color: '#15803d' }}>{statsPresentes}</h3>
            </div>
          </div>
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ backgroundColor: '#fffbeb', padding: '12px', borderRadius: '12px' }}><AlertTriangle size={24} color="#d97706" /></div>
            <div>
              <p style={{ margin: 0, fontSize: '12px', color: '#b45309', fontWeight: 'bold', textTransform: 'uppercase' }}>Atrasados / Pendentes</p>
              <h3 style={{ margin: 0, fontSize: '24px', color: '#b45309' }}>{statsAtrasados}</h3>
            </div>
          </div>
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ backgroundColor: '#fef2f2', padding: '12px', borderRadius: '12px' }}><UserMinus size={24} color="#dc2626" /></div>
            <div>
              <p style={{ margin: 0, fontSize: '12px', color: '#b91c1c', fontWeight: 'bold', textTransform: 'uppercase' }}>Ausentes</p>
              <h3 style={{ margin: 0, fontSize: '24px', color: '#b91c1c' }}>{statsAusentes}</h3>
            </div>
          </div>
        </div>

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

        {abaAtiva === 'diario' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'fadeIn 0.4s' }}>
            {funcionariosFiltrados.map(func => {
              const regHoje = registrosHoje.find(r => r.funcionarioId === func.id);
              const acordoHoje = acordosHoje.find(a => a.funcionarioId === func.id);
              const concluido = regHoje?.saida2 && regHoje.saida2 !== '--:--';
              const temFaltaOuAtestado = regHoje?.statusDia === 'Falta' || regHoje?.statusDia === 'Atestado Médico';
              const semPontoAinda = !regHoje?.entrada1 && !temFaltaOuAtestado;
              const atrasadoHoje = dataFiltro === hojeString && semPontoAinda && (horaAtualTexto > jornadaPadrao.limiteAtraso);
              const atrasadoPassado = dataFiltro < hojeString && semPontoAinda;
              const estaAtrasado = atrasadoHoje || atrasadoPassado;
              const bancoHorasDia = calcularBancoHorasDia(regHoje);

              let corFundo = 'white'; let corBorda = 'rgba(226, 232, 240, 0.8)'; 
              if (temFaltaOuAtestado) { corFundo = '#fff5f5'; corBorda = '#fecaca'; }
              else if (estaAtrasado) { corFundo = '#fffbeb'; corBorda = '#fde68a'; }

              return (
                <div key={func.id} style={{ backgroundColor: corFundo, borderRadius: '20px', border: `1px solid ${corBorda}`, padding: isMobile ? '20px' : '24px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '24px', boxShadow: '0 4px 15px -3px rgba(0,0,0,0.03)', transition: 'all 0.3s ease' }}>
                  <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      <div style={{ width: '40px', height: '40px', backgroundColor: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontWeight: 'bold', fontSize: '16px' }}>{func.nome.charAt(0)}</div>
                      <div>
                        <strong style={{ display: 'block', fontSize: '16px', color: '#0f172a', fontWeight: '700' }}>{func.nome}</strong>
                        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Mat: {func.matricula}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingLeft: '52px' }}>
                      {acordoHoje && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', backgroundColor: '#eef2ff', color: '#4f46e5', padding: '4px 8px', borderRadius: '20px', fontWeight: 'bold', border: '1px solid #c7d2fe' }}><Handshake size={12} /> Acordo Ativo</span>}
                      {regHoje?.justificativa && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', backgroundColor: temFaltaOuAtestado ? '#fee2e2' : '#fef3c7', color: temFaltaOuAtestado ? '#b91c1c' : '#d97706', padding: '4px 8px', borderRadius: '20px', fontWeight: 'bold' }}><AlertCircle size={12} /> {regHoje.justificativa}</span>}
                      {bancoHorasDia && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', backgroundColor: bancoHorasDia.val >= 0 ? '#dcfce7' : '#fee2e2', color: bancoHorasDia.val >= 0 ? '#166534' : '#991b1b', padding: '4px 8px', borderRadius: '20px', fontWeight: 'bold', border: `1px solid ${bancoHorasDia.val >= 0 ? '#bbf7d0' : '#fecaca'}` }}><Clock size={12} /> Saldo Dia: {bancoHorasDia.text}</span>}
                    </div>
                  </div>

                  <div style={{ flex: 1.5, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', backgroundColor: 'rgba(248, 250, 252, 0.5)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(226, 232, 240, 0.5)' }}>
                    {[
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

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch', height: estaAtrasado ? 'auto' : '50px' }}>
                      <div style={{ flex: 3, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {estaAtrasado ? (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', height: '40px' }}>
                            <Button onClick={() => lancarAusencia(func.id, func.nome, 'Falta')} style={{ backgroundColor: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5', fontSize: '12px', padding: 0, borderRadius: '10px' }}><UserMinus size={14} style={{ marginRight: '6px' }}/> Falta</Button>
                            <Button onClick={() => lancarAusencia(func.id, func.nome, 'Atestado Médico')} style={{ backgroundColor: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', fontSize: '12px', padding: 0, borderRadius: '10px' }}><FileText size={14} style={{ marginRight: '6px' }}/> Atestado</Button>
                          </div>
                        ) : semPontoAinda ? (
                          <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#64748b', backgroundColor: '#f1f5f9', borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', border: '1px dashed #cbd5e1' }}>Aguardando...</div>
                        ) : concluido || temFaltaOuAtestado ? (
                          <div style={{ fontSize: '13px', fontWeight: 'bold', color: temFaltaOuAtestado ? '#991b1b' : '#15803d', backgroundColor: temFaltaOuAtestado ? '#fee2e2' : '#dcfce7', borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', height: '100%' }}>{temFaltaOuAtestado ? 'Justificado' : <><UserCheck size={16} /> Concluído</>}</div>
                        ) : (
                          <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#0ea5e9', backgroundColor: '#e0f2fe', borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', height: '100%' }}><Clock size={16} /> Em Andamento</div>
                        )}
                      </div>

                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                         <Button onClick={() => abrirModalEdicao(func, regHoje)} style={{ height: '100%', minHeight: estaAtrasado ? '40px' : '100%', backgroundColor: '#f8fafc', color: '#3b82f6', border: '1px solid #cbd5e1', padding: 0, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }} title="Ajustar Manualmente"><Edit3 size={18} /></Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {abaAtiva === 'banco' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px', animation: 'fadeIn 0.4s' }}>
            {funcionariosFiltrados.map(func => {
              const saldoMensal = calcularSaldoMensal(func.id);
              const estaNegativo = saldoMensal.val < 0;

              return (
                <div key={func.id} style={{ backgroundColor: 'white', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '24px', display: 'flex', flexDirection: 'column', gap: '15px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '6px', backgroundColor: estaNegativo ? '#ef4444' : '#10b981' }}></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '45px', height: '45px', backgroundColor: '#f8fafc', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontWeight: 'bold', fontSize: '18px', border: '1px solid #e2e8f0' }}>{func.nome.charAt(0)}</div>
                    <div>
                      <strong style={{ display: 'block', fontSize: '16px', color: '#0f172a', fontWeight: '800' }}>{func.nome}</strong>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>Mat: {func.matricula}</span>
                    </div>
                  </div>
                  <div style={{ backgroundColor: estaNegativo ? '#fef2f2' : '#f0fdf4', border: `1px solid ${estaNegativo ? '#fecaca' : '#bbf7d0'}`, borderRadius: '12px', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Scale size={20} color={estaNegativo ? '#dc2626' : '#16a34a'} />
                      <span style={{ fontSize: '13px', fontWeight: 'bold', color: estaNegativo ? '#991b1b' : '#166534' }}>Saldo Mensal</span>
                    </div>
                    <strong style={{ fontSize: '22px', fontWeight: '900', color: estaNegativo ? '#ef4444' : '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {estaNegativo ? <TrendingDown size={20}/> : <TrendingUp size={20}/>}
                      {saldoMensal.text}
                    </strong>
                  </div>
                  <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8', textAlign: 'center' }}>Calculado referente ao mês {dataFiltro.substring(0, 7).split('-').reverse().join('/')}</p>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* RENDERIZAÇÃO DOS NOSSOS NOVOS MODAIS EXTRAÍDOS */}
      <ModalConfigPonto 
        aberto={modalConfig} onClose={() => setModalConfig(false)} 
        configEdit={configEdit} setConfigEdit={setConfigEdit} 
        salvarConfiguracao={salvarConfiguracaoGlobal} isMobile={isMobile} 
      />

      <ModalEdicaoPonto 
        aberto={modalAberto} onClose={() => setModalAberto(false)} 
        funcEditando={funcEditando} dataFiltro={dataFiltro} 
        entrada1={entrada1} setEntrada1={setEntrada1} saida1={saida1} setSaida1={setSaida1}
        entrada2={entrada2} setEntrada2={setEntrada2} saida2={saida2} setSaida2={setSaida2}
        cargaHorariaManual={cargaHorariaManual} setCargaHorariaManual={setCargaHorariaManual}
        justificativa={justificativa} setJustificativa={setJustificativa}
        salvarEdicaoPonto={salvarEdicaoPonto} isMobile={isMobile} 
      />

      <ModalExportacaoPonto 
        aberto={modalExport} onClose={() => setModalExport(false)} 
        mesExport={mesExport} setMesExport={setMesExport} 
        funcExportId={funcExportId} setFuncExportId={setFuncExportId} 
        funcionarios={funcionarios} exportando={exportando} gerarEspelhoPonto={gerarEspelhoPonto} 
      />
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}