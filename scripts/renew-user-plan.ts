import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Renovando plano do usuário teste@gmail.com...');

  // Buscar o usuário
  const user = await prisma.user.findUnique({
    where: { email: 'teste@gmail.com' },
  });

  if (!user) {
    console.error('❌ Usuário teste@gmail.com não encontrado.');
    process.exit(1);
  }

  console.log(`✅ Usuário encontrado: ${user.email}`);
  console.log(`   Data de criação anterior: ${user.createdAt}`);

  // Atualizar a data de criação para hoje (trial de 7 dias começando agora)
  const now = new Date();
  
  const updatedUser = await prisma.user.update({
    where: { email: 'teste@gmail.com' },
    data: {
      createdAt: now,
      updatedAt: now,
    },
  });

  console.log(`✅ Data de criação atualizada para: ${updatedUser.createdAt}`);
  
  // Calcular quando o trial expira (7 dias a partir de agora)
  const trialEndDate = new Date(now);
  trialEndDate.setDate(trialEndDate.getDate() + 7);
  
  console.log(`✅ Trial renovado com sucesso!`);
  console.log(`   Trial expira em: ${trialEndDate.toLocaleDateString('pt-BR')}`);
  console.log(`\n🎉 Usuário teste@gmail.com agora tem acesso ativo por mais 7 dias!`);
  console.log(`\n📋 Credenciais de acesso:`);
  console.log(`   E-mail: teste@gmail.com`);
  console.log(`   Senha: admin123`);
  console.log(`   Status: Trial Ativo (7 dias)`);
  console.log(`   Funcionalidades: Todas liberadas ✅`);
}

main()
  .catch((e) => {
    console.error('❌ Erro ao renovar plano:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
