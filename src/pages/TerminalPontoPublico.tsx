// src/pages/TerminalPontoPublico.tsx
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc, setDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase'; 
import { dbFolha } from '../services/firebaseFolha'; 

import { Clock, Fingerprint, AlertCircle, CheckCircle2, User, LogOut, ChevronRight, MapPin, MapPinOff, RefreshCw, FileSignature, Navigation, HelpCircle } from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import ModalAssinaturaPonto from '../components/ponto/ModalAssinaturaPonto';

// 🔓 ACESSO LIBERADO: A função de calcular distância matemática foi totalmente removida do topo do arquivo.

export default function TerminalPontoPublico() {
  const [horaAtual, setHoraAtual] = useState(new Date());
  const [matricula, setMatricula] = useState('');
  
  const [funcionario, setFuncionario] = useState<any>(null);
  const [registroHoje, setRegistroHoje] = useState<any>(null);
  const [erro, setErro] = useState('');

  const [modalAssinatura, setModalAssinatura] = useState(false);
  const [proximoPonto, setProximoPonto] = useState<'entrada1' | 'saida1' | 'entrada2' | 'saida2' | null>(null);
  
  const [diasPendentesAssinatura, setDiasPendentesAssinatura] = useState<any[]>([]);
  const [modoAssinatura, setModoAssinatura] = useState<'retroativa' | 'saida_hoje' | null>(null);

  const [localizacaoAtual, setLocalizacaoAtual] = useState<{lat: number, lng: number} | null>(null);
  const [erroGpsVisual, setErroGpsVisual] = useState('');
  const [carregandoGps, setCarregandoGps] = useState(false);
  const [tipoErroGps, setTipoErroGps] = useState<'permissao' | 'indisponivel' | null>(null);

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
        return;
      }

      const funcData = { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() };
      if ((funcData as any).status === 'desligado') {
        setErro('Colaborador inativo no sistema.');
        return;
      }

      await carregarPontoFuncionario(funcData.id);
      setFuncionario(funcData);
      
      setLocalizacaoAtual(null);
      setErroGpsVisual('');
      setTipoErroGps(null);

    } catch (error: any) {
      setErro('Erro ao carregar dados. Verifique sua internet ou tente novamente.');
      setFuncionario(null);
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

    const qPendencias = query(collection(dbFolha, 'registros_ponto'), where('funcionarioId', '==', funcionarioId));
    const snapPendencias = await getDocs(qPendencias);
    
    const pendentes = snapPendencias.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter((r: any) => {
        const dataAntiga = r.data < dataHojeStr;
        const semAssinatura = !r.assinatura;
        const temRegistroRelevante = r.entrada1 || r.statusDia;
        return dataAntiga && semAssinatura && temRegistroRelevante;
      });
    
    pendentes.sort((a: any, b: any) => a.data.localeCompare(b.data));
    setDiasPendentesAssinatura(pendentes);
  };

  const acionarGpsManual = () => {
    setCarregandoGps(true);
    setErroGpsVisual(''); 
    setTipoErroGps(null);
    
    if (!navigator.geolocation) {
      setCarregandoGps(false);
      setErroGpsVisual("O seu aparelho ou navegador não suporta a função de GPS.");
      return;
    }
    
    // 🔓 ACESSO LIBERADO: Tiramos a trava de precisão. O que o celular mandar, o sistema aceita!
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCarregandoGps(false);
        setLocalizacaoAtual({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      (err) => {
        setCarregandoGps(false);
        switch(err.code) {
          case err.PERMISSION_DENIED:
            setTipoErroGps('permissao');
            setErroGpsVisual("O seu navegador (Chrome/Safari) está bloqueando o acesso à localização.");
            break;
          case err.POSITION_UNAVAILABLE:
          case err.TIMEOUT:
            setTipoErroGps('indisponivel');
            setErroGpsVisual("Não foi possível encontrar o sinal do GPS do seu aparelho.");
            break;
          default:
            setErroGpsVisual("Erro desconhecido ao obter a localização.");
            break;
        }
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 } 
    );
  };

  const iniciarBatidaPonto = async () => {
    if (!funcionario) return;

    if (!localizacaoAtual) {
      setErro("Você precisa capturar sua localização antes de continuar.");
      return;
    }

    // 🔓 ACESSO LIBERADO: Toda a lógica de medir distância para o Galpão 1 e Galpão 2 foi apagada daqui.

    let qualPonto: 'entrada1' | 'saida1' | 'entrada2' | 'saida2' | null = null;
    if (!registroHoje?.entrada1) qualPonto = 'entrada1';
    else if (!registroHoje?.saida1) qualPonto = 'saida1';
    else if (!registroHoje?.entrada2) qualPonto = 'entrada2';
    else if (!registroHoje?.saida2) qualPonto = 'saida2';

    if (!qualPonto) {
      setErro("Todos os pontos já foram registrados hoje!");
      return;
    }

    setErro('');
    setProximoPonto(qualPonto);

    if (qualPonto === 'saida2') {
      setModoAssinatura('saida_hoje');
      setModalAssinatura(true); 
    } else {
      gravarPontoNoBanco(qualPonto, '', localizacaoAtual); 
    }
  };

  const iniciarAssinaturaRetroativa = () => {
    setModoAssinatura('retroativa');
    setModalAssinatura(true);
  };

  const handleConfirmarAssinatura = async (base64: string) => {
    if (modoAssinatura === 'retroativa') {
      try {
        const batch = writeBatch(dbFolha);
        diasPendentesAssinatura.forEach(dia => {
          batch.update(doc(dbFolha, 'registros_ponto', dia.id), {
            assinatura: base64,
            observacaoSistema: 'Assinatura regularizada pelo terminal'
          });
        });
        await batch.commit();
        setDiasPendentesAssinatura([]); 
        setModalAssinatura(false);
        setSucesso({ visivel: true, mensagem: 'Assinaturas pendentes regularizadas com sucesso! Você já pode registrar o ponto de hoje.', horaExata: 'OK' });
      } catch(e) {
        setErro("Erro ao assinar dias anteriores. Procure o RH.");
      }
    } else if (modoAssinatura === 'saida_hoje') {
      if (proximoPonto && localizacaoAtual) {
        gravarPontoNoBanco(proximoPonto, base64, localizacaoAtual);
      }
    }
  };

  const gravarPontoNoBanco = async (campoPonto: string, assinaturaBase64: string, coords?: {lat: number, lng: number} | null) => {
    const dataHojeStr = new Date().toISOString().split('T')[0];
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

      // 🗺️ AUDITORIA: Salva o link do mapa no banco para o RH conferir depois
      if (coords) dadosAtualizar[`${campoPonto}_local`] = `https://maps.google.com/?q=${coords.lat},${coords.lng}`;
      if (assinaturaBase64) dadosAtualizar.assinatura = assinaturaBase64;

      await setDoc(docRef, dadosAtualizar, { merge: true });

      setRegistroHoje({ ...registroHoje, ...dadosAtualizar });
      setModalAssinatura(false);
      
      setSucesso({ visivel: true, mensagem: 'Ponto registrado com sucesso!', horaExata: horaParaBancoComSegundos });

    } catch (error) {
      setErro("Erro ao registrar o ponto no servidor. Tente novamente.");
    }
  };

  const dataFormatada = horaAtual.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const horaCompleta = horaAtual.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const CartaoHorario = ({ titulo, hora }: { titulo: string, hora?: string }) => {
    const preenchido = hora && hora !== '--:--';
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '12px 2px', borderRadius: '12px', backgroundColor: preenchido ? '#f0fdf4' : '#f8fafc', border: preenchido ? '1px solid #bbf7d0' : '1px dashed #cbd5e1', transition: 'all 0.3s ease' }}>
        <span style={{ fontSize: '10px', color: preenchido ? '#166534' : '#64748b', fontWeight: 'bold', marginBottom: '4px', textAlign: 'center' }}>{titulo}</span>
        {preenchido ? (
          <strong style={{ fontSize: '15px', color: '#15803d', display: 'flex', alignItems: 'center', gap: '2px', letterSpacing: '-0.5px' }}>{hora} <CheckCircle2 size={12} color="#22c55e" /></strong>
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '15px 0' }}>
              <span style={{ fontSize: '56px', fontWeight: '900', letterSpacing: '-1px', lineHeight: '1', fontFamily: 'monospace', color: 'white' }}>{horaCompleta}</span>
            </div>
            <p style={{ margin: 0, color: '#64748b', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><MapPin size={14} /> Terminal com Registro de GPS</p>
          </div>
        </div>

        <div style={{ padding: '30px' }}>
          {!funcionario ? (
            <form onSubmit={buscarFuncionario} style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.5s' }}>
              <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                <div style={{ width: '60px', height: '60px', backgroundColor: '#eff6ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px auto' }}><Fingerprint size={32} color="#3b82f6" /></div>
                <h3 style={{ margin: '0 0 5px 0', color: '#1e293b', fontSize: '20px', fontWeight: '800' }}>Olá, Colaborador!</h3>
                <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>Digite sua matrícula para acessar.</p>
              </div>

              <div>
                <Input label="" value={matricula} onChange={e => setMatricula(e.target.value)} type="number" placeholder="Sua Matrícula (Ex: 1001)" style={{ textAlign: 'center', fontSize: '18px', padding: '15px', borderRadius: '12px', border: '2px solid #e2e8f0', backgroundColor: '#f8fafc' }} />
              </div>
              
              {erro && (
                <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', padding: '12px', borderRadius: '8px', color: '#b45309', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', lineHeight: '1.4' }}>
                  <AlertCircle size={20} style={{ flexShrink: 0 }} /> 
                  <strong>{erro}</strong>
                </div>
              )}

              <Button type="submit" style={{ height: '55px', backgroundColor: '#3b82f6', fontSize: '16px', borderRadius: '12px', fontWeight: 'bold' }}>Continuar <ChevronRight size={20} /></Button>
            </form>
          ) : (
            <div style={{ animation: 'fadeIn 0.5s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', paddingBottom: '20px', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '45px', height: '45px', backgroundColor: '#f0fdf4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><User size={24} color="#16a34a" /></div>
                  <div>
                    <h3 style={{ margin: 0, color: '#1e293b', fontSize: '16px', fontWeight: 'bold' }}>{funcionario.nome}</h3>
                    <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Matrícula: {funcionario.matricula}</p>
                  </div>
                </div>
                <button onClick={() => {setFuncionario(null); setMatricula(''); setErro(''); setLocalizacaoAtual(null); setErroGpsVisual(''); setDiasPendentesAssinatura([]); setTipoErroGps(null);}} style={{ background: '#f1f5f9', border: 'none', color: '#64748b', padding: '8px', borderRadius: '50%', cursor: 'pointer', transition: 'background 0.2s' }} title="Sair"><LogOut size={18} /></button>
              </div>

              {diasPendentesAssinatura.length > 0 ? (
                <div style={{ backgroundColor: '#fffbeb', border: '2px solid #fde68a', borderRadius: '16px', padding: '20px', textAlign: 'center' }}>
                  <FileSignature size={48} color="#d97706" style={{ margin: '0 auto 15px auto' }} />
                  <h3 style={{ margin: '0 0 10px 0', color: '#92400e', fontSize: '18px', fontWeight: '800' }}>Atenção, {funcionario.nome.split(' ')[0]}</h3>
                  
                  <p style={{ margin: '0 0 10px 0', color: '#b45309', fontSize: '13px', lineHeight: '1.5' }}>
                    Você possui <strong>{diasPendentesAssinatura.length} dia(s)</strong> anterior(es) com pendência de assinatura. Confira as datas abaixo:
                  </p>
                  
                  <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '10px', marginBottom: '15px', maxHeight: '100px', overflowY: 'auto', border: '1px solid #fde68a', textAlign: 'left' }}>
                    <ul style={{ margin: '0', paddingLeft: '20px', color: '#92400e', fontSize: '13px', lineHeight: '1.6' }}>
                      {diasPendentesAssinatura.map((dia, idx) => (
                        <li key={idx}>
                          <strong>{dia.data.split('-').reverse().join('/')}</strong> 
                          {dia.statusDia ? ` - (${dia.statusDia})` : ' - (Registro s/ Assinatura)'}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <p style={{ margin: '0 0 20px 0', color: '#b45309', fontSize: '13px', lineHeight: '1.5' }}>
                    Por favor, assine para regularizar a sua ficha nestes dias e liberar o ponto de hoje.
                  </p>

                  <Button 
                    onClick={iniciarAssinaturaRetroativa}
                    style={{ width: '100%', height: '55px', fontSize: '16px', fontWeight: 'bold', backgroundColor: '#d97706', color: 'white', borderRadius: '12px' }}
                  >
                    Regularizar Assinaturas
                  </Button>
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: '25px' }}>
                    <h4 style={{ fontSize: '13px', color: '#475569', margin: '0 0 15px 0', fontWeight: 'bold', textTransform: 'uppercase' }}>Registros de Hoje</h4>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <CartaoHorario titulo="ENTRADA" hora={registroHoje?.entrada1} />
                      <CartaoHorario titulo="SAÍDA" hora={registroHoje?.saida1} />
                      <CartaoHorario titulo="RETORNO" hora={registroHoje?.entrada2} />
                      <CartaoHorario titulo="FIM" hora={registroHoje?.saida2} />
                    </div>
                  </div>

                  {!registroHoje?.saida2 ? (
                    <div style={{ padding: '20px', backgroundColor: '#f8fafc', borderRadius: '16px', border: '1px solid #cbd5e1', marginBottom: '15px' }}>
                      <h4 style={{ fontSize: '14px', color: '#0f172a', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <MapPin size={18} color="#3b82f6" /> Localização
                      </h4>
                      <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 15px 0', lineHeight: '1.4' }}>
                        Precisamos salvar o local em que o seu registro foi feito.
                      </p>

                      {!localizacaoAtual ? (
                        <>
                          <Button 
                            onClick={acionarGpsManual} 
                            disabled={carregandoGps}
                            style={{ width: '100%', height: '55px', fontSize: '15px', fontWeight: 'bold', backgroundColor: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe', borderRadius: '12px', display: 'flex', justifyContent: 'center', gap: '8px' }}
                          >
                            {carregandoGps ? <><RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }}/> Carregando Local...</> : <><Navigation size={18} /> Confirmar Local Atual</>}
                          </Button>
                          
                          {erroGpsVisual && (
                            <div style={{ marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div style={{ padding: '12px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', color: '#b91c1c', fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'flex-start', lineHeight: '1.4', fontWeight: 'bold' }}>
                                  <MapPinOff size={18} style={{ flexShrink: 0, marginTop: '2px' }} /> 
                                  <span>{erroGpsVisual}</span>
                                </div>

                                {tipoErroGps === 'permissao' && (
                                  <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '15px' }}>
                                    <h5 style={{ margin: '0 0 8px 0', color: '#92400e', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}><HelpCircle size={14}/> Como permitir a localização:</h5>
                                    <ul style={{ margin: 0, paddingLeft: '20px', color: '#b45309', fontSize: '12px', lineHeight: '1.6' }}>
                                      <li><strong>No iPhone (Safari):</strong> Abra o app <strong>Ajustes</strong> &gt; Procure por <strong>Safari</strong> &gt; Role até <strong>Localização</strong> &gt; Marque <strong>"Permitir"</strong>.</li>
                                      <li><strong>No Android (Chrome):</strong> Toque no ícone de <strong>Cadeado</strong> ou <strong>Configurações</strong> ao lado do endereço do site (lá em cima) &gt; Permissões &gt; Permitir Localização.</li>
                                    </ul>
                                  </div>
                                )}
                                
                                {tipoErroGps === 'indisponivel' && (
                                  <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '15px' }}>
                                    <h5 style={{ margin: '0 0 8px 0', color: '#92400e', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}><HelpCircle size={14}/> Como resolver:</h5>
                                    <ul style={{ margin: 0, paddingLeft: '20px', color: '#b45309', fontSize: '12px', lineHeight: '1.6' }}>
                                      <li>Desligue e ligue o GPS (Localização) do seu celular.</li>
                                      <li>Certifique-se de que o modo "Economia de Bateria" não desligou o seu GPS.</li>
                                    </ul>
                                  </div>
                                )}
                            </div>
                          )}
                        </>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                          <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                            <iframe width="100%" height="120" style={{ border: 0, display: 'block' }} loading="lazy" src={`https://maps.google.com/maps?q=${localizacaoAtual.lat},${localizacaoAtual.lng}&z=16&output=embed`} />
                            <div style={{ padding: '6px', backgroundColor: '#dcfce7', fontSize: '11px', color: '#166534', textAlign: 'center', fontWeight: 'bold' }}>
                              Local salvo com sucesso!
                            </div>
                          </div>
                          
                          <Button 
                            onClick={iniciarBatidaPonto} 
                            style={{ width: '100%', height: '65px', fontSize: '18px', fontWeight: '800', borderRadius: '16px', backgroundColor: '#10b981', color: 'white', display: 'flex', justifyContent: 'center', gap: '12px', boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.3)', transition: 'all 0.3s' }}
                          >
                            <Fingerprint size={24} /> Bater Ponto Agora
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ padding: '20px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#15803d' }}><CheckCircle2 size={32} /><strong style={{ fontSize: '16px' }}>Expediente Concluído</strong><span style={{ fontSize: '13px' }}>Bom descanso!</span></div>
                  )}
                  
                  {erro && (
                    <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', padding: '12px', borderRadius: '8px', marginBottom: '15px', color: '#b45309', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', lineHeight: '1.4' }}>
                      <AlertCircle size={20} style={{ flexShrink: 0 }} /> <strong>{erro}</strong>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <ModalAssinaturaPonto 
        aberto={modalAssinatura} 
        onClose={() => { setModalAssinatura(false); setModoAssinatura(null); }} 
        onConfirm={handleConfirmarAssinatura} 
      />

      {sucesso.visivel && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.85)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)', padding: '20px' }}>
           <div style={{ backgroundColor: 'white', borderRadius: '24px', padding: '40px 30px', textAlign: 'center', maxWidth: '400px', width: '100%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}>
              <div style={{ backgroundColor: '#dcfce7', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto', boxShadow: '0 0 0 10px #f0fdf4' }}><CheckCircle2 size={40} color="#16a34a" /></div>
              <h2 style={{ margin: '0 0 10px 0', color: '#1e293b', fontSize: '24px', fontWeight: '800' }}>Sucesso!</h2>
              <p style={{ margin: '0 0 20px 0', color: '#64748b', fontSize: '15px' }}>{sucesso.mensagem}</p>
              
              {sucesso.horaExata !== 'OK' && (
                <div style={{ fontSize: '40px', fontWeight: '900', color: '#10b981', fontFamily: 'monospace', letterSpacing: '-1px', marginBottom: '30px', backgroundColor: '#f0fdf4', padding: '15px', borderRadius: '16px', border: '1px solid #bbf7d0' }}>{sucesso.horaExata}</div>
              )}
              
              <Button onClick={() => { setSucesso({ visivel: false, mensagem: '', horaExata: '' }); if(sucesso.horaExata !== 'OK'){setFuncionario(null); setMatricula(''); setLocalizacaoAtual(null);} }} style={{ width: '100%', height: '55px', fontSize: '16px', backgroundColor: '#3b82f6', borderRadius: '12px', fontWeight: 'bold' }}>Continuar</Button>
           </div>
        </div>
      )}
      
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(40px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}