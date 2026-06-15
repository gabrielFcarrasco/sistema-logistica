// src/App.tsx (ou routes.tsx / main.tsx)
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Importe as suas páginas normais...
import Login from './pages/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import PrestacaoServicos from './pages/PrestacaoServicos';
import Funcionarios from './pages/Funcionarios';
import Orcamentos from './pages/Orcamentos';

// ✨ 1. IMPORTE A NOVA PÁGINA DE ASSINATURA AQUI
import AssinaturaExterna from './pages/AssinaturaExterna'; 

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        
        {/* === ROTAS PÚBLICAS (Sem Senha) === */}
        <Route path="/" element={<Login />} />
        
        {/* ✨ 2. ADICIONE A ROTA DA ASSINATURA AQUI! */}
        {/* O ":id" avisa o sistema que o código final da URL é variável */}
        <Route path="/assinar-os/:id" element={<AssinaturaExterna />} />

        {/* === ROTAS PRIVADAS (Com Senha / Dentro do Menu Lateral) === */}
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/prestacao-servicos" element={<PrestacaoServicos />} />
          <Route path="/funcionarios" element={<Funcionarios />} />
          <Route path="/orcamentos" element={<Orcamentos />} />
          {/* ... suas outras rotas ... */}
        </Route>

      </Routes>
    </BrowserRouter>
  );
}