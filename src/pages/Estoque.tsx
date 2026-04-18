import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { collection, onSnapshot, query, where, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { 
  PackagePlus, Trash2, Zap, Building2, PackageSearch, 
  Tag, ShieldCheck, Hash, Factory, Edit3, X, CheckCircle2, AlertCircle 
} from 'lucide-react';

// Dados para carga rápida (removida a referência à nota no código)
const itensPadrao = [
  { nome: "ALLTEC CARTUCHO CMC-1 VO+ GA", categoria: "Proteção Respiratória", quantidade: 6, ncm: "84213990", unidade: "UN", marca: "ALLTEC" },
  { nome: "ALLTEC MÁSCARA 1/4 MODELO 2002", categoria: "Proteção Respiratória", quantidade: 2, ncm: "90200010", unidade: "UN", marca: "ALLTEC" },
  { nome: "CAMPER MÁSCARA RESPIRATÓRIA PFF2 COM VÁLVULA", categoria: "Proteção Respiratória", quantidade: 50, ca: "38944", marca: "CAMPER", ncm: "63079010", unidade: "UN" },
  { nome: "DANNY LUVA NEOLATEX TAM G DA-224D", categoria: "Proteção das Mãos", quantidade: 6, ncm: "40151900", unidade: "PAR", marca: "DANNY" },
  { nome: "NEXT SAFETY LUVA KINO TATO MODELO 25.000 TAMANHO G", categoria: "Proteção das Mãos", quantidade: 6, ca: "9567", marca: "NEXT SAFETY", ncm: "40151900", unidade: "PAR" },
  { nome: "NEXT SAFETY LUVA NITRÍLICA PURACHEM VERDE 11.200 TAMANHO G", categoria: "Proteção das Mãos", quantidade: 6, ca: "9567", marca: "NEXT SAFETY", ncm: "40151900", unidade: "PAR" },
  { nome: "PROTECT PROTETOR AURICULAR GRAU FARMACÊUTICO 18DB", categoria: "Proteção Auditiva", quantidade: 6, ca: "28534", marca: "PROTECT QUALITY", ncm: "39269090", unidade: "UN" },
  { nome: "STEELFLEX CINTA ERGONOMICA ERGON LYCRA ERCE9011 G", categoria: "Ergonomia", quantidade: 3, marca: "STEELFLEX", ncm: "63072000", unidade: "UN" },
  { nome: "VICSA MACACÃO DE SEGURANCA BRANCO VIC85111 XXG", categoria: "Vestimenta", quantidade: 25, ca: "20662", marca: "VICSA", ncm: "62101000", unidade: "UN" },
  { nome: "VICSA MACACÃO DE SEGURANCA BRANCO VIC85111 XXXG", categoria: "Vestimenta", quantidade: 25, ca: "20662", marca: "VICSA", ncm: "62101000", unidade: "UN" }
];

export default function Estoque() {
  const { setorAtivo } = useOutletContext<{ setorAtivo: string }>();
  const [itens, setItens] = useState<any[]>([]);
  
  // Controle de Feedback (Substituindo Alerts)
  const [notificacao, setNotificacao] = useState<{msg: string, tipo: 'sucesso' | 'erro'} | null>(null);

  // Estados do formulário e Edição
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [novoNome, setNovoNome] = useState('');
  const [novaCategoria, setNovaCategoria] = useState('');
  const [novaQuantidade, setNovaQuantidade] = useState('');
  const [novoCA, setNovoCA] = useState('');
  const [novoNCM, setNovoNCM] = useState('');
  const [novaMarca, setNovaMarca] = useState('');
  const [novaUnidade, setNovaUnidade] = useState('');

  // Função para mostrar notificação temporária
  const avisar = (msg: string, tipo: 'sucesso' | 'erro' = 'sucesso') => {
    setNotificacao({ msg, tipo });
    setTimeout(() => setNotificacao(null), 3000);
  };

  useEffect(() => {
    if (!setorAtivo) return;
    const q = query(collection(db, 'estoque'), where('setorId', '==', setorAtivo));
    return onSnapshot(q, (snapshot) => {
      setItens(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, [setorAtivo]);

  const realizarCargaRapida = async () => {
    try {
      for (const item of itensPadrao) {
        await addDoc(collection(db, 'estoque'), { ...item, setorId: setorAtivo });
      }
      avisar("Abastecimento concluído com sucesso!");
    } catch (e) { avisar("Erro ao carregar itens.", "erro"); }
  };

  const salvarItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const dados = {
      setorId: setorAtivo,
      nome: novoNome,
      categoria: novaCategoria,
      quantidade: Number(novaQuantidade),
      ca: novoCA,
      ncm: novoNCM,
      marca: novaMarca,
      unidade: novaUnidade || 'UN',
    };

    try {
      if (editandoId) {
        await updateDoc(doc(db, 'estoque', editandoId), dados);
        avisar("Item atualizado!");
        setEditandoId(null);
      } else {
        await addDoc(collection(db, 'estoque'), dados);
        avisar("Item cadastrado!");
      }
      limparCampos();
    } catch (e) { avisar("Erro ao salvar.", "erro"); }
  };

  const prepararEdicao = (item: any) => {
    setEditandoId(item.id);
    setNovoNome(item.nome);
    setNovaCategoria(item.categoria);
    setNovaQuantidade(item.quantidade.toString());
    setNovoCA(item.ca || '');
    setNovoNCM(item.ncm || '');
    setNovaMarca(item.marca || '');
    setNovaUnidade(item.unidade || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const limparCampos = () => {
    setNovoNome(''); setNovaCategoria(''); setNovaQuantidade(''); setNovoCA(''); 
    setNovoNCM(''); setNovaMarca(''); setNovaUnidade(''); setEditandoId(null);
  };

  if (!setorAtivo) return (
    <div style={{ textAlign: 'center', padding: '100px 20px' }}>
      <Building2 size={60} color="#cbd5e1" style={{ marginBottom: '20px' }} />
      <h2 style={{ color: '#1e293b' }}>Selecione uma Unidade</h2>
      <p style={{ color: '#64748b' }}>Use o menu lateral para escolher qual estoque deseja gerenciar.</p>
    </div>
  );

  return (
    <div style={{ position: 'relative' }}>
      
      {/* Notificação Toast */}
      {notificacao && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
          backgroundColor: notificacao.tipo === 'sucesso' ? '#10b981' : '#ef4444',
          color: 'white', padding: '12px 24px', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
          display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '500', animation: 'slideIn 0.3s ease-out'
        }}>
          {notificacao.tipo === 'sucesso' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          {notificacao.msg}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px' }}>
        <div>
          <h1 style={{ color: '#1e293b', margin: 0, fontSize: '26px' }}>Estoque da Unidade</h1>
          <p style={{ color: '#64748b', marginTop: '4px' }}>Gerenciamento e controle de materiais.</p>
        </div>
        <Button onClick={realizarCargaRapida} variante="primario" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px' }}>
          <Zap size={18} fill="currentColor" /> Abastecimento Automático
        </Button>
      </div>

      <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: 'var(--sombra-card)', marginBottom: '40px', border: editandoId ? '2px solid var(--cor-primaria)' : 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#1e293b' }}>
            <PackageSearch size={20} color="var(--cor-primaria)" /> 
            {editandoId ? 'Editar Material' : 'Novo Material'}
          </h3>
          {editandoId && (
            <button onClick={limparCampos} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 'bold' }}>
              <X size={16} /> Cancelar Edição
            </button>
          )}
        </div>

        <form onSubmit={salvarItem}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '15px', marginBottom: '15px' }}>
            <Input label="Nome do Item *" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} required />
            <Input label="Categoria *" value={novaCategoria} onChange={(e) => setNovaCategoria(e.target.value)} required />
            <Input label="Marca" value={novaMarca} onChange={(e) => setNovaMarca(e.target.value)} />
            <Input label="Qtd *" type="number" value={novaQuantidade} onChange={(e) => setNovaQuantidade(e.target.value)} required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '15px', alignItems: 'end' }}>
            <Input label="C.A." value={novoCA} onChange={(e) => setNovoCA(e.target.value)} />
            <Input label="NCM" value={novoNCM} onChange={(e) => setNovoNCM(e.target.value)} />
            <Input label="Unid." value={novaUnidade} onChange={(e) => setNovaUnidade(e.target.value)} placeholder="UN, PAR" />
            <Button type="submit" variante={editandoId ? "primario" : "sucesso"} style={{ height: '45px', minWidth: '150px' }}>
              {editandoId ? 'Salvar Alterações' : '+ Cadastrar'}
            </Button>
          </div>
        </form>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
        {itens.map((item) => (
          <div key={item.id} style={{ backgroundColor: 'white', borderRadius: '12px', padding: '20px', boxShadow: 'var(--sombra-card)', border: '1px solid #e2e8f0', position: 'relative', transition: 'transform 0.2s' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
              <span style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', color: '#2563eb', backgroundColor: '#eff6ff', padding: '4px 10px', borderRadius: '6px', letterSpacing: '0.5px' }}>
                {item.categoria}
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => prepararEdicao(item)} style={{ border: 'none', background: '#f1f5f9', padding: '6px', borderRadius: '6px', cursor: 'pointer', color: '#64748b' }} title="Editar">
                  <Edit3 size={16} />
                </button>
                <button onClick={() => { if(window.confirm("Excluir item?")) deleteDoc(doc(db, 'estoque', item.id)) }} style={{ border: 'none', background: '#fff1f2', padding: '6px', borderRadius: '6px', cursor: 'pointer', color: '#ef4444' }} title="Excluir">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <h4 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#1e293b', fontWeight: '700', minHeight: '44px', lineHeight: '1.4' }}>
              {item.nome}
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
              <div style={infoStyle}><ShieldCheck size={14} color="#94a3b8" /> <div><small>C.A.</small><p>{item.ca || '-'}</p></div></div>
              <div style={infoStyle}><Factory size={14} color="#94a3b8" /> <div><small>Marca</small><p>{item.marca || '-'}</p></div></div>
              <div style={infoStyle}><Hash size={14} color="#94a3b8" /> <div><small>NCM</small><p>{item.ncm || '-'}</p></div></div>
              <div style={infoStyle}><Tag size={14} color="#94a3b8" /> <div><small>Unid.</small><p>{item.unidade || 'UN'}</p></div></div>
            </div>

            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>Disponível:</span>
              <span style={{ fontSize: '20px', fontWeight: '800', color: item.quantidade < 5 ? '#ef4444' : '#10b981' }}>
                {item.quantidade}
              </span>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

const infoStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#f8fafc', padding: '8px', borderRadius: '8px', border: '1px solid #f1f5f9'
};

const valueStyle = { fontSize: '12px', fontWeight: 'bold', margin: 0, color: '#334155' };