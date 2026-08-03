// src/pages/GestaoPonto.tsx
import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase'; 
import { dbFolha } from '../services/firebaseFolha'; 

import { Clock, LockOpen, Lock, Edit3, Save, X, UserCheck, AlertCircle, Copy, CheckCircle2 } from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

export default function GestaoPonto() {
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [registrosHoje, setRegistrosHoje] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [modalAberto, setModalAberto] = useState(false);
  const [funcEditando, setFuncEditando] = useState<any>(null);
  
  const [entrada1, setEntrada1] = useState('');
  const [saida1, setSaida1] = useState('');
  const [entrada2, setEntrada2] = useState('');
  const [saida2, setSaida2] = useState('');
  const [cargaHoraria, setCargaHoraria] = useState('08:48');
  const [justificativa, setJustificativa] = useState('');
  const [linkCopiado, setLinkCopiado] = useState(false);

  // ✨ NOVO: Estado para detetar se estamos num telemóvel
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const dataHojeStr = new Date().toISOString().split('T')[0];
  const dataFormatada = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  // ✨ NOVO: Efeito que "ouve" o tamanho da tela para mudar o layout instantaneamente
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'funcionarios'), (snap) => {
      const ativos = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((f: any) => f.status !== 'desligado');
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

  const abrirModalEdicao = (func: any, registro: any) => {
    setFuncEditando({ ...func, idRegistro: `${func.id}_${dataHojeStr}` });
    setEntrada1(registro?.entrada1 || '');
    setSaida1(registro?.saida1 || '');
    setEntrada2(registro?.entrada2 || '');
    setSaida2(registro?.saida2 || '');
    setCargaHoraria(registro?.cargaHorariaPrevista || '08:48');
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
        ultimaAtualizacao: serverTimestamp(),
        editadoManualmente: true
      }, { merge: true });
      
      setModalAberto(false);
      alert("Ponto atualizado com sucesso!");
    } catch (error) {
      alert("Erro ao salvar os dados manualmente.");
    }
  };

  if (carregando) return <div style={{ padding: '40px', textAlign: 'center' }}>A carregar dados...</div>;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '10px' : '20px' }}>
      
      {/* Cabeçalho Responsivo */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: '20px', marginBottom: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ backgroundColor: '#e0f2fe', padding: '12px', borderRadius: '12px' }}>
            <Clock size={28} color="#0ea5e9" />
          </div>
          <div>
            <h1 style={{ fontSize: isMobile ? '20px' : '24px', color: '#1e293b', margin: 0, fontWeight: '800' }}>Gestão de Ponto</h1>
            <p style={{ margin: 0, fontSize: '14px', color: '#64748b', textTransform: 'capitalize' }}>{dataFormatada}</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', backgroundColor: 'white', padding: '10px 15px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
            <span style={{ fontSize: '13px', color: '#475569', fontWeight: 'bold' }}>Link:</span>
            <code style={{ fontSize: '12px', color: '#3b82f6', backgroundColor: '#eff6ff', padding: '6px 10px', borderRadius: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: isMobile ? '120px' : 'none' }}>
              /ponto
            </code>
          </div>
          <button 
            onClick={copiarLinkPonto} 
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: linkCopiado ? '#10b981' : '#f1f5f9', border: 'none', color: linkCopiado ? 'white' : '#475569', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', padding: '8px 12px', borderRadius: '6px', transition: 'all 0.2s' }}
          >
            {linkCopiado ? <CheckCircle2 size={16} /> : <Copy size={16} />}
            {linkCopiado ? 'Copiado!' : 'Copiar'}
          </button>
        </div>
      </div>

      {/* Container Principal */}
      <div style={{ backgroundColor: isMobile ? 'transparent' : 'white', borderRadius: '16px', border: isMobile ? 'none' : '1px solid #e2e8f0', overflow: 'hidden', boxShadow: isMobile ? 'none' : '0 4px 6px rgba(0,0,0,0.02)' }}>
        
        {/* Cabeçalho da Tabela Oculto no Mobile */}
        {!isMobile && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr 1.5fr 1fr', gap: '10px', backgroundColor: '#f8fafc', padding: '15px 20px', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold', color: '#475569', fontSize: '13px' }}>
            <div>COLABORADOR</div>
            <div style={{ textAlign: 'center' }}>REGISTOS DE HOJE</div>
            <div style={{ textAlign: 'center' }}>CATRACA VIRTUAL</div>
            <div style={{ textAlign: 'center' }}>AÇÕES</div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '15px' : '0' }}>
          {funcionarios.map(func => {
            const regHoje = registrosHoje.find(r => r.funcionarioId === func.id);
            const estaLiberado = regHoje?.liberadoParaBater || false;
            const concluido = regHoje?.saida2 ? true : false;

            // ✨ RENDERIZAÇÃO CONDICIONAL: SE FOR MOBILE, MOSTRA CARTÕES
            if (isMobile) {
              return (
                <div key={func.id} style={{ backgroundColor: estaLiberado ? '#f0fdf4' : 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '15px', display: 'flex', flexDirection: 'column', gap: '15px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                  
                  {/* Topo do Cartão: Nome e Matrícula */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <strong style={{ display: 'block', fontSize: '16px', color: '#1e293b' }}>{func.nome}</strong>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>Matrícula: {func.matricula}</span>
                    </div>
                    {regHoje?.justificativa && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', backgroundColor: '#fef3c7', color: '#d97706', padding: '4px 8px', borderRadius: '20px', fontWeight: 'bold' }}>
                        <AlertCircle size={12} /> Justificado
                      </span>
                    )}
                  </div>

                  {/* Meio do Cartão: Grelha 2x2 para horários */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', backgroundColor: '#f8fafc', padding: '10px', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                    <div><span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>ENTRADA</span><strong style={{ color: regHoje?.entrada1 ? '#10b981' : '#cbd5e1', fontSize: '14px' }}>{regHoje?.entrada1 || '--:--'}</strong></div>
                    <div><span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>SAÍDA ALM.</span><strong style={{ color: regHoje?.saida1 ? '#10b981' : '#cbd5e1', fontSize: '14px' }}>{regHoje?.saida1 || '--:--'}</strong></div>
                    <div><span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>RETORNO</span><strong style={{ color: regHoje?.entrada2 ? '#10b981' : '#cbd5e1', fontSize: '14px' }}>{regHoje?.entrada2 || '--:--'}</strong></div>
                    <div><span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>SAÍDA FIM</span><strong style={{ color: regHoje?.saida2 ? '#10b981' : '#cbd5e1', fontSize: '14px' }}>{regHoje?.saida2 || '--:--'}</strong></div>
                  </div>

                  {/* Fundo do Cartão: Botões Lado a Lado */}
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ flex: 3 }}>
                      {concluido ? (
                        <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#166534', backgroundColor: '#dcfce7', padding: '10px', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '5px', height: '100%' }}>
                          <UserCheck size={16} /> Concluído
                        </div>
                      ) : estaLiberado ? (
                        <Button onClick={() => alternarCatraca(func.id, func.nome, estaLiberado)} style={{ backgroundColor: '#ef4444', fontSize: '13px', height: '40px', width: '100%' }}>
                          <Lock size={16} style={{ marginRight: '5px' }}/> Bloquear
                        </Button>
                      ) : (
                        <Button onClick={() => alternarCatraca(func.id, func.nome, estaLiberado)} style={{ backgroundColor: '#10b981', fontSize: '13px', height: '40px', width: '100%' }}>
                          <LockOpen size={16} style={{ marginRight: '5px' }}/> Liberar
                        </Button>
                      )}
                    </div>
                    <Button onClick={() => abrirModalEdicao(func, regHoje)} style={{ flex: 1, backgroundColor: '#f1f5f9', color: '#3b82f6', border: '1px solid #cbd5e1', height: '40px', padding: 0 }}>
                      <Edit3 size={18} />
                    </Button>
                  </div>

                </div>
              );
            }

            // ✨ RENDERIZAÇÃO CONDICIONAL: SE FOR DESKTOP (COMPUTADOR), MANTÉM A TABELA ORIGINAL
            return (
              <div key={func.id} style={{ display: 'grid', gridTemplateColumns: '2fr 3fr 1.5fr 1fr', gap: '10px', padding: '15px 20px', borderBottom: '1px solid #f1f5f9', alignItems: 'center', transition: '0.2s', backgroundColor: estaLiberado ? '#f0fdf4' : 'white' }}>
                <div>
                  <strong style={{ display: 'block', fontSize: '15px', color: '#1e293b' }}>{func.nome}</strong>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Matrícula: {func.matricula}</span>
                  {regHoje?.justificativa && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', backgroundColor: '#fef3c7', color: '#d97706', padding: '2px 6px', borderRadius: '4px', marginTop: '4px', fontWeight: 'bold' }}>
                      <AlertCircle size={10} /> Justificado
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '5px', fontSize: '14px' }}>
                  <div style={{ textAlign: 'center', flex: 1 }}><span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>ENT</span><strong style={{ color: regHoje?.entrada1 ? '#10b981' : '#cbd5e1' }}>{regHoje?.entrada1 || '--:--'}</strong></div>
                  <div style={{ textAlign: 'center', flex: 1 }}><span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>SAÍ</span><strong style={{ color: regHoje?.saida1 ? '#10b981' : '#cbd5e1' }}>{regHoje?.saida1 || '--:--'}</strong></div>
                  <div style={{ textAlign: 'center', flex: 1 }}><span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>RET</span><strong style={{ color: regHoje?.entrada2 ? '#10b981' : '#cbd5e1' }}>{regHoje?.entrada2 || '--:--'}</strong></div>
                  <div style={{ textAlign: 'center', flex: 1 }}><span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>FIM</span><strong style={{ color: regHoje?.saida2 ? '#10b981' : '#cbd5e1' }}>{regHoje?.saida2 || '--:--'}</strong></div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  {concluido ? (
                     <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#166534', backgroundColor: '#dcfce7', padding: '6px 12px', borderRadius: '50px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                       <UserCheck size={14} /> Concluído
                     </span>
                  ) : estaLiberado ? (
                    <Button onClick={() => alternarCatraca(func.id, func.nome, estaLiberado)} style={{ backgroundColor: '#ef4444', fontSize: '12px', height: '35px', width: '100%' }}>
                      <Lock size={14} style={{ marginRight: '5px' }}/> Bloquear
                    </Button>
                  ) : (
                    <Button onClick={() => alternarCatraca(func.id, func.nome, estaLiberado)} style={{ backgroundColor: '#10b981', fontSize: '12px', height: '35px', width: '100%' }}>
                      <LockOpen size={14} style={{ marginRight: '5px' }}/> Liberar Ponto
                    </Button>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={() => abrirModalEdicao(func, regHoje)} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', fontWeight: 'bold' }}>
                    <Edit3 size={16} /> Ajustar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal de Edição - Também adaptado para telas pequenas através do maxWidth */}
      {modalAberto && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', padding: '15px' }}>
          <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '500px', borderRadius: '20px', padding: isMobile ? '20px' : '25px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', maxHeight: '90vh', overflowY: 'auto' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: 0, color: '#1e293b', fontSize: '18px' }}>Ajuste Manual de Ponto</h3>
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
              <p style={{ fontSize: '11px', color: '#94a3b8', margin: '5px 0 0 0' }}>Exemplo: 08:48 corresponde à jornada padrão.</p>
            </div>

            <div style={{ marginBottom: '25px' }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '8px' }}>Justificativa (Atestado, Faltas)</label>
              <textarea 
                value={justificativa} 
                onChange={e => setJustificativa(e.target.value)} 
                placeholder="Insira o motivo da alteração..."
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
