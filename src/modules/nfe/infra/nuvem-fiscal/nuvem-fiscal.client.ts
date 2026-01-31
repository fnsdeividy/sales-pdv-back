import { NfeConfig } from '@modules/nfe/application/config/nfe.config';

export interface NuvemFiscalTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

export interface NuvemFiscalDfeAutorizacao {
  numero_protocolo?: string | null;
  motivo_status?: string | null;
  mensagem?: string | null;
  codigo_status?: number | null;
}

export interface NuvemFiscalDfe {
  id: string;
  status: string;
  chave?: string | null;
  numero?: number | null;
  serie?: number | null;
  modelo?: number | null;
  valor_total?: number | null;
  autorizacao?: NuvemFiscalDfeAutorizacao | null;
}

export class NuvemFiscalClient {
  private accessToken: string | null = null;
  private accessTokenExpiresAt = 0;

  constructor(private readonly config: NfeConfig) {}

  async emitirNfe(payload: Record<string, unknown>): Promise<NuvemFiscalDfe> {
    return this.requestJson('POST', '/nfe', payload);
  }

  async consultarNfe(id: string): Promise<NuvemFiscalDfe> {
    return this.requestJson('GET', `/nfe/${id}`);
  }

  async baixarXml(id: string): Promise<string> {
    return this.requestText('GET', `/nfe/${id}/xml`);
  }

  private async requestJson(method: string, path: string, body?: unknown): Promise<any> {
    const response = await this.request(method, path, body, 'application/json');
    const text = await response.text();

    if (!response.ok) {
      throw new Error(`Nuvem Fiscal API error ${response.status}: ${text}`);
    }

    return text ? JSON.parse(text) : {};
  }

  private async requestText(method: string, path: string): Promise<string> {
    const response = await this.request(method, path, undefined, 'application/xml');
    const text = await response.text();

    if (!response.ok) {
      throw new Error(`Nuvem Fiscal API error ${response.status}: ${text}`);
    }

    return text;
  }

  private async request(method: string, path: string, body?: unknown, accept?: string): Promise<Response> {
    const cfg = this.config.nuvemFiscal;
    if (!cfg) {
      throw new Error('Nuvem Fiscal nao configurado. Verifique NUVEM_FISCAL_*.');
    }

    const token = await this.getAccessToken();
    const url = `${cfg.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };

    if (accept) {
      headers.Accept = accept;
    }

    let payload: string | undefined;
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs);

    try {
      return await fetch(url, {
        method,
        headers,
        body: payload,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private async getAccessToken(): Promise<string> {
    const cfg = this.config.nuvemFiscal;
    if (!cfg) {
      throw new Error('Nuvem Fiscal nao configurado. Verifique NUVEM_FISCAL_*.');
    }

    const now = Date.now();
    if (this.accessToken && now < this.accessTokenExpiresAt) {
      return this.accessToken;
    }

    const form = new URLSearchParams();
    form.set('grant_type', 'client_credentials');
    form.set('client_id', cfg.clientId);
    form.set('client_secret', cfg.clientSecret);
    if (cfg.scope) {
      form.set('scope', cfg.scope);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs);

    try {
      const response = await fetch(cfg.authUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
        signal: controller.signal,
      });

      const text = await response.text();
      if (!response.ok) {
        throw new Error(`Falha ao obter token Nuvem Fiscal ${response.status}: ${text}`);
      }

      const data = JSON.parse(text) as NuvemFiscalTokenResponse;
      const expiresInMs = (data.expires_in || 0) * 1000;
      this.accessToken = data.access_token;
      this.accessTokenExpiresAt = Date.now() + Math.max(expiresInMs - 60_000, 0);

      return this.accessToken;
    } finally {
      clearTimeout(timeout);
    }
  }
}
