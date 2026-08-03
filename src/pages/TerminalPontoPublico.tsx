// src/pages/TerminalPontoPublico.tsx
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase'; 
import { dbFolha } from '../services/firebaseFolha'; 

import { Clock, Fingerprint, Search, AlertCircle, CheckCircle2 } from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import ModalAssinaturaPonto from '../components/ponto/ModalAssinaturaPonto';

export default function TerminalPontoPublico() {
  const [horaAtual, setHoraAtual] = useState(new Date());
  const [matricula, setMatricula] = useState('');
  
  const [funcionario, setFuncionario] = useState<any>(null);
  const [registroHoje, setRegistroHoje] = useState<any>(null);
  const [erro, setErro] = useState('');

  // Estado para o Modal de Assinatura (exigido no último ponto do dia)
  const [modalAssinatura, setModalAssinatura] = useState(false);
  const [proximoPonto, setProximoPonto] = useState<'entrada1' | 'saida1' | 'entrada2' | 'saida2' | null>(null);

  // 1. Relógio em Tempo Real
  useEffect(() => {
    const timer = setInterval(() => setHoraAtual(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 2. Buscar Funcionário pela Matrícula e verificar a "Catraca Virtual"
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
        setErro('Colaborador inativo.');
        return;
      }

      setFuncionario(funcData);
      await carregarPontoFuncionario(funcData.id);

    } catch (error) {
      setErro('Erro ao ligar ao sistema.');
    }
  };

  // 3. Carregar o registo específico de HOJE para este funcionário
  const carregarPontoFuncionario = async (funcionarioId: string) => {
    const dataHojeStr = new Date().toISOString().split('T')[0];
    const idRegistro = `${funcionarioId}_${dataHojeStr}`;
    
    const docRef = doc(dbFolha, 'registros_ponto', idRegistro);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      setRegistroHoje(docSnap.data());
    } else {
      // Se não existe documento, significa que o gestor ainda não interagiu com este funcionário hoje
      setRegistroHoje({ liberadoParaBater: false }); 
    }
  };

  // 4. Lógica ao clicar no botão "Registar Horário"
  const iniciarBatidaPonto = () => {
    if (!funcionario || !registroHoje?.liberadoParaBater) return;

    // Descobre qual é a próxima batida vazia
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

    // Se for o ÚLTIMO ponto do dia (saída 2), obriga a assinar
    if (qualPonto === 'saida2') {
      setModalAssinatura(true);
    } else {
      // Se for os primeiros 3 pontos, grava direto sem assinatura
      gravarPontoNoBanco(qualPonto, '');
    }
  };

  // 5. Gravar a hora no banco de dados isolado e TRANCAR A CATRACA
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
        liberadoParaBater: false, // Tranca a catraca automaticamente após bater
        ultimaAtualizacao: serverTimestamp()
      };

      if (assinaturaBase64) {
        dadosAtualizar.assinatura = assinaturaBase64;
      }

      await setDoc(docRef, dadosAtualizar, { merge: true });

      // Atualiza a tela imediatamente
      setRegistroHoje({ ...registroHoje, ...dadosAtualizar });
      alert(`Ponto registado com sucesso às ${horaExata}!`);
      setModalAssinatura(false);

    } catch (error) {
      alert("Erro ao registar o ponto. Tente novamente.");
    }
  };

  const dataFormatada = horaAtual.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f1f5f9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '500px', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        
        {/* Cabeçalho / Relógio */}
        <div style={{ backgroundColor: '#0f172a', padding: '40px 20px', textAlign: 'center', color: 'white' }}>
          <h2 style={{ margin: 0, color: '#94a3b8', fontSize: '16px', textTransform: 'capitalize' }}>{dataFormatada}</h2>
          <div style={{ fontSize: '64px', fontWeight: '900', letterSpacing: '2px', margin: '15px 0', fontFamily: 'monospace', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
            <Clock size={40} color="#10b981" /> {horaAtual.toLocaleTimeString('pt-BR')}
          </div>
          <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>Terminal Digital Carvalho</p>
        </div>

        <div style={{ padding: '30px' }}>
          {!funcionario ? (
            // Ecrã 1: Login por Matrícula
            <form onSubmit={buscarFuncionario} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <h3 style={{ margin: 0, color: '#1e293b', textAlign: 'center', marginBottom: '10px' }}>Identifique-se</h3>
              <Input 
                label="Digite sua Matrícula" 
                value={matricula} 
                onChange={e => setMatricula(e.target.value)} 
                type="number"
                placeholder="Ex: 1001"
              />
              {erro && <p style={{ color: '#ef4444', fontSize: '13px', margin: 0, textAlign: 'center' }}>{erro}</p>}
              <Button type="submit" style={{ height: '50px', backgroundColor: '#3b82f6', fontSize: '16px' }}>
                <Search size={20} style={{ marginRight: '8px' }} /> Acessar Ponto
              </Button>
            </form>
          ) : (
            // Ecrã 2: Área do Colaborador
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid #e2e8f0' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Colaborador(a)</p>
                  <h3 style={{ margin: '5px 0 0 0', color: '#1e293b' }}>{funcionario.nome}</h3>
                </div>
                <button onClick={() => {setFuncionario(null); setMatricula('');}} style={{ background: 'none', border: 'none', color: '#ef4444', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline' }}>
                  Sair
                </button>
              </div>

              {/* Status da Catraca Virtual */}
              {!registroHoje?.liberadoParaBater && !registroHoje?.saida2 && (
                <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', padding: '15px', borderRadius: '12px', display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '20px' }}>
                  <AlertCircle size={24} color="#ef4444" />
                  <div>
                    <h4 style={{ margin: '0 0 5px 0', color: '#991b1b', fontSize: '14px' }}>Acesso Bloqueado</h4>
                    <p style={{ margin: 0, color: '#b91c1c', fontSize: '12px' }}>O seu ponto não está liberado. Solicite a liberação para bater o ponto.</p>
                  </div>
                </div>
              )}

              {/* Grelha de Horários */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '25px' }}>
                <div style={{ backgroundColor: '#f8fafc', padding: '15px', borderRadius: '10px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>ENTRADA</span>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: registroHoje?.entrada1 ? '#10b981' : '#cbd5e1' }}>{registroHoje?.entrada1 || '--:--'}</div>
                </div>
                <div style={{ backgroundColor: '#f8fafc', padding: '15px', borderRadius: '10px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>SAÍDA ALMOÇO</span>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: registroHoje?.saida1 ? '#10b981' : '#cbd5e1' }}>{registroHoje?.saida1 || '--:--'}</div>
                </div>
                <div style={{ backgroundColor: '#f8fafc', padding: '15px', borderRadius: '10px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>RETORNO</span>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: registroHoje?.entrada2 ? '#10b981' : '#cbd5e1' }}>{registroHoje?.entrada2 || '--:--'}</div>
                </div>
                <div style={{ backgroundColor: '#f8fafc', padding: '15px', borderRadius: '10px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>SAÍDA FIM</span>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: registroHoje?.saida2 ? '#10b981' : '#cbd5e1' }}>{registroHoje?.saida2 || '--:--'}</div>
                </div>
              </div>

              {/* Botões de Ação */}
              {!registroHoje?.saida2 ? (
                <Button 
                  onClick={iniciarBatidaPonto} 
                  disabled={!registroHoje?.liberadoParaBater}
                  style={{ width: '100%', height: '60px', fontSize: '18px', fontWeight: 'bold', backgroundColor: registroHoje?.liberadoParaBater ? '#10b981' : '#cbd5e1', display: 'flex', justifyContent: 'center', gap: '10px' }}
                >
                  <Fingerprint size={24} /> Registar Horário
                </Button>
              ) : (
                <div style={{ padding: '15px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#166534', fontWeight: 'bold' }}>
                  <CheckCircle2 size={24} /> Expediente Concluído
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <ModalAssinaturaPonto 
        aberto={modalAssinatura} 
        onClose={() => setModalAssinatura(false)} 
        onConfirm={(base64) => {
          // Se o utilizador pulou, o "base64" será uma string vazia (''), mas a função gravará a hora na mesma!
          if (proximoPonto) gravarPontoNoBanco(proximoPonto, base64);
        }} 
      />

    </div>
  );
}