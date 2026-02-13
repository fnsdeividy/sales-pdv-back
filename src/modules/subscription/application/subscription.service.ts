import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type SubscriptionStatus = 'PENDING_PAYMENT' | 'ACTIVE' | 'EXPIRED' | 'CANCELED';

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
  currentPeriodEnd?: string;
  plan?: SubscriptionPlan;
  isOwner: boolean;
  storeOwner: StoreOwner | null;
}

@Injectable()
export class SubscriptionService {
  constructor(private prisma: PrismaService) {}

  /**
   * Retorna a assinatura efetiva da loja do usuário autenticado.
   * A assinatura é criada no registro com status PENDING_PAYMENT.
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
    const storeSubscription = await this.prisma.storeSubscription.findUnique({
      where: { storeId: user.storeId },
    });

    if (!storeSubscription) {
      // Sem assinatura: retornar como PENDING_PAYMENT para redirecionar ao pagamento
      const storeOwner = await this.getStoreOwner(user.storeId);
      return {
        status: 'PENDING_PAYMENT',
        isOwner,
        storeOwner,
      };
    }

    const { effectiveStatus, currentPeriodEnd } =
      this.calculateEffectiveStatus(storeSubscription);

    const storeOwner = await this.getStoreOwner(user.storeId);

    return {
      status: effectiveStatus,
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
   * Calcula o status efetivo com base no status gravado e nas datas.
   * Backend é a fonte da verdade: um único status por loja.
   * Pagamento sempre tem prioridade: webhook/admin setam status ACTIVE.
   */
  private calculateEffectiveStatus(subscription: {
    status: string;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    canceledAt: Date | null;
    planId?: string | null;
  }): {
    effectiveStatus: SubscriptionStatus;
    currentPeriodEnd?: Date;
  } {
    const now = new Date();
    const { status, currentPeriodEnd } = subscription;

    // 1. PENDING_PAYMENT: aguardando pagamento inicial
    if (status === 'PENDING_PAYMENT') {
      return {
        effectiveStatus: 'PENDING_PAYMENT',
        currentPeriodEnd: currentPeriodEnd || undefined,
      };
    }

    // 2. ACTIVE: acesso total enquanto o período atual não vencer
    if (status === 'ACTIVE') {
      if (currentPeriodEnd && now <= currentPeriodEnd) {
        return {
          effectiveStatus: 'ACTIVE',
          currentPeriodEnd,
        };
      }
      return {
        effectiveStatus: 'EXPIRED',
        currentPeriodEnd: currentPeriodEnd || undefined,
      };
    }

    // 3. CANCELED: acesso até currentPeriodEnd, depois EXPIRED
    if (status === 'CANCELED') {
      if (currentPeriodEnd && now <= currentPeriodEnd) {
        return {
          effectiveStatus: 'CANCELED',
          currentPeriodEnd,
        };
      }
      return {
        effectiveStatus: 'EXPIRED',
        currentPeriodEnd: currentPeriodEnd || undefined,
      };
    }

    // 4. Demais casos (incluindo EXPIRED explícito)
    return {
      effectiveStatus: 'EXPIRED',
      currentPeriodEnd: currentPeriodEnd || undefined,
    };
  }

  private getDefaultPlanName(planId: string): string {
    switch (planId) {
      case 'start':
        return 'Plano Start';
      case 'pro':
        return 'Plano Pro';
      case 'premium':
        return 'Plano Premium';
      case 'enterprise':
        return 'Plano Enterprise';
      default:
        return planId;
    }
  }
}
