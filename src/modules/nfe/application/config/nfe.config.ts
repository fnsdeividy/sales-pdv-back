import { ConfigService } from '@nestjs/config';

/** Token de injeção para a configuração NFe */
export const NFE_CONFIG = Symbol('NFE_CONFIG');

export type NfeProvider = 'sefaz' | 'nuvemfiscal';

export interface NfeEmitenteConfig {
  cnpj: string;
  ie: string;
  razaoSocial: string;
  nomeFantasia: string;
  crt: string;
  endereco: {
    logradouro: string;
    numero: string;
    bairro: string;
    municipioCodigo: string;
    municipioNome: string;
    uf: string;
    cep: string;
    paisCodigo: string;
    paisNome: string;
    telefone?: string;
  };
}

export interface NfeDestinatarioPadraoConfig {
  documento: string;
  nome: string;
  indIeDest: string;
  email?: string;
}

export interface NfeFiscalConfig {
  cfopPadrao: string;
  cstPadrao: string;
  csosnPadrao: string;
  ncmPadrao: string;
  aliquotaIcms: string;
  aliquotaPis: string;
  aliquotaCofins: string;
  unidadeComercialPadrao: string;
  natOp: string;
  tpEmis: string;
}

export interface NfeSoapConfig {
  envioLoteUrl: string;
  consultaReciboUrl: string;
  consultaNfeUrl: string;
}

export interface NuvemFiscalConfig {
  baseUrl: string;
  authUrl: string;
  clientId: string;
  clientSecret: string;
  scope: string;
  timeoutMs: number;
}

export interface NfeConfig {
  provider: NfeProvider;
  ambiente: 'homolog' | 'producao';
  uf: string;
  ufCodigo: string;
  serie: string;
  modelo: string;
  versao: string;
  numeroInicial: number;
  consultaAutomatica: boolean;
  consultaMaxTentativas: number;
  consultaIntervaloMs: number;
  certificadoPfxPath?: string;
  certificadoPfxSenha?: string;
  emitente: NfeEmitenteConfig;
  destinatarioPadrao: NfeDestinatarioPadraoConfig;
  fiscal: NfeFiscalConfig;
  soap?: NfeSoapConfig;
  nuvemFiscal?: NuvemFiscalConfig;
}

const requireValue = (value: string | undefined, name: string): string => {
  if (!value) {
    throw new Error(`Configuração obrigatória ausente: ${name}`);
  }
  return value;
};

export const getNfeConfig = (configService: ConfigService): NfeConfig => {
  const provider = (configService.get<string>('NFE_PROVIDER') || 'sefaz') as NfeProvider;
  const ambiente = (configService.get<string>('NFE_ENV') || 'homolog') as 'homolog' | 'producao';
  const requireWhen = (condition: boolean, value: string | undefined, name: string): string | undefined =>
    condition ? requireValue(value, name) : value;

  return {
    provider,
    ambiente,
    uf: configService.get<string>('NFE_UF') || 'RJ',
    ufCodigo: configService.get<string>('NFE_UF_CODIGO') || '33',
    serie: configService.get<string>('NFE_SERIE') || '1',
    modelo: configService.get<string>('NFE_MODELO') || '55',
    versao: configService.get<string>('NFE_VERSAO') || '4.00',
    numeroInicial: Number(configService.get<string>('NFE_NUMERO_INICIAL') || '1'),
    consultaAutomatica: (configService.get<string>('NFE_CONSULTA_AUTOMATICA') || 'true') === 'true',
    consultaMaxTentativas: Number(configService.get<string>('NFE_CONSULTA_MAX_TENTATIVAS') || '10'),
    consultaIntervaloMs: Number(configService.get<string>('NFE_CONSULTA_INTERVALO_MS') || '3000'),
    certificadoPfxPath: requireWhen(provider === 'sefaz', configService.get<string>('NFE_CERT_PFX_PATH'), 'NFE_CERT_PFX_PATH'),
    certificadoPfxSenha: requireWhen(provider === 'sefaz', configService.get<string>('NFE_CERT_PFX_PASSWORD'), 'NFE_CERT_PFX_PASSWORD'),
    emitente: {
      cnpj: requireValue(configService.get<string>('NFE_EMIT_CNPJ'), 'NFE_EMIT_CNPJ'),
      ie: requireValue(configService.get<string>('NFE_EMIT_IE'), 'NFE_EMIT_IE'),
      razaoSocial: requireValue(configService.get<string>('NFE_EMIT_RAZAO'), 'NFE_EMIT_RAZAO'),
      nomeFantasia: configService.get<string>('NFE_EMIT_FANTASIA') || 'Emitente',
      crt: configService.get<string>('NFE_EMIT_CRT') || '1',
      endereco: {
        logradouro: requireValue(configService.get<string>('NFE_EMIT_LOGRADOURO'), 'NFE_EMIT_LOGRADOURO'),
        numero: requireValue(configService.get<string>('NFE_EMIT_NUMERO'), 'NFE_EMIT_NUMERO'),
        bairro: requireValue(configService.get<string>('NFE_EMIT_BAIRRO'), 'NFE_EMIT_BAIRRO'),
        municipioCodigo: requireValue(configService.get<string>('NFE_EMIT_MUN_CODIGO'), 'NFE_EMIT_MUN_CODIGO'),
        municipioNome: requireValue(configService.get<string>('NFE_EMIT_MUN_NOME'), 'NFE_EMIT_MUN_NOME'),
        uf: configService.get<string>('NFE_EMIT_UF') || 'RJ',
        cep: requireValue(configService.get<string>('NFE_EMIT_CEP'), 'NFE_EMIT_CEP'),
        paisCodigo: configService.get<string>('NFE_EMIT_PAIS_CODIGO') || '1058',
        paisNome: configService.get<string>('NFE_EMIT_PAIS_NOME') || 'BRASIL',
        telefone: configService.get<string>('NFE_EMIT_FONE') || undefined,
      },
    },
    destinatarioPadrao: {
      documento: requireValue(configService.get<string>('NFE_DEST_DOC_PADRAO'), 'NFE_DEST_DOC_PADRAO'),
      nome: requireValue(configService.get<string>('NFE_DEST_NOME_PADRAO'), 'NFE_DEST_NOME_PADRAO'),
      indIeDest: configService.get<string>('NFE_DEST_IND_IE') || '9',
      email: configService.get<string>('NFE_DEST_EMAIL_PADRAO') || undefined,
    },
    fiscal: {
      cfopPadrao: configService.get<string>('NFE_CFOP_PADRAO') || '5102',
      cstPadrao: configService.get<string>('NFE_CST_PADRAO') || '00',
      csosnPadrao: configService.get<string>('NFE_CSOSN_PADRAO') || '102',
      ncmPadrao: configService.get<string>('NFE_NCM_PADRAO') || '00000000',
      aliquotaIcms: configService.get<string>('NFE_ALIQ_ICMS') || '0',
      aliquotaPis: configService.get<string>('NFE_ALIQ_PIS') || '0',
      aliquotaCofins: configService.get<string>('NFE_ALIQ_COFINS') || '0',
      unidadeComercialPadrao: configService.get<string>('NFE_UNIDADE_PADRAO') || 'UN',
      natOp: configService.get<string>('NFE_NAT_OP') || 'VENDA DE MERCADORIA',
      tpEmis: configService.get<string>('NFE_TP_EMIS') || '1',
    },
    soap: provider === 'sefaz'
      ? {
        envioLoteUrl: requireValue(configService.get<string>('NFE_WS_ENVIO_LOTE_URL'), 'NFE_WS_ENVIO_LOTE_URL'),
        consultaReciboUrl: requireValue(configService.get<string>('NFE_WS_CONSULTA_RECIBO_URL'), 'NFE_WS_CONSULTA_RECIBO_URL'),
        consultaNfeUrl: requireValue(configService.get<string>('NFE_WS_CONSULTA_NFE_URL'), 'NFE_WS_CONSULTA_NFE_URL'),
      }
      : undefined,
    nuvemFiscal: provider === 'nuvemfiscal'
      ? {
        baseUrl:
          configService.get<string>('NUVEM_FISCAL_BASE_URL') ||
          (ambiente === 'homolog' ? 'https://api.sandbox.nuvemfiscal.com.br' : 'https://api.nuvemfiscal.com.br'),
        authUrl: configService.get<string>('NUVEM_FISCAL_AUTH_URL') || 'https://auth.nuvemfiscal.com.br/oauth/token',
        clientId: requireValue(configService.get<string>('NUVEM_FISCAL_CLIENT_ID'), 'NUVEM_FISCAL_CLIENT_ID'),
        clientSecret: requireValue(configService.get<string>('NUVEM_FISCAL_CLIENT_SECRET'), 'NUVEM_FISCAL_CLIENT_SECRET'),
        scope: configService.get<string>('NUVEM_FISCAL_SCOPE') || 'nfe',
        timeoutMs: Number(configService.get<string>('NUVEM_FISCAL_TIMEOUT_MS') || '20000'),
      }
      : undefined,
  };
};
