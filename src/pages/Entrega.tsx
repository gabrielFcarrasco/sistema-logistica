import { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { collection, onSnapshot, query, where, addDoc, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { Building2, ClipboardSignature, CheckCircle2, AlertCircle, PenTool, Eraser } from 'lucide-react';

export default function Entrega() {
  const { setorAtivo } = useOutletContext<{ setorAtivo: string }>();
  
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [estoque, setEstoque] = useState<any[]>([]);
  
  const [funcionarioSelecionado, setFuncionarioSelecionado] = useState('');
  const [itemSelecionado, setItemSelecionado] = useState('');
  const [quantidade, setQuantidade] = useState('1');
  const [notificacao, setNotificacao] = useState<{msg: string, tipo: 'sucesso' | 'erro'} | null>(null);

  // Referências para o Canvas da Assinatura
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [desenhando, setDesenhando] = useState(false);
  const [temAssinatura, setTemAssinatura] = useState(false);

  const avisar = (msg: string, tipo: 'sucesso' | 'erro' = 'sucesso') => {
    setNotificacao({ msg, tipo });
    setTimeout(() => setNotificacao(null), 4000);
  };

  useEffect(() => {
    if (!setorAtivo) return;

    // Busca Funcionários
    const qFunc = query(collection(db, 'funcionarios'), where('setorId', '==', setorAtivo));
    const unsubFunc = onSnapshot(qFunc, (snap) => setFuncionarios(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    // Busca Estoque (Apenas itens com quantidade > 0)
    const qEstoque = query(collection(db, 'estoque'), where('setorId', '==', setorAtivo));
    const unsubEstoque = onSnapshot(qEstoque, (snap) => {
      const itens = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter((i: any) => i.quantidade > 0);
      setEstoque(itens);
    });

    return () => { unsubFunc(); unsubEstoque(); };
  }, [setorAtivo]);

  // Funções do Canvas de Assinatura
  const iniciarDesenho = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setDesenhando(true);
  };

  const desenhar = (e: any) => {
    if (!desenhando) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;

    ctx.lineTo(x, y);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.stroke();
    setTemAssinatura(true);
  };

  const pararDesenho = () => setDesenhando(false);

  const limparAssinatura = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    setTemAssinatura(false);
  };

  const registrarEntrega = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!funcionarioSelecionado || !itemSelecionado) {
      avisar("Selecione um funcionário e um item.", "erro");
      return;
    }
    if (!temAssinatura) {
      avisar("A assinatura do funcionário é obrigatória.", "erro");
      return;
    }

    const qtdDesejada = Number(quantidade);
    if (qtdDesejada <= 0) return;

    try {
      // 1. Verifica se tem estoque suficiente
      const itemRef = doc(db, 'estoque', itemSelecionado);
      const itemDoc = await getDoc(itemRef);
      if (!itemDoc.exists() || itemDoc.data().quantidade < qtdDesejada) {
        avisar("Quantidade insuficiente em estoque.", "erro");
        return;
      }

      // 2. Transforma o desenho em imagem Base64
      const imagemAssinatura = canvasRef.current?.toDataURL('image/png') || '';
      
      const funcData = funcionarios.find(f => f.id === funcionarioSelecionado);
      const itemData = estoque.find(i => i.id === itemSelecionado);

      // 3. Salva o registro de entrega
      await addDoc(collection(db, 'entregas'), {
        setorId: setorAtivo,
        funcionarioId: funcionarioSelecionado,
        funcionarioNome: funcData.nome,
        itemId: itemSelecionado,
        itemNome: itemData.nome,
        quantidade: qtdDesejada,
        dataHora: new Date().toISOString(),
        assinatura: imagemAssinatura
      });

      // 4. Desconta a quantidade do estoque
      const novaQuantidade = itemDoc.data().quantidade - qtdDesejada;
      await updateDoc(itemRef, { quantidade: novaQuantidade });

      avisar("Entrega registrada com sucesso!");
      
      // Limpa a tela para a próxima entrega
      setFuncionarioSelecionado(''); setItemSelecionado(''); setQuantidade('1');
      limparAssinatura();

    } catch (error) {
      console.error(error);
      avisar("Erro ao processar entrega.", "erro");
    }
  };

  if (!setorAtivo) return (
    <div style={{ textAlign: 'center', padding: '100px 20px' }}>
      <Building2 size={60} color="#cbd5e1" style={{ marginBottom: '20px' }} />
      <h2 style={{ color: '#1e293b' }}>Selecione uma Unidade</h2>
    </div>
  );

  return (
    <div style={{ position: 'relative' }}>
      {notificacao && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999, backgroundColor: notificacao.tipo === 'sucesso' ? '#10b981' : '#ef4444', color: 'white', padding: '12px 24px', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '500' }}>
          {notificacao.tipo === 'sucesso' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          {notificacao.msg}
        </div>
      )}

      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ color: '#1e293b', margin: 0, fontSize: '26px' }}>Nova Entrega de EPI</h1>
        <p style={{ color: '#64748b', marginTop: '4px' }}>Registre a entrega e colha a assinatura digital no tablet ou celular.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '30px' }}>
        
        {/* Painel Esquerdo: Formulário */}
        <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', boxShadow: 'var(--sombra-card)' }}>
          <h3 style={{ margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '8px', color: '#1e293b' }}>
            <ClipboardSignature size={20} color="var(--cor-primaria)" /> Dados da Entrega
          </h3>

          <form id="formEntrega" onSubmit={registrarEntrega} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#64748b', marginBottom: '8px' }}>Colaborador Recebedor</label>
              <select required value={funcionarioSelecionado} onChange={e => setFuncionarioSelecionado(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', backgroundColor: '#f8fafc', fontSize: '15px' }}>
                <option value="" disabled>Selecione o colaborador...</option>
                {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome} - {f.cargo}</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#64748b', marginBottom: '8px' }}>Material / EPI</label>
              <select required value={itemSelecionado} onChange={e => setItemSelecionado(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', backgroundColor: '#f8fafc', fontSize: '15px' }}>
                <option value="" disabled>Selecione o material em estoque...</option>
                {estoque.map(i => <option key={i.id} value={i.id}>{i.nome} (Disp: {i.quantidade})</option>)}
              </select>
            </div>

            <Input label="Quantidade Entregue" type="number" min="1" required value={quantidade} onChange={e => setQuantidade(e.target.value)} />
          </form>
        </div>

        {/* Painel Direito: Assinatura */}
        <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', boxShadow: 'var(--sombra-card)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#1e293b' }}>
              <PenTool size={20} color="var(--cor-primaria)" /> Assinatura do Colaborador
            </h3>
            <button type="button" onClick={limparAssinatura} style={{ background: 'none', border: 'none', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
              <Eraser size={16} /> Limpar
            </button>
          </div>

          <div style={{ flexGrow: 1, backgroundColor: '#f8fafc', border: '2px dashed #cbd5e1', borderRadius: '8px', position: 'relative', minHeight: '200px' }}>
            {/* O Canvas capta os eventos de mouse no PC e touch no celular */}
            <canvas 
              ref={canvasRef}
              width={400} 
              height={200}
              style={{ width: '100%', height: '100%', cursor: 'crosshair', touchAction: 'none' }}
              onMouseDown={iniciarDesenho} onMouseMove={desenhar} onMouseUp={pararDesenho} onMouseLeave={pararDesenho}
              onTouchStart={iniciarDesenho} onTouchMove={desenhar} onTouchEnd={pararDesenho}
            />
            {!temAssinatura && <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#94a3b8', pointerEvents: 'none', fontWeight: '500' }}>Assine aqui</span>}
          </div>

          <div style={{ marginTop: '20px' }}>
            <Button type="submit" form="formEntrega" variante="primario" style={{ width: '100%', height: '50px', fontSize: '16px' }}>
              Confirmar Entrega e Salvar Recibo
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}