import { NfeConfig } from '@modules/nfe/application/config/nfe.config';
import { generateNfeAccessKey, generateRandomCodigoNumerico } from './nfe-access-key.util';

const onlyDigits = (value: string): string => value.replace(/\D+/g, '');

const formatDecimal = (value: unknown, decimals: number = 2): string => {
  const numberValue = typeof value === 'number' ? value : Number(value || 0);
  return numberValue.toFixed(decimals);
};

const formatDateTime = (date: Date): string => {
  const iso = date.toISOString();
  return iso;
};

export interface NfeOrderItemInput {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: unknown;
  total: unknown;
}

export interface NfeOrderInput {
  id: string;
  orderNumber: string;
  total: unknown;
  discount?: unknown | null;
  tax?: unknown | null;
  paymentMethod?: string | null;
  createdAt: Date;
  customer?: {
    firstName: string;
    lastName: string;
    email?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
  } | null;
  orderItems: NfeOrderItemInput[];
}

export interface BuildNfeXmlResult {
  xml: string;
  chaveAcesso: string;
  numero: number;
  serie: string;
  codigoNumerico: string;
}

export class NfeXmlBuilder {
  constructor(private readonly config: NfeConfig) {}

  build(order: NfeOrderInput, numero: number, serie: string): BuildNfeXmlResult {
    const dataEmissao = new Date();
    const codigoNumerico = generateRandomCodigoNumerico();
    const chaveAcesso = generateNfeAccessKey({
      ufCodigo: this.config.ufCodigo,
      dataEmissao,
      cnpj: this.config.emitente.cnpj,
      modelo: this.config.modelo,
      serie,
      numero,
      tipoEmissao: this.config.fiscal.tpEmis,
      codigoNumerico,
    });

    const emit = this.config.emitente;
    const dest = order.customer;
    const destDoc = onlyDigits(this.config.destinatarioPadrao.documento);
    const destNome = dest
      ? `${dest.firstName} ${dest.lastName}`.trim()
      : this.config.destinatarioPadrao.nome;

    const itemsXml = order.orderItems
      .map((item, index) => {
        const itemTotal = formatDecimal(item.total);
        const unitPrice = formatDecimal(item.unitPrice);
        const quantity = formatDecimal(item.quantity, 4);
        const ncm = this.config.fiscal.ncmPadrao;
        const cfop = this.config.fiscal.cfopPadrao;
        const uCom = this.config.fiscal.unidadeComercialPadrao;

        const icmsTag = emit.crt === '1'
          ? `
            <ICMSSN102>
              <orig>0</orig>
              <CSOSN>${this.config.fiscal.csosnPadrao}</CSOSN>
            </ICMSSN102>`
          : `
            <ICMS00>
              <orig>0</orig>
              <CST>${this.config.fiscal.cstPadrao}</CST>
              <modBC>3</modBC>
              <vBC>${itemTotal}</vBC>
              <pICMS>${formatDecimal(this.config.fiscal.aliquotaIcms)}</pICMS>
              <vICMS>0.00</vICMS>
            </ICMS00>`;

        return `
        <det nItem="${index + 1}">
          <prod>
            <cProd>${item.productId}</cProd>
            <cEAN></cEAN>
            <xProd>${item.productName}</xProd>
            <NCM>${ncm}</NCM>
            <CFOP>${cfop}</CFOP>
            <uCom>${uCom}</uCom>
            <qCom>${quantity}</qCom>
            <vUnCom>${unitPrice}</vUnCom>
            <vProd>${itemTotal}</vProd>
            <cEANTrib></cEANTrib>
            <uTrib>${uCom}</uTrib>
            <qTrib>${quantity}</qTrib>
            <vUnTrib>${unitPrice}</vUnTrib>
            <indTot>1</indTot>
          </prod>
          <imposto>
            <ICMS>
              ${icmsTag}
            </ICMS>
            <PIS>
              <PISAliq>
                <CST>01</CST>
                <vBC>${itemTotal}</vBC>
                <pPIS>${formatDecimal(this.config.fiscal.aliquotaPis)}</pPIS>
                <vPIS>0.00</vPIS>
              </PISAliq>
            </PIS>
            <COFINS>
              <COFINSAliq>
                <CST>01</CST>
                <vBC>${itemTotal}</vBC>
                <pCOFINS>${formatDecimal(this.config.fiscal.aliquotaCofins)}</pCOFINS>
                <vCOFINS>0.00</vCOFINS>
              </COFINSAliq>
            </COFINS>
          </imposto>
        </det>`;
      })
      .join('');

    const total = formatDecimal(order.total);

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe Id="NFe${chaveAcesso}" versao="${this.config.versao}">
    <ide>
      <cUF>${this.config.ufCodigo}</cUF>
      <cNF>${codigoNumerico}</cNF>
      <natOp>${this.config.fiscal.natOp}</natOp>
      <mod>${this.config.modelo}</mod>
      <serie>${serie}</serie>
      <nNF>${numero}</nNF>
      <dhEmi>${formatDateTime(dataEmissao)}</dhEmi>
      <tpNF>1</tpNF>
      <idDest>1</idDest>
      <cMunFG>${emit.endereco.municipioCodigo}</cMunFG>
      <tpImp>1</tpImp>
      <tpEmis>${this.config.fiscal.tpEmis}</tpEmis>
      <tpAmb>${this.config.ambiente === 'homolog' ? '2' : '1'}</tpAmb>
      <finNFe>1</finNFe>
      <indFinal>1</indFinal>
      <indPres>1</indPres>
      <procEmi>0</procEmi>
      <verProc>sales-pdv-back</verProc>
    </ide>
    <emit>
      <CNPJ>${onlyDigits(emit.cnpj)}</CNPJ>
      <xNome>${emit.razaoSocial}</xNome>
      <xFant>${emit.nomeFantasia}</xFant>
      <enderEmit>
        <xLgr>${emit.endereco.logradouro}</xLgr>
        <nro>${emit.endereco.numero}</nro>
        <xBairro>${emit.endereco.bairro}</xBairro>
        <cMun>${emit.endereco.municipioCodigo}</cMun>
        <xMun>${emit.endereco.municipioNome}</xMun>
        <UF>${emit.endereco.uf}</UF>
        <CEP>${onlyDigits(emit.endereco.cep)}</CEP>
        <cPais>${emit.endereco.paisCodigo}</cPais>
        <xPais>${emit.endereco.paisNome}</xPais>
        ${emit.endereco.telefone ? `<fone>${onlyDigits(emit.endereco.telefone)}</fone>` : ''}
      </enderEmit>
      <IE>${onlyDigits(emit.ie)}</IE>
      <CRT>${emit.crt}</CRT>
    </emit>
    <dest>
      ${destDoc.length === 11 ? `<CPF>${destDoc}</CPF>` : `<CNPJ>${destDoc}</CNPJ>`}
      <xNome>${destNome}</xNome>
      <enderDest>
        <xLgr>${dest?.address || 'NAO INFORMADO'}</xLgr>
        <nro>SN</nro>
        <xBairro>NAO INFORMADO</xBairro>
        <cMun>${emit.endereco.municipioCodigo}</cMun>
        <xMun>${dest?.city || emit.endereco.municipioNome}</xMun>
        <UF>${dest?.state || emit.endereco.uf}</UF>
        <CEP>${onlyDigits(dest?.zipCode || emit.endereco.cep)}</CEP>
        <cPais>${emit.endereco.paisCodigo}</cPais>
        <xPais>${emit.endereco.paisNome}</xPais>
      </enderDest>
      <indIEDest>${this.config.destinatarioPadrao.indIeDest}</indIEDest>
      ${dest?.email || this.config.destinatarioPadrao.email ? `<email>${dest?.email || this.config.destinatarioPadrao.email}</email>` : ''}
    </dest>
    ${itemsXml}
    <total>
      <ICMSTot>
        <vBC>0.00</vBC>
        <vICMS>0.00</vICMS>
        <vICMSDeson>0.00</vICMSDeson>
        <vFCP>0.00</vFCP>
        <vBCST>0.00</vBCST>
        <vST>0.00</vST>
        <vFCPST>0.00</vFCPST>
        <vFCPSTRet>0.00</vFCPSTRet>
        <vProd>${total}</vProd>
        <vFrete>0.00</vFrete>
        <vSeg>0.00</vSeg>
        <vDesc>${formatDecimal(order.discount || 0)}</vDesc>
        <vII>0.00</vII>
        <vIPI>0.00</vIPI>
        <vIPIDevol>0.00</vIPIDevol>
        <vPIS>0.00</vPIS>
        <vCOFINS>0.00</vCOFINS>
        <vOutro>0.00</vOutro>
        <vNF>${total}</vNF>
      </ICMSTot>
    </total>
    <transp>
      <modFrete>9</modFrete>
    </transp>
    <pag>
      <detPag>
        <indPag>0</indPag>
        <tPag>01</tPag>
        <vPag>${total}</vPag>
      </detPag>
    </pag>
  </infNFe>
</NFe>`;

    return {
      xml,
      chaveAcesso,
      numero,
      serie,
      codigoNumerico,
    };
  }
}
