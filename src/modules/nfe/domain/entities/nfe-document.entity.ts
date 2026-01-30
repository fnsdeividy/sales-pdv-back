export type NfeStatus =
  | 'PENDENTE_ENVIO'
  | 'ENVIADO'
  | 'PROCESSANDO'
  | 'AUTORIZADO'
  | 'REJEITADO';

export type NfeEnvironment = 'homolog' | 'producao';

export interface NfeDocumentEntity {
  id: string;
  orderId: string;
  chaveAcesso: string;
  numero: number;
  serie: string;
  uf: string;
  modelo: string;
  ambiente: NfeEnvironment;
  status: NfeStatus;
  recibo?: string | null;
  protocolo?: string | null;
  mensagemRetorno?: string | null;
  xmlAssinado: string;
  xmlAutorizado?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
