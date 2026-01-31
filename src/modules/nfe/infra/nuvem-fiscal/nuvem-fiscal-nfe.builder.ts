import { NfeConfig } from '@modules/nfe/application/config/nfe.config';
import { generateNfeAccessKey, generateRandomCodigoNumerico } from '@modules/nfe/infra/xml/nfe-access-key.util';
import { NfeOrderInput } from '@modules/nfe/infra/xml/nfe-xml.builder';

const onlyDigits = (value: string): string => value.replace(/\D+/g, '');

const toNumber = (value: unknown, decimals: number = 2): number => {
  const numberValue = typeof value === 'number' ? value : Number(value || 0);
  return Number(numberValue.toFixed(decimals));
};

const toIsoDateTime = (date: Date): string => date.toISOString();

export interface NuvemFiscalNfePedidoEmissao {
  ambiente: 'homologacao' | 'producao';
  referencia?: string;
  infNFe: Record<string, unknown>;
}

export interface BuildNuvemFiscalNfeResult {
  payload: NuvemFiscalNfePedidoEmissao;
  chaveAcesso: string;
}

export class NuvemFiscalNfeBuilder {
  constructor(private readonly config: NfeConfig) {}

  build(order: NfeOrderInput, numero: number, serie: string): BuildNuvemFiscalNfeResult {
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

    const det = order.orderItems.map((item, index) => {
      const itemTotal = toNumber(item.total);
      const unitPrice = toNumber(item.unitPrice, 4);
      const quantity = toNumber(item.quantity, 4);
      const ncm = this.config.fiscal.ncmPadrao;
      const cfop = this.config.fiscal.cfopPadrao;
      const uCom = this.config.fiscal.unidadeComercialPadrao;

      const icms = this.config.emitente.crt === '1'
        ? {
          ICMSSN102: {
            orig: 0,
            CSOSN: this.config.fiscal.csosnPadrao,
          },
        }
        : {
          ICMS00: {
            orig: 0,
            CST: this.config.fiscal.cstPadrao,
            modBC: 3,
            vBC: itemTotal,
            pICMS: toNumber(this.config.fiscal.aliquotaIcms),
            vICMS: 0,
          },
        };

      return {
        nItem: index + 1,
        prod: {
          cProd: item.productId,
          cEAN: '',
          xProd: item.productName,
          NCM: ncm,
          CFOP: cfop,
          uCom,
          qCom: quantity,
          vUnCom: unitPrice,
          vProd: itemTotal,
          cEANTrib: '',
          uTrib: uCom,
          qTrib: quantity,
          vUnTrib: unitPrice,
          indTot: 1,
        },
        imposto: {
          ICMS: icms,
          PIS: {
            PISAliq: {
              CST: '01',
              vBC: itemTotal,
              pPIS: toNumber(this.config.fiscal.aliquotaPis),
              vPIS: 0,
            },
          },
          COFINS: {
            COFINSAliq: {
              CST: '01',
              vBC: itemTotal,
              pCOFINS: toNumber(this.config.fiscal.aliquotaCofins),
              vCOFINS: 0,
            },
          },
        },
      };
    });

    const total = toNumber(order.total);
    const discount = toNumber(order.discount || 0);

    const infNFe = {
      versao: this.config.versao,
      ide: {
        cUF: Number(this.config.ufCodigo),
        cNF: codigoNumerico,
        natOp: this.config.fiscal.natOp,
        mod: Number(this.config.modelo),
        serie: Number(serie),
        nNF: numero,
        dhEmi: toIsoDateTime(dataEmissao),
        tpNF: 1,
        idDest: 1,
        cMunFG: emit.endereco.municipioCodigo,
        tpImp: 1,
        tpEmis: Number(this.config.fiscal.tpEmis),
        cDV: Number(chaveAcesso.slice(-1)),
        tpAmb: this.config.ambiente === 'homolog' ? 2 : 1,
        finNFe: 1,
        indFinal: 1,
        indPres: 1,
        procEmi: 0,
        verProc: 'sales-pdv-back',
      },
      emit: {
        CNPJ: onlyDigits(emit.cnpj),
        xNome: emit.razaoSocial,
        xFant: emit.nomeFantasia,
        enderEmit: {
          xLgr: emit.endereco.logradouro,
          nro: emit.endereco.numero,
          xBairro: emit.endereco.bairro,
          cMun: emit.endereco.municipioCodigo,
          xMun: emit.endereco.municipioNome,
          UF: emit.endereco.uf,
          CEP: onlyDigits(emit.endereco.cep),
          cPais: emit.endereco.paisCodigo,
          xPais: emit.endereco.paisNome,
          ...(emit.endereco.telefone ? { fone: onlyDigits(emit.endereco.telefone) } : {}),
        },
        IE: onlyDigits(emit.ie),
        CRT: Number(emit.crt),
      },
      dest: {
        ...(destDoc.length === 11 ? { CPF: destDoc } : { CNPJ: destDoc }),
        xNome: destNome,
        enderDest: {
          xLgr: dest?.address || 'NAO INFORMADO',
          nro: 'SN',
          xBairro: 'NAO INFORMADO',
          cMun: emit.endereco.municipioCodigo,
          xMun: dest?.city || emit.endereco.municipioNome,
          UF: dest?.state || emit.endereco.uf,
          CEP: onlyDigits(dest?.zipCode || emit.endereco.cep),
          cPais: emit.endereco.paisCodigo,
          xPais: emit.endereco.paisNome,
        },
        indIEDest: Number(this.config.destinatarioPadrao.indIeDest),
        ...(dest?.email || this.config.destinatarioPadrao.email
          ? { email: dest?.email || this.config.destinatarioPadrao.email }
          : {}),
      },
      det,
      total: {
        ICMSTot: {
          vBC: 0,
          vICMS: 0,
          vICMSDeson: 0,
          vFCP: 0,
          vBCST: 0,
          vST: 0,
          vFCPST: 0,
          vFCPSTRet: 0,
          vProd: total,
          vFrete: 0,
          vSeg: 0,
          vDesc: discount,
          vII: 0,
          vIPI: 0,
          vIPIDevol: 0,
          vPIS: 0,
          vCOFINS: 0,
          vOutro: 0,
          vNF: total,
        },
      },
      transp: {
        modFrete: 9,
      },
      pag: {
        detPag: [
          {
            indPag: 0,
            tPag: this.mapPaymentMethod(order.paymentMethod),
            vPag: total,
          },
        ],
      },
    };

    return {
      payload: {
        ambiente: this.config.ambiente === 'homolog' ? 'homologacao' : 'producao',
        referencia: `${order.orderNumber || order.id}-${numero}`.slice(0, 50),
        infNFe,
      },
      chaveAcesso,
    };
  }

  private mapPaymentMethod(method?: string | null): string {
    if (!method) return '01';

    switch (method) {
      case 'cash':
        return '01';
      case 'credit_card':
      case 'card':
        return '03';
      case 'debit_card':
        return '04';
      case 'pix':
        return '17';
      case 'boleto':
        return '15';
      default:
        return '99';
    }
  }
}
