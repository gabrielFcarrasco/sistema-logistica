import { BrowserRouter, Routes, Route } from 'react-router-dom';

// === IMPORTAÇÃO DOS COMPONENTES DE LAYOUT E LOGIN ===
import Login from './pages/Login';
import Layout from './components/Layout';

// === IMPORTAÇÃO DAS PÁGINAS DO SISTEMA ===
import Dashboard from './pages/Dashboard';
import PrestacaoServicos from './pages/PrestacaoServicos';
import Funcionarios from './pages/Funcionarios';
import Orcamentos from './pages/Orcamentos';
import Entrega from './pages/Entrega'; 
import Estoque from './pages/Estoque';
import PedidosCompra from './pages/PedidosCompra';
import Advertencias from './pages/Advertencias';
import GestaoAcessos from './pages/GestaoAcessos';


// === NOVA PÁGINA DE ASSINATURA PÚBLICA ===
import AssinaturaExterna from './pages/AssinaturaExterna'; 

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        
        {/* === ROTAS PÚBLICAS === */}
        <Route path="/" element={<Login />} />
        <Route path="/assinar-os/:id" element={<AssinaturaExterna />} />

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
        </Route>

      </Routes>
    </BrowserRouter>
  );
}