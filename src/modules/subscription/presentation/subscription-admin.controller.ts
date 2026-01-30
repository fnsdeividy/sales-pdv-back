import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../../shared/presentation/http/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/presentation/http/guards/roles.guard';
import { Roles } from '../../../shared/presentation/http/decorators/roles.decorator';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';

type AdminSubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'EXPIRED' | 'CANCELED';

interface ActivateSubscriptionDto {
  planId: string;
  planName?: string;
  periodDays?: number;
  reason?: string;
}

interface TrialSubscriptionDto {
  trialDays?: number;
  reason?: string;
}

interface CancelSubscriptionDto {
  cancelAtPeriodEnd?: boolean;
  reason?: string;
}

@Controller('admin/stores')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class SubscriptionAdminController {
  private readonly DEFAULT_TRIAL_DAYS = 7;
  private readonly DEFAULT_PAID_PERIOD_DAYS = 30;

  constructor(private readonly prisma: PrismaService) {}

  @Post(':storeId/subscription/trial')
  @HttpCode(HttpStatus.OK)
  async startTrial(
    @Param('storeId') storeId: string,
    @Body() body: TrialSubscriptionDto,
    @CurrentUser() user: any,
  ) {
    this.ensureSameStoreScope(storeId, user);

    const trialDays = body.trialDays ?? this.DEFAULT_TRIAL_DAYS;
    const now = new Date();
    const trialStartAt = now;
    const trialEndAt = new Date(trialStartAt);
    trialEndAt.setDate(trialEndAt.getDate() + trialDays);

    const subscription = await this.prisma.storeSubscription.upsert({
      where: { storeId },
      update: {
        status: 'TRIAL',
        planId: 'start',
        planName: 'Plano Start',
        trialStartAt,
        trialEndAt,
        currentPeriodStart: trialStartAt,
        currentPeriodEnd: trialEndAt,
        canceledAt: null,
        cancelAtPeriodEnd: false,
      },
      create: {
        storeId,
        status: 'TRIAL',
        planId: 'start',
        planName: 'Plano Start',
        trialStartAt,
        trialEndAt,
        currentPeriodStart: trialStartAt,
        currentPeriodEnd: trialEndAt,
      },
    });

    await this.logAudit({
      storeId,
      actorUserId: user.id,
      fromStatus: null,
      toStatus: 'TRIAL',
      planId: subscription.planId,
      reason: body.reason ?? 'Admin start trial',
    });

    return subscription;
  }

  @Post(':storeId/subscription/activate')
  @HttpCode(HttpStatus.OK)
  async activate(
    @Param('storeId') storeId: string,
    @Body() body: ActivateSubscriptionDto,
    @CurrentUser() user: any,
  ) {
    this.ensureSameStoreScope(storeId, user);

    const periodDays = body.periodDays ?? this.DEFAULT_PAID_PERIOD_DAYS;
    const now = new Date();
    const currentPeriodStart = now;
    const currentPeriodEnd = new Date(currentPeriodStart);
    currentPeriodEnd.setDate(currentPeriodEnd.getDate() + periodDays);

    const existing = await this.prisma.storeSubscription.findUnique({
      where: { storeId },
    });

    const subscription = await this.prisma.storeSubscription.upsert({
      where: { storeId },
      update: {
        status: 'ACTIVE',
        planId: body.planId,
        planName: body.planName ?? existing?.planName ?? body.planId,
        currentPeriodStart,
        currentPeriodEnd,
        trialStartAt: null,
        trialEndAt: null,
        canceledAt: null,
        cancelAtPeriodEnd: false,
      },
      create: {
        storeId,
        status: 'ACTIVE',
        planId: body.planId,
        planName: body.planName ?? body.planId,
        currentPeriodStart,
        currentPeriodEnd,
        trialStartAt: null,
        trialEndAt: null,
      },
    });

    await this.logAudit({
      storeId,
      actorUserId: user.id,
      fromStatus: (existing?.status as AdminSubscriptionStatus) ?? null,
      toStatus: 'ACTIVE',
      planId: subscription.planId,
      reason: body.reason ?? 'Admin activate subscription',
    });

    return subscription;
  }

  @Post(':storeId/subscription/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(
    @Param('storeId') storeId: string,
    @Body() body: CancelSubscriptionDto,
    @CurrentUser() user: any,
  ) {
    this.ensureSameStoreScope(storeId, user);

    const existing = await this.prisma.storeSubscription.findUnique({
      where: { storeId },
    });

    const now = new Date();
    const cancelAtPeriodEnd = body.cancelAtPeriodEnd ?? true;

    const currentPeriodEnd =
      !existing?.currentPeriodEnd || !cancelAtPeriodEnd ? now : existing.currentPeriodEnd;

    const subscription = await this.prisma.storeSubscription.upsert({
      where: { storeId },
      update: {
        status: 'CANCELED',
        cancelAtPeriodEnd,
        canceledAt: now,
        currentPeriodEnd,
      },
      create: {
        storeId,
        status: 'CANCELED',
        planId: existing?.planId ?? 'start',
        planName: existing?.planName ?? 'Plano Start',
        cancelAtPeriodEnd,
        canceledAt: now,
        currentPeriodStart: now,
        currentPeriodEnd: currentPeriodEnd,
      },
    });

    await this.logAudit({
      storeId,
      actorUserId: user.id,
      fromStatus: (existing?.status as AdminSubscriptionStatus) ?? null,
      toStatus: 'CANCELED',
      planId: subscription.planId,
      reason: body.reason ?? 'Admin cancel subscription',
    });

    return subscription;
  }

  @Post(':storeId/subscription/expire')
  @HttpCode(HttpStatus.OK)
  async expire(
    @Param('storeId') storeId: string,
    @Body() body: { reason?: string },
    @CurrentUser() user: any,
  ) {
    this.ensureSameStoreScope(storeId, user);

    const existing = await this.prisma.storeSubscription.findUnique({
      where: { storeId },
    });

    const now = new Date();

    const subscription = await this.prisma.storeSubscription.upsert({
      where: { storeId },
      update: {
        status: 'EXPIRED',
        currentPeriodEnd: existing?.currentPeriodEnd ?? now,
      },
      create: {
        storeId,
        status: 'EXPIRED',
        planId: existing?.planId ?? 'start',
        planName: existing?.planName ?? 'Plano Start',
        currentPeriodStart: existing?.currentPeriodStart ?? now,
        currentPeriodEnd: existing?.currentPeriodEnd ?? now,
      },
    });

    await this.logAudit({
      storeId,
      actorUserId: user.id,
      fromStatus: (existing?.status as AdminSubscriptionStatus) ?? null,
      toStatus: 'EXPIRED',
      planId: subscription.planId,
      reason: body.reason ?? 'Admin expire subscription',
    });

    return subscription;
  }

  private ensureSameStoreScope(storeId: string, user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    if (user.storeId !== storeId) {
      throw new Error('Operação não permitida em outra loja.');
    }
  }

  private async logAudit(params: {
    storeId: string;
    actorUserId: string;
    fromStatus: AdminSubscriptionStatus | null;
    toStatus: AdminSubscriptionStatus;
    planId: string | null;
    reason: string;
  }) {
    const { storeId, actorUserId, fromStatus, toStatus, planId, reason } = params;

    await this.prisma.auditLog.create({
      data: {
        userId: actorUserId,
        action: 'SUBSCRIPTION_CHANGE',
        resourceType: 'StoreSubscription',
        resourceId: storeId,
        details: {
          storeId,
          actorUserId,
          fromStatus,
          toStatus,
          planId,
          reason,
        },
      },
    });
  }
}
