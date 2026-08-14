// src/pages/TerminalPontoPublico.tsx
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase'; 
import { dbFolha } from '../services/firebaseFolha'; 

import { Clock, Fingerprint, Search, AlertCircle, CheckCircle2, User, LogOut, ChevronRight, MapPin, MapPinOff, RefreshCw } from 'lucide-react';
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
  
  const [localizacaoAtual, setLocalizacaoAtual] = useState<{lat: number, lng: number} | null>(null);
  const [erroGpsVisual, setErroGpsVisual] = useState('');
  const [carregandoGps, setCarregandoGps] = useState(false);

  const [sucesso, setSucesso] = useState({ visivel: false, mensagem: '', horaExata: '' });

  useEffect(() => {
    const timer = setInterval(() => setHoraAtual(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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

  const carregarPontoFuncionario = async (funcionarioId: string) => {
    const dataHojeStr = new Date().toISOString().split('T')[0];
    const idRegistro = `${funcionarioId}_${dataHojeStr}`;
    
    const docRef = doc(dbFolha, 'registros_ponto', idRegistro);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      setRegistroHoje(docSnap.data());
    } else {
      setRegistroHoje({}); 
    }
  };

  const obterLocalizacao = (): Promise<{lat: number, lng: number}> => {
    setCarregandoGps(true);
    setErroGpsVisual(''); 
    
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        setCarregandoGps(false);
        reject(new Error("O seu navegador ou aparelho não suporta GPS."));
        return;
      }
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCarregandoGps(false);
          resolve({ lat: position.coords.latitude, lng: position.coords.longitude });
        },
        (err) => {
          setCarregandoGps(false);
          switch(err.code) {
            case err.PERMISSION_DENIED:
              reject(new Error("Autorização negada. Por favor, permita o acesso à localização nas configurações do seu navegador ou telemóvel para conseguir bater o ponto."));
              break;
            case err.POSITION_UNAVAILABLE:
              reject(new Error("Sinal de GPS indisponível. Vá para um local mais aberto ou ative a localização (GPS) do seu telemóvel."));
              break;
            case err.TIMEOUT:
              reject(new Error("Demorou muito para encontrar o sinal de GPS. Verifique a sua conexão e tente novamente."));
              break;
            default:
              reject(new Error("Ocorreu um erro desconhecido ao tentar obter a sua localização."));
              break;
          }
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 } 
      );
    });
  };

  useEffect(() => {
    if (funcionario) {
      obterLocalizacao()
        .then(coords => {
          setLocalizacaoAtual(coords);
          setErroGpsVisual('');
        })
        .catch(err => {
          setErroGpsVisual(err.message);
          setLocalizacaoAtual(null);
        });
    } else {
      setLocalizacaoAtual(null);
      setErroGpsVisual('');
    }
  }, [funcionario]);

  const tentarNovamenteGPS = () => {
    obterLocalizacao()
      .then(coords => {
        setLocalizacaoAtual(coords);
        setErroGpsVisual('');
      })
      .catch(err => {
        setErroGpsVisual(err.message);
        setLocalizacaoAtual(null);
      });
  };

  const iniciarBatidaPonto = async () => {
    if (!funcionario) return;

    if (!localizacaoAtual) {
      setErro("A localização é obrigatória. Permita o acesso ao GPS antes de continuar.");
      return;
    }

    let qualPonto: 'entrada1' | 'saida1' | 'entrada2' | 'saida2' | null = null;
    if (!registroHoje?.entrada1) qualPonto = 'entrada1';
    else if (!registroHoje?.saida1) qualPonto = 'saida1';
    else if (!registroHoje?.entrada2) qualPonto = 'entrada2';
    else if (!registroHoje?.saida2) qualPonto = 'saida2';

    if (!qualPonto) {
      setErro("Todos os pontos já foram registados hoje!");
      return;
    }

    setErro('');
    setProximoPonto(qualPonto);

    if (qualPonto === 'saida2') {
      setModalAssinatura(true); 
    } else {
      gravarPontoNoBanco(qualPonto, '', localizacaoAtual); 
    }
  };

  const gravarPontoNoBanco = async (campoPonto: string, assinaturaBase64: string, coords?: {lat: number, lng: number} | null) => {
    const dataHojeStr = new Date().toISOString().split('T')[0];
    
    // ✨ ATUALIZAÇÃO: Guardar a hora com SEGUNDOS no banco de dados para o Terminal exibir
    const horaParaBancoComSegundos = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    const idRegistro = `${funcionario.id}_${dataHojeStr}`;
    const docRef = doc(dbFolha, 'registros_ponto', idRegistro);

    try {
      const dadosAtualizar: any = {
        funcionarioId: funcionario.id,
        nomeFuncionario: funcionario.nome,
        data: dataHojeStr,
        [campoPonto]: horaParaBancoComSegundos,
        ultimaAtualizacao: serverTimestamp()
      };

      if (coords) {
        dadosAtualizar[`${campoPonto}_local`] = `https://maps.google.com/?q=${coords.lat},${coords.lng}`;
      }

      if (assinaturaBase64) {
        dadosAtualizar.assinatura = assinaturaBase64;
      }

      await setDoc(docRef, dadosAtualizar, { merge: true });

      setRegistroHoje({ ...registroHoje, ...dadosAtualizar });
      setModalAssinatura(false);
      
      setSucesso({ 
        visivel: true, 
        mensagem: 'Ponto registado com sucesso!', 
        horaExata: horaParaBancoComSegundos 
      });

    } catch (error) {
      setErro("Erro ao registar o ponto no servidor. Tente novamente.");
    }
  };

  const dataFormatada = horaAtual.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const horaFormatada = horaAtual.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const segundosFormatados = horaAtual.toLocaleTimeString('pt-BR', { second: '2-digit' }).split(':')[2];

  const CartaoHorario = ({ titulo, hora }: { titulo: string, hora?: string }) => {
    const preenchido = hora && hora !== '--:--';
    return (
      <div style={{ 
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '12px 2px', borderRadius: '12px', 
        backgroundColor: preenchido ? '#f0fdf4' : '#f8fafc', border: preenchido ? '1px solid #bbf7d0' : '1px dashed #cbd5e1',
        transition: 'all 0.3s ease'
      }}>
        <span style={{ fontSize: '10px', color: preenchido ? '#166534' : '#64748b', fontWeight: 'bold', marginBottom: '4px', textAlign: 'center' }}>
          {titulo}
        </span>
        {preenchido ? (
          <strong style={{ fontSize: '15px', color: '#15803d', display: 'flex', alignItems: 'center', gap: '2px', letterSpacing: '-0.5px' }}>
            {hora} <CheckCircle2 size={12} color="#22c55e" />
          </strong>
        ) : (
          <strong style={{ fontSize: '15px', color: '#cbd5e1' }}>--:--:--</strong>
        )}
      </div>
    );
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f1f5f9', backgroundImage: 'radial-gradient(#e2e8f0 1px, transparent 1px)', backgroundSize: '20px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '450px', borderRadius: '24px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
        
        <div style={{ backgroundColor: '#0f172a', padding: '35px 20px', textAlign: 'center', color: 'white', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-50%', left: '-20%', width: '200px', height: '200px', background: 'radial-gradient(circle, rgba(59,130,246,0.2) 0%, rgba(0,0,0,0) 70%)', borderRadius: '50%' }}></div>
          <div style={{ position: 'absolute', bottom: '-50%', right: '-20%', width: '200px', height: '200px', background: 'radial-gradient(circle, rgba(16,185,129,0.2) 0%, rgba(0,0,0,0) 70%)', borderRadius: '50%' }}></div>
          
          <div style={{ position: 'relative', zIndex: 1 }}>
            <h2 style={{ margin: 0, color: '#94a3b8', fontSize: '14px', textTransform: 'capitalize', fontWeight: '500' }}>{dataFormatada}</h2>
            
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '4px', margin: '15px 0' }}>
              <span style={{ fontSize: '64px', fontWeight: '800', letterSpacing: '-2px', lineHeight: '1' }}>{horaFormatada}</span>
              <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981' }}>:{segundosFormatados}</span>
            </div>
            
            <p style={{ margin: 0, color: '#64748b', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <MapPin size={14} /> Terminal Integrado c/ GPS
            </p>
          </div>
        </div>

        <div style={{ padding: '30px' }}>
          {!funcionario ? (
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
              </div>

              <Button type="submit" style={{ height: '55px', backgroundColor: '#3b82f6', fontSize: '16px', borderRadius: '12px', fontWeight: 'bold' }}>
                Continuar <ChevronRight size={20} />
              </Button>
            </form>
          ) : (
            <div style={{ animation: 'fadeIn 0.5s' }}>
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
                  onClick={() => {setFuncionario(null); setMatricula(''); setErro(''); setLocalizacaoAtual(null); setErroGpsVisual('');}} 
                  style={{ background: '#f1f5f9', border: 'none', color: '#64748b', padding: '8px', borderRadius: '50%', cursor: 'pointer', transition: 'background 0.2s' }}
                  title="Sair"
                >
                  <LogOut size={18} />
                </button>
              </div>

              {carregandoGps ? (
                <div style={{ marginBottom: '25px', padding: '20px', borderRadius: '16px', backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1', textAlign: 'center', color: '#64748b', fontSize: '13px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <MapPin size={24} color="#94a3b8" style={{ animation: 'pulse 1.5s infinite' }} />
                  A procurar satélites e localização GPS...
                </div>
              ) : erroGpsVisual ? (
                <div style={{ marginBottom: '25px', padding: '20px', borderRadius: '16px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <MapPinOff size={24} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <strong style={{ display: 'block', color: '#991b1b', fontSize: '14px', marginBottom: '4px' }}>Localização Obrigatória</strong>
                      <p style={{ margin: 0, color: '#b91c1c', fontSize: '12px', lineHeight: '1.4' }}>{erroGpsVisual}</p>
                    </div>
                  </div>
                  <Button onClick={tentarNovamenteGPS} style={{ backgroundColor: 'white', color: '#ef4444', border: '1px solid #fca5a5', width: '100%', display: 'flex', justifyContent: 'center', gap: '8px', fontSize: '13px' }}>
                    <RefreshCw size={14} /> Tentar Ler Localização Novamente
                  </Button>
                </div>
              ) : localizacaoAtual ? (
                <div style={{ marginBottom: '25px', borderRadius: '16px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                  <iframe
                    width="100%"
                    height="160"
                    style={{ border: 0, display: 'block' }}
                    loading="lazy"
                    allowFullScreen
                    src={`https://maps.google.com/maps?q=${localizacaoAtual.lat},${localizacaoAtual.lng}&z=16&output=embed`}
                  />
                  <div style={{ padding: '8px', backgroundColor: '#f8fafc', fontSize: '11px', color: '#475569', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: 'bold', borderTop: '1px solid #e2e8f0' }}>
                    <MapPin size={12} color="#3b82f6" /> Localização verificada por GPS
                  </div>
                </div>
              ) : null}

              {erro && (
                <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', padding: '12px', borderRadius: '8px', marginBottom: '15px', color: '#b45309', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertCircle size={16} style={{ flexShrink: 0 }} /> {erro}
                </div>
              )}

              <div style={{ marginBottom: '30px' }}>
                <h4 style={{ fontSize: '13px', color: '#475569', margin: '0 0 15px 0', fontWeight: 'bold', textTransform: 'uppercase' }}>Registos de Hoje</h4>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <CartaoHorario titulo="ENTRADA" hora={registroHoje?.entrada1} />
                  <CartaoHorario titulo="SAÍDA" hora={registroHoje?.saida1} />
                  <CartaoHorario titulo="RETORNO" hora={registroHoje?.entrada2} />
                  <CartaoHorario titulo="FIM" hora={registroHoje?.saida2} />
                </div>
              </div>

              {!registroHoje?.saida2 ? (
                <Button 
                  onClick={iniciarBatidaPonto} 
                  disabled={carregandoGps || !localizacaoAtual}
                  style={{ 
                    width: '100%', height: '65px', fontSize: '18px', fontWeight: '800', borderRadius: '16px',
                    backgroundColor: localizacaoAtual ? '#10b981' : '#cbd5e1', 
                    color: localizacaoAtual ? 'white' : '#64748b', 
                    display: 'flex', justifyContent: 'center', gap: '12px',
                    boxShadow: localizacaoAtual ? '0 10px 15px -3px rgba(16, 185, 129, 0.3)' : 'none', 
                    transition: 'all 0.3s',
                    cursor: localizacaoAtual ? 'pointer' : 'not-allowed'
                  }}
                >
                  {carregandoGps ? (
                    <><MapPin size={24} style={{ animation: 'pulse 1s infinite' }}/> Procurando Sinal...</>
                  ) : !localizacaoAtual ? (
                    <><MapPinOff size={24} /> Libere o GPS para Bater</>
                  ) : (
                    <><Fingerprint size={24} /> Bater Ponto Agora</>
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

      <ModalAssinaturaPonto 
        aberto={modalAssinatura} 
        onClose={() => {
          setModalAssinatura(false);
          setLocalizacaoAtual(null); 
        }} 
        onConfirm={(base64) => {
          if (proximoPonto && localizacaoAtual) gravarPontoNoBanco(proximoPonto, base64, localizacaoAtual);
        }} 
      />

      {sucesso.visivel && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.85)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)', padding: '20px' }}>
           <div style={{ backgroundColor: 'white', borderRadius: '24px', padding: '40px 30px', textAlign: 'center', maxWidth: '400px', width: '100%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}>
              
              <div style={{ backgroundColor: '#dcfce7', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto', boxShadow: '0 0 0 10px #f0fdf4' }}>
                 <CheckCircle2 size={40} color="#16a34a" />
              </div>
              
              <h2 style={{ margin: '0 0 10px 0', color: '#1e293b', fontSize: '24px', fontWeight: '800' }}>Ponto Registado!</h2>
              <p style={{ margin: '0 0 20px 0', color: '#64748b', fontSize: '15px' }}>{sucesso.mensagem}</p>
              
              <div style={{ fontSize: '40px', fontWeight: '900', color: '#10b981', fontFamily: 'monospace', letterSpacing: '-1px', marginBottom: '30px', backgroundColor: '#f0fdf4', padding: '15px', borderRadius: '16px', border: '1px solid #bbf7d0' }}>
                {sucesso.horaExata}
              </div>
              
              <Button 
                onClick={() => {
                  setSucesso({ visivel: false, mensagem: '', horaExata: '' });
                  setFuncionario(null); 
                  setMatricula('');
                  setLocalizacaoAtual(null);
                }} 
                style={{ width: '100%', height: '55px', fontSize: '16px', backgroundColor: '#3b82f6', borderRadius: '12px', fontWeight: 'bold' }}
              >
                Fechar e Continuar
              </Button>
           </div>
        </div>
      )}
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(40px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}