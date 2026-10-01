// src/components/financeiro/EnvioPagamentosWhatsapp.tsx
import React, { useState, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { 
  Send, 
  Upload, 
  CheckCircle2, 
  User, 
  Phone, 
  Copy, 
  X,
  AlertTriangle,
  FileCheck,
  Edit3,
  HelpCircle,
  Calculator
} from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export type StatusLeituraHolerite = 'pendente' | 'sucesso' | 'manual' | 'nao_encontrado';

export interface ItemPagamento {
  funcionarioId?: string;
  nome: string;
  valorLiquido: number;
  valorVT: number;
  totalPagar: number;
  chavePix: string;
  statusLeitura: StatusLeituraHolerite;
  detalhesCalculo?: string;
}

interface Props {
  funcionariosList: any[];
  dadosFinanceirosMap: Record<string, any>;
  diasUteisBase: number;
  mesFiltro: string;
  onClose?: () => void;
}

// Normalização de Nomes
const removerAcentos = (texto: string) => {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
};

const limparTexto = (texto: string) => {
  return removerAcentos(texto).toUpperCase().replace(/[^A-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
};

const compararNomesFlexivel = (nomeSistema: string, nomePdf: string): boolean => {
  const sLimpo = limparTexto(nomeSistema);
  const pLimpo = limparTexto(nomePdf);

  if (!sLimpo || !pLimpo) return false;
  if (sLimpo === pLimpo || sLimpo.includes(pLimpo) || pLimpo.includes(sLimpo)) return true;

  const palavrasSistema = sLimpo.split(' ').filter(p => p.length > 2);
  const palavrasPdf = pLimpo.split(' ').filter(p => p.length > 2);

  if (palavrasSistema.length === 0 || palavrasPdf.length === 0) return false;

  const primeiroNomeIgual = palavrasSistema[0] === palavrasPdf[0];
  const ultimoNomeIgual = palavrasSistema[palavrasSistema.length - 1] === palavrasPdf[palavrasPdf.length - 1];

  if (primeiroNomeIgual && ultimoNomeIgual) return true;

  const palavrasEmComum = palavrasSistema.filter(p => palavrasPdf.includes(p));
  const taxaCoincidencia = palavrasEmComum.length / Math.min(palavrasSistema.length, palavrasPdf.length);

  return taxaCoincidencia >= 0.5;
};

interface TextPos {
  str: string;
  x: number;
  y: number;
}

const processarPaginaHolerite = (items: any[]) => {
  // 1. Extração do Nome via Fluxo Nativo de Texto
  const pageTextRaw = (items || [])
    .map((item: any) => (typeof item?.str === 'string' ? item.str : ''))
    .join(' ');
  const pageText = pageTextRaw.replace(/\s+/g, ' ').trim();

  let nomeBruto = '';
  const regexNomeA = /(?:Código\s*\d*|\d+\s+Código)\s*([A-Za-zÀ-ÖØ-öø-ÿ\s]{3,60}?)\s*Nome do Funcionário/i;
  const matchA = pageText.match(regexNomeA);

  if (matchA && matchA[1]) {
    nomeBruto = matchA[1].trim();
  } else {
    const regexNomeB = /Nome do Funcionário[\s\:\d]*([A-Za-zÀ-ÖØ-öø-ÿ\s]{3,60}?)(?=\s+(?:CBO|CPF|PIS|Admissão|Setor|Seção|F\.I\.|\d{6}))/i;
    const matchB = pageText.match(regexNomeB);
    if (matchB && matchB[1]) {
      nomeBruto = matchB[1].trim();
    }
  }

  nomeBruto = nomeBruto
    .replace(/CBO|Admissão|Setor|Seção|F\.I\.|Código|\d+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // 2. Reconstrução Espacial das Linhas Visuais por Coordenadas (X, Y)
  const validItems: TextPos[] = (items || [])
    .filter((i: any) => i && typeof i.str === 'string' && i.str.trim() !== '' && Array.isArray(i.transform) && i.transform.length >= 6)
    .map((i: any) => ({
      str: i.str.trim(),
      x: i.transform[4],
      y: i.transform[5]
    }));

  const rows: { y: number; items: TextPos[]; text: string }[] = [];
  const sortedByY = [...validItems].sort((a, b) => b.y - a.y);

  for (const item of sortedByY) {
    let row = rows.find(r => Math.abs(r.y - item.y) <= 6);
    if (!row) {
      row = { y: item.y, items: [], text: '' };
      rows.push(row);
    }
    row.items.push(item);
  }

  for (const row of rows) {
    row.items.sort((a, b) => a.x - b.x);
    row.text = row.items.map(i => i.str).join(' ');
  }

  rows.sort((a, b) => b.y - a.y); // Do topo para o rodapé

  let valorLiquido = 0;
  let detalheCalculo = '';

  const parseMoeda = (str: string): number => {
    const val = parseFloat(str.replace(/\./g, '').replace(',', '.'));
    return isNaN(val) ? 0 : val;
  };

  const regexMoeda = /\b\d{1,3}(?:\.\d{3})*,\d{2}\b/g;

  // ESTRATÉGIA A: Rótulo "Valor Líquido" e número na mesma linha visual
  for (const row of rows) {
    if (/Valor\s*Líquido|Líquido\s*a\s*Receber|Valor\s*Liquido/i.test(row.text)) {
      const moedas = row.text.match(regexMoeda);
      if (moedas && moedas.length > 0) {
        valorLiquido = parseMoeda(moedas[moedas.length - 1]);
        if (valorLiquido > 0) {
          detalheCalculo = `Linha 'Valor Líquido': R$ ${valorLiquido.toFixed(2)}`;
          break;
        }
      }
    }
  }

  // ESTRATÉGIA B: Rótulo "Valor Líquido" na linha e Valor na célula da linha abaixo
  if (valorLiquido === 0) {
    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx];
      if (/Valor\s*Líquido|Líquido\s*a\s*Receber|Valor\s*Liquido/i.test(row.text)) {
        const labelItem = row.items.find(i => /Líquido|Liquido/i.test(i.str));
        const labelX = labelItem ? labelItem.x : 300;

        for (let nextIdx = idx + 1; nextIdx < Math.min(idx + 4, rows.length); nextIdx++) {
          const rowAbaixo = rows[nextIdx];
          const moedasRow = rowAbaixo.items.filter(i => regexMoeda.test(i.str));
          if (moedasRow.length > 0) {
            moedasRow.sort((a, b) => Math.abs(a.x - labelX) - Math.abs(b.x - labelX));
            const melhorMoeda = parseMoeda(moedasRow[0].str);
            if (melhorMoeda > 0) {
              valorLiquido = melhorMoeda;
              detalheCalculo = `Célula abaixo do rótulo: R$ ${valorLiquido.toFixed(2)}`;
              break;
            }
          }
        }
      }
      if (valorLiquido > 0) break;
    }
  }

  // ESTRATÉGIA C: Validação Matemática (Vencimentos - Descontos = Líquido)
  if (valorLiquido === 0) {
    const maxY = rows.length > 0 ? rows[0].y : 800;
    const moedasRodape: number[] = [];

    for (const row of rows) {
      if (row.y < maxY * 0.5) { // Apenas valores na metade inferior do recibo
        const matches = row.text.match(regexMoeda) || [];
        matches.forEach(m => {
          const v = parseMoeda(m);
          if (v > 0) moedasRodape.push(v);
        });
      }
    }

    for (let i = 0; i < moedasRodape.length; i++) {
      for (let j = 0; j < moedasRodape.length; j++) {
        if (i === j) continue;
        const vBruto = moedasRodape[i];
        const vDesconto = moedasRodape[j];
        if (vBruto <= vDesconto) continue;

        const diff = Math.round((vBruto - vDesconto) * 100) / 100;
        if (diff > 0 && moedasRodape.some(v => Math.abs(v - diff) < 0.01)) {
          valorLiquido = diff;
          detalheCalculo = `Aferição matemática: R$ ${vBruto.toFixed(2)} - R$ ${vDesconto.toFixed(2)} = R$ ${diff.toFixed(2)}`;
          break;
        }
      }
      if (valorLiquido > 0) break;
    }
  }

  return { nomeBruto, valorLiquido, detalheCalculo, rows };
};

export default function EnvioPagamentosWhatsapp({
  funcionariosList,
  dadosFinanceirosMap,
  diasUteisBase,
  mesFiltro,
  onClose
}: Props) {
  const [telefonePatrao, setTelefonePatrao] = useState('');
  const [itensPagamento, setItensPagamento] = useState<ItemPagamento[]>([]);
  const [carregandoPdf, setCarregandoPdf] = useState(false);
  const [copiadoIdx, setCopiadoIdx] = useState<number | null>(null);
  const [resumoProcessamento, setResumoProcessamento] = useState<{ total: number; lidos: number } | null>(null);

  useEffect(() => {
    if (funcionariosList && funcionariosList.length > 0) {
      const inicial: ItemPagamento[] = funcionariosList.map(func => {
        const dadosMes = dadosFinanceirosMap[func.id] || {};
        const dias = dadosMes.diasUteisPersonalizado !== undefined ? dadosMes.diasUteisPersonalizado : diasUteisBase;
        const totalDiarioVT = func.valorPassagemDiarioPadrao || 0;
        const valorVTCalculado = totalDiarioVT * dias;

        return {
          funcionarioId: func.id,
          nome: func.nome.toUpperCase(),
          valorLiquido: 0,
          valorVT: valorVTCalculado,
          totalPagar: valorVTCalculado,
          chavePix: func.chavePixPadrao || 'Não informada',
          statusLeitura: 'pendente'
        };
      });
      setItensPagamento(inicial);
    }
  }, [funcionariosList, dadosFinanceirosMap, diasUteisBase]);

  const processarPdfHolerite = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCarregandoPdf(true);
    setResumoProcessamento(null);

    console.group('📄 [Holerite Parser] Processando e Alinhando Matriz de Dados');
    console.log('📁 Arquivo:', file.name);

    try {
      const buffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
      console.log(`📑 Total de Páginas: ${pdf.numPages}`);

      const leiturasExtraidas: Array<{ nomeBruto: string; valorLiquido: number; detalhe: string }> = [];

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();

          const { nomeBruto, valorLiquido, detalheCalculo, rows } = processarPaginaHolerite(textContent.items);

          console.log(`--- PÁGINA ${pageNum} ---`);
          console.log(`👤 Nome: "${nomeBruto}" | 💵 Líquido: R$ ${valorLiquido.toFixed(2)} (${detalheCalculo})`);
          console.log('Linhas com Valores:', rows.filter(r => /\d/.test(r.text)).map(r => `[Y=${Math.round(r.y)}] ${r.text}`));

          if (nomeBruto && valorLiquido > 0) {
            leiturasExtraidas.push({ nomeBruto, valorLiquido, detalhe: detalheCalculo });
          } else {
            console.warn(`⚠️ [Página ${pageNum}] Leitura Parcial. Nome: "${nomeBruto}", Líquido: R$ ${valorLiquido}`);
          }
        } catch (errPagina) {
          console.error(`❌ Erro na Página ${pageNum}:`, errPagina);
        }
      }

      console.log('🔍 Mapeando com o cadastro do sistema...');
      let contadorLidos = 0;

      setItensPagamento(prev => prev.map(item => {
        const achado = leiturasExtraidas.find(ext => compararNomesFlexivel(item.nome, ext.nomeBruto));

        if (achado) {
          contadorLidos++;
          console.log(`🎯 [SUCESSO] ${item.nome} <= ${achado.nomeBruto} = R$ ${achado.valorLiquido.toFixed(2)}`);
          return {
            ...item,
            valorLiquido: achado.valorLiquido,
            totalPagar: achado.valorLiquido + item.valorVT,
            statusLeitura: 'sucesso',
            detalhesCalculo: achado.detalhe
          };
        } else {
          console.warn(`❌ [NÃO ENCONTRADO NO PDF] ${item.nome}`);
          return {
            ...item,
            statusLeitura: item.valorLiquido > 0 ? 'manual' : 'nao_encontrado'
          };
        }
      }));

      setResumoProcessamento({ total: funcionariosList.length, lidos: contadorLidos });

    } catch (err) {
      console.error('💥 Erro no processamento:', err);
      alert('Erro ao processar o arquivo de holerites.');
    } finally {
      console.groupEnd();
      setCarregandoPdf(false);
    }
  };

  const atualizarCampoManual = (idx: number, campo: keyof ItemPagamento, valor: any) => {
    setItensPagamento(prev => {
      const copia = [...prev];
      const item = { ...copia[idx], [campo]: valor };

      if (campo === 'valorLiquido' || campo === 'valorVT') {
        const vl = campo === 'valorLiquido' ? (parseFloat(valor) || 0) : item.valorLiquido;
        const vt = campo === 'valorVT' ? (parseFloat(valor) || 0) : item.valorVT;
        item.totalPagar = vl + vt;
        if (campo === 'valorLiquido') item.statusLeitura = 'manual';
      }

      copia[idx] = item;
      return copia;
    });
  };

  const gerartTextoWhatsapp = (item: ItemPagamento) => {
    const mesPtBR = mesFiltro.split('-').reverse().join('/');
    return (
      `📋 *DEMONSTRATIVO DE PAGAMENTO*\n` +
      `📅 *Competência:* ${mesPtBR}\n` +
      `👤 *Colaborador:* ${item.nome}\n\n` +
      `💵 *Valor Líquido (Holerite):* R$ ${item.valorLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` +
      `🚌 *Vale Transporte (VT):* R$ ${item.valorVT.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` +
      `💰 *TOTAL A PAGAR:* R$ ${item.totalPagar.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n` +
      `🔑 *Chave PIX:* ${item.chavePix}`
    );
  };

  const enviarViaWhatsapp = (item: ItemPagamento) => {
    const mensagem = gerartTextoWhatsapp(item);
    const mensagemCodificada = encodeURIComponent(mensagem);
    let url = '';
    if (telefonePatrao.trim()) {
      const numLimpo = telefonePatrao.replace(/\D/g, '');
      const numComDdd = numLimpo.startsWith('55') ? numLimpo : `55${numLimpo}`;
      url = `https://api.whatsapp.com/send?phone=${numComDdd}&text=${mensagemCodificada}`;
    } else {
      url = `https://api.whatsapp.com/send?text=${mensagemCodificada}`;
    }
    window.open(url, '_blank');
  };

  const copiarTexto = (item: ItemPagamento, idx: number) => {
    navigator.clipboard.writeText(gerartTextoWhatsapp(item));
    setCopiadoIdx(idx);
    setTimeout(() => setCopiadoIdx(null), 2000);
  };

  const renderBadgeStatus = (status: StatusLeituraHolerite) => {
    switch (status) {
      case 'sucesso':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>
            <FileCheck size={12} /> Lido e Aferido
          </span>
        );
      case 'manual':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>
            <Edit3 size={12} /> Editado Manualmente
          </span>
        );
      case 'nao_encontrado':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: '#fef3c7', color: '#b45309', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>
            <AlertTriangle size={12} /> Não Achou no PDF
          </span>
        );
      default:
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>
            <HelpCircle size={12} /> Aguardando PDF
          </span>
        );
    }
  };

  return (
    <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '16px', border: '1px solid #e2e8f0' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ backgroundColor: '#dcfce7', padding: '10px', borderRadius: '10px' }}>
            <Send size={20} color="#16a34a" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', color: '#0f172a', fontWeight: 'bold' }}>Envio de Pagamentos</h2>
            <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Conferência Automática de Holerites</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} style={{ border: 'none', background: '#f1f5f9', borderRadius: '50%', padding: '8px', cursor: 'pointer' }}>
            <X size={18} color="#64748b" />
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px dashed #cbd5e1', marginBottom: '16px' }}>
        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: '#25d366', color: 'white', padding: '12px', borderRadius: '10px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', textAlign: 'center', width: '100%' }}>
          <Upload size={18} />
          {carregandoPdf ? 'Conferindo Holerites...' : 'Importar PDF dos Holerites'}
          <input type="file" accept="application/pdf" onChange={processarPdfHolerite} style={{ display: 'none' }} disabled={carregandoPdf} />
        </label>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px 12px' }}>
          <Phone size={16} color="#64748b" />
          <input 
            type="tel" 
            placeholder="Nº WhatsApp do Patrão (Ex: 11999998888)" 
            value={telefonePatrao} 
            onChange={e => setTelefonePatrao(e.target.value)} 
            style={{ width: '100%', border: 'none', outline: 'none', fontSize: '13px' }}
          />
        </div>
      </div>

      {resumoProcessamento && (
        <div style={{ backgroundColor: resumoProcessamento.lidos === resumoProcessamento.total ? '#f0fdf4' : '#fffbeb', border: `1px solid ${resumoProcessamento.lidos === resumoProcessamento.total ? '#bbf7d0' : '#fef3c7'}`, padding: '10px 14px', borderRadius: '10px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
          {resumoProcessamento.lidos === resumoProcessamento.total ? (
            <FileCheck size={18} color="#16a34a" />
          ) : (
            <AlertTriangle size={18} color="#d97706" />
          )}
          <span style={{ color: resumoProcessamento.lidos === resumoProcessamento.total ? '#15803d' : '#b45309', fontWeight: '500' }}>
            {resumoProcessamento.lidos === resumoProcessamento.total 
              ? `Todos os ${resumoProcessamento.lidos} holerites foram lidos e conferidos!`
              : `${resumoProcessamento.lidos} de ${resumoProcessamento.total} holerites foram importados automaticamente.`
            }
          </span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {itensPagamento.map((item, idx) => (
          <div key={idx} style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <User size={18} color="#0f172a" />
                <strong style={{ fontSize: '15px', color: '#0f172a' }}>{item.nome}</strong>
              </div>
              {renderBadgeStatus(item.statusLeitura)}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '2px' }}>Líquido Holerite (R$)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  value={item.valorLiquido || ''} 
                  placeholder="0.00"
                  onChange={e => atualizarCampoManual(idx, 'valorLiquido', e.target.value)} 
                  style={{ 
                    width: '100%', 
                    padding: '8px', 
                    borderRadius: '6px', 
                    border: `1px solid ${item.statusLeitura === 'sucesso' ? '#22c55e' : item.statusLeitura === 'manual' ? '#0284c7' : '#cbd5e1'}`, 
                    fontWeight: 'bold', 
                    fontSize: '13px',
                    backgroundColor: item.statusLeitura === 'sucesso' ? '#f0fdf4' : 'white'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '2px' }}>Vale Transporte (R$)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  value={item.valorVT || ''} 
                  placeholder="0.00"
                  onChange={e => atualizarCampoManual(idx, 'valorVT', e.target.value)} 
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#0284c7', fontSize: '13px' }}
                />
              </div>
            </div>

            {item.detalhesCalculo && item.statusLeitura === 'sucesso' && (
              <div style={{ fontSize: '11px', color: '#166534', display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#f0fdf4', padding: '4px 8px', borderRadius: '4px' }}>
                <Calculator size={12} />
                <span>Origem: {item.detalhesCalculo}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f0fdf4', padding: '8px 12px', borderRadius: '8px' }}>
              <span style={{ fontSize: '12px', color: '#166534', fontWeight: 'bold' }}>Total Final (Holerite + VT):</span>
              <strong style={{ fontSize: '16px', color: '#15803d' }}>
                R$ {item.totalPagar.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </strong>
            </div>

            <div>
              <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '2px' }}>Chave PIX</label>
              <input 
                type="text" 
                value={item.chavePix} 
                onChange={e => atualizarCampoManual(idx, 'chavePix', e.target.value)} 
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button 
                onClick={() => enviarViaWhatsapp(item)}
                style={{ 
                  flex: 3, 
                  backgroundColor: '#25d366', 
                  color: 'white', 
                  border: 'none', 
                  minHeight: '44px', 
                  borderRadius: '8px', 
                  fontWeight: 'bold', 
                  fontSize: '13px', 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '6px' 
                }}
              >
                <Send size={16} /> Enviar no WhatsApp
              </button>

              <button 
                onClick={() => copiarTexto(item, idx)}
                style={{ 
                  flex: 1, 
                  backgroundColor: copiadoIdx === idx ? '#dcfce7' : '#f1f5f9', 
                  color: copiadoIdx === idx ? '#16a34a' : '#475569', 
                  border: 'none', 
                  minHeight: '44px', 
                  borderRadius: '8px', 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {copiadoIdx === idx ? <CheckCircle2 size={18} /> : <Copy size={18} />}
              </button>
            </div>

          </div>
        ))}
      </div>
    </div>
  );
}