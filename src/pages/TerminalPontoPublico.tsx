// src/pages/TerminalPontoPublico.tsx
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase'; 
import { dbFolha } from '../services/firebaseFolha'; 

// Adicionámos novos ícones para enriquecer o visual
import { Clock, Fingerprint, Search, AlertCircle, CheckCircle2, User, LogOut, Lock, Unlock, ChevronRight } from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import ModalAssinaturaPonto from '../components/ponto/ModalAssinaturaPonto';

export default function TerminalPontoPublico() {
  const [horaAtual, setHoraAtual] = useState(new Date());
  const [matricula, setMatricula] = useState('');
  
  const [funcionario, setFuncionario] = useState<any>(null);
  const [registroHoje, setRegistroHoje] = useState<any>(null);
  const [erro, setErro] = useState('');

  const [modalAssinatura, setModalAssinatura] = useState(false);
  const [proximoPonto, setProximoPonto] = useState<'entrada1' | 'saida1' | 'entrada2' | 'saida2' | null>(null);

  // 1. Relógio em Tempo Real
  useEffect(() => {
    const timer = setInterval(() => setHoraAtual(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 2. Lógica de Busca do Funcionário
  const buscarFuncionario = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    if (!matricula) return;

    try {
      const q = query(collection(db, 'funcionarios'), where('matricula', '==', matricula));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setErro('Matrícula não encontrada. Verifique o número digitado.');
        setFuncionario(null);
        return;
      }

      const funcData = { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() };
      if ((funcData as any).status === 'desligado') {
        setErro('Colaborador inativo no sistema.');
        return;
      }

      setFuncionario(funcData);
      await carregarPontoFuncionario(funcData.id);

    } catch (error) {
      setErro('Erro ao ligar ao sistema. Tente novamente.');
    }
  };

  // 3. Lógica de Carregar Ponto de Hoje
  const carregarPontoFuncionario = async (funcionarioId: string) => {
    const dataHojeStr = new Date().toISOString().split('T')[0];
    const idRegistro = `${funcionarioId}_${dataHojeStr}`;
    
    const docRef = doc(dbFolha, 'registros_ponto', idRegistro);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      setRegistroHoje(docSnap.data());
    } else {
      setRegistroHoje({ liberadoParaBater: false }); 
    }
  };

  // 4. Lógica de Identificação do Próximo Ponto
  const iniciarBatidaPonto = () => {
    if (!funcionario || !registroHoje?.liberadoParaBater) return;

    let qualPonto: 'entrada1' | 'saida1' | 'entrada2' | 'saida2' | null = null;
    if (!registroHoje.entrada1) qualPonto = 'entrada1';
    else if (!registroHoje.saida1) qualPonto = 'saida1';
    else if (!registroHoje.entrada2) qualPonto = 'entrada2';
    else if (!registroHoje.saida2) qualPonto = 'saida2';

    if (!qualPonto) {
      alert("Todos os pontos já foram registados hoje!");
      return;
    }

    setProximoPonto(qualPonto);

    if (qualPonto === 'saida2') {
      setModalAssinatura(true);
    } else {
      gravarPontoNoBanco(qualPonto, '');
    }
  };

  // 5. Lógica de Gravação no Banco
  const gravarPontoNoBanco = async (campoPonto: string, assinaturaBase64: string) => {
    const dataHojeStr = new Date().toISOString().split('T')[0];
    const horaExata = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const idRegistro = `${funcionario.id}_${dataHojeStr}`;
    const docRef = doc(dbFolha, 'registros_ponto', idRegistro);

    try {
      const dadosAtualizar: any = {
        funcionarioId: funcionario.id,
        nomeFuncionario: funcionario.nome,
        data: dataHojeStr,
        [campoPonto]: horaExata,
        liberadoParaBater: false,
        ultimaAtualizacao: serverTimestamp()
      };

      if (assinaturaBase64) {
        dadosAtualizar.assinatura = assinaturaBase64;
      }

      await setDoc(docRef, dadosAtualizar, { merge: true });

      setRegistroHoje({ ...registroHoje, ...dadosAtualizar });
      setModalAssinatura(false);

    } catch (error) {
      alert("Erro ao registar o ponto. Tente novamente.");
    }
  };

  // Formatação de Datas
  const dataFormatada = horaAtual.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const horaFormatada = horaAtual.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const segundosFormatados = horaAtual.toLocaleTimeString('pt-BR', { second: '2-digit' }).split(':')[2];

  // Componente Auxiliar Visual: Cartão de Horário Individual
  const CartaoHorario = ({ titulo, hora }: { titulo: string, hora?: string }) => {
    const preenchido = hora && hora !== '--:--';
    return (
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: '12px 5px', 
        borderRadius: '12px', 
        backgroundColor: preenchido ? '#f0fdf4' : '#f8fafc',
        border: preenchido ? '1px solid #bbf7d0' : '1px dashed #cbd5e1',
        transition: 'all 0.3s ease'
      }}>
        <span style={{ fontSize: '10px', color: preenchido ? '#166534' : '#64748b', fontWeight: 'bold', marginBottom: '4px', textAlign: 'center' }}>
          {titulo}
        </span>
        {preenchido ? (
          <strong style={{ fontSize: '18px', color: '#15803d', display: 'flex', alignItems: 'center', gap: '4px' }}>
            {hora} <CheckCircle2 size={14} color="#22c55e" />
          </strong>
        ) : (
          <strong style={{ fontSize: '18px', color: '#cbd5e1' }}>--:--</strong>
        )}
      </div>
    );
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f1f5f9', backgroundImage: 'radial-gradient(#e2e8f0 1px, transparent 1px)', backgroundSize: '20px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Container Principal Estilo Cartão Flutuante */}
      <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '450px', borderRadius: '24px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
        
        {/* Cabeçalho Escuro / Relógio Premium */}
        <div style={{ backgroundColor: '#0f172a', padding: '35px 20px', textAlign: 'center', color: 'white', position: 'relative', overflow: 'hidden' }}>
          {/* Elementos decorativos de fundo */}
          <div style={{ position: 'absolute', top: '-50%', left: '-20%', width: '200px', height: '200px', background: 'radial-gradient(circle, rgba(59,130,246,0.2) 0%, rgba(0,0,0,0) 70%)', borderRadius: '50%' }}></div>
          <div style={{ position: 'absolute', bottom: '-50%', right: '-20%', width: '200px', height: '200px', background: 'radial-gradient(circle, rgba(16,185,129,0.2) 0%, rgba(0,0,0,0) 70%)', borderRadius: '50%' }}></div>
          
          <div style={{ position: 'relative', zIndex: 1 }}>
            <h2 style={{ margin: 0, color: '#94a3b8', fontSize: '14px', textTransform: 'capitalize', fontWeight: '500' }}>{dataFormatada}</h2>
            
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '4px', margin: '15px 0' }}>
              <span style={{ fontSize: '64px', fontWeight: '800', letterSpacing: '-2px', lineHeight: '1' }}>{horaFormatada}</span>
              <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981' }}>{segundosFormatados}</span>
            </div>
            
            <p style={{ margin: 0, color: '#64748b', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Clock size={14} /> Terminal Digital de Ponto
            </p>
          </div>
        </div>

        {/* Área de Conteúdo Dinâmica */}
        <div style={{ padding: '30px' }}>
          {!funcionario ? (
            // ==========================================
            // ECRÃ 1: IDENTIFICAÇÃO (LOGIN)
            // ==========================================
            <form onSubmit={buscarFuncionario} style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.5s' }}>
              <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                <div style={{ width: '60px', height: '60px', backgroundColor: '#eff6ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px auto' }}>
                  <Fingerprint size={32} color="#3b82f6" />
                </div>
                <h3 style={{ margin: '0 0 5px 0', color: '#1e293b', fontSize: '20px', fontWeight: '800' }}>Olá, Colaborador!</h3>
                <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>Digite sua matrícula para registrar o ponto.</p>
              </div>

              <div>
                <Input 
                  label="" 
                  value={matricula} 
                  onChange={e => setMatricula(e.target.value)} 
                  type="number"
                  placeholder="Sua Matrícula (Ex: 1001)"
                  style={{ textAlign: 'center', fontSize: '18px', padding: '15px', borderRadius: '12px', border: '2px solid #e2e8f0', backgroundColor: '#f8fafc' }}
                />
                {erro && (
                  <p style={{ color: '#ef4444', fontSize: '13px', margin: '8px 0 0 0', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    <AlertCircle size={14} /> {erro}
                  </p>
                )}
              </div>

              <Button type="submit" style={{ height: '55px', backgroundColor: '#3b82f6', fontSize: '16px', borderRadius: '12px', fontWeight: 'bold' }}>
                Continuar <ChevronRight size={20} />
              </Button>
            </form>
          ) : (
            // ==========================================
            // ECRÃ 2: PAINEL DO COLABORADOR
            // ==========================================
            <div style={{ animation: 'fadeIn 0.5s' }}>
              
              {/* Cabeçalho do Utilizador */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', paddingBottom: '20px', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '45px', height: '45px', backgroundColor: '#f0fdf4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <User size={24} color="#16a34a" />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, color: '#1e293b', fontSize: '16px', fontWeight: 'bold' }}>{funcionario.nome}</h3>
                    <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Matrícula: {funcionario.matricula}</p>
                  </div>
                </div>
                <button 
                  onClick={() => {setFuncionario(null); setMatricula('');}} 
                  style={{ background: '#f1f5f9', border: 'none', color: '#64748b', padding: '8px', borderRadius: '50%', cursor: 'pointer', transition: 'background 0.2s' }}
                  title="Sair"
                >
                  <LogOut size={18} />
                </button>
              </div>

              {/* Status da Catraca */}
              {!registroHoje?.liberadoParaBater && !registroHoje?.saida2 && (
                <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', padding: '16px', borderRadius: '12px', display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '25px' }}>
                  <div style={{ backgroundColor: '#fee2e2', padding: '8px', borderRadius: '50%' }}>
                    <Lock size={20} color="#dc2626" />
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 4px 0', color: '#991b1b', fontSize: '14px', fontWeight: 'bold' }}>Aguardando Liberação</h4>
                    <p style={{ margin: 0, color: '#b91c1c', fontSize: '12px' }}>Peça ao gestor para liberar seu próximo ponto.</p>
                  </div>
                </div>
              )}

              {/* Linha do Tempo (Horários) */}
              <div style={{ marginBottom: '30px' }}>
                <h4 style={{ fontSize: '13px', color: '#475569', margin: '0 0 15px 0', fontWeight: 'bold', textTransform: 'uppercase' }}>Registos de Hoje</h4>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <CartaoHorario titulo="ENTRADA" hora={registroHoje?.entrada1} />
                  <CartaoHorario titulo="SAÍDA" hora={registroHoje?.saida1} />
                  <CartaoHorario titulo="RETORNO" hora={registroHoje?.entrada2} />
                  <CartaoHorario titulo="FIM" hora={registroHoje?.saida2} />
                </div>
              </div>

              {/* Botão de Ação Principal */}
              {!registroHoje?.saida2 ? (
                <Button 
                  onClick={iniciarBatidaPonto} 
                  disabled={!registroHoje?.liberadoParaBater}
                  style={{ 
                    width: '100%', 
                    height: '65px', 
                    fontSize: '18px', 
                    fontWeight: '800', 
                    borderRadius: '16px',
                    backgroundColor: registroHoje?.liberadoParaBater ? '#10b981' : '#f1f5f9', 
                    color: registroHoje?.liberadoParaBater ? 'white' : '#94a3b8',
                    display: 'flex', 
                    justifyContent: 'center', 
                    gap: '12px',
                    boxShadow: registroHoje?.liberadoParaBater ? '0 10px 15px -3px rgba(16, 185, 129, 0.3)' : 'none',
                    transition: 'all 0.3s'
                  }}
                >
                  {registroHoje?.liberadoParaBater ? (
                    <><Unlock size={24} /> Bater Ponto Agora</>
                  ) : (
                    <><Lock size={24} /> Ponto Bloqueado</>
                  )}
                </Button>
              ) : (
                <div style={{ padding: '20px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#15803d' }}>
                  <CheckCircle2 size={32} />
                  <strong style={{ fontSize: '16px' }}>Expediente Concluído</strong>
                  <span style={{ fontSize: '13px' }}>Bom descanso!</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Assinatura */}
      <ModalAssinaturaPonto 
        aberto={modalAssinatura} 
        onClose={() => setModalAssinatura(false)} 
        onConfirm={(base64) => {
          if (proximoPonto) gravarPontoNoBanco(proximoPonto, base64);
        }} 
      />
      
      {/* Pequeno CSS global para as animações suaves inseridas na página */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

    </div>
  );
}
