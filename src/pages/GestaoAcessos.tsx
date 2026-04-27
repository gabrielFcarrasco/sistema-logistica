import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Shield, UserPlus, CheckCircle2, AlertCircle, Building2, Mail, Globe, Copy, HelpCircle, Power, PowerOff, Info, MessageCircle } from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

interface Setor { id: string; nome: string; }
interface Usuario { id: string; nome: string; email: string; nivel: string; whatsapp: string; setorId?: string; status: string; }

export default function GestaoAcessos() {
  const [setores, setSetores] = useState<Setor[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  
  // Estados do Formulário
  const [nome, setNome] = useState('');
  const [matricula, setMatricula] = useState('');
  const [cpf, setCpf] = useState('');
  const [rg, setRg] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [nivel, setNivel] = useState('responsavel');
  const [setorId, setSetorId] = useState('');

  const [emailGerado, setEmailGerado] = useState('');
  const [mostrarTutorial, setMostrarTutorial] = useState(false);
  const [notificacao, setNotificacao] = useState<{msg: string, tipo: 'sucesso' | 'erro'} | null>(null);

  const avisar = (msg: string, tipo: 'sucesso' | 'erro' = 'sucesso') => {
    setNotificacao({ msg, tipo });
    setTimeout(() => setNotificacao(null), 4000);
  };

  useEffect(() => {
    const unsubSetores = onSnapshot(collection(db, 'setores'), (s) => setSetores(s.docs.map(d => ({ id: d.id, nome: d.data().nome }))));
    const unsubUsuarios = onSnapshot(collection(db, 'usuarios'), (s) => setUsuarios(s.docs.map(d => ({ id: d.id, ...d.data() } as Usuario))));
    return () => { unsubSetores(); unsubUsuarios(); };
  }, []);

  useEffect(() => {
    if (nome) {
      const partes = nome.trim().split(' ');
      const primeiroNome = partes[0].toLowerCase();
      const ultimoNome = partes.length > 1 ? partes[partes.length - 1].toLowerCase() : '';
      const limpaString = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
      const base = limpaString(primeiroNome + ultimoNome);
      
      let emailTentativa = `${base}@carvalho.com`;
      if (usuarios.some(u => u.email === emailTentativa) && matricula) {
        emailTentativa = `${base}${matricula}@carvalho.com`;
      }
      setEmailGerado(emailTentativa);
    } else {
      setEmailGerado('');
    }
  }, [nome, matricula, usuarios]);

  const cadastrarUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !matricula || !whatsapp) return avisar("Preencha Nome, Matrícula e WhatsApp.", "erro");
    if (!cpf && !rg) return avisar("Preencha pelo menos um documento (CPF ou RG).", "erro");
    if (nivel === 'responsavel' && !setorId) return avisar("Vincule a uma unidade.", "erro");

    try {
      await addDoc(collection(db, 'usuarios'), {
        nome, matricula, cpf: cpf || '', rg: rg || '', email: emailGerado, whatsapp, nivel,
        setorId: nivel === 'socio' ? 'todas' : setorId, status: 'pendente_senha', createdAt: serverTimestamp()
      });
      avisar("Usuário criado! Copie o link e envie para o funcionário.");
      setNome(''); setMatricula(''); setCpf(''); setRg(''); setWhatsapp(''); setSetorId('');
    } catch (error) {
      avisar("Erro ao criar usuário.", "erro");
    }
  };

  const gerarLink = (id: string) => `${window.location.origin}/setup-senha?id=${id}`;

  // FÁBRICA DE MENSAGENS COM PASSO A PASSO
  const gerarTextoMensagem = (usuario: Usuario) => {
    const linkSetup = gerarLink(usuario.id);
    const linkSistema = 'https://logisticacarvalho.vercel.app/';

    return `Olá *${usuario.nome.split(' ')[0]}*! Bem-vindo(a) ao ERP Carvalho. 🏢\n\n` +
           `Seu perfil de acesso foi criado. Siga o passo a passo abaixo para entrar no sistema:\n\n` +
           `1️⃣ *Crie sua Senha:*\nClique neste link seguro e digite uma senha de 6 números:\n🔗 ${linkSetup}\n\n` +
           `2️⃣ *Acesse o Sistema:*\nDepois de criar a senha, abra o link oficial do sistema:\n🔗 ${linkSistema}\n\n` +
           `🔒 *GUARDE SEUS DADOS DE LOGIN:*\n` +
           `👤 *Usuário:* ${usuario.email}\n` +
           `🔑 *Senha:* (Os 6 números que você criou)\n\n` +
           `_Em caso de dúvidas, procure seu gestor._`;
  };

  const copiarMensagem = (usuario: Usuario) => {
    const texto = gerarTextoMensagem(usuario);
    navigator.clipboard.writeText(texto);
    avisar("Mensagem copiada! Agora é só colar no WhatsApp da pessoa.");
  };

  const alternarStatusUsuario = async (usuario: Usuario) => {
    if (usuario.nivel === 'socio' && usuarios.filter(u => u.nivel === 'socio' && u.status === 'ativo').length <= 1 && usuario.status === 'ativo') {
      return avisar("Você não pode desligar o único sócio ativo do sistema.", "erro");
    }

    const novoStatus = usuario.status === 'ativo' ? 'inativo' : 'ativo';
    try {
      await updateDoc(doc(db, 'usuarios', usuario.id), { status: novoStatus });
      avisar(`Acesso de ${usuario.nome} foi ${novoStatus === 'inativo' ? 'bloqueado' : 'liberado'} com sucesso.`);
    } catch (error) {
      avisar("Erro ao alterar o status do usuário.", "erro");
    }
  };

  const getNomeSetor = (id?: string) => {
    if (!id || id === 'todas') return 'Todas as Unidades';
    const setor = setores.find(s => s.id === id);
    return setor ? setor.nome : 'Unidade Excluída';
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '40px', padding: '10px' }}>
      
      {notificacao && (
        <div style={{ position: 'fixed', top: '10px', left: '10px', right: '10px', zIndex: 100, backgroundColor: notificacao.tipo === 'sucesso' ? '#10b981' : '#ef4444', color: 'white', padding: '15px', borderRadius: '8px', display: 'flex', gap: '10px', alignItems: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          {notificacao.tipo === 'sucesso' ? <CheckCircle2 shrink={0} /> : <AlertCircle shrink={0} />} 
          <span style={{ fontSize: '14px' }}>{notificacao.msg}</span>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', marginTop: '10px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Shield size={28} color="var(--cor-primaria)" />
          <h1 style={{ fontSize: '22px', color: '#1e293b', margin: 0 }}>Gestão de Acessos</h1>
        </div>
        <Button onClick={() => setMostrarTutorial(!mostrarTutorial)} style={{ backgroundColor: '#f1f5f9', color: '#475569', fontSize: '14px', padding: '8px 15px', display: 'flex', gap: '8px' }}>
          <HelpCircle size={18} /> {mostrarTutorial ? 'Ocultar Ajuda' : 'Como Usar?'}
        </Button>
      </div>

      {/* TUTORIAL PARA OS SÓCIOS */}
      {mostrarTutorial && (
        <div style={{ backgroundColor: '#e0e7ff', border: '1px solid #c7d2fe', padding: '20px', borderRadius: '12px', marginBottom: '20px' }}>
          <h4 style={{ color: '#3730a3', margin: '0 0 15px 0', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Info size={20} /> Guia Rápido de Gestão
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', fontSize: '14px', color: '#4338ca' }}>
            <div>
              <strong>1. Como dar acesso a alguém?</strong><br/>
              Preencha o formulário abaixo. O sistema vai gerar um E-mail automático. Clique em "Gerar Acesso". Depois, basta clicar em "Copiar Convite" na lista e mandar no WhatsApp da pessoa.
            </div>
            <div>
              <strong>2. Como o funcionário entra?</strong><br/>
              Ele clica no link que você enviou, cria a senha de 6 números dele e o status aqui mudará de "Pendente" para "Ativo" automaticamente.
            </div>
            <div>
              <strong>3. Como desligar alguém?</strong><br/>
              Se um gerente for desligado da empresa, ache ele na lista e clique em "Desligar Acesso". A conta dele é bloqueada na hora, impedindo o login.
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100%, 1fr))', gap: '20px' }}>
        
        {/* FORMULÁRIO DE NOVO USUÁRIO */}
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: 'var(--sombra-card)', height: 'fit-content' }}>
          <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', color: '#1e293b' }}>
            <UserPlus size={20} color="var(--cor-primaria)"/> Novo Acesso
          </h3>
          
          <form onSubmit={cadastrarUsuario} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
              <div style={{ flex: '1 1 200px' }}>
                <Input label="Nome Completo *" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: João Silva" />
              </div>
              <div style={{ flex: '1 1 100px' }}>
                <Input label="Matrícula *" value={matricula} onChange={e => setMatricula(e.target.value)} placeholder="Ex: 11" />
              </div>
            </div>

            {emailGerado && (
              <div style={{ backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1', padding: '12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Mail size={18} color="#64748b" style={{ flexShrink: 0 }} />
                <div style={{ overflow: 'hidden' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', display: 'block', fontWeight: 'bold' }}>USUÁRIO DE ACESSO GERADO</span>
                  <span style={{ fontSize: '14px', color: '#1e293b', fontWeight: '500', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emailGerado}</span>
                </div>
              </div>
            )}
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
              <div style={{ flex: '1 1 120px' }}>
                <Input label="CPF" value={cpf} onChange={e => setCpf(e.target.value)} placeholder="Apenas números" />
              </div>
              <div style={{ flex: '1 1 120px' }}>
                <Input label="RG" value={rg} onChange={e => setRg(e.target.value)} placeholder="Apenas números" />
              </div>
              <div style={{ flex: '1 1 150px' }}>
                <Input label="WhatsApp *" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="(11) 99999-9999" />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '13px', color: '#64748b', fontWeight: 'bold' }}>Nível de Permissão</label>
              <select value={nivel} onChange={e => setNivel(e.target.value)} style={{ width: '100%', padding: '14px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '5px', fontSize: '15px', backgroundColor: 'white' }}>
                <option value="responsavel">Responsável de Unidade</option>
                <option value="socio">Sócio / Admin (Visão Total)</option>
              </select>
            </div>

            {nivel === 'responsavel' ? (
              <div>
                <label style={{ fontSize: '13px', color: '#64748b', fontWeight: 'bold' }}>Unidade Principal</label>
                <select value={setorId} onChange={e => setSetorId(e.target.value)} style={{ width: '100%', padding: '14px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '5px', fontSize: '15px', backgroundColor: 'white' }}>
                  <option value="">Selecione a unidade...</option>
                  {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
              </div>
            ) : (
              <div style={{ padding: '14px', backgroundColor: '#f5f3ff', border: '1px dashed #8b5cf6', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px' }}>
                <Globe size={20} color="#8b5cf6" />
                <span style={{ fontSize: '14px', color: '#4c1d95', fontWeight: '500' }}>Este usuário terá acesso irrestrito a todas as unidades.</span>
              </div>
            )}

            <Button type="submit" style={{ marginTop: '10px', height: '50px', fontSize: '16px' }} variante="primaria">
              Gerar Acesso
            </Button>
          </form>
        </div>

        {/* LISTA DE USUÁRIOS */}
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: 'var(--sombra-card)' }}>
          <h3 style={{ marginBottom: '15px', fontSize: '16px', color: '#1e293b' }}>Equipe e Acessos</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {usuarios.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: '14px', textAlign: 'center' }}>Nenhum usuário cadastrado.</p>
            ) : (
              usuarios.map(user => (
                <div key={user.id} style={{ border: '1px solid #e2e8f0', padding: '15px', borderRadius: '8px', display: 'flex', flexWrap: 'wrap', gap: '15px', justifyContent: 'space-between', alignItems: 'flex-start', backgroundColor: user.status === 'inativo' ? '#f8fafc' : 'white', opacity: user.status === 'inativo' ? 0.7 : 1 }}>
                  
                  <div style={{ flex: '1 1 200px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ color: '#1e293b', fontSize: '15px', textDecoration: user.status === 'inativo' ? 'line-through' : 'none' }}>{user.nome}</strong>
                      {/* Badge de Status Inteligente */}
                      {user.status === 'pendente_senha' && <span style={{ fontSize: '10px', backgroundColor: '#fef08a', color: '#854d0e', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>PENDENTE</span>}
                      {user.status === 'ativo' && <span style={{ fontSize: '10px', backgroundColor: '#d1fae5', color: '#065f46', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>ATIVO</span>}
                      {user.status === 'inativo' && <span style={{ fontSize: '10px', backgroundColor: '#fee2e2', color: '#991b1b', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>DESLIGADO</span>}
                    </div>
                    
                    <span style={{ fontSize: '12px', color: user.nivel === 'socio' ? '#8b5cf6' : '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px', fontWeight: user.nivel === 'socio' ? 'bold' : 'normal' }}>
                      {user.nivel === 'socio' ? <Shield size={14} color="#8b5cf6" /> : <Building2 size={14} color="#3b82f6" />} 
                      {user.nivel === 'socio' ? 'SÓCIO - Acesso Global' : `Gestor: ${getNomeSetor(user.setorId)}`}
                    </span>
                    <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginTop: '4px' }}>{user.email}</span>
                  </div>

                  <div style={{ flex: '1 1 100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    
                    {/* SE ESTIVER PENDENTE: Mostra o link, botão de Copiar e Botão do WhatsApp */}
                    {user.status === 'pendente_senha' && (
                      <div style={{ backgroundColor: '#fffbeb', border: '1px dashed #fcd34d', padding: '12px', borderRadius: '8px' }}>
                        <p style={{ fontSize: '12px', color: '#b45309', margin: '0 0 8px 0', fontWeight: '500' }}>⚠️ Falta criar a senha. Envie este link para o funcionário:</p>
                        
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <input 
                            type="text" 
                            readOnly 
                            value={gerarLink(user.id)} 
                            style={{ flex: '1 1 150px', padding: '8px', fontSize: '12px', borderRadius: '6px', border: '1px solid #fde68a', backgroundColor: 'white', color: '#94a3b8' }}
                          />
                          
                          <div style={{ display: 'flex', gap: '8px', flex: '1 1 auto' }}>
                            <Button onClick={() => copiarMensagem(user)} style={{ backgroundColor: '#f59e0b', color: 'white', padding: '8px 12px', fontSize: '13px', display: 'flex', gap: '6px', flex: 1, justifyContent: 'center' }}>
                              <Copy size={16} /> Copiar
                            </Button>

                            <Button onClick={() => {
                                const texto = gerarTextoMensagem(user);
                                window.open(`https://wa.me/55${user.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`, '_blank');
                              }} 
                              style={{ backgroundColor: '#25D366', color: 'white', padding: '8px 12px', fontSize: '13px', display: 'flex', gap: '6px', flex: 1, justifyContent: 'center' }}
                            >
                              <MessageCircle size={16} /> WhatsApp
                            </Button>
                          </div>
                        </div>
                        
                      </div>
                    )}

                    {/* SE ESTIVER ATIVO OU INATIVO: Mostra a opção de ligar/desligar */}
                    {(user.status === 'ativo' || user.status === 'inativo') && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
                        {user.status === 'ativo' ? (
                          <Button onClick={() => alternarStatusUsuario(user)} style={{ backgroundColor: '#fee2e2', color: '#ef4444', border: '1px solid #fca5a5', padding: '8px 15px', fontSize: '12px', display: 'flex', gap: '6px' }}>
                            <PowerOff size={16} /> Desligar Acesso
                          </Button>
                        ) : (
                          <Button onClick={() => alternarStatusUsuario(user)} style={{ backgroundColor: '#ecfdf5', color: '#10b981', border: '1px solid #6ee7b7', padding: '8px 15px', fontSize: '12px', display: 'flex', gap: '6px' }}>
                            <Power size={16} /> Reativar Acesso
                          </Button>
                        )}
                      </div>
                    )}

                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}