import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Configurando usuário com Plano Pro ativo...');

  // Buscar o usuário Teste
  const testeUser = await prisma.user.findUnique({
    where: { email: 'teste@gmail.com' },
    include: { store: true },
  });

  if (!testeUser) {
    console.error('❌ Usuário teste@gmail.com não encontrado.');
    process.exit(1);
  }

  if (!testeUser.store) {
    console.error('❌ Usuário não possui loja associada.');
    process.exit(1);
  }

  console.log(`✅ Usuário encontrado: ${testeUser.email}`);
  console.log(`   Loja: ${testeUser.store.name}`);

  // Verificar se já existe subscription
  let subscription = await prisma.subscription.findUnique({
    where: { storeId: testeUser.store.id },
  });

  // Datas para subscription ativa
  const now = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 10); // Iniciou há 10 dias
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + 1); // Válido por mais 1 mês
  const nextBillingDate = new Date(endDate);

  if (subscription) {
    console.log('📝 Atualizando subscription existente...');
    subscription = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        plan: 'PRO',
        status: 'ACTIVE',
        startDate,
        endDate,
        nextBillingDate,
        trialEndsAt: null,
        canceledAt: null,
      },
    });
  } else {
    console.log('📝 Criando nova subscription...');
    subscription = await prisma.subscription.create({
      data: {
        storeId: testeUser.store.id,
        plan: 'PRO',
        status: 'ACTIVE',
        startDate,
        endDate,
        nextBillingDate,
        trialEndsAt: null,
      },
    });
  }

  console.log(`✅ Subscription configurada com sucesso!`);
  console.log(`   Plano: ${subscription.plan}`);
  console.log(`   Status: ${subscription.status}`);
  console.log(`   Início: ${subscription.startDate}`);
  console.log(`   Fim: ${subscription.endDate}`);
  console.log(`   Próximo pagamento: ${subscription.nextBillingDate}`);
  console.log(`\n🎉 Usuário teste@gmail.com agora possui Plano Pro ATIVO!`);
  console.log(`\n📋 Credenciais de acesso:`);
  console.log(`   E-mail: teste@gmail.com`);
  console.log(`   Senha: admin123`);
  console.log(`   Plano: Pro (Ativo)`);
  console.log(`   Funcionalidades: Todas liberadas ✅`);
}

main()
  .catch((e) => {
    console.error('❌ Erro ao configurar usuário:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
