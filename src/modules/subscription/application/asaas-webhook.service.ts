import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

type AsaasWebhookPayload = {
  event?: string;
  eventType?: string;
  type?: string;
  payment?: AsaasPaymentPayload;
  data?: AsaasPaymentPayload | { payment?: AsaasPaymentPayload };
};

type AsaasPaymentPayload = {
  id?: string;
  status?: string;
  customer?: string;
  subscription?: string | null;
  paymentLink?: string | null;
  externalReference?: string | null;
  description?: string | null;
  confirmedDate?: string | null;
  paymentDate?: string | null;
  dateCreated?: string | null;
  dueDate?: string | null;
  originalDueDate?: string | null;
  nextDueDate?: string | null;
  billingType?: string | null;
  value?: number | null;
  planId?: string | null;
  plan?: string | { id?: string } | null;
};

@Injectable()
export class AsaasWebhookService {
  private readonly DEFAULT_PAID_PERIOD_DAYS = 30;
  private readonly PAID_EVENTS = new Set([
    'PAYMENT_CONFIRMED',
    'PAYMENT_RECEIVED',
    'PAYMENT_RECEIVED_IN_CASH',
    'PAYMENT_APPROVED',
  ]);
  private readonly PAID_STATUSES = new Set(['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH', 'APPROVED']);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async handleWebhook(
    payload: AsaasWebhookPayload,
    headers: Record<string, string | string[] | undefined>,
  ) {
    this.validateToken(headers);

    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('Payload invalido');
    }

    const event = payload.event || payload.eventType || payload.type;
    const payment = this.extractPayment(payload);

    if (!event || !payment) {
      return { received: true, processed: false, ignored: true, reason: 'Evento ou pagamento ausente.' };
    }

    if (!this.isPaidEvent(event, payment.status)) {
      return { received: true, processed: false, ignored: true, reason: 'Evento nao aplicavel.' };
    }

    const { storeId, subscription } = await this.resolveStoreSubscription(payment);

    if (!storeId) {
      return { received: true, processed: false, ignored: true, reason: 'Loja nao identificada.' };
    }

    const planId = this.resolvePlanId(payment, subscription?.planId ?? undefined);
    const planName = this.resolvePlanName(planId, payment, subscription?.planName ?? undefined);
    const period = this.resolvePeriod(payment);
    const currentPeriodStart =
      subscription?.currentPeriodStart && subscription.currentPeriodStart > period.currentPeriodStart
        ? subscription.currentPeriodStart
        : period.currentPeriodStart;
    const currentPeriodEnd =
      subscription?.currentPeriodEnd && subscription.currentPeriodEnd > period.currentPeriodEnd
        ? subscription.currentPeriodEnd
        : period.currentPeriodEnd;
    const nextBillingAt = currentPeriodEnd;
    const externalPlanId = this.resolveExternalPlanId(payment);

    const updatedSubscription = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.storeSubscription.upsert({
        where: { storeId },
        update: {
          status: 'ACTIVE',
          planId,
          planName,
          trialStartAt: null,
          trialEndAt: null,
          currentPeriodStart,
          currentPeriodEnd,
          nextBillingAt,
          canceledAt: null,
          cancelAtPeriodEnd: false,
          externalCustomerId: payment.customer ?? undefined,
          externalSubscriptionId: payment.subscription ?? undefined,
          externalPlanId: externalPlanId ?? undefined,
        },
        create: {
          storeId,
          status: 'ACTIVE',
          planId,
          planName,
          trialStartAt: null,
          trialEndAt: null,
          currentPeriodStart,
          currentPeriodEnd,
          nextBillingAt,
          canceledAt: null,
          cancelAtPeriodEnd: false,
          externalCustomerId: payment.customer ?? undefined,
          externalSubscriptionId: payment.subscription ?? undefined,
          externalPlanId: externalPlanId ?? undefined,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: null,
          action: 'SUBSCRIPTION_CHANGE',
          resourceType: 'StoreSubscription',
          resourceId: storeId,
          details: {
            origin: 'asaas-webhook',
            event,
            paymentId: payment.id ?? null,
            paymentStatus: payment.status ?? null,
            planId,
            planName,
            externalCustomerId: payment.customer ?? null,
            externalSubscriptionId: payment.subscription ?? null,
            externalPlanId: externalPlanId ?? null,
          },
        },
      });

      return updated;
    });

    return {
      received: true,
      processed: true,
      storeId,
      subscriptionId: updatedSubscription.id,
    };
  }

  private validateToken(headers: Record<string, string | string[] | undefined>) {
    const expectedToken = this.configService.get<string>('ASAAS_WEBHOOK_TOKEN');
    if (!expectedToken) {
      throw new UnauthorizedException('ASAAS_WEBHOOK_TOKEN nao configurado.');
    }

    const headerToken =
      this.getHeader(headers, 'asaas-access-token') ||
      this.getHeader(headers, 'asaas_access_token') ||
      this.getHeader(headers, 'x-asaas-access-token');

    if (!headerToken) {
      throw new UnauthorizedException('Token do webhook nao informado.');
    }

    const normalized = headerToken.replace(/^Bearer\s+/i, '').trim();

    if (normalized !== expectedToken) {
      throw new UnauthorizedException('Token do webhook invalido.');
    }
  }

  private getHeader(
    headers: Record<string, string | string[] | undefined>,
    key: string,
  ): string | undefined {
    const value = headers[key.toLowerCase()] ?? headers[key];
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
  }

  private extractPayment(payload: AsaasWebhookPayload): AsaasPaymentPayload | null {
    if (payload.payment) {
      return payload.payment;
    }

    if (payload.data && typeof payload.data === 'object') {
      if ('payment' in payload.data) {
        return payload.data.payment ?? null;
      }
      return payload.data as AsaasPaymentPayload;
    }

    return null;
  }

  private isPaidEvent(event: string, status?: string | null) {
    const normalizedEvent = event.toUpperCase();
    if (this.PAID_EVENTS.has(normalizedEvent)) {
      return true;
    }

    const normalizedStatus = status?.toUpperCase();
    if (normalizedStatus && this.PAID_STATUSES.has(normalizedStatus)) {
      return true;
    }

    return false;
  }

  private async resolveStoreSubscription(payment: AsaasPaymentPayload) {
    const storeIdFromReference = this.extractStoreId(payment.externalReference ?? undefined);

    if (storeIdFromReference) {
      const store = await this.prisma.store.findUnique({
        where: { id: storeIdFromReference },
        select: { id: true },
      });

      if (!store) {
        return { storeId: null, subscription: null };
      }

      const subscription = await this.prisma.storeSubscription.findUnique({
        where: { storeId: storeIdFromReference },
      });

      return { storeId: storeIdFromReference, subscription };
    }

    if (payment.subscription) {
      const subscription = await this.prisma.storeSubscription.findFirst({
        where: { externalSubscriptionId: payment.subscription },
      });
      if (subscription) {
        return { storeId: subscription.storeId, subscription };
      }
    }

    if (payment.customer) {
      const subscription = await this.prisma.storeSubscription.findFirst({
        where: { externalCustomerId: payment.customer },
      });
      if (subscription) {
        return { storeId: subscription.storeId, subscription };
      }
    }

    return { storeId: null, subscription: null };
  }

  private resolvePlanId(payment: AsaasPaymentPayload, fallbackPlanId?: string) {
    const fromReference = this.extractPlanId(payment.externalReference ?? undefined);
    if (fromReference) return fromReference;

    const fromPlanId = this.extractPlanId(
      typeof payment.plan === 'string'
        ? payment.plan
        : payment.plan?.id ?? payment.planId ?? undefined,
    );
    if (fromPlanId) return fromPlanId;

    const fromDescription = this.extractPlanId(payment.description ?? undefined);
    if (fromDescription) return fromDescription;

    return fallbackPlanId ?? 'start';
  }

  private resolvePlanName(
    planId: string,
    payment: AsaasPaymentPayload,
    fallbackPlanName?: string,
  ) {
    const fromDescription = this.extractPlanName(payment.description ?? undefined);
    if (fromDescription) {
      return fromDescription;
    }

    if (fallbackPlanName) {
      return fallbackPlanName;
    }

    return this.getDefaultPlanName(planId);
  }

  private resolveExternalPlanId(payment: AsaasPaymentPayload): string | null {
    if (typeof payment.plan === 'string') {
      return payment.plan;
    }
    if (payment.plan?.id) {
      return payment.plan.id;
    }
    return payment.planId ?? null;
  }

  private resolvePeriod(payment: AsaasPaymentPayload) {
    const now = new Date();
    const confirmedAt =
      this.parseDate(payment.confirmedDate) ||
      this.parseDate(payment.paymentDate) ||
      this.parseDate(payment.dateCreated) ||
      now;

    const periodEndCandidate =
      this.parseDate(payment.nextDueDate) ||
      this.parseDate(payment.dueDate) ||
      this.parseDate(payment.originalDueDate);

    const fallbackEnd = this.addDays(confirmedAt, this.DEFAULT_PAID_PERIOD_DAYS);
    const currentPeriodEnd =
      periodEndCandidate && periodEndCandidate > confirmedAt ? periodEndCandidate : fallbackEnd;

    return {
      currentPeriodStart: confirmedAt,
      currentPeriodEnd,
      nextBillingAt: currentPeriodEnd,
    };
  }

  private parseDate(value?: string | null): Date | null {
    if (!value) {
      return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed;
  }

  private addDays(date: Date, days: number) {
    const next = new Date(date.getTime());
    next.setDate(next.getDate() + days);
    return next;
  }

  private extractStoreId(reference?: string) {
    if (!reference) {
      return null;
    }

    const trimmed = reference.trim();
    if (!trimmed) {
      return null;
    }

    if (this.isUuid(trimmed)) {
      return trimmed;
    }

    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        const candidate = parsed?.storeId ?? parsed?.store_id ?? parsed?.store;
        if (typeof candidate === 'string' && this.isUuid(candidate)) {
          return candidate;
        }
      } catch {
        // ignore JSON parse errors
      }
    }

    const keyedMatch = trimmed.match(/(storeId|store_id|store)\s*[:=]\s*([a-f0-9-]{36})/i);
    if (keyedMatch?.[2]) {
      return keyedMatch[2];
    }

    const looseMatch = trimmed.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i);
    if (looseMatch?.[0]) {
      return looseMatch[0];
    }

    return null;
  }

  private extractPlanId(value?: string) {
    if (!value) {
      return null;
    }

    const normalized = value.toLowerCase();

    if (normalized === 'start' || normalized.includes('start')) {
      return 'start';
    }

    if (normalized === 'pro' || /\bpro\b/.test(normalized) || normalized.includes('profissional') || normalized.includes('professional')) {
      return 'pro';
    }

    if (normalized.includes('premium')) {
      return 'enterprise';
    }

    if (normalized === 'enterprise' || normalized.includes('enterprise')) {
      return 'enterprise';
    }

    if (normalized.includes('essencial') || normalized.includes('essential')) {
      return 'start';
    }

    return null;
  }

  private extractPlanName(value?: string) {
    if (!value) {
      return null;
    }

    const normalized = value.toLowerCase();
    if (normalized.includes('plano start') || normalized.includes('start')) {
      return 'Plano Start';
    }
    if (normalized.includes('plano pro') || normalized.includes('profissional') || normalized.includes('professional')) {
      return 'Plano Pro';
    }
    if (normalized.includes('plano premium') || normalized.includes('premium')) {
      return 'Plano Premium';
    }
    if (normalized.includes('enterprise')) {
      return 'Plano Enterprise';
    }

    return null;
  }

  private isUuid(value: string) {
    return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
  }

  private getDefaultPlanName(planId: string): string {
    switch (planId) {
      case 'start':
        return 'Plano Start';
      case 'pro':
        return 'Plano Pro';
      case 'enterprise':
        return 'Plano Enterprise';
      default:
        return planId;
    }
  }
}
