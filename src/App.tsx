// src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Importando as Páginas
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Estoque from './pages/Estoque';
import Funcionarios from './pages/Funcionarios';
import Entrega from './pages/Entrega';
import PedidosCompra from './pages/PedidosCompra';
import Advertencias from './pages/Advertencias';
import GestaoAcessos from './pages/GestaoAcessos';
import SetupSenha from './pages/SetupSenha';

// Importando o Componente de Layout
import Layout from './components/Layout';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* A Rota de Login fica fora do Layout, pois não queremos menu nela */}
        <Route path="/" element={<Login />} />

        {/* Tela de criação de senha (fora do Layout para ser tela cheia) */}
<Route path="/setup-senha" element={<SetupSenha />} />



        {/* Todas as rotas DENTRO do Layout terão o menu lateral aplicado */}
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/estoque" element={<Estoque />} />
          <Route path="/funcionarios" element={<Funcionarios />} />
          <Route path="/entrega" element={<Entrega />} />
          <Route path="/pedidos-compra" element={<PedidosCompra />} />
          <Route path="/advertencias" element={<Advertencias />} />
          <Route path="/acessos" element={<GestaoAcessos />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;