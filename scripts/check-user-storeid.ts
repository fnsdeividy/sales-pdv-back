import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUserStoreId(email: string) {
  try {
    console.log(`🔍 Verificando usuário: ${email}`);
    
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        store: {
          select: {
            id: true,
            name: true,
            isActive: true,
          },
        },
      },
    });

    if (!user) {
      console.log(`❌ Usuário não encontrado: ${email}`);
      return;
    }

    console.log('\n📋 Informações do Usuário:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`ID: ${user.id}`);
    console.log(`Email: ${user.email}`);
    console.log(`Nome: ${user.firstName} ${user.lastName}`);
    console.log(`Ativo: ${user.isActive ? 'Sim' : 'Não'}`);
    console.log(`Criado em: ${user.createdAt}`);
    console.log(`StoreId: ${user.storeId || '❌ NÃO DEFINIDO'}`);
    
    if (user.store) {
      console.log('\n🏪 Informações da Loja:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`ID da Loja: ${user.store.id}`);
      console.log(`Nome da Loja: ${user.store.name}`);
      console.log(`Loja Ativa: ${user.store.isActive ? 'Sim' : 'Não'}`);
    } else {
      console.log('\n❌ Loja não encontrada ou não associada!');
    }

    // Verificar produtos da loja
    if (user.storeId) {
      const products = await prisma.product.findMany({
        where: { storeId: user.storeId },
        select: {
          id: true,
          name: true,
          storeId: true,
        },
      });

      console.log('\n📦 Produtos da Loja:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`Total de produtos: ${products.length}`);
      
      if (products.length > 0) {
        console.log('\nPrimeiros 5 produtos:');
        products.slice(0, 5).forEach((p, i) => {
          console.log(`${i + 1}. ${p.name} (ID: ${p.id})`);
          console.log(`   StoreId: ${p.storeId}`);
          if (p.storeId !== user.storeId) {
            console.log(`   ⚠️ ERRO: StoreId não corresponde!`);
          }
        });
      } else {
        console.log('Nenhum produto encontrado para esta loja.');
      }

      // Verificar produtos de outras lojas (problema de segurança)
      const allProducts = await prisma.product.findMany({
        select: {
          id: true,
          name: true,
          storeId: true,
        },
      });

      const otherStoreProducts = allProducts.filter(p => p.storeId !== user.storeId);
      console.log(`\n⚠️ Total de produtos de OUTRAS lojas: ${otherStoreProducts.length}`);
      
      if (otherStoreProducts.length > 0) {
        const storeIds = [...new Set(otherStoreProducts.map(p => p.storeId))];
        console.log(`   Lojas com produtos: ${storeIds.join(', ')}`);
      }
    } else {
      console.log('\n❌ Usuário não tem storeId! Este é o problema.');
    }

  } catch (error) {
    console.error('❌ Erro ao verificar usuário:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Verificar ambos os usuários
const emails = ['vnn2005@gmail.com', 'vnn2006@gmail.com'];

async function main() {
  for (const email of emails) {
    await checkUserStoreId(email);
    console.log('\n\n');
  }
}

main();
