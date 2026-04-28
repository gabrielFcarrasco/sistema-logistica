// src/pages/Login.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';

import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import logoCarvalho from '../assets/LogoLimpa.webp';
import styles from './Login.module.css';
import { User, Lock, Loader2 } from 'lucide-react';

export default function Login() {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  
  // loading: Para o botão de entrar (buscando no banco)
  const [loading, setLoading] = useState(false);
  
  // entrando: Para a tela de transição de tela cheia (após senha correta)
  const [entrando, setEntrando] = useState(false);
  
  const navigate = useNavigate();

  const fazerLogin = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setErro('');
    setLoading(true);

    try {
      // --- 🕵️‍♂️ MODO DEV (AUTENTICADOR NÍVEL DEV) ---
      const senhaDev = import.meta.env.VITE_DEV_PASS;
      const nomeDev = import.meta.env.VITE_DEV_USER_NAME;

      if (usuario === 'dev' && senha === senhaDev && senhaDev !== undefined) {
        setEntrando(true); // Sobe a cortina de loading!
        
        localStorage.setItem('userLevel', 'socio');
        localStorage.setItem('userName', nomeDev || 'Admin Dev');
        localStorage.setItem('userId', 'ID_MODO_DEV');
        localStorage.setItem('setorId', 'geral'); 
        
        // Segura 1 segundo para dar tempo do Dashboard carregar na memória
        setTimeout(() => navigate('/dashboard'), 1000);
        return; 
      }
      // --------------------------------------------

      // 🎩 Lógica Original: Formata o e-mail
      const inputLimpo = usuario.trim().toLowerCase();
      const emailFormatadoParaFirebase = inputLimpo.includes('@') 
        ? inputLimpo 
        : `${inputLimpo}@carvalho.com`;

      // 🔍 Busca no Banco de Dados REAL
      const q = query(collection(db, 'usuarios'), where('email', '==', emailFormatadoParaFirebase));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setErro('Usuário não encontrado. Verifique se digitou corretamente.');
        setLoading(false);
        return;
      }

      const usuarioDoc = querySnapshot.docs[0];
      const dados = usuarioDoc.data();

      // 🛑 Validações de status e senha
      if (dados.status === 'pendente_senha') {
        setErro('Sua conta ainda não foi ativada. Verifique com a administração.');
      } else if (dados.status === 'inativo') {
        setErro('Seu acesso foi desligado. Procure a administração.');
      } else if (dados.senha !== senha) {
        setErro('Senha incorreta.');
      } else {
        // ✅ SUCESSO TOTAL: Sobe a cortina de loading!
        setEntrando(true);
        
        localStorage.setItem('userLevel', dados.nivel);
        localStorage.setItem('userName', dados.nome);
        localStorage.setItem('userId', usuarioDoc.id);
        if (dados.setorId) localStorage.setItem('setorId', dados.setorId);
        
        // Segura 1 segundo para transição suave sem tela branca
        setTimeout(() => navigate('/dashboard'), 1000); 
        return;
      }
    } catch (error) {
      console.error(error);
      setErro('Erro ao conectar. Verifique sua internet.');
    }
    
    setLoading(false);
  };

  return (
    <>
      {/* 🌟 CORTINA DE TRANSIÇÃO (Só aparece quando o login dá certo) */}
      {entrando && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#1e293b', zIndex: 99999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', animation: 'fadeIn 0.3s ease-out' }}>
          <Loader2 className="animate-spin" size={60} color="#3b82f6" style={{ marginBottom: '20px' }} />
          <h2 style={{ fontSize: '24px', margin: 0, fontWeight: 'bold' }}>Acesso Liberado!</h2>
          <p style={{ color: '#94a3b8', marginTop: '10px', fontSize: '15px' }}>Preparando seu ambiente de trabalho...</p>
        </div>
      )}

      {/* TELA DE LOGIN NORMAL */}
      <div className={styles.container}>
        <div className={styles.card}>
          <img src={logoCarvalho} alt="Logo Carvalho" className={styles.logo} />
          <h2 className={styles.titulo}>Login</h2>

          {erro && (
            <div className={styles.mensagemErro} style={{ backgroundColor: '#fee2e2', color: '#ef4444', padding: '12px', borderRadius: '8px', marginBottom: '15px', fontSize: '14px', textAlign: 'center' }}>
              {erro}
            </div>
          )}

          <form onSubmit={fazerLogin} className={styles.form}>
            <Input 
              label="Usuário" icone={<User size={18} />} type="text" 
              required value={usuario} onChange={(e) => setUsuario(e.target.value)}
              placeholder="Ex: joao.silva" 
            />
            <Input 
              label="Senha" icone={<Lock size={18} />} type="password" 
              required maxLength={6} value={senha} onChange={(e) => setSenha(e.target.value.replace(/\D/g, ''))}
              placeholder="6 números" 
            />
            <Button type="submit" variante="primario" disabled={loading} style={{ width: '100%', padding: '14px', marginTop: '10px', display: 'flex', justifyContent: 'center' }}>
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'Entrar'}
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
