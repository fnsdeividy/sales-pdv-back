import * as https from 'node:https';
import { NfeConfig } from '@modules/nfe/application/config/nfe.config';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const extractTagValue = (xml: string, tag: string): string | null => {
  const regex = new RegExp(`<${tag}>([^<]+)</${tag}>`);
  const match = xml.match(regex);
  return match ? match[1] : null;
};

const extractTagBlock = (xml: string, tag: string): string | null => {
  const regex = new RegExp(`<${tag}[\s\S]*?</${tag}>`);
  const match = xml.match(regex);
  return match ? match[0] : null;
};

export interface NfeEnvioResposta {
  status: string | null;
  motivo: string | null;
  recibo: string | null;
  rawResponse: string;
}

export interface NfeConsultaResposta {
  status: string | null;
  motivo: string | null;
  protocolo: string | null;
  xmlAutorizado?: string | null;
  rawResponse: string;
}

export class NfeSoapClient {
  constructor(private readonly config: NfeConfig) {}

  private ensureSefazConfig() {
    if (this.config.provider !== 'sefaz' || !this.config.soap || !this.config.certificadoPfxPath || !this.config.certificadoPfxSenha) {
      throw new Error('Configuração SEFAZ inválida. Verifique NFE_CERT_* e NFE_WS_*.');
    }
  }

  private async postXml(url: string, xml: string): Promise<string> {
    this.ensureSefazConfig();
    return new Promise((resolve, reject) => {
      const request = https.request(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/soap+xml; charset=utf-8',
            'Content-Length': Buffer.byteLength(xml),
          },
          pfx: require('node:fs').readFileSync(this.config.certificadoPfxPath as string),
          passphrase: this.config.certificadoPfxSenha as string,
        },
        response => {
          let data = '';
          response.on('data', chunk => {
            data += chunk;
          });
          response.on('end', () => resolve(data));
        }
      );

      request.on('error', reject);
      request.write(xml);
      request.end();
    });
  }

  private buildSoapEnvelope(body: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    ${body}
  </soap12:Body>
</soap12:Envelope>`;
  }

  async enviarLoteNfe(xmlAssinado: string, loteId: string): Promise<NfeEnvioResposta> {
    this.ensureSefazConfig();
    const soap = this.config.soap!;
    const body = `
<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="${this.config.versao}">
  <idLote>${loteId}</idLote>
  <indSinc>0</indSinc>
  ${xmlAssinado}
</enviNFe>`;

    const envelope = this.buildSoapEnvelope(body);
    const response = await this.postXml(soap.envioLoteUrl, envelope);

    return {
      status: extractTagValue(response, 'cStat'),
      motivo: extractTagValue(response, 'xMotivo'),
      recibo: extractTagValue(response, 'nRec'),
      rawResponse: response,
    };
  }

  async consultarRecibo(recibo: string): Promise<NfeConsultaResposta> {
    this.ensureSefazConfig();
    const soap = this.config.soap!;
    const body = `
<consReciNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="${this.config.versao}">
  <tpAmb>${this.config.ambiente === 'homolog' ? '2' : '1'}</tpAmb>
  <nRec>${recibo}</nRec>
</consReciNFe>`;

    const envelope = this.buildSoapEnvelope(body);
    const response = await this.postXml(soap.consultaReciboUrl, envelope);

    return {
      status: extractTagValue(response, 'cStat'),
      motivo: extractTagValue(response, 'xMotivo'),
      protocolo: extractTagValue(response, 'nProt'),
      xmlAutorizado: extractTagBlock(response, 'nfeProc'),
      rawResponse: response,
    };
  }

  async consultarNfe(chave: string): Promise<NfeConsultaResposta> {
    this.ensureSefazConfig();
    const soap = this.config.soap!;
    const body = `
<consSitNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="${this.config.versao}">
  <tpAmb>${this.config.ambiente === 'homolog' ? '2' : '1'}</tpAmb>
  <xServ>CONSULTAR</xServ>
  <chNFe>${chave}</chNFe>
</consSitNFe>`;

    const envelope = this.buildSoapEnvelope(body);
    const response = await this.postXml(soap.consultaNfeUrl, envelope);

    return {
      status: extractTagValue(response, 'cStat'),
      motivo: extractTagValue(response, 'xMotivo'),
      protocolo: extractTagValue(response, 'nProt'),
      xmlAutorizado: extractTagBlock(response, 'nfeProc'),
      rawResponse: response,
    };
  }

  async consultarReciboComTentativas(recibo: string): Promise<NfeConsultaResposta> {
    for (let attempt = 1; attempt <= this.config.consultaMaxTentativas; attempt += 1) {
      const resposta = await this.consultarRecibo(recibo);
      if (resposta.status === '100' || resposta.status === '104' || resposta.status === '539') {
        return resposta;
      }
      await sleep(this.config.consultaIntervaloMs);
    }

    return {
      status: null,
      motivo: 'Consulta não finalizada dentro do limite de tentativas',
      protocolo: null,
      xmlAutorizado: null,
      rawResponse: '',
    };
  }
}
