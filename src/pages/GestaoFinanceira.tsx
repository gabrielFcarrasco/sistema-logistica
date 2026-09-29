// src/pages/GestaoFinanceira.tsx
import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, doc, setDoc, query, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase'; 
import { dbFolha } from '../services/firebaseFolha'; 
import { Wallet, Banknote, PlusCircle, Printer, ArrowRight, User, Bus, Route, Trash2 } from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

// Motor de Cálculo de Dias Úteis
const calcularDiasUteis = (mesAnoFiltro: string) => {
  const ano = parseInt(mesAnoFiltro.split('-')[0]);
  const mes = parseInt(mesAnoFiltro.split('-')[1]);
  const diasNoMes = new Date(ano, mes, 0).getDate();
  
  const FERIADOS_SP = ['01-01', '01-25', '04-21', '05-01', '07-09', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25'];

  let diasUteis = 0;
  for (let dia = 1; dia <= diasNoMes; dia++) {
    const dataObj = new Date(ano, mes - 1, dia);
    const diaSemana = dataObj.getDay(); 
    const mesDiaStr = `${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

    if (diaSemana !== 0 && diaSemana !== 6 && !FERIADOS_SP.includes(mesDiaStr)) {
      diasUteis++;
    }
  }
  return diasUteis;
};

export default function GestaoFinanceira() {
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [dadosFinanceiros, setDadosFinanceiros] = useState<Record<string, any>>({});
  const [mesFiltro, setMesFiltro] = useState(new Date().toISOString().substring(0, 7));
  const [termoBusca, setTermoBusca] = useState('');

  const diasUteisDoMes = useMemo(() => calcularDiasUteis(mesFiltro), [mesFiltro]);

  // Estados dos Modais
  const [modalAdiantamento, setModalAdiantamento] = useState<{ visivel: boolean, funcId: string, nome: string }>({ visivel: false, funcId: '', nome: '' });
  const [valorAdiantamento, setValorAdiantamento] = useState('');
  const [motivoAdiantamento, setMotivoAdiantamento] = useState('');

  // 🚀 NOVO: Estado do Modal de Construtor de Rotas de Transporte
  const [modalTransporte, setModalTransporte] = useState<{ visivel: boolean, funcId: string, nome: string, rotas: any[] }>({ visivel: false, funcId: '', nome: '', rotas: [] });

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
        const data = doc.data();
        if (doc.id.includes(mesFiltro)) {
          financasMap[data.funcionarioId] = data;
        }
      });
      setDadosFinanceiros(financasMap);
    };
    carregarFinancas();
  }, [mesFiltro]);

  // 🚀 LÓGICA DO CONSTRUTOR DE ROTAS
  const abrirModalTransporte = (funcId: string, nome: string) => {
    const rotasAtuais = dadosFinanceiros[funcId]?.transportes || [];
    setModalTransporte({ visivel: true, funcId, nome, rotas: [...rotasAtuais] });
  };

  const adicionarLinhaRota = () => {
    const novaRota = { id: Date.now().toString(), nomeConducao: '', valor: '', qtdDiaria: 1 };
    setModalTransporte(prev => ({ ...prev, rotas: [...prev.rotas, novaRota] }));
  };

  const removerLinhaRota = (idLinha: string) => {
    setModalTransporte(prev => ({ ...prev, rotas: prev.rotas.filter(r => r.id !== idLinha) }));
  };

  const atualizarLinhaRota = (idLinha: string, campo: string, valor: any) => {
    setModalTransporte(prev => ({
      ...prev,
      rotas: prev.rotas.map(r => r.id === idLinha ? { ...r, [campo]: valor } : r)
    }));
  };

  const salvarConfiguracaoRotas = async () => {
    const { funcId, nome, rotas } = modalTransporte;
    const idDoc = `${funcId}_${mesFiltro}`;
    
    // Calcula o valor total diário baseado nas rotas inseridas
    let totalDiario = 0;
    rotas.forEach(rota => {
      const valor = parseFloat(rota.valor) || 0;
      const qtd = parseInt(rota.qtdDiaria) || 0;
      totalDiario += (valor * qtd);
    });

    // Multiplica o total diário pelos dias úteis para ter o valor mensal
    const valorMensalTotal = totalDiario * diasUteisDoMes;

    await setDoc(doc(dbFolha, 'financeiro_mes', idDoc), {
      funcionarioId: funcId,
      nomeFuncionario: nome,
      mesReferencia: mesFiltro,
      transportes: rotas, // Guarda o array detalhado
      valorPassagemDiario: totalDiario,
      valorPassagem: valorMensalTotal // Guarda o total final
    }, { merge: true });

    setDadosFinanceiros(prev => ({
      ...prev,
      [funcId]: { 
        ...prev[funcId], 
        transportes: rotas,
        valorPassagemDiario: totalDiario,
        valorPassagem: valorMensalTotal 
      }
    }));

    setModalTransporte({ visivel: false, funcId: '', nome: '', rotas: [] });
  };

  // Lógica de Adiantamentos (Mantida igual)
  const salvarAdiantamento = async () => {
    if (!valorAdiantamento) return;
    const { funcId, nome } = modalAdiantamento;
    const idDoc = `${funcId}_${mesFiltro}`;
    const valor = parseFloat(valorAdiantamento) || 0;
    
    const novoAdiantamento = { id: Date.now().toString(), data: new Date().toLocaleDateString('pt-BR'), valor: valor, motivo: motivoAdiantamento || 'Adiantamento / Vale' };
    const dadosAtuais = dadosFinanceiros[funcId] || {};
    const adiantamentosAtuais = dadosAtuais.adiantamentos || [];
    const novaLista = [...adiantamentosAtuais, novoAdiantamento];

    await setDoc(doc(dbFolha, 'financeiro_mes', idDoc), {
      funcionarioId: funcId, nomeFuncionario: nome, mesReferencia: mesFiltro, adiantamentos: novaLista
    }, { merge: true });

    setDadosFinanceiros(prev => ({ ...prev, [funcId]: { ...prev[funcId], adiantamentos: novaLista } }));
    setModalAdiantamento({ visivel: false, funcId: '', nome: '' });
    setValorAdiantamento(''); setMotivoAdiantamento('');
  };

  const funcionariosFiltrados = funcionarios.filter(f => f.nome.toLowerCase().includes(termoBusca.toLowerCase()));
  const imprimirRelatorio = () => window.print();

  return (
    <div style={{ padding: '30px', backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: 'system-ui' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }} className="no-print">
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ backgroundColor: '#f0fdf4', padding: '15px', borderRadius: '16px' }}><Wallet size={30} color="#16a34a" /></div>
            <div>
              <h1 style={{ margin: 0, fontSize: '24px', color: '#0f172a' }}>Gestão Financeira e Vales</h1>
              <p style={{ margin: 0, color: '#64748b' }}>Cálculo de Rotas de Transporte e Caixinha da Empresa</p>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'white', padding: '8px 15px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
               <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569' }}>Dias Úteis: <span style={{ color: '#0ea5e9', fontSize: '15px' }}>{diasUteisDoMes}</span></span>
               <input type="month" value={mesFiltro} onChange={e => setMesFiltro(e.target.value)} style={{ border: 'none', outline: 'none', fontWeight: 'bold' }} />
            </div>
            <Button onClick={imprimirRelatorio} style={{ backgroundColor: '#0f172a', display: 'flex', gap: '8px' }}><Printer size={18}/> Relatório</Button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {funcionariosFiltrados.map(func => {
            const dadosFunc = dadosFinanceiros[func.id] || {};
            const adiantamentos = dadosFunc.adiantamentos || [];
            const totalAdiantado = adiantamentos.reduce((acc: number, curr: any) => acc + curr.valor, 0);

            // Valores de transporte atuais
            const rotasFunc = dadosFunc.transportes || [];
            const totalPassagemDiario = dadosFunc.valorPassagemDiario || 0;
            const totalPassagemCalculado = dadosFunc.valorPassagem || 0;

            return (
              <div key={func.id} style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid #f1f5f9', paddingBottom: '15px' }}>
                  <div style={{ width: '40px', height: '40px', backgroundColor: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><User size={20} color="#475569" /></div>
                  <strong style={{ fontSize: '18px', color: '#1e293b' }}>{func.nome}</strong>
                </div>

                {/* 🚌 PAINEL DE TRANSPORTE (VISÃO LIMPA) */}
                <div style={{ backgroundColor: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px dashed #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} className="no-print">
                  <div>
                    <h4 style={{ margin: '0 0 5px 0', fontSize: '13px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase' }}><Bus size={14}/> Vale Transporte</h4>
                    
                    {rotasFunc.length > 0 ? (
                      <p style={{ margin: 0, fontSize: '13px', color: '#334155' }}>
                        Custo Diário: <strong>R$ {totalPassagemDiario.toFixed(2)}</strong> | Previsto no Mês ({diasUteisDoMes} dias): <strong style={{ color: '#0ea5e9', fontSize: '15px' }}>R$ {totalPassagemCalculado.toFixed(2)}</strong>
                      </p>
                    ) : (
                      <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', fontStyle: 'italic' }}>Nenhuma rota configurada.</p>
                    )}
                  </div>

                  <Button onClick={() => abrirModalTransporte(func.id, func.nome)} style={{ backgroundColor: 'white', color: '#0f172a', border: '1px solid #cbd5e1', fontSize: '13px', height: '40px', gap: '8px' }}>
                    <Route size={16} /> Configurar Rotas
                  </Button>
                </div>
                
                {/* Visão limpa para a Contabilidade (Print) */}
                <div className="print-only" style={{ display: 'none', borderBottom: '1px dashed #cbd5e1', paddingBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                    <span style={{ fontWeight: 'bold' }}>Vale Transporte (Mês)</span>
                    <strong>R$ {totalPassagemCalculado.toFixed(2)}</strong>
                  </div>
                </div>

                {/* CAIXINHA / ADIANTAMENTOS */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h4 style={{ margin: 0, fontSize: '14px', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}><Banknote size={16} /> Adiantamentos (Caixinha)</h4>
                    <button 
                      onClick={() => setModalAdiantamento({ visivel: true, funcId: func.id, nome: func.nome })}
                      className="no-print"
                      style={{ backgroundColor: '#eff6ff', color: '#3b82f6', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <PlusCircle size={14} /> Novo Vale
                    </button>
                  </div>

                  {adiantamentos.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {adiantamentos.map((ad: any) => (
                        <div key={ad.id} style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: '#fef2f2', padding: '10px 15px', borderRadius: '8px', fontSize: '13px', border: '1px solid #fee2e2' }}>
                          <span style={{ color: '#991b1b' }}>{ad.data} - {ad.motivo}</span>
                          <strong style={{ color: '#b91c1c' }}>R$ {ad.valor.toFixed(2)}</strong>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 15px', borderTop: '2px solid #e2e8f0', marginTop: '5px' }}>
                        <strong style={{ color: '#1e293b', fontSize: '14px' }}>Total a Descontar:</strong>
                        <strong style={{ color: '#b91c1c', fontSize: '16px' }}>R$ {totalAdiantado.toFixed(2)}</strong>
                      </div>
                    </div>
                  ) : (
                    <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', fontStyle: 'italic' }}>Nenhum adiantamento registado neste mês.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 🚀 MODAL DO CONSTRUTOR DE ROTAS DE TRANSPORTE */}
      {modalTransporte.visivel && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px', backdropFilter: 'blur(3px)' }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '24px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', animation: 'fadeIn 0.3s' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
               <div style={{ backgroundColor: '#e0f2fe', padding: '10px', borderRadius: '50%' }}><Route size={24} color="#0284c7" /></div>
               <div>
                  <h3 style={{ margin: '0 0 2px 0', fontSize: '18px', color: '#0f172a' }}>Configurar Transporte</h3>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Colaborador: {modalTransporte.nome}</p>
               </div>
            </div>

            <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '15px', marginBottom: '20px' }}>
               <p style={{ margin: '0 0 15px 0', fontSize: '13px', color: '#475569' }}>Adicione todas as conduções que o colaborador pega **num único dia**. Por exemplo: se ele pega 1 ônibus para ir e 1 trem, mas só paga o ônibus na volta, deves adicionar Ônibus (2x) e Trem (1x).</p>
               
               <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {modalTransporte.rotas.map((rota, index) => (
                    <div key={rota.id} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                       <input 
                         type="text" placeholder="Nome (Ex: Ônibus)" value={rota.nomeConducao} 
                         onChange={e => atualizarLinhaRota(rota.id, 'nomeConducao', e.target.value)}
                         style={{ flex: 2, padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                       />
                       <input 
                         type="number" placeholder="Valor (R$)" value={rota.valor} 
                         onChange={e => atualizarLinhaRota(rota.id, 'valor', e.target.value)}
                         style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                       />
                       <select 
                         value={rota.qtdDiaria} onChange={e => atualizarLinhaRota(rota.id, 'qtdDiaria', parseInt(e.target.value))}
                         style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                       >
                          <option value={1}>1x ao dia</option>
                          <option value={2}>2x ao dia</option>
                          <option value={3}>3x ao dia</option>
                          <option value={4}>4x ao dia</option>
                       </select>
                       <button onClick={() => removerLinhaRota(rota.id)} style={{ backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer', display: 'flex' }}>
                          <Trash2 size={18} />
                       </button>
                    </div>
                  ))}
               </div>

               <Button onClick={adicionarLinhaRota} style={{ marginTop: '15px', backgroundColor: 'white', color: '#3b82f6', border: '1px dashed #3b82f6', width: '100%', display: 'flex', justifyContent: 'center', gap: '8px' }}>
                 <PlusCircle size={16} /> Adicionar Nova Condução
               </Button>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <Button onClick={() => setModalTransporte({ visivel: false, funcId: '', nome: '', rotas: [] })} style={{ flex: 1, backgroundColor: '#f1f5f9', color: '#475569' }}>Cancelar</Button>
              <Button onClick={salvarConfiguracaoRotas} style={{ flex: 1, backgroundColor: '#0ea5e9' }}>Salvar Configuração <ArrowRight size={16}/></Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ADIANTAMENTO (CAIXINHA) */}
      {modalAdiantamento.visivel && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(3px)' }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '16px', width: '100%', maxWidth: '400px', animation: 'fadeIn 0.3s' }}>
            <h3 style={{ margin: '0 0 5px 0', fontSize: '18px' }}>Lançar Vale/Adiantamento</h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748b' }}>Colaborador: {modalAdiantamento.nome}</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px' }}>
              <Input label="Valor (R$)" type="number" placeholder="Ex: 50.00" value={valorAdiantamento} onChange={e => setValorAdiantamento(e.target.value)} />
              <Input label="Motivo / Descrição" type="text" placeholder="Ex: Vale farmácia, Almoço..." value={motivoAdiantamento} onChange={e => setMotivoAdiantamento(e.target.value)} />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <Button onClick={() => setModalAdiantamento({ visivel: false, funcId: '', nome: '' })} style={{ flex: 1, backgroundColor: '#f1f5f9', color: '#475569' }}>Cancelar</Button>
              <Button onClick={salvarAdiantamento} style={{ flex: 1, backgroundColor: '#3b82f6' }}>Confirmar <ArrowRight size={16}/></Button>
            </div>
          </div>
        </div>
      )}

      {/* ESTILOS PARA IMPRESSÃO DO RELATÓRIO PARA A CONTABILIDADE */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background-color: white; }
          div { box-shadow: none !important; border-color: #cbd5e1 !important; }
        }
      `}</style>
    </div>
  );
}