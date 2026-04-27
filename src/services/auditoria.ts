// src/services/auditoria.ts
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export type TipoAcao = 
  | 'ENTREGA_EPI' 
  | 'EDICAO_ESTOQUE' 
  | 'ADVERTENCIA' 
  | 'MUDANCA_SETOR' 
  | 'ENTREGA_RETROATIVA';

interface DadosAuditoria {
  usuarioId: string;       // Quem fez a ação
  usuarioNome: string;     // Nome de quem fez
  unidadeOrigem: string;   // De qual unidade ele é (Responsável do Setor A)
  unidadeAfetada: string;  // Em qual unidade ele mexeu (Mexeu no Setor B)
  acao: TipoAcao;          // O que ele fez
  descricao: string;       // Detalhes (ex: "Entregou 2 luvas para Carlos")
  alertaDesvio?: boolean;  // Se for true, o Dashboard do Sócio vai piscar vermelho!
}

export const registrarAuditoria = async (dados: DadosAuditoria) => {
  try {
    // Verifica se a pessoa está mexendo no setor do vizinho
    const isInterferenciaExterna = dados.unidadeOrigem !== dados.unidadeAfetada && dados.unidadeOrigem !== 'todas';

    await addDoc(collection(db, 'auditoria'), {
      ...dados,
      interferenciaExterna: isInterferenciaExterna, // O "dedo duro" marca isso aqui
      dataHora: serverTimestamp()
    });

    // Aqui no futuro podemos colocar um gatilho: 
    // Se "isInterferenciaExterna" for true, manda um push/email para o Sócio.

  } catch (error) {
    console.error("Erro ao registrar auditoria:", error);
  }
};