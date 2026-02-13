import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sgMail from '@sendgrid/mail';

@Injectable()
export class MailService {
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly apiKey: string | undefined;
  private readonly frontendUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('SENDGRID_API_KEY');
    this.fromEmail =
      this.configService.get<string>('SENDGRID_FROM_EMAIL') ||
      this.configService.get<string>('SENDGRID_SENDER') ||
      this.configService.get<string>('MAIL_FROM') ||
      'noreply@pdv.local';
    this.fromName =
      this.configService.get<string>('SENDGRID_FROM_NAME') || 'PDV Inteligente';
    this.frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';

    if (this.apiKey) {
      sgMail.setApiKey(this.apiKey);
      console.log(
        '[MailService] SendGrid configurado com remetente:',
        `${this.fromName} <${this.fromEmail}>`,
      );
    } else {
      console.warn(
        '[MailService] SENDGRID_API_KEY não configurada. Emails não serão enviados.',
      );
    }
  }

  /**
   * Envia email com link para redefinição de senha via SendGrid.
   */
  async sendPasswordResetEmail(
    toEmail: string,
    resetToken: string,
  ): Promise<void> {
    const resetLink = `${this.frontendUrl.replace(/\/$/, '')}/redefinir-senha?token=${encodeURIComponent(resetToken)}`;

    const html = this.buildPasswordResetHtml(resetLink);
    const text = this.buildPasswordResetText(resetLink);

    if (!this.apiKey) {
      console.warn(
        '[MailService] SENDGRID_API_KEY não configurada. Link de redefinição (dev):',
        resetLink,
      );
      return;
    }

    try {
      await sgMail.send({
        to: toEmail,
        from: { email: this.fromEmail, name: this.fromName },
        replyTo: { email: this.fromEmail, name: this.fromName },
        subject: 'Redefinir sua senha',
        html,
        text,
        mailSettings: {
          sandboxMode: { enable: false },
        },
        trackingSettings: {
          clickTracking: { enable: false },
          openTracking: { enable: false },
        },
      });

      console.log(
        `[MailService] Email de redefinição enviado para: ${toEmail}`,
      );
    } catch (error: any) {
      console.error(
        '[MailService] Erro ao enviar email via SendGrid:',
        error?.response?.body || error.message || error,
      );
      throw new Error('Falha ao enviar email de redefinição de senha.');
    }
  }

  /**
   * Template HTML profissional para redefinição de senha.
   * Seguindo boas práticas anti-spam: inline CSS, tabelas, texto/html balanceado,
   * informações de contato e link de desinscrição.
   */
  private buildPasswordResetHtml(resetLink: string): string {
    return `<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Redefinir sua senha</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;-webkit-font-smoothing:antialiased;font-size:16px;line-height:1.6;color:#51545e;width:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;">
    <tr>
      <td align="center" style="padding:24px 0;">
        <!-- Wrapper -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:570px;margin:0 auto;">

          <!-- Header -->
          <tr>
            <td align="center" style="padding:24px 0;">
              <span style="font-size:22px;font-weight:bold;color:#7c3aed;">PDV Inteligente</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color:#ffffff;border-radius:8px;padding:40px 48px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
              <h1 style="margin:0 0 16px;font-size:20px;font-weight:bold;color:#333333;">Redefinir sua senha</h1>
              <p style="margin:0 0 16px;color:#51545e;">
                Recebemos uma solicitação para redefinir a senha da sua conta. Clique no botão abaixo para escolher uma nova senha. Este link é válido por <strong>1 hora</strong>.
              </p>

              <!-- Botão CTA -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
                <tr>
                  <td align="center">
                    <a href="${resetLink}" target="_blank" style="display:inline-block;background-color:#7c3aed;color:#ffffff;font-size:16px;font-weight:bold;text-decoration:none;padding:12px 36px;border-radius:6px;text-align:center;">
                      Redefinir minha senha
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 16px;color:#51545e;font-size:14px;">
                Se o botão não funcionar, copie e cole o link abaixo no seu navegador:
              </p>
              <p style="margin:0 0 24px;word-break:break-all;font-size:13px;color:#7c3aed;">
                ${resetLink}
              </p>

              <hr style="border:none;border-top:1px solid #eaeaec;margin:24px 0;">

              <p style="margin:0;color:#85878e;font-size:13px;">
                Se você não solicitou essa redefinição, nenhuma ação é necessária. Sua senha permanecerá a mesma.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:24px 0;">
              <p style="margin:0 0 4px;color:#a8aaaf;font-size:12px;">
                ${this.fromName}
              </p>
              <p style="margin:0;color:#a8aaaf;font-size:12px;">
                Este é um email automático, por favor não responda.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  /**
   * Versão texto puro do email (importante para anti-spam).
   */
  private buildPasswordResetText(resetLink: string): string {
    return [
      `${this.fromName}`,
      '',
      'Redefinir sua senha',
      '',
      'Recebemos uma solicitação para redefinir a senha da sua conta.',
      'Acesse o link abaixo para escolher uma nova senha (válido por 1 hora):',
      '',
      resetLink,
      '',
      'Se você não solicitou essa redefinição, ignore este email. Sua senha permanecerá a mesma.',
      '',
      '---',
      `${this.fromName} - Este é um email automático.`,
    ].join('\n');
  }
}
