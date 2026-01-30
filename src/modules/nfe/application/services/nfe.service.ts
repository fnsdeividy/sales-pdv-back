import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@modules/prisma/prisma.service';
import { NfeRepository } from '@modules/nfe/infra/repositories/nfe.repository';
import { NfeXmlBuilder } from '@modules/nfe/infra/xml/nfe-xml.builder';
import { NfeXmlSigner } from '@modules/nfe/infra/xml/nfe-xml.signer';
import { NfeSoapClient } from '@modules/nfe/infra/soap/nfe-soap.client';
import { NfeConfig } from '@modules/nfe/application/config/nfe.config';
import { NfeStatus } from '@modules/nfe/domain/entities/nfe-document.entity';
import { SubscriptionService } from '@modules/subscription/application/subscription.service';

@Injectable()
export class NfeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: NfeRepository,
    private readonly config: NfeConfig,
    private readonly xmlBuilder: NfeXmlBuilder,
    private readonly xmlSigner: NfeXmlSigner,
    private readonly soapClient: NfeSoapClient,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  async emitirNfeParaOrder(orderId: string, storeId: string) {
    await this.ensureStoreHasActiveSubscription(storeId);

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, storeId },
      include: {
        orderItems: true,
        customer: true,
        store: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Venda não encontrada para emissão de NF-e.');
    }

    const existing = await this.repository.findLatestByOrderId(orderId);
    if (existing?.status === 'AUTORIZADO') {
      throw new BadRequestException('Já existe NF-e autorizada para esta venda.');
    }

    const numero = await this.repository.getNextNumero(storeId, this.config.numeroInicial);
    const { xml, chaveAcesso, serie } = this.xmlBuilder.build(order, numero, this.config.serie);
    const xmlAssinado = this.xmlSigner.sign(xml);

    const document = await this.repository.create({
      orderId,
      chaveAcesso,
      numero,
      serie,
      uf: this.config.uf,
      modelo: this.config.modelo,
      ambiente: this.config.ambiente,
      status: 'PENDENTE_ENVIO',
      xmlAssinado,
    });

    const loteId = String(Date.now());
    const envio = await this.soapClient.enviarLoteNfe(xmlAssinado, loteId);

    const statusEnvio: NfeStatus = envio.status === '103' ? 'PROCESSANDO' : 'ENVIADO';
    const atualizado = await this.repository.updateStatus(document.id, {
      status: statusEnvio,
      recibo: envio.recibo,
      mensagemRetorno: envio.motivo,
    });

    if (!envio.recibo || !this.config.consultaAutomatica) {
      return atualizado;
    }

    const consulta = await this.soapClient.consultarReciboComTentativas(envio.recibo);
    return await this.finalizarProcessamento(document.id, consulta);
  }

  async consultarRecibo(nfeId: string, storeId: string) {
    await this.ensureStoreHasActiveSubscription(storeId);

    const document = await this.validateOwnership(nfeId, storeId);
    if (!document.recibo) {
      throw new BadRequestException('NF-e não possui recibo para consulta.');
    }

    const consulta = await this.soapClient.consultarRecibo(document.recibo);
    return await this.finalizarProcessamento(document.id, consulta);
  }

  async consultarNfePorChave(nfeId: string, storeId: string) {
    await this.ensureStoreHasActiveSubscription(storeId);

    const document = await this.validateOwnership(nfeId, storeId);
    const consulta = await this.soapClient.consultarNfe(document.chaveAcesso);
    return await this.finalizarProcessamento(document.id, consulta);
  }

  async buscarNfePorId(nfeId: string, storeId: string) {
    await this.ensureStoreHasActiveSubscription(storeId);

    return this.validateOwnership(nfeId, storeId);
  }

  async buscarXmlAutorizado(nfeId: string, storeId: string) {
    await this.ensureStoreHasActiveSubscription(storeId);

    const document = await this.validateOwnership(nfeId, storeId);
    if (!document.xmlAutorizado) {
      throw new BadRequestException('XML autorizado ainda não disponível.');
    }
    return document.xmlAutorizado;
  }

  private async validateOwnership(nfeId: string, storeId: string) {
    const document = await this.repository.findById(nfeId);
    if (!document) {
      throw new NotFoundException('NF-e não encontrada.');
    }

    const order = await this.prisma.order.findFirst({
      where: { id: document.orderId, storeId },
    });

    if (!order) {
      throw new NotFoundException('NF-e não pertence à loja do usuário.');
    }

    return document;
  }

  private async finalizarProcessamento(nfeId: string, consulta: {
    status: string | null;
    motivo: string | null;
    protocolo: string | null;
    xmlAutorizado?: string | null;
  }) {
    if (consulta.status === '100') {
      return this.repository.updateStatus(nfeId, {
        status: 'AUTORIZADO',
        protocolo: consulta.protocolo,
        mensagemRetorno: consulta.motivo,
        xmlAutorizado: consulta.xmlAutorizado || null,
      });
    }

    if (consulta.status === '204' || consulta.status === '539' || consulta.status === '999') {
      return this.repository.updateStatus(nfeId, {
        status: 'REJEITADO',
        protocolo: consulta.protocolo,
        mensagemRetorno: consulta.motivo,
        xmlAutorizado: consulta.xmlAutorizado || null,
      });
    }

    return this.repository.updateStatus(nfeId, {
      status: 'PROCESSANDO',
      protocolo: consulta.protocolo,
      mensagemRetorno: consulta.motivo,
      xmlAutorizado: consulta.xmlAutorizado || null,
    });
  }

  /**
   * Garante que a loja possua assinatura ACTIVE antes de acessar recursos de NFe.
   * Lança 403 com código padronizado caso contrário.
   */
  private async ensureStoreHasActiveSubscription(storeId: string) {
    // Encontrar um usuário qualquer da loja para reutilizar o fluxo existente de cálculo
    const user = await this.prisma.user.findFirst({
      where: { storeId },
      select: { id: true },
    });

    if (!user) {
      throw new ForbiddenException({
        code: 'SUBSCRIPTION_REQUIRED',
        message: 'Recurso disponível apenas no plano pago.',
      });
    }

    const subscription = await this.subscriptionService.getSubscription(user.id);

    if (subscription.status !== 'ACTIVE') {
      throw new ForbiddenException({
        code: 'SUBSCRIPTION_REQUIRED',
        message: 'Recurso disponível apenas no plano pago.',
      });
    }
  }
}
