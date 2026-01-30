import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const emailArg = process.argv[2];
  const targetEmail = emailArg || 'teste@teste.com.br';

  console.log(`🔄 Ativando plano da loja do usuário ${targetEmail}...`);

  const user = await prisma.user.findUnique({
    where: { email: targetEmail },
    include: { store: true },
  });

  if (!user) {
    console.error(`❌ Usuário ${targetEmail} não encontrado.`);
    process.exit(1);
  }

  if (!user.store) {
    console.error(`❌ Usuário ${targetEmail} não possui loja associada (storeId nulo).`);
    process.exit(1);
  }

  const storeId = user.store.id;

  console.log(`✅ Usuário encontrado: ${user.email}`);
  console.log(`   Loja: ${user.store.name} (ID: ${storeId})`);

  const now = new Date();
  const currentPeriodStart = now;
  const currentPeriodEnd = new Date(now);
  currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);

  const subscription = await prisma.storeSubscription.upsert({
    where: { storeId },
    update: {
      status: 'ACTIVE',
      planId: 'pro',
      planName: 'Plano Pro',
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
      planId: 'pro',
      planName: 'Plano Pro',
      trialStartAt: null,
      trialEndAt: null,
      currentPeriodStart,
      currentPeriodEnd,
      canceledAt: null,
      cancelAtPeriodEnd: false,
      nextBillingAt: currentPeriodEnd,
    },
  });

  console.log('✅ Assinatura da loja configurada/atualizada com sucesso!');
  console.log(`   Plano: ${subscription.planName} (${subscription.planId})`);
  console.log(`   Status: ${subscription.status}`);
  console.log(`   Período atual: ${subscription.currentPeriodStart?.toISOString()} -> ${subscription.currentPeriodEnd?.toISOString()}`);
  console.log(`   Próxima cobrança em: ${subscription.nextBillingAt?.toISOString()}`);
  console.log('\n🎉 Plano ATIVO para a loja desse usuário.');
}

main()
  .catch((e) => {
    console.error('❌ Erro ao ativar plano da loja:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

