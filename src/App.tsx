// src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Importando as Páginas
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Estoque from './pages/Estoque';
import Funcionarios from './pages/Funcionarios';
import Entrega from './pages/Entrega';

// Importando o Componente de Layout
import Layout from './components/Layout';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* A Rota de Login fica fora do Layout, pois não queremos menu nela */}
        <Route path="/" element={<Login />} />

        {/* Todas as rotas DENTRO do Layout terão o menu lateral aplicado */}
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/estoque" element={<Estoque />} />
          <Route path="/funcionarios" element={<Funcionarios />} />
          <Route path="/entrega" element={<Entrega />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;