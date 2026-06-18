// src/components/funcionarios/ModalFicha.tsx
import { useState, useEffect } from 'react';
import { doc, updateDoc, collection, query, where, onSnapshot, Timestamp, addDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { X, UserPlus, AlertTriangle, Lock, Edit3, Shirt, UserMinus, UserCheck, Archive, History, Plus, GraduationCap, ShieldCheck } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';

interface Props {
  funcionarioAberta: any;
  onClose: () => void;
  estoque: any[];
  treinamentosGlobais: any[];
  dssGlobais: any[]; // ✨ Recebendo o Histórico de DSS
  avisar: (msg: string, tipo?: 'sucesso' | 'erro') => void;
}

export default function ModalFicha({ funcionarioAberta, onClose, estoque, treinamentosGlobais, dssGlobais, avisar }: Props) {
  const [fichaAberta, setFichaAberta] = useState<any>(funcionarioAberta);
  const [historicoEntregas, setHistoricoEntregas] = useState<any[]>([]); 
  
  const [addHistAberto, setAddHistAberto] = useState(false);
  const [histData, setHistData] = useState('');
  const [histItem, setHistItem] = useState('');
  const [histQtd, setHistQtd] = useState('1');
  const [histMotivo, setHistMotivo] = useState('Registro Anterior ao Sistema');

  const [modalSenhaAberto, setModalSenhaAberto] = useState(false);
  const [senhaSocio, setSenhaSocio] = useState('');
  const [validandoSenha, setValidandoSenha] = useState(false);
  const [editandoRestrito, setEditandoRestrito] = useState(false);
  const [cpfEdit, setCpfEdit] = useState('');
  const [rgEdit, setRgEdit] = useState('');

  useEffect(() => { setFichaAberta(funcionarioAberta); }, [funcionarioAberta]);

  useEffect(() => {
    if (!fichaAberta) return;
    const q = query(collection(db, 'entregas'), where('funcionarioId', '==', fichaAberta.id));
    const unsub = onSnapshot(q, (snapshot) => {
      const entregas = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      entregas.sort((a, b) => (b.dataHora?.toMillis() || 0) - (a.dataHora?.toMillis() || 0));
      setHistoricoEntregas(entregas);
    });
    return () => unsub();
  }, [fichaAberta?.id]);

  const salvarEdicaoFicha = async () => {
    try {
      await updateDoc(doc(db, 'funcionarios', fichaAberta.id), { tamanhoUniforme: fichaAberta.tamanhoUniforme, tamanhoCalcado: fichaAberta.tamanhoCalcado });
      avisar("Medidas atualizadas!");
    } catch (error) { avisar("Erro ao atualizar.", "erro"); }
  };

  const alternarStatusFuncionario = async () => {
    const isDesligando = fichaAberta.status !== 'desligado';
    const msg = isDesligando 
      ? `Atenção: Deseja DESLIGAR ${fichaAberta.nome}?\nO BD irá ignorá-lo totalmente e ele não aparecerá em mais nenhuma lista do sistema.`
      : `Deseja REATIVAR o colaborador ${fichaAberta.nome} no sistema?`;

    if (!confirm(msg)) return;

    try {
      await updateDoc(doc(db, 'funcionarios', fichaAberta.id), {
        status: isDesligando ? 'desligado' : 'ativo',
        dataDesligamento: isDesligando ? serverTimestamp() : null
      });
      setFichaAberta({ ...fichaAberta, status: isDesligando ? 'desligado' : 'ativo' });
      avisar(isDesligando ? "Colaborador Desligado e Ocultado." : "Colaborador Reativado!");
    } catch (error) { avisar("Erro ao atualizar o status.", "erro"); }
  };

  const validarSenhaSocio = async () => {
    setValidandoSenha(true);
    try {
      const senhaDev = import.meta.env.VITE_DEV_PASS;
      if (senhaSocio === senhaDev && senhaDev !== undefined) { desbloquearCofre(); return; }
      const q = query(collection(db, 'usuarios'), where('nivel', '==', 'socio'), where('senha', '==', senhaSocio));
      const snap = await getDocs(q);
      if (!snap.empty) desbloquearCofre(); else avisar("Senha incorreta.", "erro");
    } catch (error) { avisar("Erro ao validar senha.", "erro"); }
    setValidandoSenha(false);
  };

  const desbloquearCofre = () => { setCpfEdit(fichaAberta?.cpf || ''); setRgEdit(fichaAberta?.rg || ''); setEditandoRestrito(true); setModalSenhaAberto(false); setSenhaSocio(''); };

  const salvarDadosRestritos = async () => {
    try {
      await updateDoc(doc(db, 'funcionarios', fichaAberta.id), { cpf: cpfEdit, rg: rgEdit });
      setFichaAberta({ ...fichaAberta, cpf: cpfEdit, rg: rgEdit }); setEditandoRestrito(false); avisar("Documentos atualizados!");
    } catch (error) { avisar("Erro.", "erro"); }
  };

  const salvarRegistroAntigo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const dataFormatada = new Date(`${histData}T12:00:00`);
      await addDoc(collection(db, 'entregas'), {
        setorId: fichaAberta?.setorId, funcionarioId: fichaAberta?.id, funcionarioNome: fichaAberta?.nome,
        itemId: 'historico_manual', itemNome: histItem, quantidade: Number(histQtd), durabilidade: 0,
        justificativa: histMotivo, assinatura: 'Registro Manual Anterior', dataHora: Timestamp.fromDate(dataFormatada), isRegistroAntigo: true 
      });
      avisar("Histórico adicionado!"); setAddHistAberto(false); setHistData(''); setHistItem(''); setHistQtd('1'); setHistMotivo('Registro Anterior ao Sistema');
    } catch (error) { avisar("Erro.", "erro"); }
  };

  const nomesEstoque = Array.from(new Set(estoque.map(i => i.nome).filter(Boolean)));
  if (!fichaAberta) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.9)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px', backdropFilter: 'blur(4px)' }}>
      <div style={{ backgroundColor: '#f8fafc', width: '100%', maxWidth: '1000px', borderRadius: '20px', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '90vh', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
        
        <div style={{ backgroundColor: fichaAberta.status === 'desligado' ? '#7f1d1d' : '#1e293b', padding: '20px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
              <div style={{ width: '55px', height: '55px', borderRadius: '50%', backgroundColor: 'white', overflow: 'hidden', border: '2px solid #475569' }}>
                {fichaAberta.fotoBase64 ? <img src={fichaAberta.fotoBase64} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: fichaAberta.status === 'desligado' ? 'grayscale(100%)' : 'none' }} /> : <UserPlus size={25} color="#94a3b8" style={{ margin: '12px' }} />}
              </div>
              <div>
              <h2 style={{ fontSize: '18px', margin: '0 0 5px 0', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
                {fichaAberta.nome} 
                {fichaAberta.status === 'desligado' && <span style={{ backgroundColor: '#ef4444', fontSize: '11px', padding: '2px 8px', borderRadius: '4px' }}>DESLIGADO</span>}
              </h2>
              <span style={{ fontSize: '13px', color: '#cbd5e1', backgroundColor: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '50px' }}>Matrícula: {fichaAberta.matricula}</span>
              </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer' }}><X size={28} /></button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', overflowY: 'auto', flex: 1 }}>
          <div style={{ flex: '1 1 300px', padding: '20px', backgroundColor: 'white', borderRight: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', flexDirection: 'column', fontSize: '13px', color: '#475569', backgroundColor: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: editandoRestrito ? '15px' : '0' }}>
                <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444' }}>
                  <AlertTriangle size={16} /> DADOS RESTRITOS
                </strong>
                {!editandoRestrito && (
                  <button onClick={() => setModalSenhaAberto(true)} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', fontSize: '11px', backgroundColor: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                    <Lock size={12} /> Editar
                  </button>
                )}
              </div>

              {!editandoRestrito ? (
                <div style={{ display: 'flex', gap: '20px', marginTop: '15px' }}>
                  <div><strong>CPF:</strong><br/>{fichaAberta.cpf ? '***.***.***-**' : 'Não informado'}</div>
                  <div><strong>RG:</strong><br/>{fichaAberta.rg ? '**.***.***-*' : 'Não informado'}</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <Input label="Novo CPF" value={cpfEdit} onChange={e => setCpfEdit(e.target.value)} />
                    <Input label="Novo RG" value={rgEdit} onChange={e => setRgEdit(e.target.value)} />
                  </div>
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '5px' }}>
                    <Button onClick={() => setEditandoRestrito(false)} style={{ backgroundColor: '#e2e8f0', color: '#475569', height: '35px', padding: '0 15px' }}>Cancelar</Button>
                    <Button onClick={salvarDadosRestritos} style={{ backgroundColor: '#10b981', height: '35px', padding: '0 15px' }}><Edit3 size={14} style={{marginRight: '5px'}}/> Salvar</Button>
                  </div>
                </div>
              )}
            </div>

            <h4 style={{ fontSize: '13px', color: '#1e293b', margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '6px' }}><Shirt size={16} color="#3b82f6" /> MEDIDAS DO COLABORADOR</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Tamanho Camisa / Calça</label>
                <select value={fichaAberta.tamanhoUniforme} onChange={e => setFichaAberta({...fichaAberta, tamanhoUniforme: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}>
                  <option value="Não informado">Selecione...</option>
                  {['P', 'M', 'G', 'GG', 'XG', 'G1', 'G2', 'G3'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <Input label="Tamanho Calçado / Bota" placeholder="Ex: 40" value={fichaAberta.tamanhoCalcado} onChange={e => setFichaAberta({...fichaAberta, tamanhoCalcado: e.target.value})} />
              </div>
              <Button onClick={salvarEdicaoFicha} style={{ height: '45px', backgroundColor: '#3b82f6', marginTop: '5px' }}>Salvar Medidas</Button>
            </div>

            <div style={{ marginTop: '25px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
              <h4 style={{ fontSize: '13px', color: '#1e293b', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <UserMinus size={16} color="#ef4444" /> ADMISSÃO E RESCISÃO
              </h4>
              <Button 
                onClick={alternarStatusFuncionario} 
                style={{ 
                  width: '100%', height: '45px', 
                  backgroundColor: fichaAberta.status === 'desligado' ? '#10b981' : '#fee2e2', 
                  color: fichaAberta.status === 'desligado' ? 'white' : '#ef4444', 
                  border: fichaAberta.status === 'desligado' ? 'none' : '1px solid #f87171' 
                }}
              >
                {fichaAberta.status === 'desligado' ? <><UserCheck size={16} style={{marginRight: '6px'}}/> Reativar Colaborador</> : <><Archive size={16} style={{marginRight: '6px'}}/> Desligar Colaborador</>}
              </Button>
            </div>

          </div>

          <div style={{ flex: '2 1 500px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* EPIs */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e2e8f0', paddingBottom: '12px', marginBottom: '15px' }}>
                <h4 style={{ fontSize: '16px', color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <History size={20} color="#f59e0b" /> EPIs E MATERIAIS
                </h4>
                <Button onClick={() => setAddHistAberto(!addHistAberto)} style={{ backgroundColor: addHistAberto ? '#64748b' : '#3b82f6', fontSize: '12px', padding: '8px 12px' }}>
                  {addHistAberto ? 'Fechar' : <><Plus size={16} style={{marginRight: '5px'}}/> Adicionar Antigo</>}
                </Button>
              </div>

              {addHistAberto && (
                <form onSubmit={salvarRegistroAntigo} style={{ backgroundColor: '#eff6ff', padding: '15px', borderRadius: '12px', border: '1px dashed #93c5fd', marginBottom: '20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
                    <Input label="Data da Entrega *" type="date" value={histData} onChange={e => setHistData(e.target.value)} required />
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Item Entregue *</label>
                      <input list="itens-estoque" value={histItem} onChange={e => setHistItem(e.target.value)} placeholder="Ex: Bota de Segurança" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} required />
                      <datalist id="itens-estoque">{nomesEstoque.map(n => <option key={n} value={n} />)}</datalist>
                    </div>
                    <Input label="Qtd *" type="number" value={histQtd} onChange={e => setHistQtd(e.target.value)} required />
                  </div>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                    <Input label="Observação / Motivo" value={histMotivo} onChange={e => setHistMotivo(e.target.value)} />
                    <Button type="submit" style={{ alignSelf: 'flex-end', height: '42px', backgroundColor: '#2563eb' }}>Salvar Registro</Button>
                  </div>
                </form>
              )}
              
              <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                {historicoEntregas.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                    <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>Nenhuma entrega registrada.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {historicoEntregas.map(ent => (
                      <div key={ent.id} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', backgroundColor: ent.isRegistroAntigo ? '#fefce8' : '#ffffff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <strong style={{ fontSize: '14px', color: '#1e293b' }}>{ent.quantidade}x {ent.itemNome}</strong>
                          <span style={{ fontSize: '11px', color: ent.isRegistroAntigo ? '#ca8a04' : '#64748b', backgroundColor: ent.isRegistroAntigo ? '#fef08a' : '#f1f5f9', padding: '2px 8px', borderRadius: '50px', fontWeight: 'bold' }}>
                            {ent.dataHora?.toDate().toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* TREINAMENTOS E DSS (LADO A LADO NA TELA GRANDE) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
              
              {/* BLOCO: TREINAMENTOS */}
              <div>
                <div style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: '12px', marginBottom: '15px' }}>
                  <h4 style={{ fontSize: '14px', color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <GraduationCap size={18} color="#8b5cf6" /> TREINAMENTOS (NR)
                  </h4>
                </div>
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {treinamentosGlobais.filter(t => t.participantes?.some((p:any) => p.funcionarioId === fichaAberta.id)).length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '15px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                      <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Nenhum treinamento.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {treinamentosGlobais
                        .filter(t => t.participantes?.some((p:any) => p.funcionarioId === fichaAberta.id))
                        .map(treino => (
                          <div key={treino.id} style={{ display: 'flex', flexDirection: 'column', padding: '10px', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#faf5ff' }}>
                            <strong style={{ fontSize: '13px', color: '#4c1d95' }}>{treino.titulo}</strong>
                            <span style={{ fontSize: '11px', color: '#7c3aed' }}>{new Date(`${treino.data}T12:00:00`).toLocaleDateString('pt-BR')} - {treino.cargaHoraria}h</span>
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>
              </div>

              {/* ✨ NOVO BLOCO: DSS */}
              <div>
                <div style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: '12px', marginBottom: '15px' }}>
                  <h4 style={{ fontSize: '14px', color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldCheck size={18} color="#0284c7" /> DIÁLOGOS (DSS)
                  </h4>
                </div>
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {dssGlobais.filter(d => d.participantes?.some((p:any) => p.funcionarioId === fichaAberta.id)).length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '15px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                      <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Nenhum DSS.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {dssGlobais
                        .filter(d => d.participantes?.some((p:any) => p.funcionarioId === fichaAberta.id))
                        .map(dss => (
                          <div key={dss.id} style={{ display: 'flex', flexDirection: 'column', padding: '10px', border: '1px solid #e0f2fe', borderRadius: '8px', backgroundColor: '#f0f9ff' }}>
                            <strong style={{ fontSize: '13px', color: '#0369a1' }}>{dss.tema}</strong>
                            <span style={{ fontSize: '11px', color: '#0284c7' }}>{new Date(`${dss.data}T12:00:00`).toLocaleDateString('pt-BR')} - {dss.lider}</span>
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>
              </div>

            </div>

          </div>
        </div>
      </div>

      {/* 🔐 MODAL DE SENHA INTERNO À FICHA */}
      {modalSenhaAberto && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.95)', zIndex: 11000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '20px', width: '100%', maxWidth: '350px', textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '20px', color: '#1e293b' }}>Acesso Restrito</h3>
            <Input label="" type="password" value={senhaSocio} onChange={e => setSenhaSocio(e.target.value)} placeholder="Digite a senha..." />
            <div style={{ display: 'flex', gap: '10px', marginTop: '25px' }}>
              <Button onClick={() => { setModalSenhaAberto(false); setSenhaSocio(''); }} style={{ flex: 1, backgroundColor: '#f1f5f9', color: '#475569' }}>Cancelar</Button>
              <Button onClick={validarSenhaSocio} disabled={validandoSenha || !senhaSocio} style={{ flex: 1, backgroundColor: '#ef4444' }}>Desbloquear</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}