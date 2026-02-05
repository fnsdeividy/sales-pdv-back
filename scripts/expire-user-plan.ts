/**
 * Marca a assinatura da loja do usuário como EXPIRED (plano vencido).
 * Uso: npx ts-node scripts/expire-user-plan.ts <email>
 * Exemplo: npx ts-node scripts/expire-user-plan.ts vnn2006@gmail.com
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const emailArg = process.argv[2];
  if (!emailArg) {
    console.error('Uso: npx ts-node scripts/expire-user-plan.ts <email>');
    process.exit(1);
  }

  const targetEmail = emailArg.trim().toLowerCase();
  console.log(`🔄 Marcando plano como vencido para o usuário ${targetEmail}...`);

  const user = await prisma.user.findUnique({
    where: { email: targetEmail },
    include: { store: { include: { subscription: true } } },
  });

  if (!user) {
    console.error(`❌ Usuário ${targetEmail} não encontrado.`);
    process.exit(1);
  }

  if (!user.storeId || !user.store) {
    console.error(`❌ Usuário ${targetEmail} não possui loja associada (storeId nulo).`);
    process.exit(1);
  }

  const storeId = user.store.id;
  const existing = user.store.subscription;

  console.log(`✅ Usuário encontrado: ${user.email}`);
  console.log(`   Loja: ${user.store.name} (ID: ${storeId})`);
  if (existing) {
    console.log(`   Status atual: ${existing.status}`);
  }

  const now = new Date();

  const subscription = await prisma.storeSubscription.upsert({
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

  console.log(`\n✅ Plano marcado como vencido (EXPIRED).`);
  console.log(`   Status: ${subscription.status}`);
  console.log(`   Plano: ${subscription.planName} (${subscription.planId})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
