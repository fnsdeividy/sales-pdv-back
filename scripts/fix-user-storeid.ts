import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixUserStoreId(email: string) {
  try {
    console.log(`🔧 Corrigindo usuário: ${email}`);
    
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        store: true,
      },
    });

    if (!user) {
      console.log(`❌ Usuário não encontrado: ${email}`);
      return;
    }

    console.log(`\n📋 Usuário encontrado:`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Nome: ${user.firstName} ${user.lastName}`);
    console.log(`   StoreId atual: ${user.storeId || 'NÃO DEFINIDO'}`);

    if (user.storeId) {
      console.log(`\n✅ Usuário já tem storeId associado. Nada a fazer.`);
      return;
    }

    // Verificar se há uma loja com nome similar ao nome do usuário
    const storeName = user.firstName || `Loja ${user.email.split('@')[0]}`;
    
    // Procurar loja existente com nome similar
    let store = await prisma.store.findFirst({
      where: {
        name: {
          contains: storeName,
          mode: 'insensitive',
        },
      },
    });

    if (!store) {
      // Criar nova loja para o usuário
      console.log(`\n🏪 Criando nova loja: ${storeName}`);
      store = await prisma.store.create({
        data: {
          name: storeName,
          description: `Loja ${user.firstName || user.email.split('@')[0]}`,
          type: 'main',
          isActive: true,
        },
      });
      console.log(`✅ Loja criada: ${store.id} - ${store.name}`);
    } else {
      console.log(`\n🏪 Loja existente encontrada: ${store.id} - ${store.name}`);
    }

    // Associar usuário à loja
    console.log(`\n🔗 Associando usuário à loja...`);
    await prisma.user.update({
      where: { id: user.id },
      data: { storeId: store.id },
    });

    console.log(`✅ Usuário associado à loja com sucesso!`);
    console.log(`   Novo StoreId: ${store.id}`);

    // Verificar produtos da loja
    const products = await prisma.product.findMany({
      where: { storeId: store.id },
      select: {
        id: true,
        name: true,
      },
    });

    console.log(`\n📦 Produtos da loja: ${products.length}`);
    if (products.length > 0) {
      console.log(`   Primeiros produtos:`);
      products.slice(0, 3).forEach(p => {
        console.log(`   - ${p.name}`);
      });
    } else {
      console.log(`   ⚠️ Nenhum produto encontrado. O usuário verá uma lista vazia.`);
    }

  } catch (error) {
    console.error('❌ Erro ao corrigir usuário:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Corrigir ambos os usuários
const emails = ['vnn2005@gmail.com', 'vnn2006@gmail.com'];

async function main() {
  for (const email of emails) {
    await fixUserStoreId(email);
    console.log('\n\n');
  }
}

main();
