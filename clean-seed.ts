import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanSeedData() {
  console.log('🧹 Iniciando limpeza dos dados da seed...');

  try {
    // IDs específicos da seed
    const seedProductIds = [
      'B96D1208-BF58-4A45-8307-24005C8C46C8',
      '0A915B12-C5CD-4978-BF09-2C7D275B082C',
      '4226C6AC-38CF-41A0-B9D8-4A13906333EF',
      'F1A2B3C4-D5E6-F7G8-H9I0-J1K2L3M4N5O6',
      'A1B2C3D4-E5F6-G7H8-I9J0-K1L2M3N4O5P6',
      'Q1W2E3R4-T5Y6-U7I8-O9P0-A1S2D3F4G5H6'
    ];

    const seedStoreId = 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';
    const seedCustomerId = '4F461257-2F49-4667-83E4-A9510DDAE575';
    const seedUserEmails = [
      'cassiobrr@gmail.com',
      'cristianosenna79@gmail.com',
      'test@example.com',
      'caixa@example.com'
    ];

    // 1. Limpar dados de produção
    console.log('📦 Limpando dados de produção...');
    
    // Buscar ordens de produção dos produtos da seed
    const productionOrders = await prisma.productionOrder.findMany({
      where: { productId: { in: seedProductIds } }
    });
    
    const productionOrderIds = productionOrders.map(order => order.id);
    
    // Limpar consumos de produção
    if (productionOrderIds.length > 0) {
      await prisma.productionConsumption.deleteMany({
        where: { productionOrderId: { in: productionOrderIds } }
      });
    }
    
    // Limpar produtos acabados
    await prisma.finishedGoodsInventory.deleteMany({
      where: { productId: { in: seedProductIds } }
    });
    
    // Limpar ordens de produção
    await prisma.productionOrder.deleteMany({
      where: { productId: { in: seedProductIds } }
    });
    
    // Limpar BOM
    await prisma.productBom.deleteMany({
      where: { productId: { in: seedProductIds } }
    });
    
    // Limpar cache de custos
    await prisma.productCostCache.deleteMany({
      where: { productId: { in: seedProductIds } }
    });

    // 2. Limpar vendas e pedidos
    console.log('🛒 Limpando vendas e pedidos...');
    
    // Limpar itens de pedidos
    await prisma.orderItem.deleteMany({
      where: { productId: { in: seedProductIds } }
    });
    
    // Limpar pedidos do customer padrão
    await prisma.order.deleteMany({
      where: { customerId: seedCustomerId }
    });
    
    // Limpar pedidos da loja principal
    await prisma.order.deleteMany({
      where: { storeId: seedStoreId }
    });

    // 3. Limpar estoque
    console.log('📊 Limpando estoque...');
    
    await prisma.stock.deleteMany({
      where: { productId: { in: seedProductIds } }
    });
    
    await prisma.stock.deleteMany({
      where: { storeId: seedStoreId }
    });

    // 4. Buscar IDs dos usuários da seed
    const seedUsers = await prisma.user.findMany({
      where: { email: { in: seedUserEmails } }
    });
    
    const seedUserIds = seedUsers.map(user => user.id);

    // 5. Limpar transações
    console.log('💰 Limpando transações...');
    
    await prisma.transaction.deleteMany({
      where: { 
        OR: [
          { storeId: seedStoreId },
          { userId: { in: seedUserIds } }
        ]
      }
    });

    // 6. Limpar produtos da seed
    console.log('🧴 Limpando produtos...');
    
    await prisma.product.deleteMany({
      where: { id: { in: seedProductIds } }
    });

    // 7. Limpar customer padrão
    console.log('👤 Limpando customer padrão...');
    
    await prisma.customer.delete({
      where: { id: seedCustomerId }
    }).catch(() => console.log('Customer padrão já foi removido ou não existe'));

    // 8. Limpar loja principal
    console.log('🏪 Limpando loja principal...');
    
    await prisma.store.delete({
      where: { id: seedStoreId }
    }).catch(() => console.log('Loja principal já foi removida ou não existe'));

    // 9. Limpar associações de usuários com roles
    console.log('👥 Limpando associações de usuários...');
    
    await prisma.userRole.deleteMany({
      where: { userId: { in: seedUserIds } }
    });

    // 10. Limpar sessões
    console.log('🔐 Limpando sessões...');
    
    await prisma.session.deleteMany({
      where: { userId: { in: seedUserIds } }
    });

    // 11. Limpar audit logs
    console.log('📝 Limpando logs de auditoria...');
    
    await prisma.auditLog.deleteMany({
      where: { userId: { in: seedUserIds } }
    });

    // 12. Limpar usuários da seed
    console.log('🗑️ Limpando usuários da seed...');
    
    await prisma.user.deleteMany({
      where: { email: { in: seedUserEmails } }
    });

    // 13. Opcionalmente limpar roles (descomente se necessário)
    // console.log('🔑 Limpando roles...');
    // await prisma.role.deleteMany({
    //   where: { name: { in: ['admin', 'user', 'cashier'] } }
    // });

    console.log('✅ Limpeza concluída com sucesso!');
    
    // Verificar o que sobrou
    console.log('\n📊 Verificando registros restantes:');
    const counts = await Promise.all([
      prisma.user.count(),
      prisma.store.count(),
      prisma.product.count(),
      prisma.customer.count(),
      prisma.stock.count(),
      prisma.order.count(),
      prisma.transaction.count(),
      prisma.role.count(),
      prisma.userRole.count()
    ]);
    
    console.log(`Users: ${counts[0]}`);
    console.log(`Stores: ${counts[1]}`);
    console.log(`Products: ${counts[2]}`);
    console.log(`Customers: ${counts[3]}`);
    console.log(`Stock: ${counts[4]}`);
    console.log(`Orders: ${counts[5]}`);
    console.log(`Transactions: ${counts[6]}`);
    console.log(`Roles: ${counts[7]}`);
    console.log(`User Roles: ${counts[8]}`);

  } catch (error) {
    console.error('❌ Erro durante a limpeza:', error);
    throw error;
  }
}

// Executar a limpeza
cleanSeedData()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
