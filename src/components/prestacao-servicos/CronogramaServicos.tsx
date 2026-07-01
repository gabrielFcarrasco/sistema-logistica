// src/components/prestacao-servicos/CronogramaServicos.tsx
import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, addDoc, serverTimestamp, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoCarvalho from '../../assets/logopdf.png';

import { Calendar, Clock, Users, Plus, Trash2, FileSignature, Share2, Printer, CheckCircle, Smartphone, AlertCircle } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';

interface Props { setorAtivo: string; funcionarios: any[]; avisar: (msg: string, tipo?: 'sucesso'|'erro') => void; }

export default function CronogramaServicos({ setorAtivo, funcionarios, avisar }: Props) {
  const [atividades, setAtividades] = useState<any[]>([]);
  const [dataLote, setDataLote] = useState(new Date().toISOString().split('T')[0]);
  const [responsavelRotem, setResponsavelRotem] = useState('');
  const [carrinhoServicos, setCarrinhoServicos] = useState<any[]>([]);
  
  // Estados do item temporário
  const [servico, setServico] = useState('');
  const [horaInicio, setHoraInicio] = useState('08:00');
  const [horaTermino, setHoraTermino] = useState('17:00');
  const [equipe, setEquipe] = useState<string[]>([]);

  // Escutar Registos do Firestore
  useEffect(() => {
    if (!setorAtivo) return;
    const q = query(collection(db, 'diario_obra_lotes'), where('setorId', '==', setorAtivo));
    const unsub = onSnapshot(q, (snap) => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Ordena por data decrescente
      lista.sort((a: any, b: any) => new Date(b.data).getTime() - new Date(a.data).getTime());
      setAtividades(lista);
    });
    return () => unsub();
  }, [setorAtivo]);

  const adicionarAoLote = () => {
    if (!servico || equipe.length === 0) return avisar("Preencha o serviço e equipe.", "erro");
    setCarrinhoServicos([...carrinhoServicos, { servico, horaInicio, horaTermino, equipe }]);
    setServico(''); setEquipe([]);
  };

  const salvarLote = async () => {
    if (carrinhoServicos.length === 0 || !responsavelRotem) return avisar("Adicione serviços e informe o responsável.", "erro");
    try {
      await addDoc(collection(db, 'diario_obra_lotes'), {
        setorId: setorAtivo, data: dataLote, responsavelRotem,
        servicos: carrinhoServicos,
        assinaturaCarvalho: 'pendente', nomeCarvalho: '',
        assinaturaRotem: 'pendente', nomeRotem: '',
        status: 'Pendente',
        createdAt: serverTimestamp()
      });
      avisar("Diário de Obra salvo!");
      setCarrinhoServicos([]); setResponsavelRotem('');
    } catch (e) { avisar("Erro ao salvar.", "erro"); }
  };

  const enviarLinkWhatsApp = (id: string) => {
    const url = `${window.location.origin}/assinar-cronograma/${id}`;
    const texto = `Olá! O Diário de Obra da Carvalho Pintura está disponível para assinatura.\n\n🔗 Acessar: ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
  };

  // 📄 GERADOR DE PDF PROFISSIONAL
  const gerarPDF = (lote: any) => {
    const doc = new jsPDF('l', 'mm', 'a4');
    try { doc.addImage(logoCarvalho, 'PNG', 15, 10, 35, 10); } catch(e){}
    doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.text("DIÁRIO DE OBRA - PRESTAÇÃO DE SERVIÇOS", 148.5, 16, { align: 'center' });
    doc.setFontSize(10); doc.text(`Data: ${lote.data.split('-').reverse().join('/')} | Resp. Rotem: ${lote.responsavelRotem}`, 148.5, 22, { align: 'center' });
    
    const renderTable = typeof autoTable === 'function' ? autoTable : (autoTable as any).default;
    renderTable(doc, {
      startY: 30,
      head: [["Serviço", "Início", "Término", "Equipe", "Assinatura Carvalho", "Assinatura Rotem"]],
      body: lote.servicos.map((s: any) => [s.servico, s.horaInicio, s.horaTermino, s.equipe.join(', '), '', '']),
      theme: 'grid',
      columnStyles: { 4: { cellWidth: 50 }, 5: { cellWidth: 50 } },
      didDrawCell: (data: any) => {
        // Lógica para desenhar as assinaturas aqui se necessário
      }
    });
    doc.save(`Diario_Obra_${lote.data}.pdf`);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
      {/* Coluna Lançamento */}
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <h3>Lançar Serviço do Dia</h3>
        <Input label="Data" type="date" value={dataLote} onChange={e => setDataLote(e.target.value)} />
        <Input label="Responsável Hyundai Rotem" value={responsavelRotem} onChange={e => setResponsavelRotem(e.target.value)} />
        
        <div style={{ marginTop: '20px', padding: '15px', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
          <Input label="Serviço Prestado" value={servico} onChange={e => setServico(e.target.value)} />
          <div style={{ display: 'flex', gap: '10px' }}>
            <Input label="Início" type="time" value={horaInicio} onChange={e => setHoraInicio(e.target.value)} />
            <Input label="Término" type="time" value={horaTermino} onChange={e => setHoraTermino(e.target.value)} />
          </div>
          <div style={{ margin: '10px 0' }}>
            <label style={{ fontSize: '12px' }}>Equipe:</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {funcionarios.map(f => (
                <button type="button" key={f.id} onClick={() => setEquipe(prev => prev.includes(f.nome) ? prev.filter(n => n !== f.nome) : [...prev, f.nome])} 
                  style={{ padding: '5px 10px', borderRadius: '4px', border: 'none', backgroundColor: equipe.includes(f.nome) ? '#3b82f6' : '#e2e8f0' }}>
                  {f.nome.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={adicionarAoLote}><Plus size={16}/> Adicionar Serviço</Button>
        </div>
        <Button onClick={salvarLote} style={{ marginTop: '20px', backgroundColor: '#10b981', width: '100%' }}>Salvar Relatório do Dia</Button>
      </div>

      {/* Coluna Listagem */}
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <h3>Diários Pendentes</h3>
        {atividades.map((a: any) => (
          <div key={a.id} style={{ padding: '15px', border: '1px solid #eee', borderRadius: '8px', marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>{a.data}</strong>
              <Button onClick={() => enviarLinkWhatsApp(a.id)} style={{ padding: '5px 10px' }}><Share2 size={14}/></Button>
              <Button onClick={() => gerarPDF(a)} style={{ padding: '5px 10px', backgroundColor: '#64748b' }}><Printer size={14}/></Button>
            </div>
            <p>Responsável: {a.responsavelRotem}</p>
            <small>Status: {a.status}</small>
          </div>
        ))}
      </div>
    </div>
  );
}