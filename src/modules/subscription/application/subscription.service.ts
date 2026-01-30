import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'EXPIRED' | 'CANCELED';

export interface SubscriptionPlan {
  id: string;
  name: string;
}

export interface Subscription {
  status: SubscriptionStatus;
  trialEndsAt?: string;
  currentPeriodEnd?: string;
  plan?: SubscriptionPlan;
}

@Injectable()
export class SubscriptionService {
  constructor(private prisma: PrismaService) {}

  private readonly DEFAULT_TRIAL_DAYS = 7;

  /**
   * Retorna a assinatura efetiva da loja do usuário autenticado,
   * garantindo criação automática de TRIAL quando não existir.
   */
  async getSubscription(userId: string): Promise<Subscription> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, storeId: true, createdAt: true },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    if (!user.storeId) {
      throw new NotFoundException('Usuário não está associado a uma loja');
    }

    const storeSubscription = await this.getOrCreateStoreSubscription(user.storeId, user.createdAt);

    const { effectiveStatus, trialEndsAt, currentPeriodEnd } =
      this.calculateEffectiveStatus(storeSubscription);

    return {
      status: effectiveStatus,
      trialEndsAt: trialEndsAt?.toISOString(),
      currentPeriodEnd: currentPeriodEnd?.toISOString(),
      plan: storeSubscription.planId
        ? {
            id: storeSubscription.planId,
            name: storeSubscription.planName || this.getDefaultPlanName(storeSubscription.planId),
          }
        : undefined,
    };
  }

  /**
   * Busca assinatura por storeId; se não existir, cria TRIAL padrão.
   * A data base do trial é criada a partir de agora, não mais do createdAt do usuário.
   */
  private async getOrCreateStoreSubscription(storeId: string, userCreatedAt: Date) {
    let subscription = await this.prisma.storeSubscription.findUnique({
      where: { storeId },
    });

    if (subscription) {
      return subscription;
    }

    const now = new Date();
    const trialStartAt = now;
    const trialEndAt = new Date(trialStartAt);
    trialEndAt.setDate(trialEndAt.getDate() + this.DEFAULT_TRIAL_DAYS);

    subscription = await this.prisma.storeSubscription.create({
      data: {
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

    return subscription;
  }

  /**
   * Calcula o status efetivo com base nas datas, flags e plano.
   *
   * Regras principais:
   * - Se houver plano válido (start/pro/enterprise) e o período atual ainda não
   *   terminou, o status efetivo é sempre ACTIVE (plano pago/ativo).
   * - TRIAL expirado vira EXPIRED.
   * - ACTIVE/CANCELED com período vencido viram EXPIRED.
   */
  private calculateEffectiveStatus(subscription: {
    status: string;
    trialEndAt: Date | null;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    canceledAt: Date | null;
    planId?: string | null;
  }): {
    effectiveStatus: SubscriptionStatus;
    trialEndsAt?: Date;
    currentPeriodEnd?: Date;
  } {
    const now = new Date();
    const { status, trialEndAt, currentPeriodEnd, cancelAtPeriodEnd, canceledAt, planId } = subscription;

    const isPaidPlan =
      !!planId && (planId === 'start' || planId === 'pro' || planId === 'enterprise');

    // Se há plano pago/ativo e o período atual ainda não terminou,
    // sempre refletimos ACTIVE, independentemente de status interno.
    if (isPaidPlan && currentPeriodEnd && now <= currentPeriodEnd) {
      return {
        effectiveStatus: 'ACTIVE',
        trialEndsAt: trialEndAt || undefined,
        currentPeriodEnd,
      };
    }

    // Se está em TRIAL e já passou a data de término, vira EXPIRED
    if (status === 'TRIAL') {
      if (trialEndAt && now > trialEndAt) {
        return {
          effectiveStatus: 'EXPIRED',
          trialEndsAt: trialEndAt || undefined,
          currentPeriodEnd: currentPeriodEnd || undefined,
        };
      }
      return {
        effectiveStatus: 'TRIAL',
        trialEndsAt: trialEndAt || undefined,
        currentPeriodEnd: currentPeriodEnd || undefined,
      };
    }

    // ACTIVE ou CANCELED dependem do currentPeriodEnd
    if (status === 'ACTIVE' || status === 'CANCELED') {
      if (!currentPeriodEnd || now > currentPeriodEnd) {
        return {
          effectiveStatus: 'EXPIRED',
          trialEndsAt: trialEndAt || undefined,
          currentPeriodEnd: currentPeriodEnd || undefined,
        };
      }

      // Se marcado como cancelado ao fim do período, refletimos CANCELED,
      // embora continue com acesso até currentPeriodEnd.
      if (status === 'CANCELED' || (cancelAtPeriodEnd && canceledAt)) {
        return {
          effectiveStatus: 'CANCELED',
          trialEndsAt: trialEndAt || undefined,
          currentPeriodEnd,
        };
      }

      return {
        effectiveStatus: 'ACTIVE',
        trialEndsAt: trialEndAt || undefined,
        currentPeriodEnd,
      };
    }

    // Qualquer outro caso (incluindo EXPIRED explícito) é EXPIRED
    return {
      effectiveStatus: 'EXPIRED',
      trialEndsAt: trialEndAt || undefined,
      currentPeriodEnd: currentPeriodEnd || undefined,
    };
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
