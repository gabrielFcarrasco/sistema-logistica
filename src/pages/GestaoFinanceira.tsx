// src/pages/GestaoFinanceira.tsx
import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, query, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase'; 
import { dbFolha } from '../services/firebaseFolha'; 
import { Wallet, Download, Edit3, Send, Search } from 'lucide-react';
import Button from '../components/ui/Button';

// Componentes da pasta financeiro
import EnvioPagamentosWhatsapp from '../components/financeiro/EnvioPagamentosWhatsapp';
import ModalAdiantamento from '../components/financeiro/ModalAdiantamento';
import ModalTransporte from '../components/financeiro/ModalTransporte';
import ModalAssinatura from '../components/financeiro/ModalAssinatura';
import CardFuncionarioFinanceiro from '../components/financeiro/CardFuncionarioFinanceiro';

// Utilitários
import { 
  calcularDiasUteis, 
  exportarPdfValesEscritorio, 
  exportarPdfTermoIndividual, 
  exportarPdfPixTransporte 
} from '../utils/pdfFinanceiro';

const formatarDataPtBR = (dataIso: string) => dataIso.split('-').reverse().join('/');

export default function GestaoFinanceira() {
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [dadosFinanceiros, setDadosFinanceiros] = useState<Record<string, any>>({});
  const [mesFiltro, setMesFiltro] = useState(new Date().toISOString().substring(0, 7));
  const [termoBusca, setTermoBusca] = useState('');
  const [diasUteis, setDiasUteis] = useState<number>(calcularDiasUteis(new Date().toISOString().substring(0, 7)));

  // Modais (Todos dentro da função para não quebrar Hooks)
  const [mostrarModalWhatsapp, setMostrarModalWhatsapp] = useState(false);
  const [modalAdiantamento, setModalAdiantamento] = useState({ 
    visivel: false, funcId: '', nome: '', idVale: '', valor: '', motivo: '', dataIso: '' 
  });
  const [modalTransporte, setModalTransporte] = useState<{ visivel: boolean; funcId: string; nome: string; rotas: any[] }>({ 
    visivel: false, funcId: '', nome: '', rotas: [] 
  });
  const [modalAssinatura, setModalAssinatura] = useState({ visivel: false, funcId: '', idVale: '' });

  useEffect(() => { setDiasUteis(calcularDiasUteis(mesFiltro)); }, [mesFiltro]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'funcionarios'), (snap) => {
      setFuncionarios(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter((f: any) => f.status !== 'desligado'));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const carregarFinancas = async () => {
      const q = query(collection(dbFolha, 'financeiro_mes'));
      const snap = await getDocs(q);
      const financasMap: Record<string, any> = {};
      snap.docs.forEach(doc => {
        if (doc.id.includes(mesFiltro)) financasMap[doc.data().funcionarioId] = doc.data();
      });
      setDadosFinanceiros(financasMap);
    };
    carregarFinancas();
  }, [mesFiltro]);

  const salvarChavePix = async (funcId: string, chave: string) => {
    await setDoc(doc(db, 'funcionarios', funcId), { chavePixPadrao: chave }, { merge: true });
  };

  const salvarDiasPersonalizados = async (funcId: string, dias: number) => {
    const idDoc = `${funcId}_${mesFiltro}`;
    if (isNaN(dias)) return;
    await setDoc(doc(dbFolha, 'financeiro_mes', idDoc), { diasUteisPersonalizado: dias }, { merge: true });
    setDadosFinanceiros(prev => ({ ...prev, [funcId]: { ...prev[funcId], diasUteisPersonalizado: dias } }));
  };

  const abrirModalTransporte = (funcId: string, nome: string) => {
    const funcGlobal = funcionarios.find(f => f.id === funcId);
    const rotasAtuais = funcGlobal?.transportesPadrao || [];
    setModalTransporte({ visivel: true, funcId, nome, rotas: [...rotasAtuais] });
  };

  const salvarConfiguracaoRotas = async () => {
    const { funcId, rotas } = modalTransporte;
    let totalDiario = 0;
    rotas.forEach(rota => totalDiario += ((parseFloat(rota.valor) || 0) * (parseInt(rota.qtdDiaria) || 0)));

    await setDoc(doc(db, 'funcionarios', funcId), { 
      transportesPadrao: rotas, 
      valorPassagemDiarioPadrao: totalDiario 
    }, { merge: true });
    
    setModalTransporte({ visivel: false, funcId: '', nome: '', rotas: [] });
  };

  const abrirModalAdiantamento = (funcId: string, nome: string, valeExistente?: any) => {
    if (valeExistente) {
      const partesData = valeExistente.data.split('/');
      const dataIso = partesData.length === 3 ? `${partesData[2]}-${partesData[1]}-${partesData[0]}` : new Date().toISOString().split('T')[0];
      setModalAdiantamento({ visivel: true, funcId, nome, idVale: valeExistente.id, valor: String(valeExistente.valor), motivo: valeExistente.motivo, dataIso });
    } else {
      setModalAdiantamento({ visivel: true, funcId, nome, idVale: '', valor: '', motivo: '', dataIso: new Date().toISOString().split('T')[0] });
    }
  };

  const salvarAdiantamento = async () => {
    if (!modalAdiantamento.valor || !modalAdiantamento.dataIso) return;
    const { funcId, nome, idVale, valor, motivo, dataIso } = modalAdiantamento;
    const idDoc = `${funcId}_${mesFiltro}`;
    const valorNum = parseFloat(valor) || 0;
    const dataFormatada = formatarDataPtBR(dataIso);
    
    const dadosAtuais = dadosFinanceiros[funcId] || {};
    let adiantamentosAtuais = [...(dadosAtuais.adiantamentos || [])];

    if (idVale) {
      adiantamentosAtuais = adiantamentosAtuais.map(ad => 
        ad.id === idVale ? { ...ad, data: dataFormatada, valor: valorNum, motivo: motivo || 'Adiantamento / Vale' } : ad
      );
    } else {
      adiantamentosAtuais.push({ id: Date.now().toString(), data: dataFormatada, valor: valorNum, motivo: motivo || 'Adiantamento / Vale' });
    }

    await setDoc(doc(dbFolha, 'financeiro_mes', idDoc), { funcionarioId: funcId, nomeFuncionario: nome, mesReferencia: mesFiltro, adiantamentos: adiantamentosAtuais }, { merge: true });
    setDadosFinanceiros(prev => ({ ...prev, [funcId]: { ...prev[funcId], adiantamentos: adiantamentosAtuais } }));
    setModalAdiantamento({ visivel: false, funcId: '', nome: '', idVale: '', valor: '', motivo: '', dataIso: '' });
  };

  const excluirAdiantamento = async (funcId: string, idAdiantamento: string) => {
    const idDoc = `${funcId}_${mesFiltro}`;
    const dadosAtuais = dadosFinanceiros[funcId] || {};
    const novaLista = (dadosAtuais.adiantamentos || []).filter((ad: any) => ad.id !== idAdiantamento);
    await setDoc(doc(dbFolha, 'financeiro_mes', idDoc), { adiantamentos: novaLista }, { merge: true });
    setDadosFinanceiros(prev => ({ ...prev, [funcId]: { ...prev[funcId], adiantamentos: novaLista } }));
  };

  const salvarAssinatura = async (imagemBase64: string) => {
    const { funcId, idVale } = modalAssinatura;
    const idDoc = `${funcId}_${mesFiltro}`;
    const dadosAtuais = dadosFinanceiros[funcId] || {};
    const adiantamentosAtualizados = (dadosAtuais.adiantamentos || []).map((ad: any) => ad.id === idVale ? { ...ad, assinatura: imagemBase64 } : ad);
    await setDoc(doc(dbFolha, 'financeiro_mes', idDoc), { adiantamentos: adiantamentosAtualizados }, { merge: true });
    setDadosFinanceiros(prev => ({ ...prev, [funcId]: { ...prev[funcId], adiantamentos: adiantamentosAtualizados } }));
    setModalAssinatura({ visivel: false, funcId: '', idVale: '' });
  };

  const funcionariosFiltrados = funcionarios.filter(f => f.nome.toLowerCase().includes(termoBusca.toLowerCase()));

  return (
    <div style={{ padding: '16px', backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: 'system-ui' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        
        {/* Cabeçalho Responsivo */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ backgroundColor: '#f0fdf4', padding: '12px', borderRadius: '14px' }}>
              <Wallet size={26} color="#16a34a" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '20px', color: '#0f172a' }}>Gestão Financeira</h1>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Transporte, Vales e Holerites</p>
            </div>
          </div>

          {/* Filtros e Busca */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'white', padding: '8px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', flex: 1 }}>
              <Search size={16} color="#94a3b8" />
              <input 
                type="text" 
                placeholder="Buscar colaborador..." 
                value={termoBusca} 
                onChange={e => setTermoBusca(e.target.value)} 
                style={{ border: 'none', outline: 'none', fontSize: '13px', width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'white', padding: '8px 12px', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                Dias: 
                <input type="number" value={diasUteis} onChange={e => setDiasUteis(parseInt(e.target.value) || 0)} style={{ border: '1px solid #e2e8f0', borderRadius: '4px', outline: 'none', fontWeight: 'bold', color: '#0ea5e9', fontSize: '13px', width: '38px', textAlign: 'center' }} />
                <Edit3 size={12} color="#94a3b8"/>
              </span>
              <input type="month" value={mesFiltro} onChange={e => setMesFiltro(e.target.value)} style={{ border: 'none', outline: 'none', fontWeight: 'bold', fontSize: '12px' }} />
            </div>
          </div>

          {/* Botões de Ação Principais */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Button onClick={() => setMostrarModalWhatsapp(true)} style={{ backgroundColor: '#25d366', color: 'white', display: 'flex', justifyContent: 'center', gap: '8px', minHeight: '44px', width: '100%' }}>
              <Send size={18}/> Enviar Pagamentos no WhatsApp
            </Button>

            <div style={{ display: 'flex', gap: '8px' }}>
              <Button onClick={() => exportarPdfPixTransporte(funcionarios, dadosFinanceiros, diasUteis, mesFiltro)} style={{ backgroundColor: '#0f172a', display: 'flex', justifyContent: 'center', gap: '6px', minHeight: '42px', flex: 1, fontSize: '12px' }}>
                <Download size={16}/> PDF - PIX / VT
              </Button>
              <Button onClick={() => exportarPdfValesEscritorio(funcionarios, dadosFinanceiros, mesFiltro)} style={{ backgroundColor: '#b91c1c', display: 'flex', justifyContent: 'center', gap: '6px', minHeight: '42px', flex: 1, fontSize: '12px' }}>
                <Download size={16}/> PDF - Vales
              </Button>
            </div>
          </div>
        </div>

        {/* Lista de Colaboradores */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {funcionariosFiltrados.map(func => (
            <CardFuncionarioFinanceiro 
              key={func.id}
              func={func}
              dadosFunc={dadosFinanceiros[func.id] || {}}
              diasUteisBase={diasUteis}
              onExportarTermoPdf={(f) => exportarPdfTermoIndividual(f, dadosFinanceiros, mesFiltro)}
              onSalvarChavePix={salvarChavePix}
              onSalvarDiasPersonalizados={salvarDiasPersonalizados}
              onAbrirTransporte={abrirModalTransporte}
              onAbrirAdiantamento={abrirModalAdiantamento}
              onExcluirAdiantamento={excluirAdiantamento}
              onAbrirAssinatura={(funcId, idVale) => setModalAssinatura({ visivel: true, funcId, idVale })}
            />
          ))}
        </div>
      </div>

      {/* Modais da Aplicação */}
      <ModalTransporte 
        visivel={modalTransporte.visivel}
        dados={modalTransporte}
        onAdicionarRota={() => setModalTransporte(prev => ({ ...prev, rotas: [...prev.rotas, { id: Date.now().toString(), nomeConducao: '', valor: '', qtdDiaria: 1 }] }))}
        onRemoverRota={(id) => setModalTransporte(prev => ({ ...prev, rotas: prev.rotas.filter(r => r.id !== id) }))}
        onAtualizarRota={(id, campo, valor) => setModalTransporte(prev => ({ ...prev, rotas: prev.rotas.map(r => r.id === id ? { ...r, [campo]: valor } : r) }))}
        onSalvar={salvarConfiguracaoRotas}
        onCancelar={() => setModalTransporte({ visivel: false, funcId: '', nome: '', rotas: [] })}
      />

      <ModalAdiantamento 
        visivel={modalAdiantamento.visivel}
        dados={modalAdiantamento}
        setDados={setModalAdiantamento}
        onSalvar={salvarAdiantamento}
        onCancelar={() => setModalAdiantamento({ visivel: false, funcId: '', nome: '', idVale: '', valor: '', motivo: '', dataIso: '' })}
      />

      <ModalAssinatura 
        visivel={modalAssinatura.visivel}
        onSalvar={salvarAssinatura}
        onCancelar={() => setModalAssinatura({ visivel: false, funcId: '', idVale: '' })}
      />

      {mostrarModalWhatsapp && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '8px', backdropFilter: 'blur(3px)' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '800px', maxHeight: '95vh', overflowY: 'auto' }}>
            <EnvioPagamentosWhatsapp 
              funcionariosList={funcionarios}
              dadosFinanceirosMap={dadosFinanceiros}
              diasUteisBase={diasUteis}
              mesFiltro={mesFiltro}
              onClose={() => setMostrarModalWhatsapp(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}