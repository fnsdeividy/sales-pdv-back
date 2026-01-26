import { PrismaClient, FixedCostFrequency, FixedCostCategory, ProductionOrderStatus, Unit, CostingMethod, ProductionOrder } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de dados financeiros...');

  // Buscar o usuário Cassio e a loja principal
  const cassioUser = await prisma.user.findUnique({
    where: { email: 'cassiobrr@gmail.com' },
  });

  if (!cassioUser) {
    console.error('❌ Usuário cassiobrr@gmail.com não encontrado.');
    process.exit(1);
  }

  const mainStore = await prisma.store.findFirst({
    where: { name: 'Loja Principal' },
  });

  if (!mainStore) {
    console.error('❌ Loja Principal não encontrada.');
    process.exit(1);
  }

  console.log(`✅ Usuário: ${cassioUser.email}`);
  console.log(`✅ Loja: ${mainStore.name} (${mainStore.id})`);

  // Buscar produtos existentes
  const products = await prisma.product.findMany({
    where: { storeId: mainStore.id },
    take: 3, // Usar apenas 3 produtos para criar ordens de produção
  });

  if (products.length === 0) {
    console.error('❌ Nenhum produto encontrado. Execute o seed principal primeiro.');
    process.exit(1);
  }

  console.log(`✅ Produtos encontrados: ${products.length}`);

  // 1. CRIAR CUSTOS FIXOS
  console.log('\n💰 Criando custos fixos...');
  
  const fixedCosts = [
    {
      name: 'Aluguel da Fábrica',
      description: 'Aluguel mensal do espaço de produção',
      amount: 3500.00,
      frequency: FixedCostFrequency.monthly,
      category: FixedCostCategory.rent,
      isActive: true,
    },
    {
      name: 'Salários da Equipe',
      description: 'Folha de pagamento mensal dos funcionários de produção',
      amount: 12500.00,
      frequency: FixedCostFrequency.monthly,
      category: FixedCostCategory.labor,
      isActive: true,
    },
    {
      name: 'Energia Elétrica',
      description: 'Conta de energia elétrica mensal',
      amount: 850.00,
      frequency: FixedCostFrequency.monthly,
      category: FixedCostCategory.utilities,
      isActive: true,
    },
    {
      name: 'Água e Esgoto',
      description: 'Conta de água e esgoto mensal',
      amount: 320.00,
      frequency: FixedCostFrequency.monthly,
      category: FixedCostCategory.utilities,
      isActive: true,
    },
    {
      name: 'Internet e Telefone',
      description: 'Plano de internet e telefone empresarial',
      amount: 280.00,
      frequency: FixedCostFrequency.monthly,
      category: FixedCostCategory.utilities,
      isActive: true,
    },
    {
      name: 'Seguro da Fábrica',
      description: 'Seguro patrimonial anual',
      amount: 4800.00,
      frequency: FixedCostFrequency.yearly,
      category: FixedCostCategory.other,
      isActive: true,
    },
    {
      name: 'Manutenção de Equipamentos',
      description: 'Manutenção preventiva mensal dos equipamentos',
      amount: 650.00,
      frequency: FixedCostFrequency.monthly,
      category: FixedCostCategory.overhead,
      isActive: true,
    },
    {
      name: 'Limpeza Profissional',
      description: 'Serviço de limpeza mensal',
      amount: 450.00,
      frequency: FixedCostFrequency.monthly,
      category: FixedCostCategory.overhead,
      isActive: true,
    },
    {
      name: 'Contabilidade',
      description: 'Honorários contábeis mensais',
      amount: 800.00,
      frequency: FixedCostFrequency.monthly,
      category: FixedCostCategory.other,
      isActive: true,
    },
    {
      name: 'Marketing Digital',
      description: 'Investimento em marketing e publicidade',
      amount: 1200.00,
      frequency: FixedCostFrequency.monthly,
      category: FixedCostCategory.other,
      isActive: true,
    },
    {
      name: 'Combustível para Entrega',
      description: 'Custo diário de combustível para veículos de entrega',
      amount: 85.00,
      frequency: FixedCostFrequency.daily,
      category: FixedCostCategory.overhead,
      isActive: true,
    },
    {
      name: 'Material de Escritório',
      description: 'Material de escritório e suprimentos',
      amount: 150.00,
      frequency: FixedCostFrequency.monthly,
      category: FixedCostCategory.other,
      isActive: true,
    },
    {
      name: 'Treinamento de Funcionários',
      description: 'Cursos e treinamentos para equipe',
      amount: 600.00,
      frequency: FixedCostFrequency.monthly,
      category: FixedCostCategory.labor,
      isActive: true,
    },
    {
      name: 'Depreciação de Equipamentos',
      description: 'Depreciação mensal dos equipamentos de produção',
      amount: 1200.00,
      frequency: FixedCostFrequency.monthly,
      category: FixedCostCategory.overhead,
      isActive: true,
    },
    {
      name: 'Taxas e Licenças',
      description: 'Taxas municipais e licenças de funcionamento',
      amount: 350.00,
      frequency: FixedCostFrequency.monthly,
      category: FixedCostCategory.other,
      isActive: true,
    },
  ];

  let createdCosts = 0;
  for (const costData of fixedCosts) {
    try {
      await prisma.fixedCost.create({
        data: {
          ...costData,
          storeId: mainStore.id,
        },
      });
      createdCosts++;
    } catch (error: any) {
      // Se já existir, apenas logar
      if (error.code === 'P2002') {
        console.log(`   ⚠️  Custo "${costData.name}" já existe, pulando...`);
      } else {
        throw error;
      }
    }
  }

  console.log(`✅ ${createdCosts} custos fixos criados`);

  // 2. CRIAR ORDENS DE PRODUÇÃO FINALIZADAS (para calcular custo médio)
  console.log('\n🏭 Criando ordens de produção...');

  const productionOrders: ProductionOrder[] = [];
  const now = new Date();

  for (let i = 0; i < 15; i++) {
    const product = products[i % products.length];
    
    // Data aleatória nos últimos 60 dias
    const daysAgo = Math.floor(Math.random() * 60);
    const orderDate = new Date(now);
    orderDate.setDate(orderDate.getDate() - daysAgo);
    
    const startedAt = new Date(orderDate);
    startedAt.setHours(8, 0, 0, 0);
    
    const finishedAt = new Date(startedAt);
    finishedAt.setHours(finishedAt.getHours() + Math.floor(Math.random() * 8) + 4); // 4-12 horas de produção

    const plannedQty = Math.floor(Math.random() * 500) + 100; // 100-600 unidades
    const actualQty = plannedQty + Math.floor(Math.random() * 50) - 25; // ±25 unidades de variação

    // Calcular custos
    const materialCost = Math.random() * 2000 + 500; // R$ 500-2500
    const packagingCost = actualQty * (Math.random() * 0.5 + 0.2); // R$ 0.20-0.70 por unidade
    const overheadPercent = Math.random() * 15 + 5; // 5-20%
    const overheadCost = materialCost * (overheadPercent / 100);
    const totalCost = materialCost + packagingCost + overheadCost;
    const unitCost = totalCost / actualQty;

    try {
      const order = await prisma.productionOrder.create({
        data: {
          productId: product.id,
          plannedOutputQty: plannedQty,
          plannedUnit: Unit.un,
          actualOutputQty: actualQty,
          startedAt: startedAt,
          finishedAt: finishedAt,
          status: ProductionOrderStatus.finished,
          costingMethodSnapshot: CostingMethod.fifo,
          overheadPercent: overheadPercent,
          packagingCostPerOutputUnit: packagingCost / actualQty,
          totalMaterialCost: materialCost,
          totalPackagingCost: packagingCost,
          totalOverheadCost: overheadCost,
          totalCost: totalCost,
          unitCost: unitCost,
          batchCode: `BATCH-${String(orderDate.getFullYear()).slice(-2)}${String(orderDate.getMonth() + 1).padStart(2, '0')}-${String(i + 1).padStart(3, '0')}`,
          storeId: mainStore.id,
          createdAt: orderDate,
          updatedAt: finishedAt,
        },
      });
      productionOrders.push(order);
    } catch (error) {
      console.error(`Erro ao criar ordem de produção ${i + 1}:`, error);
    }
  }

  console.log(`✅ ${productionOrders.length} ordens de produção criadas`);

  // 3. CRIAR ALGUMAS ORDENS EM PROGRESSO
  console.log('\n⏳ Criando ordens em progresso...');

  for (let i = 0; i < 3; i++) {
    const product = products[i % products.length];
    const startedAt = new Date(now);
    startedAt.setHours(8 - i, 0, 0, 0); // Iniciadas em horários diferentes hoje

    const plannedQty = Math.floor(Math.random() * 300) + 100;

    try {
      await prisma.productionOrder.create({
        data: {
          productId: product.id,
          plannedOutputQty: plannedQty,
          plannedUnit: Unit.un,
          startedAt: startedAt,
          status: ProductionOrderStatus.in_progress,
          costingMethodSnapshot: CostingMethod.fifo,
          overheadPercent: 10,
          packagingCostPerOutputUnit: 0.3,
          storeId: mainStore.id,
          createdAt: startedAt,
          updatedAt: startedAt,
        },
      });
    } catch (error) {
      console.error(`Erro ao criar ordem em progresso ${i + 1}:`, error);
    }
  }

  console.log(`✅ 3 ordens em progresso criadas`);

  // RESUMO FINAL
  console.log('\n📊 RESUMO DOS DADOS FINANCEIROS CRIADOS:');
  console.log('=====================================');

  const totalFixedCosts = await prisma.fixedCost.count({
    where: { storeId: mainStore.id },
  });
  console.log(`💰 Custos Fixos: ${totalFixedCosts}`);

  const costsSummary = await prisma.fixedCost.findMany({
    where: { storeId: mainStore.id, isActive: true },
  });

  let totalDaily = 0;
  let totalMonthly = 0;
  let totalYearly = 0;

  for (const cost of costsSummary) {
    const amount = Number(cost.amount);
    switch (cost.frequency) {
      case FixedCostFrequency.daily:
        totalDaily += amount;
        totalMonthly += amount * 30;
        totalYearly += amount * 365;
        break;
      case FixedCostFrequency.monthly:
        totalDaily += amount / 30;
        totalMonthly += amount;
        totalYearly += amount * 12;
        break;
      case FixedCostFrequency.yearly:
        totalDaily += amount / 365;
        totalMonthly += amount / 12;
        totalYearly += amount;
        break;
    }
  }

  console.log(`   └─ Custo Diário: R$ ${totalDaily.toFixed(2)}`);
  console.log(`   └─ Custo Mensal: R$ ${totalMonthly.toFixed(2)}`);
  console.log(`   └─ Custo Anual: R$ ${totalYearly.toFixed(2)}`);

  const totalProductionOrders = await prisma.productionOrder.count({
    where: { storeId: mainStore.id },
  });
  console.log(`🏭 Ordens de Produção: ${totalProductionOrders}`);

  const finishedOrders = await prisma.productionOrder.count({
    where: { storeId: mainStore.id, status: ProductionOrderStatus.finished },
  });
  console.log(`   └─ Finalizadas: ${finishedOrders}`);

  const inProgressOrders = await prisma.productionOrder.count({
    where: { storeId: mainStore.id, status: ProductionOrderStatus.in_progress },
  });
  console.log(`   └─ Em Progresso: ${inProgressOrders}`);

  // Calcular custo médio por unidade
  const avgCostResult = await prisma.productionOrder.aggregate({
    where: {
      storeId: mainStore.id,
      status: ProductionOrderStatus.finished,
      unitCost: { not: null },
    },
    _avg: { unitCost: true },
  });

  const avgCostPerUnit = Number(avgCostResult._avg.unitCost || 0);
  console.log(`📊 Custo Médio por Unidade: R$ ${avgCostPerUnit.toFixed(4)}`);

  console.log('\n✅ Seed de dados financeiros concluído com sucesso!');
  console.log('\n🔐 Acesse a tela de Financeiro:');
  console.log('   URL: http://localhost:5173/financeiro');
}

main()
  .catch((e) => {
    console.error('❌ Erro ao executar seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
