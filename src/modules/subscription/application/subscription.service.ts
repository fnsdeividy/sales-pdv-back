import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'EXPIRED' | 'CANCELED';

export interface SubscriptionPlan {
  id: string;
  name: string;
}

export interface StoreOwner {
  name: string;
  email: string;
  phone: string | null;
}

export interface Subscription {
  status: SubscriptionStatus;
  trialEndsAt?: string;
  currentPeriodEnd?: string;
  plan?: SubscriptionPlan;
  isOwner: boolean;
  storeOwner: StoreOwner | null;
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
      select: {
        id: true,
        email: true,
        storeId: true,
        createdAt: true,
        userRoles: { include: { role: true } },
      },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    if (!user.storeId) {
      throw new NotFoundException('Usuário não está associado a uma loja');
    }

    const isOwner = user.userRoles.some((ur) => ur.role.name === 'admin');
    const storeSubscription = await this.getOrCreateStoreSubscription(user.storeId, user.createdAt);

    const { effectiveStatus, trialEndsAt, currentPeriodEnd } =
      this.calculateEffectiveStatus(storeSubscription);

    const storeOwner = await this.getStoreOwner(user.storeId);

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
      isOwner,
      storeOwner,
    };
  }

  /**
   * Retorna o primeiro usuário admin da loja (dono/responsável) para contato
   * quando a assinatura está expirada e o usuário atual não é owner.
   */
  private async getStoreOwner(storeId: string): Promise<StoreOwner | null> {
    const owner = await this.prisma.user.findFirst({
      where: {
        storeId,
        userRoles: {
          some: { role: { name: 'admin' } },
        },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
      },
    });

    if (!owner) {
      return null;
    }

    const name = [owner.firstName, owner.lastName].filter(Boolean).join(' ') || owner.email;
    return {
      name,
      email: owner.email,
      phone: owner.phone ?? null,
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
   * Calcula o status efetivo com base no status gravado e nas datas.
   * Backend é a fonte da verdade: um único status por loja (TRIAL | ACTIVE | EXPIRED | CANCELED).
   * Pagamento sempre tem prioridade: webhook/admin setam status ACTIVE e trialEndAt null.
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
    const { status, trialEndAt, currentPeriodEnd, cancelAtPeriodEnd, canceledAt } = subscription;

    // 1. ACTIVE: acesso total enquanto o período atual não vencer
    if (status === 'ACTIVE') {
      if (currentPeriodEnd && now <= currentPeriodEnd) {
        return {
          effectiveStatus: 'ACTIVE',
          trialEndsAt: trialEndAt || undefined,
          currentPeriodEnd,
        };
      }
      return {
        effectiveStatus: 'EXPIRED',
        trialEndsAt: trialEndAt || undefined,
        currentPeriodEnd: currentPeriodEnd || undefined,
      };
    }

    // 2. TRIAL: acesso em trial enquanto trialEndAt não vencer
    if (status === 'TRIAL') {
      if (trialEndAt && now <= trialEndAt) {
        return {
          effectiveStatus: 'TRIAL',
          trialEndsAt: trialEndAt || undefined,
          currentPeriodEnd: currentPeriodEnd || undefined,
        };
      }
      return {
        effectiveStatus: 'EXPIRED',
        trialEndsAt: trialEndAt || undefined,
        currentPeriodEnd: currentPeriodEnd || undefined,
      };
    }

    // 3. CANCELED: acesso até currentPeriodEnd, depois EXPIRED
    if (status === 'CANCELED') {
      if (currentPeriodEnd && now <= currentPeriodEnd) {
        return {
          effectiveStatus: 'CANCELED',
          trialEndsAt: trialEndAt || undefined,
          currentPeriodEnd,
        };
      }
      return {
        effectiveStatus: 'EXPIRED',
        trialEndsAt: trialEndAt || undefined,
        currentPeriodEnd: currentPeriodEnd || undefined,
      };
    }

    // 4. Demais casos (incluindo EXPIRED explícito)
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
