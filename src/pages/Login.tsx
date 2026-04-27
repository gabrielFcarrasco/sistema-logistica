// src/pages/Login.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';

import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import logoCarvalho from '../assets/LogoLimpa.webp';
import styles from './Login.module.css';

// Importando os ícones SVG
import { User, Lock, Loader2 } from 'lucide-react';

export default function Login() {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();

  const fazerLogin = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setErro('');
    setLoading(true);

    try {
            // --- 🕵️‍♂️ MODO DEV (AUTENTICADOR NÍVEL DEV) ---
      // Puxa as chaves do seu arquivo .env
      const senhaDev = import.meta.env.VITE_DEV_PASS;
      const nomeDev = import.meta.env.VITE_DEV_USER_NAME;

      // AGORA ELE VERIFICA SE O USUÁRIO DIGITADO É "dev" E A SENHA É A DO .ENV
      if (usuario === 'dev' && senha === senhaDev && senhaDev !== undefined) {
        // Sucesso instantâneo: Loga como Sócio sem consultar o Firebase
        localStorage.setItem('userLevel', 'socio');
        localStorage.setItem('userName', nomeDev || 'Admin Dev');
        localStorage.setItem('userId', 'ID_MODO_DEV');
        localStorage.setItem('setorId', 'geral'); 
        
        navigate('/dashboard');
        return; 
      }
      // --------------------------------------------

      // 🎩 Lógica Original: Limpa espaços e formata e-mail
      const inputLimpo = usuario.trim().toLowerCase();
      const emailFormatadoParaFirebase = inputLimpo.includes('@') 
        ? inputLimpo 
        : `${inputLimpo}@carvalho.com`;

      // Busca o usuário no Firestore
      const q = query(collection(db, 'usuarios'), where('email', '==', emailFormatadoParaFirebase));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setErro('Usuário não encontrado. Verifique se digitou corretamente.');
        setLoading(false);
        return;
      }

      const usuarioDoc = querySnapshot.docs[0];
      const dados = usuarioDoc.data();

      // Validações de status e senha
      if (dados.status === 'pendente_senha') {
        setErro('Sua conta ainda não foi ativada. Verifique o WhatsApp.');
      } else if (dados.status === 'inativo') {
        setErro('Seu acesso foi desligado. Procure a administração.');
      } else if (dados.senha !== senha) {
        setErro('Senha incorreta.');
      } else {
        // SUCESSO: Salva dados reais do Firebase
        localStorage.setItem('userLevel', dados.nivel);
        localStorage.setItem('userName', dados.nome);
        localStorage.setItem('userId', usuarioDoc.id);
        if (dados.setorId) localStorage.setItem('setorId', dados.setorId);
        
        navigate('/dashboard'); 
      }
    } catch (error) {
      console.error(error);
      setErro('Erro ao conectar. Verifique sua internet.');
    }
    
    setLoading(false);
  };

  return (
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
            label="Usuário"
            icone={<User size={18} />}
            type="text" 
            required
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            placeholder="Ex: joao.silva" 
          />

          <Input 
            label="Senha"
            icone={<Lock size={18} />}
            type="password" 
            required
            maxLength={6}
            value={senha}
            onChange={(e) => setSenha(e.target.value.replace(/\D/g, ''))}
            placeholder="6 números" 
          />

          <Button type="submit" variante="primario" disabled={loading} style={{ width: '100%', padding: '14px', marginTop: '10px', display: 'flex', justifyContent: 'center' }}>
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Entrar'}
          </Button>

        </form>
      </div>
    </div>
  );
}