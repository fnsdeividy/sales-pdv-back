import { PrismaClient, Product, OrderItem } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de dados de caixa...');

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

  // Data de hoje
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 1. CRIAR TRANSAÇÃO DE ABERTURA DE CAIXA (hoje)
  console.log('\n💰 Criando transação de abertura de caixa...');
  
  const openingAmount = 500.00; // R$ 500,00 de abertura
  
  try {
    await prisma.transaction.create({
      data: {
        type: 'income',
        category: 'Caixa',
        description: 'Abertura de caixa',
        amount: openingAmount,
        date: today,
        reference: `ABERTURA-${today.toISOString().split('T')[0]}`,
        storeId: mainStore.id,
        userId: cassioUser.id,
        notes: 'Abertura de caixa do dia',
        createdAt: new Date(today.getTime() + 8 * 60 * 60 * 1000), // 8h da manhã
        updatedAt: new Date(today.getTime() + 8 * 60 * 60 * 1000),
      },
    });
    console.log(`✅ Abertura de caixa criada: R$ ${openingAmount.toFixed(2)}`);
  } catch (error: any) {
    if (error.code !== 'P2002') {
      console.log(`   ⚠️  Abertura de caixa já existe ou erro: ${error.message}`);
    }
  }

  // 2. CRIAR TRANSAÇÕES DE ENTRADA (hoje)
  console.log('\n💵 Criando transações de entrada...');
  
  const incomeTransactions = [
    {
      description: 'Recebimento de cliente - Pagamento pendente',
      category: 'Recebimento',
      amount: 350.00,
      notes: 'Cliente João Silva',
    },
    {
      description: 'Reembolso de fornecedor',
      category: 'Reembolso',
      amount: 120.00,
      notes: 'Devolução de mercadoria',
    },
    {
      description: 'Recebimento de comissão',
      category: 'Comissão',
      amount: 85.50,
      notes: 'Comissão de vendas',
    },
    {
      description: 'Recebimento de aluguel de equipamento',
      category: 'Aluguel',
      amount: 200.00,
      notes: 'Aluguel de máquina',
    },
  ];

  let createdIncomes = 0;
  for (let i = 0; i < incomeTransactions.length; i++) {
    const transaction = incomeTransactions[i];
    const transactionDate = new Date(today);
    transactionDate.setHours(9 + i * 2, Math.floor(Math.random() * 60), 0, 0); // Entre 9h e 17h

    try {
      await prisma.transaction.create({
        data: {
          type: 'income',
          category: transaction.category,
          description: transaction.description,
          amount: transaction.amount,
          date: transactionDate,
          reference: `ENT-${today.toISOString().split('T')[0]}-${i + 1}`,
          storeId: mainStore.id,
          userId: cassioUser.id,
          notes: transaction.notes,
          createdAt: transactionDate,
          updatedAt: transactionDate,
        },
      });
      createdIncomes++;
    } catch (error: any) {
      if (error.code !== 'P2002') {
        console.error(`Erro ao criar transação de entrada ${i + 1}:`, error);
      }
    }
  }

  console.log(`✅ ${createdIncomes} transações de entrada criadas`);

  // 3. CRIAR TRANSAÇÕES DE SAÍDA (hoje)
  console.log('\n💸 Criando transações de saída...');
  
  const expenseTransactions = [
    {
      description: 'Saída de caixa: Pagamento fornecedor',
      category: 'Saída',
      amount: 280.00,
      notes: 'Pagamento de produtos',
    },
    {
      description: 'Saída de caixa: Despesas operacionais',
      category: 'Saída',
      amount: 45.00,
      notes: 'Material de limpeza',
    },
    {
      description: 'Sangria: Excesso de dinheiro',
      category: 'Sangria',
      amount: 300.00,
      notes: 'Sangria para segurança',
    },
    {
      description: 'Saída de caixa: Pagamento de frete',
      category: 'Saída',
      amount: 65.00,
      notes: 'Frete de entrega',
    },
    {
      description: 'Saída de caixa: Troco para cliente',
      category: 'Saída',
      amount: 15.50,
      notes: 'Troco de venda',
    },
  ];

  let createdExpenses = 0;
  for (let i = 0; i < expenseTransactions.length; i++) {
    const transaction = expenseTransactions[i];
    const transactionDate = new Date(today);
    transactionDate.setHours(10 + i * 2, Math.floor(Math.random() * 60), 0, 0); // Entre 10h e 18h

    try {
      await prisma.transaction.create({
        data: {
          type: 'expense',
          category: transaction.category,
          description: transaction.description,
          amount: transaction.amount,
          date: transactionDate,
          reference: `SAIDA-${today.toISOString().split('T')[0]}-${i + 1}`,
          storeId: mainStore.id,
          userId: cassioUser.id,
          notes: transaction.notes,
          createdAt: transactionDate,
          updatedAt: transactionDate,
        },
      });
      createdExpenses++;
    } catch (error: any) {
      if (error.code !== 'P2002') {
        console.error(`Erro ao criar transação de saída ${i + 1}:`, error);
      }
    }
  }

  console.log(`✅ ${createdExpenses} transações de saída criadas`);

  // 4. CRIAR VENDAS PARA HOJE (com diferentes métodos de pagamento)
  console.log('\n🛒 Criando vendas para hoje...');
  
  const customers = await prisma.customer.findMany({
    where: { storeId: mainStore.id },
    take: 10,
  });

  if (customers.length === 0) {
    console.log('⚠️  Nenhum cliente encontrado. Criando vendas sem cliente específico...');
  }

  const products = await prisma.product.findMany({
    where: { storeId: mainStore.id },
    take: 5,
  });

  if (products.length === 0) {
    console.error('❌ Nenhum produto encontrado.');
    process.exit(1);
  }

  const paymentMethods = ['cash', 'credit_card', 'debit_card', 'pix'];
  let orderNumber = 2000;
  let createdSales = 0;

  // Criar 15 vendas para hoje
  for (let i = 0; i < 15; i++) {
    orderNumber++;
    const customer = customers.length > 0 ? customers[i % customers.length] : null;
    const paymentMethod = paymentMethods[i % paymentMethods.length];
    
    // Hora aleatória entre 8h e 20h
    const saleDate = new Date(today);
    saleDate.setHours(8 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60), 0, 0);

    // Selecionar 1-3 produtos
    const numProducts = Math.floor(Math.random() * 3) + 1;
    const selectedProducts: Product[] = [];
    const usedProducts = new Set<string>();

    while (selectedProducts.length < numProducts) {
      const product = products[Math.floor(Math.random() * products.length)];
      if (!usedProducts.has(product.id)) {
        usedProducts.add(product.id);
        selectedProducts.push(product);
      }
    }

    // Calcular total
    let total = 0;
    const orderItems: Array<{
      productId: string;
      productName: string;
      quantity: number;
      unitPrice: any;
      discount: number;
      total: number;
    }> = [];

    for (const product of selectedProducts) {
      const quantity = Math.floor(Math.random() * 5) + 1;
      const unitPrice = Number(product.price);
      const itemTotal = unitPrice * quantity;
      total += itemTotal;

      orderItems.push({
        productId: product.id,
        productName: product.name,
        quantity: quantity,
        unitPrice: product.price,
        discount: 0,
        total: itemTotal,
      });
    }

    const tax = total * 0.05;
    const totalComTaxa = total + tax;

    try {
      // Usar cliente padrão se não houver clientes
      let customerId = customer?.id;
      if (!customerId) {
        const defaultCustomer = await prisma.customer.findFirst({
          where: { storeId: mainStore.id },
        });
        customerId = defaultCustomer?.id;
      }

      if (!customerId) {
        console.log(`⚠️  Pulando venda ${orderNumber} - nenhum cliente disponível`);
        continue;
      }

      const order = await prisma.order.create({
        data: {
          orderNumber: `ORD-${orderNumber}`,
          customerId: customerId,
          storeId: mainStore.id,
          total: totalComTaxa,
          tax: tax,
          status: 'completed',
          paymentMethod: paymentMethod,
          notes: `Venda do dia ${today.toLocaleDateString('pt-BR')}`,
          createdAt: saleDate,
          updatedAt: saleDate,
        },
      });

      // Criar itens do pedido
      for (const item of orderItems) {
        await prisma.orderItem.create({
          data: {
            orderId: order.id,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            total: item.total,
            createdAt: saleDate,
          },
        });
      }

      createdSales++;
    } catch (error) {
      console.error(`Erro ao criar venda ${orderNumber}:`, error);
    }
  }

  console.log(`✅ ${createdSales} vendas criadas para hoje`);

  // 5. CRIAR TRANSAÇÕES DE DIAS ANTERIORES (últimos 7 dias)
  console.log('\n📅 Criando transações de dias anteriores...');

  for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
    const date = new Date(today);
    date.setDate(date.getDate() - dayOffset);
    date.setHours(0, 0, 0, 0);

    // Abertura de caixa
    const openingDate = new Date(date);
    openingDate.setHours(8, 0, 0, 0);

    try {
      await prisma.transaction.create({
        data: {
          type: 'income',
          category: 'Caixa',
          description: 'Abertura de caixa',
          amount: 500.00,
          date: date,
          reference: `ABERTURA-${date.toISOString().split('T')[0]}`,
          storeId: mainStore.id,
          userId: cassioUser.id,
          notes: `Abertura de caixa do dia ${date.toLocaleDateString('pt-BR')}`,
          createdAt: openingDate,
          updatedAt: openingDate,
        },
      });
    } catch (error: any) {
      // Ignorar se já existir
    }

    // Algumas transações aleatórias
    const numTransactions = Math.floor(Math.random() * 5) + 2; // 2-6 transações por dia

    for (let i = 0; i < numTransactions; i++) {
      const isIncome = Math.random() > 0.4; // 60% de chance de ser entrada
      const transactionDate = new Date(date);
      transactionDate.setHours(9 + i * 2, Math.floor(Math.random() * 60), 0, 0);

      const amount = Math.random() * 300 + 50; // R$ 50-350

      const categories = isIncome
        ? ['Recebimento', 'Reembolso', 'Comissão', 'Aluguel']
        : ['Saída', 'Despesa', 'Sangria'];

      const descriptions = isIncome
        ? [
            'Recebimento de cliente',
            'Reembolso de fornecedor',
            'Recebimento de comissão',
            'Recebimento de aluguel',
          ]
        : [
            'Saída de caixa: Pagamento fornecedor',
            'Saída de caixa: Despesas operacionais',
            'Sangria: Excesso de dinheiro',
            'Saída de caixa: Pagamento de frete',
          ];

      const category = categories[Math.floor(Math.random() * categories.length)];
      const description = descriptions[Math.floor(Math.random() * descriptions.length)];

      try {
        await prisma.transaction.create({
          data: {
            type: isIncome ? 'income' : 'expense',
            category: category,
            description: description,
            amount: amount,
            date: date,
            reference: `${isIncome ? 'ENT' : 'SAIDA'}-${date.toISOString().split('T')[0]}-${i + 1}`,
            storeId: mainStore.id,
            userId: cassioUser.id,
            notes: `Transação do dia ${date.toLocaleDateString('pt-BR')}`,
            createdAt: transactionDate,
            updatedAt: transactionDate,
          },
        });
      } catch (error: any) {
        // Ignorar erros de duplicação
      }
    }
  }

  console.log(`✅ Transações dos últimos 7 dias criadas`);

  // RESUMO FINAL
  console.log('\n📊 RESUMO DOS DADOS DE CAIXA CRIADOS:');
  console.log('=====================================');

  const todayTransactions = await prisma.transaction.findMany({
    where: {
      storeId: mainStore.id,
      date: {
        gte: today,
        lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      },
    },
  });

  const todayIncomes = todayTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const todayExpenses = todayTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const todaySales = await prisma.order.findMany({
    where: {
      storeId: mainStore.id,
      status: 'completed',
      createdAt: {
        gte: today,
        lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      },
    },
  });

  const totalSales = todaySales.reduce((sum, sale) => sum + Number(sale.total), 0);

  const salesByPayment = todaySales.reduce((acc, sale) => {
    acc[sale.paymentMethod] = (acc[sale.paymentMethod] || 0) + Number(sale.total);
    return acc;
  }, {} as Record<string, number>);

  console.log(`📅 Data: ${today.toLocaleDateString('pt-BR')}`);
  console.log(`💰 Transações de hoje: ${todayTransactions.length}`);
  console.log(`   └─ Entradas: R$ ${todayIncomes.toFixed(2)}`);
  console.log(`   └─ Saídas: R$ ${todayExpenses.toFixed(2)}`);
  console.log(`🛒 Vendas de hoje: ${todaySales.length}`);
  console.log(`   └─ Total: R$ ${totalSales.toFixed(2)}`);
  console.log(`   └─ Dinheiro: R$ ${(salesByPayment.cash || 0).toFixed(2)}`);
  console.log(`   └─ Cartão: R$ ${((salesByPayment.credit_card || 0) + (salesByPayment.debit_card || 0)).toFixed(2)}`);
  console.log(`   └─ PIX: R$ ${(salesByPayment.pix || 0).toFixed(2)}`);

  const expectedCash = openingAmount + (salesByPayment.cash || 0) + todayIncomes - todayExpenses;
  console.log(`💵 Saldo Esperado: R$ ${expectedCash.toFixed(2)}`);

  console.log('\n✅ Seed de dados de caixa concluído com sucesso!');
  console.log('\n🔐 Acesse a tela de Caixa:');
  console.log('   URL: http://localhost:5173/caixa');
}

main()
  .catch((e) => {
    console.error('❌ Erro ao executar seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
