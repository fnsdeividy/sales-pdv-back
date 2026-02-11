import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sgMail from '@sendgrid/mail';

@Injectable()
export class MailService {
  private readonly from: string;
  private readonly apiKey: string | undefined;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('SENDGRID_API_KEY');
    this.from =
      this.configService.get<string>('SENDGRID_SENDER') ||
      this.configService.get<string>('MAIL_FROM') ||
      'noreply@pdv.local';

    if (this.apiKey) {
      sgMail.setApiKey(this.apiKey);
    }
  }

  /**
   * Envia email com link para redefinição de senha via SendGrid.
   * O link aponta para o frontend: FRONTEND_URL/redefinir-senha?token=xxx
   */
  async sendPasswordResetEmail(toEmail: string, resetToken: string): Promise<void> {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    const resetLink = `${frontendUrl.replace(/\/$/, '')}/redefinir-senha?token=${encodeURIComponent(resetToken)}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: sans-serif; line-height: 1.5; color: #333;">
          <h2>Redefinição de senha</h2>
          <p>Você solicitou a redefinição da senha da sua conta.</p>
          <p>Clique no link abaixo para definir uma nova senha (válido por 1 hora):</p>
          <p><a href="${resetLink}" style="color: #7c3aed;">Redefinir senha</a></p>
          <p>Ou copie e cole no navegador:</p>
          <p style="word-break: break-all;">${resetLink}</p>
          <p>Se você não solicitou isso, ignore este email.</p>
        </body>
      </html>
    `;

    const text = `Redefinição de senha\n\nAcesse o link para redefinir sua senha (válido por 1 hora):\n${resetLink}\n\nSe você não solicitou isso, ignore este email.`;

    if (!this.apiKey) {
      console.warn(
        '[MailService] SENDGRID_API_KEY não configurada. Link de redefinição (dev):',
        resetLink,
      );
      return;
    }

    await sgMail.send({
      to: toEmail,
      from: this.from,
      subject: 'Redefinição de senha - Sistema PDV',
      html,
      text,
    });
  }
}
