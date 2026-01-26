import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Atualizando status de trial para pago...');

  // Buscar o usuário Teste
  const testeUser = await prisma.user.findUnique({
    where: { email: 'teste@gmail.com' },
  });

  if (!testeUser) {
    console.error('❌ Usuário teste@gmail.com não encontrado.');
    process.exit(1);
  }

  console.log(`✅ Usuário encontrado: ${testeUser.email}`);
  console.log(`   Data de criação atual: ${testeUser.createdAt}`);

  // Atualizar a data de criação para 30 dias atrás (garantindo que o trial expirou)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const updatedUser = await prisma.user.update({
    where: { email: 'teste@gmail.com' },
    data: {
      createdAt: thirtyDaysAgo,
    },
  });

  console.log(`✅ Data de criação atualizada para: ${updatedUser.createdAt}`);
  console.log(`\n🎉 Usuário ${testeUser.email} agora está com status PAGO (ACTIVE)!`);
  console.log(`   O trial expirou há ${Math.floor((new Date().getTime() - thirtyDaysAgo.getTime()) / (1000 * 60 * 60 * 24))} dias.`);
}

main()
  .catch((e) => {
    console.error('❌ Erro ao atualizar usuário:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
