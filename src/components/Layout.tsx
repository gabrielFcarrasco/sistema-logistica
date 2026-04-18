import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

import logoCarvalho from '../assets/logoLimpa.webp'; // Verifique se o nome confere
import styles from './Layout.module.css';
import { LayoutDashboard, Package, Users, ClipboardCheck, LogOut, Building2, Menu, X } from 'lucide-react';

interface Setor {
  id: string;
  nome: string;
}

export default function Layout() {
  const [setores, setSetores] = useState<Setor[]>([]);
  const [setorAtivo, setSetorAtivo] = useState<string>('');
  
  // Controle do Menu Mobile
  const [menuAberto, setMenuAberto] = useState(false);
  const location = useLocation();

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

  return (
    <div className={styles.container}>
      
      {/* 📱 BARRA SUPERIOR MOBILE (Só aparece em telas pequenas) */}
      <div className={styles.mobileTopbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Building2 size={24} color="var(--cor-primaria)" />
          <span style={{ fontWeight: 'bold', fontSize: '18px' }}>ERP Carvalho</span>
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

        {/* Seletor de Unidades */}
        <div style={{ padding: '0 20px 20px 20px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px' }}>
            <Building2 size={16} /> Unidade Atual
          </label>
          <select 
            value={setorAtivo}
            onChange={(e) => setSetorAtivo(e.target.value)}
            style={{ width: '100%', padding: '12px', borderRadius: '6px', backgroundColor: '#334155', color: 'white', border: '1px solid #475569', outline: 'none', cursor: 'pointer', fontSize: '14px' }}
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
              <LayoutDashboard size={20} style={{ marginRight: '12px' }} /> Dashboard
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
        </ul>

        <Link to="/" className={styles.btnSair}>
          <LogOut size={20} style={{ marginRight: '12px' }} /> Sair do Sistema
        </Link>
      </nav>

      {/* ÁREA PRINCIPAL DA TELA */}
      <main className={styles.mainContent}>
        <Outlet context={{ setorAtivo }} />
      </main>
    </div>
  );
}