// src/components/Layout.tsx
import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

import logoCarvalho from '../assets/logo.webp';
import Carvalho from '../assets/LogoLimpa.webp';
import styles from './Layout.module.css';
import { 
  LayoutDashboard, Package, Users, ClipboardCheck, LogOut, 
  Building2, Menu, X, ShieldCheck, ShieldAlert, ShoppingCart, 
  ArrowDownToLine, Paintbrush, FileSignature
} from 'lucide-react';

interface Setor { id: string; nome: string; }

export default function Layout() {
  const [setores, setSetores] = useState<Setor[]>([]);
  const [setorAtivo, setSetorAtivo] = useState<string>('');
  
  const [userLevel, setUserLevel] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [menuAberto, setMenuAberto] = useState(false);
  
  const location = useLocation();
  const navigate = useNavigate();
  const [podeInstalar, setPodeInstalar] = useState<any>(null);

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setPodeInstalar(e);
    });
    setUserLevel(localStorage.getItem('userLevel') || 'socio');
    setUserName(localStorage.getItem('userName') || 'Administrador');
  }, []);

  useEffect(() => { setMenuAberto(false); }, [location.pathname]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'setores'), (snapshot) => {
      const lista = snapshot.docs.map(doc => ({ id: doc.id, nome: doc.data().nome }));
      setSetores(lista);
      if (lista.length > 0 && !setorAtivo) setSetorAtivo(lista[0].id);
    });
    return () => unsub();
  }, [setorAtivo]);

  const instalarApp = () => {
    if (!podeInstalar) return;
    podeInstalar.prompt();
    podeInstalar.userChoice.then((choice: any) => {
      if (choice.outcome === 'accepted') setPodeInstalar(null);
    });
  };

  const fazerLogout = () => { localStorage.clear(); navigate('/'); };

  // Função para destacar a aba ativa
  const getMenuClass = (path: string) => {
    return `${styles.menuItem} ${location.pathname.includes(path) ? styles.ativo : ''}`;
  };

  return (
    <div className={styles.container}>
      <div className={styles.mobileTopbar}>
        <img src={Carvalho} alt="Logo" style={{ height: '35px' }} />
        <button className={styles.btnHamburger} onClick={() => setMenuAberto(true)}><Menu size={28} /></button>
      </div>

      <div className={`${styles.overlay} ${menuAberto ? styles.ativo : ''}`} onClick={() => setMenuAberto(false)} />

      <nav className={`${styles.sidebar} ${menuAberto ? styles.aberto : ''}`}>
        <div className={styles.logoContainer}>
          <img src={logoCarvalho} alt="Logo Carvalho" className={styles.logo} />
          <button className={styles.btnFecharMobile} onClick={() => setMenuAberto(false)}><X size={24} /></button>
        </div>

        <div style={{ padding: '0 20px 15px', marginBottom: '15px' }}>
          <p style={{ color: 'white', fontSize: '15px', margin: '0 0 4px 0' }}>Olá, <strong>{userName?.split(' ')[0]}</strong></p>
          <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {userLevel === 'socio' ? 'Acesso Sócio' : 'Gestor de Unidade'}
          </span>
        </div>

        <div style={{ padding: '0 20px 20px 20px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', marginBottom: '15px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px' }}>
            <Building2 size={14} /> Unidade Atual
          </label>
          <select 
            value={setorAtivo} onChange={(e) => setSetorAtivo(e.target.value)} disabled={userLevel !== 'socio'}
            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', outline: 'none', cursor: userLevel === 'socio' ? 'pointer' : 'not-allowed', fontSize: '13px', fontWeight: 'bold' }}
          >
            {setores.map(setor => <option key={setor.id} value={setor.id} style={{color: 'black'}}>{setor.nome}</option>)}
          </select>
        </div>
        
        <ul className={styles.menuList}>
          <li><Link to="/dashboard" className={getMenuClass('/dashboard')}><LayoutDashboard size={18} color="#e2e8f0" style={{ marginRight: '12px' }} /> Início</Link></li>
          <li><Link to="/estoque" className={getMenuClass('/estoque')}><Package size={18} color="#38bdf8" style={{ marginRight: '12px' }} /> Estoque e EPIs</Link></li>
          <li><Link to="/entrega" className={getMenuClass('/entrega')}><ClipboardCheck size={18} color="#10b981" style={{ marginRight: '12px' }} /> Entregar Material</Link></li>
          <li><Link to="/funcionarios" className={getMenuClass('/funcionarios')}><Users size={18} color="#8b5cf6" style={{ marginRight: '12px' }} /> Equipe e Qualificação</Link></li>
          <li><Link to="/prestacao-servicos" className={getMenuClass('/prestacao-servicos')}><Paintbrush size={18} color="#f59e0b" style={{ marginRight: '12px' }} /> Operação / Produção</Link></li>
          <li><Link to="/orcamentos" className={getMenuClass('/orcamentos')}><FileSignature size={18} color="#f472b6" style={{ marginRight: '12px' }} /> Orçamentos</Link></li>
          <li><Link to="/pedidos-compra" className={getMenuClass('/pedidos-compra')}><ShoppingCart size={18} color="#fbbf24" style={{ marginRight: '12px' }} /> Pedidos de Compra</Link></li>
          <li><Link to="/advertencias" className={getMenuClass('/advertencias')}><ShieldAlert size={18} color="#ef4444" style={{ marginRight: '12px' }} /> Advertências</Link></li>
          
          {userLevel === 'socio' && (
            <li><Link to="/gestao-acessos" className={getMenuClass('/gestao-acessos')}><ShieldCheck size={18} color="#94a3b8" style={{ marginRight: '12px' }} /> Acessos do Sistema</Link></li>
          )}
        </ul>

        <div className={styles.sidebarFooter}>
          {podeInstalar && (
            <button onClick={instalarApp} className={styles.menuItem} style={{ color: '#10b981', border: 'none', background: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', padding: '12px', marginBottom: '5px' }}>
              <ArrowDownToLine size={18} style={{ marginRight: '12px' }} /> Instalar Aplicativo
            </button>
          )}
          <button onClick={fazerLogout} className={styles.btnSair}>
            <LogOut size={18} style={{ marginRight: '12px' }} /> Sair do Sistema
          </button>
        </div>
      </nav>

      <main className={styles.mainContent}>
        <Outlet context={{ setorAtivo }} />
      </main>
    </div>
  );
}