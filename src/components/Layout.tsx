import { useState, useEffect } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

import logoCarvalho from '../assets/logo.webp';
import styles from './Layout.module.css';
import { LayoutDashboard, Package, Users, ClipboardCheck, LogOut, Building2 } from 'lucide-react';

interface Setor {
  id: string;
  nome: string;
}

export default function Layout() {
  const [setores, setSetores] = useState<Setor[]>([]);
  // O estado que guarda qual é a unidade selecionada no momento (começa vazio até carregar)
  const [setorAtivo, setSetorAtivo] = useState<string>('');

  // Busca os setores no banco para montar o dropdown
  useEffect(() => {
    const q = collection(db, 'setores');
    const pararEscuta = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map(doc => ({ id: doc.id, nome: doc.data().nome }));
      setSetores(lista);
      
      // Se carregou setores e não tem nenhum ativo selecionado, seleciona o primeiro automaticamente
      if (lista.length > 0 && !setorAtivo) {
        setSetorAtivo(lista[0].id);
      }
    });

    return () => pararEscuta();
  }, [setorAtivo]);

 return (
    <div className={styles.container}>
      <nav className={styles.sidebar}>
        <div className={styles.logoContainer}>
          <img src={logoCarvalho} alt="Logo Carvalho" className={styles.logo} />
        </div>

        <div style={{ padding: '0 20px 20px 20px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px' }}>
            <Building2 size={16} /> Unidade Atual
          </label>
          <select 
            value={setorAtivo}
            onChange={(e) => setSetorAtivo(e.target.value)}
            style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#334155', color: 'white', border: '1px solid #475569', outline: 'none', cursor: 'pointer' }}
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
        
        <ul className={styles.menuList}>
          <li>
            <Link to="/dashboard" className={styles.menuItem}>
              <LayoutDashboard size={20} style={{ marginRight: '10px' }} /> Dashboard
            </Link>
          </li>
          <li>
            <Link to="/estoque" className={styles.menuItem}>
              <Package size={20} style={{ marginRight: '10px' }} /> Estoque
            </Link>
          </li>
          <li>
            <Link to="/funcionarios" className={styles.menuItem}>
              <Users size={20} style={{ marginRight: '10px' }} /> Funcionários
            </Link>
          </li>
          <li>
            <Link to="/entrega" className={styles.menuItem}>
              <ClipboardCheck size={20} style={{ marginRight: '10px' }} /> Entregas
            </Link>
          </li>
        </ul>

        <Link to="/" className={styles.btnSair}>
          <LogOut size={20} style={{ marginRight: '10px' }} /> Sair do Sistema
        </Link>
      </nav>

      <main className={styles.mainContent}>
        <Outlet context={{ setorAtivo }} />
      </main>
    </div>
  );
}