// src/components/prestacao-servicos/GerenciadorOS.tsx
import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoCarvalho from '../../assets/LogoLimpa.webp';

import { FileText, Plus, Trash2, Check, Clock, X, Edit, Eye, Smartphone, Send, Download } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import ModalAssinatura from './ModalAssinatura';

interface Props { setorAtivo: string; isPortrait: boolean; avisar: (msg: string, tipo?: 'sucesso'|'erro') => void; }

export default function GerenciadorOS({ setorAtivo, isPortrait, avisar }: Props) {
  const [historicoOS, setHistoricoOS] = useState<any[]>([]);
  const [tipoEscopo, setTipoEscopo] = useState('Peças Avulsas / Componentes');
  const [itensOS, setItensOS] = useState([{ quantidade: 1, descricao: '', serial: '' }]);
  const [descricaoServicoOS, setDescricaoServicoOS] = useState('');
  
  const [osEditando, setOsEditando] = useState<any>(null);
  const [osAberta, setOsAberta] = useState<any>(null);
  const [modalAssinatura, setModalAssinatura] = useState<'fechado' | 'prestador' | 'cliente'>('fechado');
  
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!setorAtivo) return;
    const q = query(collection(db, 'ordens_servico'), where('setorId', '==', setorAtivo));
    const unsub = onSnapshot(q, (snap) => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      lista.sort((a: any, b: any) => (b.dataEmissao?.toMillis() || 0) - (a.dataEmissao?.toMillis() || 0));
      setHistoricoOS(lista);
      if (osAberta) {
        const osAtualizada = lista.find(os => os.id === osAberta.id);
        if (osAtualizada) setOsAberta(osAtualizada);
      }
    });
    return () => unsub();
  }, [setorAtivo, osAberta]);

  // ==========================================
  // FUNÇÕES DE CONTROLO DO CARRINHO E EDIÇÃO
  // ==========================================
  const adicionarItemOS = () => setItensOS([...itensOS, { quantidade: 1, descricao: '', serial: '' }]);
  const removerItemOS = (index: number) => setItensOS(itensOS.filter((_, i) => i !== index));
  const atualizarItemOS = (index: number, campo: 'quantidade' | 'descricao' | 'serial', valor: any) => {
    const novos = [...itensOS];
    novos[index] = { ...novos[index], [campo]: valor };
    setItensOS(novos);
  };

  const iniciarEdicaoOS = (os: any) => {
    setOsEditando(os);
    setTipoEscopo(os.tipoEscopo || 'Peças Avulsas / Componentes');
    setItensOS(os.itens || [{ quantidade: 1, descricao: '', serial: '' }]);
    setDescricaoServicoOS(os.descricaoServico || '');
    setOsAberta(null); 
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
  };

  const cancelarEdicaoOS = () => {
    setOsEditando(null);
    setTipoEscopo('Peças Avulsas / Componentes');
    setItensOS([{ quantidade: 1, descricao: '', serial: '' }]);
    setDescricaoServicoOS('');
  };

  // ==========================================
  // SALVAR E ASSINAR
  // ==========================================
  const registrarESalvarOS = async (e: React.FormEvent) => {
    e.preventDefault();
    if (itensOS.length === 0 || itensOS.some(i => !i.descricao)) return avisar("Preencha as descrições no carrinho.", "erro");

    try {
      if (osEditando) {
        await updateDoc(doc(db, 'ordens_servico', osEditando.id), { tipoEscopo, itens: itensOS, descricaoServico: descricaoServicoOS });
        avisar("OS atualizada!");
      } else {
        await addDoc(collection(db, 'ordens_servico'), {
          setorId: setorAtivo, tipoEscopo, itens: itensOS, descricaoServico: descricaoServicoOS,
          assinaturaPrestador: '', assinaturaCliente: '', status: 'Aguardando Assinaturas', dataEmissao: serverTimestamp()
        });
        avisar("OS salva no banco!");
      }
      cancelarEdicaoOS();
    } catch (e) { avisar("Erro ao salvar a OS.", "erro"); }
  };

  const salvarAssinaturaNaOS = async (base64: string) => {
    if (!osAberta) return;
    try {
      const atualizacoes: any = {};
      if (modalAssinatura === 'prestador') atualizacoes.assinaturaPrestador = base64;
      if (modalAssinatura === 'cliente') atualizacoes.assinaturaCliente = base64;
      const presFinal = modalAssinatura === 'prestador' ? base64 : osAberta.assinaturaPrestador;
      const cliFinal = modalAssinatura === 'cliente' ? base64 : osAberta.assinaturaCliente;
      if (presFinal && cliFinal) atualizacoes.status = 'Concluída';

      await updateDoc(doc(db, 'ordens_servico', osAberta.id), atualizacoes);
      avisar("Assinatura anexada!"); setModalAssinatura('fechado');
    } catch(e) { avisar("Erro ao salvar assinatura", "erro"); }
  };

  // ==========================================
  // PDF ENRIQUECIDO E WHATSAPP
  // ==========================================
  
  // Função mestre que constrói o PDF de apenas 1 VIA baseada no parâmetro 'tipoVia'
  const construirPDFViaUnica = (osDados: any, tipoVia: 'cliente' | 'interna') => {
    const docPdf = new jsPDF('p', 'mm', 'a4');
    const azulEscuro = [30, 41, 59];
    const dataDoc = osDados.dataEmissao?.toDate ? osDados.dataEmissao.toDate().toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR');
    const numeroOS = osDados.id ? osDados.id.slice(-6).toUpperCase() : "NOVA";
    const tituloVia = tipoVia === 'cliente' ? "1ª VIA - CLIENTE" : "2ª VIA - CONTROLE INTERNO";

    // Logo e Título
    try { docPdf.addImage(logoCarvalho, 'WEBP', 15, 10, 40, 14); } catch(e){}
    docPdf.setFont("helvetica", "bold"); docPdf.setFontSize(18); docPdf.setTextColor(...azulEscuro);
    docPdf.text("ORDEM DE SERVIÇO", 105, 18, { align: 'center' });
    
    // Cabeçalho Direito
    docPdf.setFontSize(10); docPdf.setTextColor(100, 100, 100);
    docPdf.text(tituloVia, 195, 15, { align: 'right' });
    docPdf.text(`OS Nº: ${numeroOS}`, 195, 20, { align: 'right' });
    docPdf.text(`Emissão: ${dataDoc}`, 195, 25, { align: 'right' });
    
    docPdf.setLineWidth(0.5); docPdf.line(15, 29, 195, 29);
    
    // Quadros Informativos Melhorados
    docPdf.setFillColor(241, 245, 249); docPdf.rect(15, 33, 80, 26, "F");
    docPdf.setFontSize(9); docPdf.setTextColor(0, 0, 0);
    docPdf.setFont("helvetica", "bold"); docPdf.text("PRESTADOR DO SERVIÇO", 18, 38);
    docPdf.setFont("helvetica", "normal"); 
    docPdf.text("CARVALHO FUNILARIA LTDA", 18, 43);
    docPdf.text("CNPJ: 31.362.302/0001-33", 18, 48);
    docPdf.text("Tel: (16) 99720-2288 | acarloscarvalho71@gmail.com", 18, 53); // Substitua pelo contato correto
    
    docPdf.setFillColor(241, 245, 249); docPdf.rect(115, 33, 80, 26, "F");
    docPdf.setFont("helvetica", "bold"); docPdf.text("CLIENTE / TOMADOR", 118, 38);
    docPdf.setFont("helvetica", "normal"); 
    const infoCliente = docPdf.splitTextToSize("Hyundai Rotem Brasil Industria e Comercio de Trens Ltda.\nCNPJ: 17.866.875/0004-16", 74);
    docPdf.text(infoCliente, 118, 43);

    // Status e Escopo
    docPdf.setFont("helvetica", "bold"); docPdf.setFontSize(11);
    docPdf.text("INFORMAÇÕES DO SERVIÇO", 15, 66);
    docPdf.setFont("helvetica", "normal"); docPdf.setFontSize(10);
    docPdf.text(`Escopo de Atuação: ${osDados.tipoEscopo}`, 15, 72);
    docPdf.text(`Status Atual: ${osDados.status.toUpperCase()}`, 195, 72, { align: 'right' });
    
    // Tabela Enriquecida
    const renderTable = typeof autoTable === 'function' ? autoTable : (autoTable as any).default;
    renderTable(docPdf, {
      startY: 78,
      head: [["QTD", "DESCRIÇÃO DETALHADA DA PEÇA / SERVIÇO", "SERIAL / IDENTIFICADOR"]],
      body: osDados.itens.map((i: any) => [`${i.quantidade} un`, i.descricao, i.serial || 'S/ Registro']),
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], halign: 'center' },
      columnStyles: { 0: { halign: 'center', cellWidth: 20 }, 2: { halign: 'center', cellWidth: 55 } },
      styles: { fontSize: 9, cellPadding: 5 }
    });

    const finalY = (docPdf as any).lastAutoTable.finalY + 10;
    
    // Observações Técnicas
    docPdf.setFont("helvetica", "bold"); docPdf.setFontSize(11);
    docPdf.text("OBSERVAÇÕES TÉCNICAS E ATIVIDADES ADICIONAIS", 15, finalY);
    docPdf.setFont("helvetica", "normal"); docPdf.setFontSize(10);
    const textoObs = osDados.descricaoServico || 'Serviços executados rigorosamente conforme as peças e quantidades detalhadas acima, respeitando os padrões de qualidade acordados.';
    const splitDesc = docPdf.splitTextToSize(textoObs, 180);
    docPdf.text(splitDesc, 15, finalY + 7);

    // Termo de Responsabilidade
    const termoY = finalY + 18 + (splitDesc.length * 5);
    docPdf.setFontSize(8); docPdf.setTextColor(100, 100, 100);
    const termoText = "A assinatura deste documento confirma a execução, conferência e aceite dos serviços acima descritos nas quantidades indicadas. O cliente atesta que as peças foram recebidas e inspecionadas em conformidade com o escopo acordado entre as partes.";
    const termo = docPdf.splitTextToSize(termoText, 180);
    docPdf.text(termo, 15, termoY);

    // Assinaturas
    const yAssinatura = Math.max(termoY + 30, 235);
    docPdf.setDrawColor(0,0,0); docPdf.setLineWidth(0.5); docPdf.setTextColor(0, 0, 0);

    if (osDados.assinaturaPrestador) { try { docPdf.addImage(osDados.assinaturaPrestador, 'JPEG', 30, yAssinatura - 25, 40, 20); } catch(e){} }
    docPdf.line(20, yAssinatura, 80, yAssinatura);
    docPdf.setFontSize(10); docPdf.setFont("helvetica", "bold");
    docPdf.text("Carvalho Funilaria e Pinturas", 50, yAssinatura + 5, { align: 'center' });
    docPdf.setFont("helvetica", "normal"); docPdf.text("Prestador do Serviço", 50, yAssinatura + 10, { align: 'center' });

    if (osDados.assinaturaCliente) { try { docPdf.addImage(osDados.assinaturaCliente, 'JPEG', 130, yAssinatura - 25, 40, 20); } catch(e){} }
    docPdf.line(120, yAssinatura, 180, yAssinatura);
    docPdf.setFontSize(10); docPdf.setFont("helvetica", "bold");
    docPdf.text("Hyundai Rotem Brasil", 150, yAssinatura + 5, { align: 'center' });
    docPdf.setFont("helvetica", "normal"); docPdf.text("De Acordo / Recebedor", 150, yAssinatura + 10, { align: 'center' });

    return docPdf;
  };

  // Botões de Ação Separados
  const gerarEBaixarPDF = (tipoVia: 'cliente' | 'interna') => {
    if (!osAberta) return;
    const docPdf = construirPDFViaUnica(osAberta, tipoVia);
    const numeroOS = osAberta.id.slice(-6).toUpperCase();
    docPdf.save(`OS_Carvalho_${numeroOS}_VIA_${tipoVia.toUpperCase()}.pdf`);
  };

  const visualizarPDF = () => {
    if (!osAberta) return;
    const docPdf = construirPDFViaUnica(osAberta, 'cliente'); // Preview baseia-se na via do cliente
    const blobUrl = docPdf.output('bloburl');
    setPdfPreviewUrl(blobUrl.toString());
  };

  const enviarLinkWhatsApp = () => {
    if (!osAberta) return;
    const urlAssinatura = `${window.location.origin}/assinar-os/${osAberta.id}`;
    const texto = `Olá! A Carvalho Funilaria preparou a Ordem de Serviço (OS Nº ${osAberta.id.slice(-6).toUpperCase()}) referente aos serviços prestados.\n\nPor favor, confira os dados no link abaixo e realize a sua assinatura digital para concluirmos o processo:\n\n🔗 *Acessar e Assinar OS:*\n${urlAssinatura}\n\nObrigado!`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
      
      {/* Coluna 1: Formulário */}
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', borderTop: osEditando ? '4px solid #3b82f6' : '4px solid #8b5cf6', height: 'fit-content' }}>
        <h3 style={{ fontSize: '16px', margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={18} color="#8b5cf6" /> {osEditando ? 'Editando OS' : 'Elaborar Nova OS'}
        </h3>
        <form onSubmit={registrarESalvarOS} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <select value={tipoEscopo} onChange={e => setTipoEscopo(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
            <option>Trem Inteiro</option><option>Carro Específico</option><option>Peças Avulsas / Componentes</option>
          </select>

          <div style={{ borderTop: '2px dashed #e2e8f0', paddingTop: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <strong>Lista de Peças</strong>
              <Button type="button" onClick={adicionarItemOS} style={{ padding: '6px 12px', fontSize: '12px' }}><Plus size={14}/> Add Linha</Button>
            </div>
            {itensOS.map((item, index) => (
              <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px', paddingBottom: '15px', borderBottom: '1px dashed #cbd5e1' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <Input type="number" value={item.quantidade} onChange={e => atualizarItemOS(index, 'quantidade', Number(e.target.value))} placeholder="Qtd" required />
                  <Input value={item.descricao} onChange={e => atualizarItemOS(index, 'descricao', e.target.value)} placeholder="Descrição" required />
                  <button type="button" onClick={() => removerItemOS(index)} disabled={itensOS.length === 1} style={{ border: 'none', background: 'none', color: itensOS.length === 1 ? '#cbd5e1' : '#ef4444' }}><Trash2/></button>
                </div>
                <Input value={item.serial} onChange={e => atualizarItemOS(index, 'serial', e.target.value)} placeholder="Serial (Opcional)" />
              </div>
            ))}
          </div>

          <textarea rows={3} value={descricaoServicoOS} onChange={e => setDescricaoServicoOS(e.target.value)} placeholder="Observações..." style={{ padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
          
          <div style={{ display: 'flex', gap: '10px' }}>
            {osEditando && <Button type="button" onClick={cancelarEdicaoOS} style={{ flex: 1, backgroundColor: '#e2e8f0', color: '#475569' }}>Cancelar</Button>}
            <Button type="submit" style={{ flex: 2, backgroundColor: '#8b5cf6' }}>Salvar OS</Button>
          </div>
        </form>
      </div>

      {/* Coluna 2: Emissões Pendentes */}
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px' }}>
         <h3 style={{ fontSize: '16px', margin: '0 0 15px 0' }}>Emissões Pendentes e Concluídas</h3>
         <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {historicoOS.map(os => (
              <div key={os.id} onClick={() => setOsAberta(os)} style={{ backgroundColor: os.status === 'Concluída' ? '#f0fdf4' : '#fffbeb', padding: '15px', borderRadius: '12px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>OS Nº {os.id.slice(-6).toUpperCase()}</strong>
                  <span style={{ fontSize: '10px', backgroundColor: os.status === 'Concluída' ? '#dcfce7' : '#fef08a', padding: '4px 8px', borderRadius: '50px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                     {os.status === 'Concluída' ? <Check size={12}/> : <Clock size={12}/>} {os.status}
                  </span>
                </div>
                <span style={{ fontSize: '12px', color: '#64748b' }}>{os.itens?.length} peças • {os.tipoEscopo}</span>
              </div>
            ))}
         </div>
      </div>

      {/* MODAL DE DETALHES DA OS */}
      {osAberta && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.9)', zIndex: 15000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '15px' }}>
          <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '600px', borderRadius: '24px', padding: '25px', maxHeight: '95vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2>OS Nº {osAberta.id.slice(-6).toUpperCase()}</h2>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={visualizarPDF} style={{ background: '#f1f5f9', color: '#475569', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer' }} title="Pré-visualizar Documento"><Eye size={20}/></button>
                {osAberta.status !== 'Concluída' && <button onClick={() => {setOsEditando(osAberta); setOsAberta(null);}} style={{ background: '#e0e7ff', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}><Edit size={20}/></button>}
                <button onClick={() => setOsAberta(null)} style={{ background: '#f1f5f9', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}><X size={20}/></button>
              </div>
            </div>
            
            <div style={{ backgroundColor: '#f5f3ff', padding: '15px', borderRadius: '12px', border: '1px solid #ddd6fe', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
               <h4 style={{ margin: 0, fontSize: '14px', color: '#4c1d95', display: 'flex', alignItems: 'center', gap: '6px' }}>
                 <Smartphone size={16} /> Enviar para Assinatura Externa
               </h4>
               <p style={{ margin: 0, fontSize: '12px', color: '#6d28d9' }}>Envie um link único para o cliente analisar e assinar no próprio celular.</p>
               <Button onClick={enviarLinkWhatsApp} disabled={osAberta.status === 'Concluída'} style={{ backgroundColor: '#10b981', display: 'flex', justifyContent: 'center', gap: '8px' }}>
                 <Send size={16}/> Enviar Link via WhatsApp
               </Button>
            </div>

            <div style={{ borderTop: '2px dashed #e2e8f0', paddingTop: '15px', marginBottom: '20px' }}>
              <h4 style={{ fontSize: '14px', color: '#1e293b', marginBottom: '10px' }}>Assinatura Presencial</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <Button onClick={() => setModalAssinatura('prestador')} style={{ backgroundColor: osAberta.assinaturaPrestador ? '#10b981' : '#3b82f6' }}>Assinar (Carvalho)</Button>
                <Button onClick={() => setModalAssinatura('cliente')} style={{ backgroundColor: osAberta.assinaturaCliente ? '#10b981' : '#8b5cf6' }}>Assinar (Hyundai)</Button>
              </div>
            </div>

            {/* ✨ SEPARAÇÃO DOS DOWNLOADS DE PDF */}
            <div style={{ borderTop: '2px solid #f1f5f9', paddingTop: '15px' }}>
              <h4 style={{ fontSize: '14px', color: '#1e293b', marginBottom: '10px' }}>Baixar Vias do Documento Final</h4>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <Button onClick={() => gerarEBaixarPDF('cliente')} disabled={osAberta.status !== 'Concluída'} style={{ flex: 1, backgroundColor: osAberta.status === 'Concluída' ? '#1e293b' : '#cbd5e1', display: 'flex', justifyContent: 'center', gap: '6px' }}>
                  <Download size={16}/> Via Cliente
                </Button>
                <Button onClick={() => gerarEBaixarPDF('interna')} disabled={osAberta.status !== 'Concluída'} style={{ flex: 1, backgroundColor: osAberta.status === 'Concluída' ? '#475569' : '#cbd5e1', display: 'flex', justifyContent: 'center', gap: '6px' }}>
                  <Download size={16}/> Via Interna
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE PRÉ-VISUALIZAÇÃO DO PDF MELHORADA */}
      {pdfPreviewUrl && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.95)', zIndex: 16000, display: 'flex', flexDirection: 'column', backdropFilter: 'blur(4px)' }}>
          <div style={{ padding: '15px 25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1e293b', borderBottom: '1px solid #334155' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'white' }}>
              <FileText size={20} color="#3b82f6" />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '500' }}>Pré-visualização da Ordem de Serviço</h3>
            </div>
            <button onClick={() => setPdfPreviewUrl(null)} style={{ background: '#334155', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
              <X size={18}/> Fechar Pré-visualização
            </button>
          </div>
          <div style={{ flex: 1, padding: '20px', display: 'flex', justifyContent: 'center', overflow: 'hidden' }}>
            <iframe src={`${pdfPreviewUrl}#toolbar=0`} style={{ width: '100%', maxWidth: '850px', height: '100%', border: 'none', borderRadius: '12px', backgroundColor: 'white', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }} title="Preview PDF" />
          </div>
        </div>
      )}

      <ModalAssinatura 
        aberto={modalAssinatura !== 'fechado'} 
        titulo={modalAssinatura === 'prestador' ? 'Assinatura Prestador' : 'Assinatura Cliente'}
        isPortrait={isPortrait} 
        onClose={() => setModalAssinatura('fechado')} 
        onSave={salvarAssinaturaNaOS} 
      />
    </div>
  );
}