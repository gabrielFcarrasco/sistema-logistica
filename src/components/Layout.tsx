import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

import logoCarvalho from '../assets/logo.webp';
import Carvalho from '../assets/LogoLimpa.webp';
import styles from './Layout.module.css';
import { 
  LayoutDashboard, Package, Users, ClipboardCheck, LogOut, 
  Building2, Menu, X, ShieldCheck, ShieldAlert, ShoppingCart, ArrowDownToLine
} from 'lucide-react';

interface Setor {
  id: string;
  nome: string;
}

export default function Layout() {
  const [setores, setSetores] = useState<Setor[]>([]);
  const [setorAtivo, setSetorAtivo] = useState<string>('');
  
  // Dados do Usuário Logado
  const [userLevel, setUserLevel] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  
  // Controle do Menu Mobile
  const [menuAberto, setMenuAberto] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const [podeInstalar, setPodeInstalar] = useState<any>(null);

useEffect(() => {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    setPodeInstalar(e);
  });
}, []);

const instalarApp = () => {
  if (!podeInstalar) return;
  podeInstalar.prompt();
  podeInstalar.userChoice.then((choice: any) => {
    if (choice.outcome === 'accepted') setPodeInstalar(null);
  });
};

// No seu menu lateral (sidebar), antes do botão Sair, adicione:
{podeInstalar && (
  <li>
    <button onClick={instalarApp} className={styles.menuItem} style={{ color: '#10b981', border: 'none', background: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}>
      <ArrowDownToLine size={20} style={{ marginRight: '12px' }} /> Instalar Aplicativo
    </button>
  </li>
)}

  // Carrega os dados de quem logou (Vamos usar isso quando o Login estiver pronto)
  useEffect(() => {
    setUserLevel(localStorage.getItem('userLevel') || 'socio'); // Temporário como 'socio' para você conseguir ver o menu
    setUserName(localStorage.getItem('userName') || 'Administrador');
  }, []);

  // Fecha o menu mobile automaticamente sempre que o usuário trocar de tela
  useEffect(() => {
    setMenuAberto(false);
  }, [location.pathname]);

  useEffect(() => {
    const q = collection(db, 'setores');
    const pararEscuta = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map(doc => ({ id: doc.id, nome: doc.data().nome }));
      setSetores(lista);
      if (lista.length > 0 && !setorAtivo) {
        setSetorAtivo(lista[0].id);
      }
    });
    return () => pararEscuta();
  }, [setorAtivo]);

  const fazerLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  return (
    <div className={styles.container}>

  {/* 📱 BARRA SUPERIOR MOBILE (Só aparece em telas pequenas) */}
  <div className={styles.mobileTopbar}>
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <img 
        src={Carvalho} 
        alt="Logo Carvalho" 
        style={{ height: '35px', width: 'auto', objectFit: 'contain' }} 
      />
    </div>
    
    <button className={styles.btnHamburger} onClick={() => setMenuAberto(true)}>
      <Menu size={28} />
    </button>
  </div>

      {/* OVERLAY: Fundo escuro para fechar o menu ao clicar fora */}
      <div 
        className={`${styles.overlay} ${menuAberto ? styles.ativo : ''}`} 
        onClick={() => setMenuAberto(false)}
      />

      {/* 🖥️ MENU LATERAL */}
      <nav className={`${styles.sidebar} ${menuAberto ? styles.aberto : ''}`}>
        <div className={styles.logoContainer}>
          <img src={logoCarvalho} alt="Logo Carvalho" className={styles.logo} />
          {/* Botão de Fechar que só aparece no celular */}
          <button className={styles.btnFecharMobile} onClick={() => setMenuAberto(false)}>
            <X size={24} />
          </button>
        </div>

        {/* Info do Usuário Logado */}
        <div style={{ padding: '0 20px 15px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '15px' }}>
          <p style={{ color: 'white', fontSize: '14px', margin: '0 0 4px 0' }}>Olá, <strong>{userName?.split(' ')[0]}</strong></p>
          <span style={{ fontSize: '11px', color: 'var(--cor-primaria)', fontWeight: 'bold', textTransform: 'uppercase' }}>
            {userLevel === 'socio' ? 'Acesso Global (Sócio)' : 'Gestor de Unidade'}
          </span>
        </div>

        {/* Seletor de Unidades (Só habilita se for Sócio, ou trava na unidade do Responsável) */}
        <div style={{ padding: '0 20px 20px 20px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px' }}>
            <Building2 size={16} /> Unidade Atual
          </label>
          <select 
            value={setorAtivo}
            onChange={(e) => setSetorAtivo(e.target.value)}
            disabled={userLevel !== 'socio'} // Se não for sócio, ele não pode ficar fuçando no setor dos outros pelo menu principal
            style={{ width: '100%', padding: '12px', borderRadius: '6px', backgroundColor: userLevel === 'socio' ? '#334155' : '#1e293b', color: 'white', border: '1px solid #475569', outline: 'none', cursor: userLevel === 'socio' ? 'pointer' : 'not-allowed', fontSize: '14px' }}
          >
            {setores.length === 0 ? (
              <option value="">Nenhuma unidade criada</option>
            ) : (
              <>
                <option value="" disabled>Selecione uma unidade</option>
                {setores.map(setor => (
                  <option key={setor.id} value={setor.id}>{setor.nome}</option>
                ))}
              </>
            )}
          </select>
        </div>
        
        {/* Links de Navegação */}
        <ul className={styles.menuList}>
          <li>
            <Link to="/dashboard" className={styles.menuItem}>
              <LayoutDashboard size={20} style={{ marginRight: '12px' }} /> Início 
            </Link>
          </li>
          <li>
            <Link to="/estoque" className={styles.menuItem}>
              <Package size={20} style={{ marginRight: '12px' }} /> Estoque
            </Link>
          </li>
          <li>
            <Link to="/funcionarios" className={styles.menuItem}>
              <Users size={20} style={{ marginRight: '12px' }} /> Funcionários
            </Link>
          </li>
          <li>
            <Link to="/entrega" className={styles.menuItem}>
              <ClipboardCheck size={20} style={{ marginRight: '12px' }} /> Entregas
            </Link>
          </li>

          <li>
            <Link to="/pedidos-compra" className={styles.menuItem} style={{ color: '#10b981' }}>
              <ShoppingCart size={20} style={{ marginRight: '12px' }} /> Pedidos de Compra
            </Link>
          </li>

          <li>
            <Link to="/advertencias" className={styles.menuItem} style={{ color: '#ef4444' }}>
              <ShieldAlert size={20} style={{ marginRight: '12px' }} /> Advertências
            </Link>
          </li>
          
          {/* 🔒 Trava: Apenas Sócios veem este botão */}
          {userLevel === 'socio' && (
            <li>
              <Link to="/acessos" className={styles.menuItem} style={{ color: '#a78bfa' }}>
                <ShieldCheck size={20} style={{ marginRight: '12px' }} /> Gestão de Acessos
              </Link>
            </li>
          )}
        </ul>

        <button onClick={fazerLogout} className={styles.btnSair} style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', fontFamily: 'inherit' }}>
          <LogOut size={20} style={{ marginRight: '12px' }} /> Sair do Sistema
        </button>
      </nav>

      {/* ÁREA PRINCIPAL DA TELA */}
      <main className={styles.mainContent}>
        <Outlet context={{ setorAtivo }} />
      </main>
    </div>
  );
}