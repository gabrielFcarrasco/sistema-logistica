// src/components/ponto/TerminalPonto.tsx
import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { dbFolha } from '../../services/firebaseFolha'; // Usando o NOVO banco!

import { Clock, Fingerprint, User, AlertCircle, CheckCircle2 } from 'lucide-react';
import Button from '../ui/Button';
import ModalAssinaturaEntrega from '../entrega/ModalAssinaturaEntrega'; // Reaproveitando teu modal

interface Props {
  funcionarios: any[];
  avisar: (msg: string, tipo?: 'sucesso' | 'erro') => void;
}

export default function TerminalPonto({ funcionarios, avisar }: Props) {
  // Estados do Relógio
  const [horaAtual, setHoraAtual] = useState(new Date());
  
  // Estados de Identificação e Dados do Ponto
  const [funcionarioSelecionado, setFuncionarioSelecionado] = useState('');
  const [registroHoje, setRegistroHoje] = useState<any>(null);
  const [carregando, setCarregando] = useState(false);

  // Estado para a Assinatura Final
  const [modalAssinatura, setModalAssinatura] = useState(false);

  // 1. Relógio em Tempo Real: Atualiza a cada segundo
  useEffect(() => {
    const timer = setInterval(() => setHoraAtual(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 2. Buscar o ponto do dia ao selecionar um funcionário
  useEffect(() => {
    const buscarPontoDiario = async () => {
      if (!funcionarioSelecionado) {
        setRegistroHoje(null);
        return;
      }
      
      setCarregando(true);
      const dataHojeStr = horaAtual.toISOString().split('T')[0]; // Ex: 2026-08-03
      const idDocumento = `${funcionarioSelecionado}_${dataHojeStr}`;
      
      try {
        const docRef = doc(dbFolha, 'registros_ponto', idDocumento);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setRegistroHoje({ id: docSnap.id, ...docSnap.data() });
        } else {
          // Se não existe documento, o gestor ainda não liberou o ponto hoje
          setRegistroHoje({ status: 'nao_liberado' });
        }
      } catch (error) {
        avisar("Erro ao buscar informações do ponto.", "erro");
      } finally {
        setCarregando(false);
      }
    };

    buscarPontoDiario();
  }, [funcionarioSelecionado]); // Executa sempre que trocar de funcionário

  // 3. Função que determina qual é a próxima batida e a regista
  const registrarPonto = async (base64Assinatura: string = '') => {
    if (!funcionarioSelecionado || registroHoje?.status === 'nao_liberado') return;
    
    // Pega a hora formatada (Ex: 08:00) exatamente no momento do clique
    const horaExata = horaAtual.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const dataHojeStr = horaAtual.toISOString().split('T')[0];
    const idDocumento = `${funcionarioSelecionado}_${dataHojeStr}`;
    const docRef = doc(dbFolha, 'registros_ponto', idDocumento);

    try {
      // Lógica para descobrir qual campo preencher
      let atualizacoes: any = {};
      
      if (!registroHoje.entrada1) {
        atualizacoes = { entrada1: horaExata };
      } else if (!registroHoje.saida1) {
        atualizacoes = { saida1: horaExata };
      } else if (!registroHoje.entrada2) {
        atualizacoes = { entrada2: horaExata };
      } else if (!registroHoje.saida2) {
        // É O ÚLTIMO PONTO! Precisamos da assinatura.
        if (!base64Assinatura) {
          // Interrompe o processo e abre o modal de assinatura
          setModalAssinatura(true);
          return; 
        }
        atualizacoes = { 
          saida2: horaExata, 
          assinatura: base64Assinatura, 
          status: 'concluido',
          ultimaAtualizacao: serverTimestamp() 
        };
      } else {
        return avisar("Todos os pontos de hoje já foram registados!", "erro");
      }

      // Atualiza o banco isolado
      await updateDoc(docRef, atualizacoes);
      
      // Atualiza o estado local para refletir na tela imediatamente
      setRegistroHoje({ ...registroHoje, ...atualizacoes });
      
      avisar(`Ponto registado às ${horaExata}!`, "sucesso");
      setModalAssinatura(false); // Fecha modal se estiver aberto

    } catch (error) {
      avisar("Falha ao registar o ponto. Tente novamente.", "erro");
    }
  };

  // Função disparada quando o modal de assinatura devolve o desenho feito
  const handleAssinaturaConcluida = (base64: string) => {
    registrarPonto(base64); // Chama o registo passando a assinatura
  };

  // Funções de formatação visual
  const dataFormatada = horaAtual.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const horaFormatada = horaAtual.toLocaleTimeString('pt-BR');

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      
      {/* Cabeçalho do Relógio */}
      <div style={{ backgroundColor: '#0f172a', padding: '30px', borderRadius: '20px', textAlign: 'center', color: 'white', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
        <h2 style={{ margin: 0, color: '#94a3b8', fontSize: '16px', textTransform: 'capitalize' }}>{dataFormatada}</h2>
        <div style={{ fontSize: '64px', fontWeight: '900', letterSpacing: '2px', margin: '10px 0', fontFamily: 'monospace', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
          <Clock size={48} color="#10b981" /> {horaFormatada}
        </div>
        <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>Horário Oficial de Brasília</p>
      </div>

      {/* Seleção de Funcionário */}
      <div style={{ marginTop: '25px', backgroundColor: 'white', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 'bold', color: '#334155', marginBottom: '10px' }}>
          <User size={18} /> Selecione sua Identificação
        </label>
        <select 
          value={funcionarioSelecionado} 
          onChange={(e) => setFuncionarioSelecionado(e.target.value)}
          style={{ width: '100%', padding: '15px', borderRadius: '10px', border: '2px solid #cbd5e1', fontSize: '16px', outline: 'none' }}
        >
          <option value="">-- Escolha seu nome --</option>
          {funcionarios.filter(f => f.status !== 'desligado').map(f => (
            <option key={f.id} value={f.id}>{f.nome}</option>
          ))}
        </select>
      </div>

      {/* Área do Ponto */}
      {carregando ? (
        <p style={{ textAlign: 'center', marginTop: '20px', color: '#64748b' }}>A verificar registos...</p>
      ) : funcionarioSelecionado && registroHoje ? (
        
        registroHoje.status === 'nao_liberado' ? (
          <div style={{ marginTop: '20px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', padding: '20px', borderRadius: '12px', display: 'flex', gap: '15px', alignItems: 'center' }}>
            <AlertCircle size={24} color="#ef4444" />
            <div>
              <h4 style={{ margin: '0 0 5px 0', color: '#991b1b' }}>Ponto Bloqueado</h4>
              <p style={{ margin: 0, color: '#b91c1c', fontSize: '13px' }}>O seu ponto de hoje ainda não foi liberado pela gestão. Aguarde liberação.</p>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: '25px', backgroundColor: 'white', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: '0 0 20px 0', color: '#1e293b', fontSize: '16px' }}>Registos do Dia</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <CartaoPonto titulo="Entrada (Manhã)" hora={registroHoje.entrada1} />
              <CartaoPonto titulo="Saída (Almoço)" hora={registroHoje.saida1} />
              <CartaoPonto titulo="Retorno (Almoço)" hora={registroHoje.entrada2} />
              <CartaoPonto titulo="Saída (Fim)" hora={registroHoje.saida2} />
            </div>

            {/* Botão Principal de Ação */}
            {!registroHoje.saida2 ? (
              <Button 
                onClick={() => registrarPonto()} 
                style={{ width: '100%', height: '60px', marginTop: '25px', fontSize: '18px', fontWeight: 'bold', backgroundColor: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
              >
                <Fingerprint size={24} /> Bater Ponto Agora
              </Button>
            ) : (
              <div style={{ marginTop: '25px', padding: '15px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#166534', fontWeight: 'bold' }}>
                <CheckCircle2 size={24} /> Expediente Concluído e Assinado
              </div>
            )}
          </div>
        )
      ) : null}

      {/* O teu modal de assinatura já existente, que devolve o Base64 */}
      <ModalAssinaturaEntrega 
        aberto={modalAssinatura} 
        onClose={() => setModalAssinatura(false)} 
        onConfirm={handleAssinaturaConcluida} // Recebe o desenho e envia para o Firestore
      />

    </div>
  );
}

// Subcomponente visual simples para mostrar os 4 blocos de horas
function CartaoPonto({ titulo, hora }: { titulo: string, hora?: string }) {
  return (
    <div style={{ backgroundColor: hora ? '#f0fdf4' : '#f8fafc', border: `1px solid ${hora ? '#bbf7d0' : '#e2e8f0'}`, padding: '15px', borderRadius: '10px', textAlign: 'center' }}>
      <span style={{ display: 'block', fontSize: '12px', color: '#64748b', fontWeight: 'bold', marginBottom: '5px' }}>{titulo}</span>
      <span style={{ display: 'block', fontSize: '20px', fontWeight: '900', color: hora ? '#166534' : '#cbd5e1', fontFamily: 'monospace' }}>
        {hora || '--:--'}
      </span>
    </div>
  );
}