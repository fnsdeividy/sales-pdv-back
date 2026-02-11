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

/** Valores padrão para desenvolvimento quando NFe não está configurado */
const NFE_DEV_DEFAULTS = {
  NFE_EMIT_CNPJ: '00000000000191',
  NFE_EMIT_IE: '000000000000',
  NFE_EMIT_RAZAO: 'Empresa Desenvolvimento',
  NFE_EMIT_LOGRADOURO: 'Rua Exemplo',
  NFE_EMIT_NUMERO: '1',
  NFE_EMIT_BAIRRO: 'Centro',
  NFE_EMIT_MUN_CODIGO: '3304557',
  NFE_EMIT_MUN_NOME: 'Rio de Janeiro',
  NFE_EMIT_CEP: '20000000',
  NFE_DEST_DOC_PADRAO: '00000000000191',
  NFE_DEST_NOME_PADRAO: 'Consumidor Final',
};

const getOrDevDefault = (
  configService: ConfigService,
  key: keyof typeof NFE_DEV_DEFAULTS,
  strict = false,
): string => {
  const value = configService.get<string>(key);
  if (value) return value;
  if (strict) return requireValue(undefined, key);
  return NFE_DEV_DEFAULTS[key];
};

export const getNfeConfig = (configService: ConfigService): NfeConfig => {
  const provider = (configService.get<string>('NFE_PROVIDER') || 'sefaz') as NfeProvider;
  const ambiente = (configService.get<string>('NFE_ENV') || 'homolog') as 'homolog' | 'producao';
  const nfeEnabled = configService.get<string>('NFE_ENABLED') === 'true';

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
    certificadoPfxPath: (provider === 'sefaz' && nfeEnabled)
      ? requireValue(configService.get<string>('NFE_CERT_PFX_PATH'), 'NFE_CERT_PFX_PATH')
      : configService.get<string>('NFE_CERT_PFX_PATH') || '',
    certificadoPfxSenha: (provider === 'sefaz' && nfeEnabled)
      ? requireValue(configService.get<string>('NFE_CERT_PFX_PASSWORD'), 'NFE_CERT_PFX_PASSWORD')
      : configService.get<string>('NFE_CERT_PFX_PASSWORD') || '',
    emitente: {
      cnpj: getOrDevDefault(configService, 'NFE_EMIT_CNPJ', nfeEnabled),
      ie: getOrDevDefault(configService, 'NFE_EMIT_IE', nfeEnabled),
      razaoSocial: getOrDevDefault(configService, 'NFE_EMIT_RAZAO', nfeEnabled),
      nomeFantasia: configService.get<string>('NFE_EMIT_FANTASIA') || 'Emitente',
      crt: configService.get<string>('NFE_EMIT_CRT') || '1',
      endereco: {
        logradouro: getOrDevDefault(configService, 'NFE_EMIT_LOGRADOURO', nfeEnabled),
        numero: getOrDevDefault(configService, 'NFE_EMIT_NUMERO', nfeEnabled),
        bairro: getOrDevDefault(configService, 'NFE_EMIT_BAIRRO', nfeEnabled),
        municipioCodigo: getOrDevDefault(configService, 'NFE_EMIT_MUN_CODIGO', nfeEnabled),
        municipioNome: getOrDevDefault(configService, 'NFE_EMIT_MUN_NOME', nfeEnabled),
        uf: configService.get<string>('NFE_EMIT_UF') || 'RJ',
        cep: getOrDevDefault(configService, 'NFE_EMIT_CEP', nfeEnabled),
        paisCodigo: configService.get<string>('NFE_EMIT_PAIS_CODIGO') || '1058',
        paisNome: configService.get<string>('NFE_EMIT_PAIS_NOME') || 'BRASIL',
        telefone: configService.get<string>('NFE_EMIT_FONE') || undefined,
      },
    },
    destinatarioPadrao: {
      documento: getOrDevDefault(configService, 'NFE_DEST_DOC_PADRAO', nfeEnabled),
      nome: getOrDevDefault(configService, 'NFE_DEST_NOME_PADRAO', nfeEnabled),
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
        envioLoteUrl: nfeEnabled
          ? requireValue(configService.get<string>('NFE_WS_ENVIO_LOTE_URL'), 'NFE_WS_ENVIO_LOTE_URL')
          : configService.get<string>('NFE_WS_ENVIO_LOTE_URL') || 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.00.asmx',
        consultaReciboUrl: nfeEnabled
          ? requireValue(configService.get<string>('NFE_WS_CONSULTA_RECIBO_URL'), 'NFE_WS_CONSULTA_RECIBO_URL')
          : configService.get<string>('NFE_WS_CONSULTA_RECIBO_URL') || 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeRetRecepcao/NfeRetRecepcao4.00.asmx',
        consultaNfeUrl: nfeEnabled
          ? requireValue(configService.get<string>('NFE_WS_CONSULTA_NFE_URL'), 'NFE_WS_CONSULTA_NFE_URL')
          : configService.get<string>('NFE_WS_CONSULTA_NFE_URL') || 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.00.asmx',
      }
      : undefined,
    nuvemFiscal: provider === 'nuvemfiscal'
      ? {
        baseUrl:
          configService.get<string>('NUVEM_FISCAL_BASE_URL') ||
          (ambiente === 'homolog' ? 'https://api.sandbox.nuvemfiscal.com.br' : 'https://api.nuvemfiscal.com.br'),
        authUrl: configService.get<string>('NUVEM_FISCAL_AUTH_URL') || 'https://auth.nuvemfiscal.com.br/oauth/token',
        clientId: nfeEnabled
          ? requireValue(configService.get<string>('NUVEM_FISCAL_CLIENT_ID'), 'NUVEM_FISCAL_CLIENT_ID')
          : configService.get<string>('NUVEM_FISCAL_CLIENT_ID') || 'dev-placeholder',
        clientSecret: nfeEnabled
          ? requireValue(configService.get<string>('NUVEM_FISCAL_CLIENT_SECRET'), 'NUVEM_FISCAL_CLIENT_SECRET')
          : configService.get<string>('NUVEM_FISCAL_CLIENT_SECRET') || 'dev-placeholder',
        scope: configService.get<string>('NUVEM_FISCAL_SCOPE') || 'nfe',
        timeoutMs: Number(configService.get<string>('NUVEM_FISCAL_TIMEOUT_MS') || '20000'),
      }
      : undefined,
  };
};
