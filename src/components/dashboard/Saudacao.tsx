import { useState, useEffect } from 'react';
import { auth } from '../../services/firebase';

export default function Saudacao() {
  const [mensagem, setMensagem] = useState('');
  
  // Pega o nome antes do @ do e-mail
  const usuario = auth.currentUser?.email?.split('@')[0] || 'Gestor';

  useEffect(() => {
    const hora = new Date().getHours();
    if (hora >= 5 && hora < 12) setMensagem('Bom dia');
    else if (hora >= 12 && hora < 18) setMensagem('Boa tarde');
    else setMensagem('Boa noite');
  }, []);

  const dataAtual = new Intl.DateTimeFormat('pt-BR', { 
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' 
  }).format(new Date());

  return (
    <div style={{ marginBottom: '30px' }}>
      <h1 style={{ fontSize: '28px', color: '#1e293b', margin: '0 0 8px 0' }}>
        {mensagem}, <span style={{ textTransform: 'capitalize', color: 'var(--cor-primaria)' }}>{usuario}</span>!
      </h1>
      <p style={{ color: '#64748b', margin: 0, textTransform: 'capitalize', fontSize: '14px' }}>
        {dataAtual}
      </p>
    </div>
  );
}