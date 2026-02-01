/**
 * Atribui um usuário (por email) a uma NOVA loja.
 * Use quando dois admins estiverem compartilhando a mesma loja e um deles
 * precisar ter sua própria loja (isolamento por tenant).
 *
 * Uso: npx ts-node scripts/assign-user-to-new-store.ts <email>
 * Exemplo: npx ts-node scripts/assign-user-to-new-store.ts vnn2006@gmail.com
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2]?.trim();
  if (!email) {
    console.error('Uso: npx ts-node scripts/assign-user-to-new-store.ts <email>');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { store: true },
  });

  if (!user) {
    console.error('Usuário não encontrado:', email);
    process.exit(1);
  }

  const storeName = `Loja ${user.firstName || user.email.split('@')[0]}`.trim();
  const newStore = await prisma.store.create({
    data: {
      name: storeName,
      description: `Loja do usuário ${user.email}`,
      type: 'main',
      isActive: true,
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { storeId: newStore.id },
  });

  console.log('Usuário atribuído à nova loja.');
  console.log('  Email:', user.email);
  console.log('  Novo storeId:', newStore.id);
  console.log('  Nome da loja:', newStore.name);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
