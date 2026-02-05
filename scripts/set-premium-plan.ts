import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Define a assinatura da loja do usuário como Plano Premium.
 * Uso: npx ts-node scripts/set-premium-plan.ts <email>
 * Exemplo: npx ts-node scripts/set-premium-plan.ts vnn2006@gmail.com
 */
async function main() {
  const emailArg = process.argv[2];
  if (!emailArg) {
    console.error('Uso: npx ts-node scripts/set-premium-plan.ts <email>');
    process.exit(1);
  }

  const targetEmail = emailArg.trim().toLowerCase();
  console.log(`Ativando Plano Premium para a loja do usuário ${targetEmail}...`);

  const user = await prisma.user.findUnique({
    where: { email: targetEmail },
    include: { store: true },
  });

  if (!user) {
    console.error(`Usuário ${targetEmail} não encontrado.`);
    process.exit(1);
  }

  if (!user.store) {
    console.error(`Usuário ${targetEmail} não possui loja associada (storeId nulo).`);
    process.exit(1);
  }

  const storeId = user.store.id;
  console.log(`Usuário encontrado: ${user.email}`);
  console.log(`Loja: ${user.store.name} (ID: ${storeId})`);

  const now = new Date();
  const currentPeriodStart = now;
  const currentPeriodEnd = new Date(now);
  currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);

  const subscription = await prisma.storeSubscription.upsert({
    where: { storeId },
    update: {
      status: 'ACTIVE',
      planId: 'premium',
      planName: 'Plano Premium',
      trialStartAt: null,
      trialEndAt: null,
      currentPeriodStart,
      currentPeriodEnd,
      canceledAt: null,
      cancelAtPeriodEnd: false,
      nextBillingAt: currentPeriodEnd,
    },
    create: {
      storeId,
      status: 'ACTIVE',
      planId: 'premium',
      planName: 'Plano Premium',
      trialStartAt: null,
      trialEndAt: null,
      currentPeriodStart,
      currentPeriodEnd,
      canceledAt: null,
      cancelAtPeriodEnd: false,
      nextBillingAt: currentPeriodEnd,
    },
  });

  console.log('Assinatura atualizada com sucesso.');
  console.log(`Plano: ${subscription.planName} (${subscription.planId})`);
  console.log(`Status: ${subscription.status}`);
}

main()
  .catch((e) => {
    console.error('Erro:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
