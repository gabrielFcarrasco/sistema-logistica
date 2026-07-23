// src/components/prestacao-servicos/ModalRelatorioPintura.tsx
import { useState, useEffect } from 'react';
import { doc, updateDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';
import { db } from '../../services/firebase';

import { X, ClipboardCheck, PaintBucket, CheckCircle } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';

interface Props {
  aberto: boolean;
  onClose: () => void;
  truque: any;
  avisar: (msg: string, tipo?: 'sucesso' | 'erro') => void;
}

export default function ModalRelatorioPintura({ aberto, onClose, truque, avisar }: Props) {
  // 1. Estados do Formulário (Produto)
  const [loteA, setLoteA] = useState('');
  const [loteB, setLoteB] = useState('');
  const [diluicao, setDiluicao] = useState('5%');
  
  // 2. Estados de Processo e Aplicação
  const [substrato, setSubstrato] = useState('Aço Carbono');
  const [preparacao, setPreparacao] = useState('Jateamento Abrasivo Sa 2½');
  const [formaAplicacao, setFormaAplicacao] = useState('Pistola de caneco');
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFim, setHoraFim] = useState('');

  // 3. Estados do Clima
  const [ura, setUra] = useState('');
  const [ta, setTa] = useState('');
  const [ts, setTs] = useState('');
  const [td, setTd] = useState('');
  const [diferencaTsTd, setDiferencaTsTd] = useState('');
  
  // 4. Estados de Medição
  const [rugosidade, setRugosidade] = useState('');
  const [epu1, setEpu1] = useState('');
  const [epu2, setEpu2] = useState('');
  const [eps, setEps] = useState('');
  const [observacoes, setObservacoes] = useState('');

  // Cálculo Automático da Temperatura: Diferença entre Substrato e Orvalho
  useEffect(() => {
    const valorTs = parseFloat(ts);
    const valorTd = parseFloat(td);
    if (!isNaN(valorTs) && !isNaN(valorTd)) {
      setDiferencaTsTd((valorTs - valorTd).toFixed(1));
    } else {
      setDiferencaTsTd('');
    }
  }, [ts, td]);

  // Limpar formulário quando abre um novo truque para evitar dados residuais
  useEffect(() => {
    if (aberto) {
      setLoteA(''); setLoteB(''); setUra(''); setTa(''); setTs(''); setTd('');
      setRugosidade(''); setEpu1(''); setEpu2(''); setEps(''); setObservacoes('');
      setHoraInicio(''); setHoraFim('');
    }
  }, [aberto, truque]);

  // Salvar Relatório e Avançar Peça para o Galpão
  const salvarEAvancar = async () => {
    // Validação ajustada: agora exige apenas as medições principais
    if (!epu1 || !eps) {
      return avisar("Preencha pelo menos as medições de EPU 1 e EPS Final.", "erro");
    }

    try {
      // Cria o documento com os dados técnicos na coleção de relatórios
      await addDoc(collection(db, 'relatorios_pintura'), {
        truqueId: truque.id,
        identificacao: truque.identificacao,
        produto: { loteA, loteB, diluicao },
        processo: { substrato, preparacao, formaAplicacao, horaInicio, horaFim },
        clima: { ura, ta, ts, td, diferencaTsTd },
        medicoes: { rugosidade, epu1, epu2, eps },
        observacoes,
        dataRelatorio: serverTimestamp()
      });

      // Atualiza o status do truque para movê-lo para a coluna do Galpão
      await updateDoc(doc(db, 'truques_producao', truque.id), { 
        status: 'pintado', 
        dataPintura: serverTimestamp(),
        possuiRelatorioPintura: true
      });

      avisar("Relatório de Qualidade salvo com sucesso!");
      onClose(); // Fecha o modal após o sucesso
    } catch (e) {
      avisar("Erro ao salvar o relatório.", "erro");
    }
  };

  // Se o modal não estiver aberto ou não houver dados da peça, não renderiza nada
  if (!aberto || !truque) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '16px', padding: '20px' }}>
        
        {/* Cabeçalho */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ClipboardCheck color="#3b82f6" size={24} />
            <h2 style={{ margin: 0, fontSize: '18px', color: '#1e293b' }}>Relatório de Pintura: {truque.identificacao}</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} color="#64748b" /></button>
        </div>

        {/* Corpo do Formulário */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          
          {/* Bloco: Processo e Tempo */}
          <div style={{ padding: '15px', backgroundColor: '#f1f5f9', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}><PaintBucket size={16}/> Processo e Aplicação</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <Input label="Substrato" value={substrato} onChange={e => setSubstrato(e.target.value)} />
              <Input label="Preparação" value={preparacao} onChange={e => setPreparacao(e.target.value)} />
              <Input label="Aplicação" value={formaAplicacao} onChange={e => setFormaAplicacao(e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <Input label="Lote A" value={loteA} onChange={e => setLoteA(e.target.value)} placeholder="Ex: 3843488" />
              <Input label="Lote B" value={loteB} onChange={e => setLoteB(e.target.value)} placeholder="Ex: 3847324" />
              <Input label="Diluição" value={diluicao} onChange={e => setDiluicao(e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
              <Input label="Hora Início" type="time" value={horaInicio} onChange={e => setHoraInicio(e.target.value)} />
              <Input label="Hora Término" type="time" value={horaFim} onChange={e => setHoraFim(e.target.value)} />
            </div>
          </div>

          {/* Bloco: Clima */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '10px', backgroundColor: '#f0fdf4', padding: '15px', borderRadius: '8px' }}>
            <Input label="% URA" value={ura} onChange={e => setUra(e.target.value)} type="number" />
            <Input label="Ta (°C)" value={ta} onChange={e => setTa(e.target.value)} type="number" />
            <Input label="Ts (°C)" value={ts} onChange={e => setTs(e.target.value)} type="number" />
            <Input label="Td (°C)" value={td} onChange={e => setTd(e.target.value)} type="number" />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#166534', marginBottom: '8px' }}>Ts - Td</label>
              <input value={diferencaTsTd} readOnly style={{ padding: '8px', borderRadius: '6px', border: '1px solid #bbf7d0', backgroundColor: '#dcfce7', fontWeight: 'bold' }} />
            </div>
          </div>

          {/* Bloco: Medições */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', backgroundColor: '#eff6ff', padding: '15px', borderRadius: '8px' }}>
            <Input label="Rugosidade" value={rugosidade} onChange={e => setRugosidade(e.target.value)} type="number" />
            <Input label="EPU 1" value={epu1} onChange={e => setEpu1(e.target.value)} type="number" />
            <Input label="EPU 2" value={epu2} onChange={e => setEpu2(e.target.value)} type="number" />
            <Input label="EPS Final" value={eps} onChange={e => setEps(e.target.value)} type="number" />
          </div>

          {/* Bloco: Observações */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '8px' }}>Observações Visuais / Secagem</label>
            <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', minHeight: '60px' }} />
          </div>

          {/* Botão de Submissão */}
          <Button onClick={salvarEAvancar} style={{ height: '50px', backgroundColor: '#10b981', fontSize: '16px', fontWeight: 'bold', marginTop: '10px' }}>
            <CheckCircle size={20} style={{ marginRight: '8px' }}/> Gravar Qualidade e Enviar ao Galpão
          </Button>

        </div>
      </div>
    </div>
  );
}