// src/pages/SetupSenha.tsx
import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { LockKeyhole, CheckCircle2, AlertTriangle, Loader2, User, Mail, IdCard } from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

export default function SetupSenha() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const userId = searchParams.get('id');

  const [loading, setLoading] = useState(true);
  const [usuario, setUsuario] = useState<any>(null);
  
  // Estados do Formulário
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [cpfFaltante, setCpfFaltante] = useState('');
  const [rgFaltante, setRgFaltante] = useState('');
  
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    async function carregarUsuario() {
      if (!userId) {
        setErro("Link inválido. Por favor, solicite um novo convite ao seu gestor.");
        setLoading(false);
        return;
      }

      try {
        const docRef = doc(db, 'usuarios', userId);
        const snap = await getDoc(docRef);

        if (snap.exists()) {
          if (snap.data().status === 'ativo') {
            setErro("Este convite já foi utilizado e sua conta está ativa. Vá para a tela de Login.");
          } else {
            setUsuario(snap.data());
          }
        } else {
          setErro("Usuário não encontrado no sistema.");
        }
      } catch (err) {
        setErro("Erro ao conectar com o servidor.");
      }
      setLoading(false);
    }
    carregarUsuario();
  }, [userId]);

  const salvarDados = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    // Validação da Senha
    if (senha.length !== 6 || !/^\d+$/.test(senha)) {
      setErro("A senha deve conter exatamente 6 números.");
      return;
    }
    if (senha !== confirmarSenha) {
      setErro("As senhas digitadas não conferem.");
      return;
    }

    // Prepara os dados para atualizar (só atualiza CPF/RG se o usuário tiver preenchido agora)
    const dadosAtualizados: any = {
      senha: senha,
      status: 'ativo'
    };

    if (!usuario.cpf && cpfFaltante) dadosAtualizados.cpf = cpfFaltante;
    if (!usuario.rg && rgFaltante) dadosAtualizados.rg = rgFaltante;

    try {
      const docRef = doc(db, 'usuarios', userId!);
      await updateDoc(docRef, dadosAtualizados);
      
      setSucesso(true);
      // Redireciona para o Login após 4 segundos
      setTimeout(() => navigate('/'), 4000);
    } catch (err) {
      setErro("Erro ao salvar suas informações. Tente novamente.");
    }
  };

  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '15px', backgroundColor: '#f8fafc' }}>
      <Loader2 className="animate-spin" size={40} color="var(--cor-primaria)" />
      <p style={{ color: '#64748b' }}>Buscando seu convite...</p>
    </div>
  );

  if (erro) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '15px', padding: '20px', textAlign: 'center', backgroundColor: '#f8fafc' }}>
      <AlertTriangle size={60} color="#ef4444" />
      <h2 style={{ color: '#1e293b', fontSize: '22px' }}>Acesso Indisponível</h2>
      <p style={{ color: '#64748b', maxWidth: '400px' }}>{erro}</p>
      <Button onClick={() => navigate('/')} style={{ marginTop: '10px' }}>Ir para o Login</Button>
    </div>
  );

  if (sucesso) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '15px', padding: '20px', textAlign: 'center', backgroundColor: '#ecfdf5' }}>
      <CheckCircle2 size={70} color="#10b981" />
      <h2 style={{ color: '#065f46', fontSize: '24px', margin: 0 }}>Tudo Pronto!</h2>
      <p style={{ color: '#047857', maxWidth: '400px', fontSize: '15px' }}>
        Sua senha foi criada com sucesso, <strong>{usuario.nome.split(' ')[0]}</strong>.<br/>
        Você já pode acessar o ERP Carvalho.
      </p>
      <p style={{ color: '#64748b', fontSize: '13px', marginTop: '20px' }}>Redirecionando para o login...</p>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '450px', backgroundColor: 'white', padding: '30px 20px', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{ backgroundColor: 'var(--cor-primaria-clara)', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px' }}>
            <LockKeyhole size={30} color="var(--cor-primaria)" />
          </div>
          <h1 style={{ fontSize: '22px', color: '#1e293b', margin: '0 0 8px 0' }}>Bem-vindo à Carvalho</h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
            Finalize seu cadastro para liberar seu acesso.
          </p>
        </div>

        {/* Card Resumo do Usuário */}
        <div style={{ backgroundColor: '#f1f5f9', padding: '15px', borderRadius: '12px', marginBottom: '25px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#334155' }}>
            <User size={18} color="#64748b" />
            <span style={{ fontWeight: '600', fontSize: '15px' }}>{usuario.nome}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#334155' }}>
            <Mail size={18} color="#64748b" />
            <div>
              <span style={{ fontSize: '11px', display: 'block', color: '#94a3b8', fontWeight: 'bold' }}>SEU USUÁRIO DE LOGIN</span>
              <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--cor-primaria)' }}>{usuario.email}</span>
            </div>
          </div>
        </div>

        {erro && (
          <div style={{ backgroundColor: '#fee2e2', color: '#ef4444', padding: '12px', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
            <AlertTriangle size={18} shrink={0} /> {erro}
          </div>
        )}

        <form onSubmit={salvarDados} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Só pede o CPF se o RH não tiver cadastrado */}
          {!usuario.cpf && (
            <div style={{ backgroundColor: '#fff7ed', border: '1px dashed #fdba74', padding: '15px', borderRadius: '10px' }}>
              <p style={{ fontSize: '13px', color: '#c2410c', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <IdCard size={16} /> Precisamos do seu CPF para continuar:
              </p>
              <Input 
                label="" 
                value={cpfFaltante} 
                onChange={e => setCpfFaltante(e.target.value)} 
                placeholder="Digite seu CPF" 
              />
            </div>
          )}

          {/* Só pede o RG se o RH não tiver cadastrado e ele também não tiver CPF */}
          {!usuario.rg && usuario.cpf && (
            <div style={{ backgroundColor: '#fff7ed', border: '1px dashed #fdba74', padding: '15px', borderRadius: '10px' }}>
              <p style={{ fontSize: '13px', color: '#c2410c', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <IdCard size={16} /> Precisamos do seu RG para continuar:
              </p>
              <Input 
                label="" 
                value={rgFaltante} 
                onChange={e => setRgFaltante(e.target.value)} 
                placeholder="Digite seu RG" 
              />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div style={{ position: 'relative' }}>
              <Input 
                label="Crie uma Senha" 
                type="password" 
                maxLength={6} 
                value={senha} 
                onChange={e => setSenha(e.target.value.replace(/\D/g, ''))} 
                placeholder="6 números"
                style={{ fontSize: '18px', letterSpacing: '2px', textAlign: 'center' }}
              />
            </div>
            <div style={{ position: 'relative' }}>
              <Input 
                label="Confirme a Senha" 
                type="password" 
                maxLength={6} 
                value={confirmarSenha} 
                onChange={e => setConfirmarSenha(e.target.value.replace(/\D/g, ''))} 
                placeholder="6 números"
                style={{ fontSize: '18px', letterSpacing: '2px', textAlign: 'center' }}
              />
            </div>
          </div>
          
          <Button type="submit" style={{ height: '54px', fontSize: '16px', marginTop: '10px' }}>
            Ativar meu Acesso
          </Button>
        </form>
      </div>
    </div>
  );
}