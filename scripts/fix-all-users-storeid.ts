import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Corrigindo storeId de todos os usuários...\n');

  // Buscar a loja principal
  const mainStore = await prisma.store.findUnique({
    where: { id: 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33' },
  });

  if (!mainStore) {
    console.log('❌ Loja principal não encontrada. Criando...');
    const newStore = await prisma.store.create({
      data: {
        id: 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
        name: 'Loja Principal',
        description: 'Loja principal do sistema Cloro',
        address: 'Rua Principal, 123, Centro - São Paulo, SP',
        phone: '+55 11 3333-3333',
        email: 'principal@cloro.com',
        isActive: true,
      },
    });
    console.log('✅ Loja principal criada:', newStore.id);
  }

  const storeId = mainStore?.id || 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';

  // Buscar todos os usuários sem storeId
  const usersWithoutStore = await prisma.user.findMany({
    where: {
      storeId: null,
    },
  });

  console.log(`📋 Encontrados ${usersWithoutStore.length} usuários sem storeId\n`);

  if (usersWithoutStore.length === 0) {
    console.log('✅ Todos os usuários já têm storeId associado!');
    return;
  }

  // Atualizar todos os usuários
  for (const user of usersWithoutStore) {
    await prisma.user.update({
      where: { id: user.id },
      data: { storeId },
    });
    console.log(`✅ Usuário ${user.email} associado à loja principal`);
  }

  console.log(`\n🎉 ${usersWithoutStore.length} usuário(s) corrigido(s) com sucesso!`);
}

main()
  .catch((e) => {
    console.error('❌ Erro ao corrigir usuários:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
