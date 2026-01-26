import { Injectable } from '@nestjs/common';
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

  async getSubscription(userId: string): Promise<Subscription> {
    // Buscar o usuário
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    // Verificar se é o usuário teste@gmail.com (usuário pago)
    if (user.email === 'teste@gmail.com') {
      const now = new Date();
      const currentPeriodEnd = new Date();
      currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);

      return {
        status: 'ACTIVE',
        currentPeriodEnd: currentPeriodEnd.toISOString(),
        plan: {
          id: 'pro',
          name: 'Plano Pro',
        },
      };
    }

    // Para outros usuários, calcular trial baseado na data de criação
    const TRIAL_PERIOD_DAYS = 7;
    const now = new Date();
    const createdAt = new Date(user.createdAt);
    const trialEndDate = new Date(createdAt);
    trialEndDate.setDate(trialEndDate.getDate() + TRIAL_PERIOD_DAYS);

    const isTrialActive = now < trialEndDate;

    return {
      status: isTrialActive ? 'TRIAL' : 'EXPIRED',
      trialEndsAt: trialEndDate.toISOString(),
      currentPeriodEnd: isTrialActive ? trialEndDate.toISOString() : undefined,
      plan: {
        id: 'start',
        name: 'Plano Start',
      },
    };
  }
}
