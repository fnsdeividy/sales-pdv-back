const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Troque pelos ids retornados no POST /api/v1/auth/register
  const storeId = process.argv[2] || 'cfec7ca0-61fd-48a9-9d44-b1a89137796d';
  const userId = process.argv[3] || '7917014f-faab-4e33-a650-aa503df2fd4b';

  const store = await prisma.store.findUnique({ where: { id: storeId } });
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!store) return console.log('Loja não encontrada:', storeId);
  if (!user) return console.log('Usuário não encontrado:', userId);

  console.log('=== LOJA ===');
  console.log(JSON.stringify(store, null, 2));
  console.log('\n=== USUÁRIO ===');
  console.log(JSON.stringify(user ? { ...user, password: '[REDACTED]' } : user, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
