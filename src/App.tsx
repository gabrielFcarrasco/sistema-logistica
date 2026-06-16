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

// ✨ NOVA PÁGINA DE ASSINATURA PÚBLICA
import AssinaturaExterna from './pages/AssinaturaExterna'; 

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        
        {/* =========================================
            ROTAS PÚBLICAS (Sem exigência de Senha)
            ========================================= */}
        <Route path="/" element={<Login />} />
        
        {/* Rota exclusiva para o cliente da Hyundai assinar */}
        <Route path="/assinar-os/:id" element={<AssinaturaExterna />} />

        {/* =========================================
            ROTAS PRIVADAS (Protegidas pelo Layout)
            ========================================= */}
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/prestacao-servicos" element={<PrestacaoServicos />} />
          <Route path="/funcionarios" element={<Funcionarios />} />
          <Route path="/orcamentos" element={<Orcamentos />} />
          
          {/* A Rota de Entrega que estava a dar erro de "No routes matched" */}
          <Route path="/entrega" element={<Entrega />} />
          <Route path="/estoque" element={<Estoque />} />
          <Route path="/pedidos-compra" element={<PedidosCompra />} />
        </Route>

      </Routes>
    </BrowserRouter>
  );
}