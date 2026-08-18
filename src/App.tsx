// src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Importações de Layout e Login
import Login from './pages/Login';
import Layout from './components/Layout';

// Importações das Páginas do Sistema
import Dashboard from './pages/Dashboard';
import PrestacaoServicos from './pages/PrestacaoServicos';
import Funcionarios from './pages/Funcionarios';
import Orcamentos from './pages/Orcamentos';
import Entrega from './pages/Entrega'; 
import Estoque from './pages/Estoque';
import PedidosCompra from './pages/PedidosCompra';
import Advertencias from './pages/Advertencias';
import GestaoAcessos from './pages/GestaoAcessos';

// ✨ NOVAS PÁGINAS DE PONTO
import TerminalPontoPublico from './pages/TerminalPontoPublico';
import GestaoPonto from './pages/GestaoPonto';

// Assinaturas Públicas
import AssinaturaExterna from './pages/AssinaturaExterna'; 
import AssinaturaEpiExterna from './pages/AssinaturaEpiExterna';
import AssinaturaCronograma from './pages/AssinaturaCronograma';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        
        {/* === ROTAS PÚBLICAS === */}
        <Route path="/" element={<Login />} />
        <Route path="/assinar-os/:id" element={<AssinaturaExterna />} />
        <Route path="/assinar-epi/:loteId" element={<AssinaturaEpiExterna />} />
        <Route path="/assinatura-cronograma" element={<AssinaturaCronograma />} />
        
        {/* ✨ ROTA PÚBLICA DO PONTO (Link fixo para os funcionários) */}
        <Route path="/ponto" element={<TerminalPontoPublico />} />

        {/* === ROTAS PRIVADAS === */}
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/prestacao-servicos" element={<PrestacaoServicos />} />
          <Route path="/funcionarios" element={<Funcionarios />} />
          <Route path="/orcamentos" element={<Orcamentos />} />
          <Route path="/entrega" element={<Entrega />} />
          <Route path="/estoque" element={<Estoque />} />
          <Route path="/pedidos-compra" element={<PedidosCompra />} />
          <Route path="/advertencias" element={<Advertencias />} />
          <Route path="/gestao-acessos" element={<GestaoAcessos />} />
          
          {/* ✨ ROTA PRIVADA DE GESTÃO DE PONTO */}
          <Route path="/gestao-ponto" element={<GestaoPonto />} />
        </Route>

      </Routes>
    </BrowserRouter>
  );
}