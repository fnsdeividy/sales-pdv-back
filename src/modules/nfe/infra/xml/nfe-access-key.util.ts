const onlyDigits = (value: string): string => value.replace(/\D+/g, '');

export const calculateNfeAccessKeyDv = (base43: string): string => {
  const digits = onlyDigits(base43);
  if (digits.length !== 43) {
    throw new Error(`Chave base deve ter 43 dígitos, recebido ${digits.length}`);
  }

  let weight = 2;
  let sum = 0;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    sum += Number(digits[i]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }

  const mod = sum % 11;
  const dv = mod === 0 || mod === 1 ? 0 : 11 - mod;
  return String(dv);
};

export const generateNfeAccessKey = (params: {
  ufCodigo: string;
  dataEmissao: Date;
  cnpj: string;
  modelo: string;
  serie: string;
  numero: number;
  tipoEmissao: string;
  codigoNumerico: string;
}): string => {
  const cUF = onlyDigits(params.ufCodigo).padStart(2, '0');
  const ano = params.dataEmissao.getFullYear().toString().slice(-2);
  const mes = String(params.dataEmissao.getMonth() + 1).padStart(2, '0');
  const cnpj = onlyDigits(params.cnpj).padStart(14, '0');
  const modelo = onlyDigits(params.modelo).padStart(2, '0');
  const serie = onlyDigits(params.serie).padStart(3, '0');
  const numero = String(params.numero).padStart(9, '0');
  const tpEmis = onlyDigits(params.tipoEmissao).padStart(1, '0');
  const cNF = onlyDigits(params.codigoNumerico).padStart(8, '0');

  const base = `${cUF}${ano}${mes}${cnpj}${modelo}${serie}${numero}${tpEmis}${cNF}`;
  const dv = calculateNfeAccessKeyDv(base);
  return `${base}${dv}`;
};

export const generateRandomCodigoNumerico = (): string => {
  const random = Math.floor(Math.random() * 10 ** 8);
  return String(random).padStart(8, '0');
};
