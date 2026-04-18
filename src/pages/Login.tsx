import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../services/firebase';

import Button from '../components/ui/Button';
import Input from '../components/ui/Input'; // Importando nosso novo componente
import logoCarvalho from '../assets/logoLimpa.webp';
import styles from './Login.module.css';

// Importando os ícones SVG!
import { User, Lock } from 'lucide-react';

export default function Login() {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  
  const navigate = useNavigate();

  const fazerLogin = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setErro('');

    try {
      const emailFormatadoParaFirebase = `${usuario}@carvalho.com`;
      await signInWithEmailAndPassword(auth, emailFormatadoParaFirebase, senha);
      navigate('/dashboard');
    } catch (error) {
      console.error(error);
      setErro('Usuário ou senha incorretos. Tente novamente.');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        
        <img src={logoCarvalho} alt="Logo Carvalho" className={styles.logo} />
        
        <h2 className={styles.titulo}>Login</h2>

        {erro && <div className={styles.mensagemErro}>{erro}</div>}

        <form onSubmit={fazerLogin} className={styles.form}>
          
          {/* Olha como ficou limpo! Passamos o label e o ícone como propriedades */}
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
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="********" 
          />

          <Button type="submit" variante="primario" style={{ width: '100%', padding: '14px', marginTop: '10px' }}>
            Entrar
          </Button>

        </form>
      </div>
    </div>
  );
}