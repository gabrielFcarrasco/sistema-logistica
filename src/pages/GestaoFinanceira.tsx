// src/pages/GestaoFinanceira.tsx
import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, doc, setDoc, query, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase'; 
import { dbFolha } from '../services/firebaseFolha'; 
import { Wallet, Banknote, PlusCircle, ArrowRight, User, Bus, Route, Trash2, QrCode, FileText, Download, Edit3 } from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

// Importações do motor de PDF
import jsPDF from 'jspdf';
import 'jspdf-autotable';

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

  // 🚀 NOVO: Estado editável para a quantidade de dias
  const [diasUteis, setDiasUteis] = useState<number>(calcularDiasUteis(new Date().toISOString().substring(0, 7)));

  // Atualiza os dias úteis padrão caso o mês mude
  useEffect(() => {
    setDiasUteis(calcularDiasUteis(mesFiltro));
  }, [mesFiltro]);

  // Estados dos Modais de Adiantamento e Transporte
  const [modalAdiantamento, setModalAdiantamento] = useState<{ visivel: boolean, funcId: string, nome: string }>({ visivel: false, funcId: '', nome: '' });
  const [valorAdiantamento, setValorAdiantamento] = useState('');
  const [motivoAdiantamento, setMotivoAdiantamento] = useState('');

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

  // Lógica de Chave PIX (Agora salva padrão no perfil global do funcionário)
  const salvarChavePix = async (funcId: string, chave: string) => {
    const idDoc = `${funcId}_${mesFiltro}`;
    await setDoc(doc(dbFolha, 'financeiro_mes', idDoc), { chavePix: chave }, { merge: true });
    // 🚀 NOVO: Salva globalmente para os próximos meses
    await setDoc(doc(db, 'funcionarios', funcId), { chavePixPadrao: chave }, { merge: true });
    setDadosFinanceiros(prev => ({ ...prev, [funcId]: { ...prev[funcId], chavePix: chave } }));
  };

  // Lógica do Construtor de Rotas
  const abrirModalTransporte = (funcId: string, nome: string) => {
    const dadosFunc = dadosFinanceiros[funcId] || {};
    // 🚀 NOVO: Se tiver rota no mês, usa. Senão, puxa as rotas padrão do cadastro do funcionário.
    const funcGlobal = funcionarios.find(f => f.id === funcId);
    const rotasAtuais = dadosFunc.transportes !== undefined ? dadosFunc.transportes : (funcGlobal?.transportesPadrao || []);
    
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
      ...prev, rotas: prev.rotas.map(r => r.id === idLinha ? { ...r, [campo]: valor } : r)
    }));
  };

  const salvarConfiguracaoRotas = async () => {
    const { funcId, nome, rotas } = modalTransporte;
    const idDoc = `${funcId}_${mesFiltro}`;
    
    let totalDiario = 0;
    rotas.forEach(rota => {
      const valor = parseFloat(rota.valor) || 0;
      const qtd = parseInt(rota.qtdDiaria) || 0;
      totalDiario += (valor * qtd);
    });
    const valorMensalTotal = totalDiario * diasUteis;

    // Salvar no mês específico
    await setDoc(doc(dbFolha, 'financeiro_mes', idDoc), {
      funcionarioId: funcId, nomeFuncionario: nome, mesReferencia: mesFiltro,
      transportes: rotas, valorPassagemDiario: totalDiario, valorPassagem: valorMensalTotal
    }, { merge: true });

    // 🚀 NOVO: Salvar o PADRÃO no cadastro do funcionário (vale para os meses subsequentes)
    await setDoc(doc(db, 'funcionarios', funcId), {
      transportesPadrao: rotas,
      valorPassagemDiarioPadrao: totalDiario
    }, { merge: true });

    setDadosFinanceiros(prev => ({
      ...prev, [funcId]: { ...prev[funcId], transportes: rotas, valorPassagemDiario: totalDiario, valorPassagem: valorMensalTotal }
    }));
    setModalTransporte({ visivel: false, funcId: '', nome: '', rotas: [] });
  };

  const salvarAdiantamento = async () => {
    if (!valorAdiantamento) return;
    const { funcId, nome } = modalAdiantamento;
    const idDoc = `${funcId}_${mesFiltro}`;
    const valor = parseFloat(valorAdiantamento) || 0;
    
    const novoAdiantamento = { 
      id: Date.now().toString(), 
      data: new Date().toLocaleDateString('pt-BR'), 
      valor: valor, 
      motivo: motivoAdiantamento || 'Adiantamento / Vale' 
    };

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

  const excluirAdiantamento = async (funcId: string, idAdiantamento: string) => {
    const idDoc = `${funcId}_${mesFiltro}`;
    const dadosAtuais = dadosFinanceiros[funcId] || {};
    const adiantamentosAtuais = dadosAtuais.adiantamentos || [];
    const novaLista = adiantamentosAtuais.filter((ad: any) => ad.id !== idAdiantamento);

    await setDoc(doc(dbFolha, 'financeiro_mes', idDoc), {
      adiantamentos: novaLista
    }, { merge: true });

    setDadosFinanceiros(prev => ({
      ...prev,
      [funcId]: { ...prev[funcId], adiantamentos: novaLista }
    }));
  };

  // Geração de PDF 1 (Transporte e PIX) com cálculos reativos
  const exportarPdfPixTransporte = () => {
    const docPdf = new jsPDF('p', 'mm', 'a4');
    const azul = [30, 41, 59];

    docPdf.setFont("helvetica", "bold");
    docPdf.setFontSize(14);
    docPdf.setTextColor(azul[0], azul[1], azul[2]);
    docPdf.text("RELATÓRIO DE TRANSPORTE E CHAVES PIX", 105, 15, { align: 'center' });
    
    docPdf.setFontSize(10);
    docPdf.setTextColor(100);
    docPdf.text(`Mês de Referência: ${mesFiltro.split('-').reverse().join('/')} | Dias Úteis: ${diasUteis}`, 105, 22, { align: 'center' });

    const corpoTabela: any[] = [];
    let valorTotalGeral = 0;

    funcionarios.forEach(func => {
      const dados = dadosFinanceiros[func.id] || {};
      
      // 🚀 NOVO: Puxa o dado do mês ou o padrão (se o mês estiver em branco)
      const totalDiario = dados.valorPassagemDiario !== undefined ? dados.valorPassagemDiario : (func.valorPassagemDiarioPadrao || 0);
      const chavePix = dados.chavePix !== undefined ? dados.chavePix : (func.chavePixPadrao || 'Não informada');
      const totalPass = totalDiario * diasUteis; 

      if (totalPass > 0) {
        valorTotalGeral += totalPass;
        corpoTabela.push([
          func.nome.toUpperCase(),
          chavePix,
          diasUteis.toString(),
          `R$ ${totalPass.toFixed(2)}`
        ]);
      }
    });

    (docPdf as any).autoTable({
      startY: 30,
      head: [["Colaborador", "Chave PIX", "Dias Úteis", "Valor a Pagar (VT)"]],
      body: corpoTabela,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3, halign: 'center' },
      headStyles: { fillColor: azul, textColor: 255 },
      columnStyles: { 0: { halign: 'left' }, 1: { halign: 'left' }, 3: { fontStyle: 'bold', textColor: [22, 101, 52] } }
    });

    const finalY = (docPdf as any).lastAutoTable.finalY + 10;
    docPdf.setFont("helvetica", "bold");
    docPdf.setFontSize(11);
    docPdf.setTextColor(0);
    docPdf.text(`TOTAL GERAL DE TRANSPORTE: R$ ${valorTotalGeral.toFixed(2)}`, 14, finalY);

    docPdf.save(`Relatorio_Transporte_PIX_${mesFiltro}.pdf`);
  };

  const exportarPdfValesEscritorio = () => {
    const docPdf = new jsPDF('p', 'mm', 'a4');
    const vermelho = [185, 28, 28];

    docPdf.setFont("helvetica", "bold");
    docPdf.setFontSize(14);
    docPdf.setTextColor(vermelho[0], vermelho[1], vermelho[2]);
    docPdf.text("RELATÓRIO DE VALES PARA DESCONTO EM FOLHA", 105, 15, { align: 'center' });
    
    docPdf.setFontSize(10);
    docPdf.setTextColor(100);
    docPdf.text(`Competência: ${mesFiltro.split('-').reverse().join('/')}`, 105, 22, { align: 'center' });

    const corpoTabela: any[] = [];
    let totalGeralVales = 0;

    funcionarios.forEach(func => {
      const dados = dadosFinanceiros[func.id] || {};
      const adiantamentos = dados.adiantamentos || [];
      const totalFunc = adiantamentos.reduce((acc: number, curr: any) => acc + curr.valor, 0);

      if (totalFunc > 0) {
        totalGeralVales += totalFunc;
        const descricaoVales = adiantamentos.map((ad: any) => `• [${ad.data}] ${ad.motivo}: R$ ${ad.valor.toFixed(2)}`).join('\n');
        
        corpoTabela.push([
          func.nome.toUpperCase(),
          descricaoVales,
          `R$ ${totalFunc.toFixed(2)}`
        ]);
      }
    });

    (docPdf as any).autoTable({
      startY: 30,
      head: [["Colaborador", "Discriminação dos Adiantamentos", "Total a Descontar"]],
      body: corpoTabela,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 4, valign: 'middle' },
      headStyles: { fillColor: vermelho, textColor: 255 },
      columnStyles: { 0: { fontStyle: 'bold' }, 2: { halign: 'right', fontStyle: 'bold', textColor: vermelho } }
    });

    const finalY = (docPdf as any).lastAutoTable.finalY + 10;
    docPdf.setFont("helvetica", "bold");
    docPdf.setFontSize(11);
    docPdf.setTextColor(0);
    docPdf.text(`TOTAL GERAL DE VALES A DESCONTAR: R$ ${totalGeralVales.toFixed(2)}`, 14, finalY);

    docPdf.save(`Relatorio_Vales_Contabilidade_${mesFiltro}.pdf`);
  };

  const funcionariosFiltrados = funcionarios.filter(f => f.nome.toLowerCase().includes(termoBusca.toLowerCase()));

  return (
    <div style={{ padding: '30px', backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: 'system-ui' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '30px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div style={{ backgroundColor: '#f0fdf4', padding: '15px', borderRadius: '16px' }}><Wallet size={30} color="#16a34a" /></div>
              <div>
                <h1 style={{ margin: 0, fontSize: '24px', color: '#0f172a' }}>Gestão Financeira e Vales</h1>
                <p style={{ margin: 0, color: '#64748b' }}>Cálculo de Rotas de Transporte e Caixinha da Empresa</p>
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'white', padding: '8px 15px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  Dias Úteis (Mês): 
                  {/* 🚀 NOVO: Input numérico para configurar dias na hora */}
                  <input 
                    type="number" 
                    value={diasUteis} 
                    onChange={e => setDiasUteis(parseInt(e.target.value) || 0)} 
                    style={{ border: '1px solid #e2e8f0', borderRadius: '6px', outline: 'none', fontWeight: 'bold', color: '#0ea5e9', fontSize: '15px', width: '45px', textAlign: 'center', padding: '2px' }} 
                    title="Altere manualmente os dias úteis deste mês"
                  />
                  <Edit3 size={14} color="#94a3b8"/>
                </span>
                <span style={{ borderLeft: '1px solid #e2e8f0', height: '20px', margin: '0 5px' }}></span>
                <input type="month" value={mesFiltro} onChange={e => setMesFiltro(e.target.value)} style={{ border: 'none', outline: 'none', fontWeight: 'bold' }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <Button onClick={exportarPdfPixTransporte} style={{ backgroundColor: '#0f172a', display: 'flex', gap: '8px' }}>
              <Download size={18}/> PDF - PIX e Transporte
            </Button>
            <Button onClick={exportarPdfValesEscritorio} style={{ backgroundColor: '#b91c1c', display: 'flex', gap: '8px' }}>
              <Download size={18}/> PDF - Vales Contabilidade
            </Button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {funcionariosFiltrados.map(func => {
            const dadosFunc = dadosFinanceiros[func.id] || {};
            const adiantamentos = dadosFunc.adiantamentos || [];
            const totalAdiantado = adiantamentos.reduce((acc: number, curr: any) => acc + curr.valor, 0);
            
            // 🚀 NOVO: Puxa o dado do mês atual ou herda o Padrão do Funcionario
            const rotasFunc = dadosFunc.transportes !== undefined ? dadosFunc.transportes : (func.transportesPadrao || []);
            const totalPassagemDiario = dadosFunc.valorPassagemDiario !== undefined ? dadosFunc.valorPassagemDiario : (func.valorPassagemDiarioPadrao || 0);
            const chavePixExibida = dadosFunc.chavePix !== undefined ? dadosFunc.chavePix : (func.chavePixPadrao || '');
            
            // 🚀 NOVO: O valor mensal é calculado dinamicamente com base nos 'diasUteis' configurados na tela
            const totalPassagemCalculado = totalPassagemDiario * diasUteis;

            return (
              <div key={func.id} style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '15px', flexWrap: 'wrap', gap: '15px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', backgroundColor: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><User size={20} color="#475569" /></div>
                    <strong style={{ fontSize: '18px', color: '#1e293b' }}>{func.nome}</strong>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#f8fafc', padding: '6px 12px', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                    <QrCode size={16} color="#64748b" />
                    <input 
                      type="text" 
                      placeholder="Chave PIX..." 
                      defaultValue={chavePixExibida}
                      onBlur={(e) => salvarChavePix(func.id, e.target.value)}
                      style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', width: '200px' }}
                    />
                  </div>
                </div>

                <div style={{ backgroundColor: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px dashed #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                  <div>
                    <h4 style={{ margin: '0 0 5px 0', fontSize: '13px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase' }}><Bus size={14}/> Vale Transporte</h4>
                    {rotasFunc.length > 0 ? (
                      <p style={{ margin: 0, fontSize: '13px', color: '#334155' }}>
                        Custo Diário: <strong>R$ {totalPassagemDiario.toFixed(2)}</strong> | Previsto no Mês ({diasUteis} dias): <strong style={{ color: '#0ea5e9', fontSize: '15px' }}>R$ {totalPassagemCalculado.toFixed(2)}</strong>
                      </p>
                    ) : (
                      <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', fontStyle: 'italic' }}>Nenhuma rota configurada.</p>
                    )}
                  </div>
                  <Button onClick={() => abrirModalTransporte(func.id, func.nome)} style={{ backgroundColor: 'white', color: '#0f172a', border: '1px solid #cbd5e1', fontSize: '13px', height: '40px', gap: '8px' }}>
                    <Route size={16} /> Configurar Rotas
                  </Button>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h4 style={{ margin: 0, fontSize: '14px', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}><Banknote size={16} /> Adiantamentos (Caixinha)</h4>
                    <button onClick={() => setModalAdiantamento({ visivel: true, funcId: func.id, nome: func.nome })} style={{ backgroundColor: '#eff6ff', color: '#3b82f6', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <PlusCircle size={14} /> Novo Vale
                    </button>
                  </div>

                  {adiantamentos.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {adiantamentos.map((ad: any) => (
                        <div key={ad.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fef2f2', padding: '10px 15px', borderRadius: '8px', fontSize: '13px', border: '1px solid #fee2e2' }}>
                          <span style={{ color: '#991b1b' }}>{ad.data} - {ad.motivo}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <strong style={{ color: '#b91c1c' }}>R$ {ad.valor.toFixed(2)}</strong>
                            <button onClick={() => excluirAdiantamento(func.id, ad.id)} title="Excluir este vale" style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}>
                              <Trash2 size={16} />
                            </button>
                          </div>
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
               <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {modalTransporte.rotas.map(rota => (
                    <div key={rota.id} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                       <input type="text" placeholder="Nome (Ex: Ônibus)" value={rota.nomeConducao} onChange={e => atualizarLinhaRota(rota.id, 'nomeConducao', e.target.value)} style={{ flex: 2, padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                       <input type="number" placeholder="Valor (R$)" value={rota.valor} onChange={e => atualizarLinhaRota(rota.id, 'valor', e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                       <select value={rota.qtdDiaria} onChange={e => atualizarLinhaRota(rota.id, 'qtdDiaria', parseInt(e.target.value))} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                          <option value={1}>1x ao dia</option>
                          <option value={2}>2x ao dia</option>
                          <option value={3}>3x ao dia</option>
                          <option value={4}>4x ao dia</option>
                       </select>
                       <button onClick={() => removerLinhaRota(rota.id)} style={{ backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer' }}><Trash2 size={18} /></button>
                    </div>
                  ))}
               </div>
               <Button onClick={adicionarLinhaRota} style={{ marginTop: '15px', backgroundColor: 'white', color: '#3b82f6', border: '1px dashed #3b82f6', width: '100%', display: 'flex', justifyContent: 'center', gap: '8px' }}><PlusCircle size={16} /> Adicionar Nova Condução</Button>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <Button onClick={() => setModalTransporte({ visivel: false, funcId: '', nome: '', rotas: [] })} style={{ flex: 1, backgroundColor: '#f1f5f9', color: '#475569' }}>Cancelar</Button>
              <Button onClick={salvarConfiguracaoRotas} style={{ flex: 1, backgroundColor: '#0ea5e9' }}>Salvar Configuração <ArrowRight size={16}/></Button>
            </div>
          </div>
        </div>
      )}

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

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}