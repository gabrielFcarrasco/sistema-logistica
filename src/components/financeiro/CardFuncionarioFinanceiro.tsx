// src/components/financeiro/CardFuncionarioFinanceiro.tsx
import React from 'react';
import { User, FileText, QrCode, Bus, Route, Banknote, PlusCircle, CheckCircle, PenTool, Edit3, Trash2 } from 'lucide-react';
import Button from '../ui/Button';

interface Props {
  func: any;
  dadosFunc: any;
  diasUteisBase: number;
  onExportarTermoPdf: (func: any) => void;
  onSalvarChavePix: (funcId: string, chave: string) => void;
  onSalvarDiasPersonalizados: (funcId: string, dias: number) => void;
  onAbrirTransporte: (funcId: string, nome: string) => void;
  onAbrirAdiantamento: (funcId: string, nome: string, vale?: any) => void;
  onExcluirAdiantamento: (funcId: string, idVale: string) => void;
  onAbrirAssinatura: (funcId: string, idVale: string) => void;
}

export default function CardFuncionarioFinanceiro({
  func,
  dadosFunc,
  diasUteisBase,
  onExportarTermoPdf,
  onSalvarChavePix,
  onSalvarDiasPersonalizados,
  onAbrirTransporte,
  onAbrirAdiantamento,
  onExcluirAdiantamento,
  onAbrirAssinatura
}: Props) {
  const adiantamentos = dadosFunc.adiantamentos || [];
  const totalAdiantado = adiantamentos.reduce((acc: number, curr: any) => acc + curr.valor, 0);
  
  const rotasFunc = func.transportesPadrao || [];
  const totalPassagemDiario = func.valorPassagemDiarioPadrao || 0;
  const chavePixExibida = func.chavePixPadrao || '';
  
  const diasFuncionario = dadosFunc.diasUteisPersonalizado !== undefined ? dadosFunc.diasUteisPersonalizado : diasUteisBase;
  const totalPassagemCalculado = totalPassagemDiario * diasFuncionario;

  return (
    <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}>
      
      {/* Nome do Funcionário + Ações de Topo */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', backgroundColor: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <User size={18} color="#475569" />
          </div>
          <strong style={{ fontSize: '17px', color: '#1e293b' }}>{func.nome}</strong>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {adiantamentos.length > 0 && (
            <Button onClick={() => onExportarTermoPdf(func)} style={{ backgroundColor: '#ef4444', color: 'white', fontSize: '12px', height: '38px', padding: '0 10px', gap: '6px', flex: 1 }}>
              <FileText size={14} /> Termo PDF
            </Button>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#f8fafc', padding: '6px 10px', borderRadius: '8px', border: '1px dashed #cbd5e1', flex: 2, minWidth: '180px' }}>
            <QrCode size={16} color="#64748b" />
            <input 
              type="text" 
              placeholder="Chave PIX..." 
              defaultValue={chavePixExibida} 
              onBlur={(e) => onSalvarChavePix(func.id, e.target.value)} 
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', width: '100%' }} 
            />
          </div>
        </div>
      </div>

      {/* Vale Transporte */}
      <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px dashed #cbd5e1', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ margin: 0, fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase' }}>
            <Bus size={14}/> Vale Transporte
          </h4>
          <Button onClick={() => onAbrirTransporte(func.id, func.nome)} style={{ backgroundColor: 'white', color: '#0f172a', border: '1px solid #cbd5e1', fontSize: '12px', height: '32px', gap: '4px', padding: '0 8px' }}>
            <Route size={14} /> Rotas
          </Button>
        </div>

        {rotasFunc.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#334155' }}>
            <span>Diário: <strong>R$ {totalPassagemDiario.toFixed(2)}</strong></span>
            <span>| Dias:</span>
            <input 
              type="number" 
              value={diasFuncionario} 
              onChange={(e) => onSalvarDiasPersonalizados(func.id, parseInt(e.target.value))} 
              style={{ width: '42px', padding: '2px', textAlign: 'center', borderRadius: '4px', border: '1px solid #cbd5e1', fontWeight: 'bold' }} 
            />
            <span>= <strong style={{ color: '#0ea5e9', fontSize: '14px' }}>R$ {totalPassagemCalculado.toFixed(2)}</strong></span>
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>Nenhuma rota configurada.</p>
        )}
      </div>

      {/* Adiantamentos / Vales */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h4 style={{ margin: 0, fontSize: '13px', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Banknote size={15} /> Adiantamentos
          </h4>
          <button onClick={() => onAbrirAdiantamento(func.id, func.nome)} style={{ backgroundColor: '#eff6ff', color: '#3b82f6', border: 'none', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <PlusCircle size={14} /> Novo Vale
          </button>
        </div>

        {adiantamentos.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {adiantamentos.map((ad: any) => (
              <div key={ad.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px', backgroundColor: '#fef2f2', padding: '10px', borderRadius: '8px', fontSize: '13px', border: '1px solid #fee2e2' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#991b1b', fontWeight: '500' }}>{ad.data} - {ad.motivo}</span>
                  <strong style={{ color: '#b91c1c' }}>R$ {ad.valor.toFixed(2)}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px dashed #fca5a5', paddingTop: '6px' }}>
                  {ad.assinatura ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#16a34a', fontSize: '11px', fontWeight: 'bold', backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '4px' }}>
                      <CheckCircle size={12} /> Assinado
                    </div>
                  ) : (
                    <button onClick={() => onAbrirAssinatura(func.id, ad.id)} style={{ background: 'white', border: '1px solid #cbd5e1', color: '#0f172a', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                      <PenTool size={12} /> Assinar
                    </button>
                  )}
                  <button onClick={() => onAbrirAdiantamento(func.id, func.nome, ad)} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: '2px' }}><Edit3 size={15} /></button>
                  <button onClick={() => onExcluirAdiantamento(func.id, ad.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}><Trash2 size={15} /></button>
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 4px', borderTop: '2px solid #e2e8f0', marginTop: '4px' }}>
              <strong style={{ color: '#1e293b', fontSize: '13px' }}>Total Vales:</strong>
              <strong style={{ color: '#b91c1c', fontSize: '15px' }}>R$ {totalAdiantado.toFixed(2)}</strong>
            </div>
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>Nenhum adiantamento no mês.</p>
        )}
      </div>

    </div>
  );
}