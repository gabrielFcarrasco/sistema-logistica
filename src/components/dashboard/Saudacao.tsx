// src/components/dashboard/Saudacao.tsx
import { useState, useEffect } from 'react';

export default function Saudacao() {
  const [mensagem, setMensagem] = useState('Olá');
  
  // Puxa o nome salvo no login ou usa "Gestor" como segurança caso dê erro
  const nomeCompleto = localStorage.getItem('userName') || 'Gestor';
  
  // Pega apenas o primeiro nome (ex: "João Silva" vira "João")
  const primeiroNome = nomeCompleto.split(' ')[0];

  useEffect(() => {
    const hora = new Date().getHours();
    
    if (hora >= 5 && hora < 12) {
      setMensagem('Bom dia');
    } else if (hora >= 12 && hora < 18) {
      setMensagem('Boa tarde');
    } else {
      setMensagem('Boa noite');
    }
  }, []);

  return (
    <div>
      <h1 style={{ margin: 0, fontSize: '24px', color: '#1e293b', fontWeight: '800' }}>
        {mensagem}, <span style={{ color: 'var(--cor-primaria)' }}>{primeiroNome}</span>! 
      </h1>
      <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
        Aqui está o resumo da sua operação hoje.
      </p>
    </div>
  );
}
