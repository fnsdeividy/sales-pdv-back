import { PrismaClient, Customer, Product } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de dados de massa...');

  // Buscar o usuário Cassio e a loja principal
  const cassioUser = await prisma.user.findUnique({
    where: { email: 'cassiobrr@gmail.com' },
  });

  if (!cassioUser) {
    console.error('❌ Usuário Cassio não encontrado. Execute o seed principal primeiro.');
    process.exit(1);
  }

  const mainStore = await prisma.store.findFirst({
    where: { name: 'Loja Principal' },
  });

  if (!mainStore) {
    console.error('❌ Loja Principal não encontrada. Execute o seed principal primeiro.');
    process.exit(1);
  }

  console.log(`✅ Usuário: ${cassioUser.email}`);
  console.log(`✅ Loja: ${mainStore.name} (${mainStore.id})`);

  // Buscar produtos existentes
  const products = await prisma.product.findMany({
    where: { storeId: mainStore.id },
  });

  if (products.length === 0) {
    console.error('❌ Nenhum produto encontrado. Execute o seed principal primeiro.');
    process.exit(1);
  }

  console.log(`✅ Produtos encontrados: ${products.length}`);

  // 1. CRIAR CLIENTES (30 clientes)
  console.log('\n📊 Criando clientes...');
  const clientesNomes = [
    { firstName: 'João', lastName: 'Silva' },
    { firstName: 'Maria', lastName: 'Santos' },
    { firstName: 'Pedro', lastName: 'Oliveira' },
    { firstName: 'Ana', lastName: 'Costa' },
    { firstName: 'Carlos', lastName: 'Ferreira' },
    { firstName: 'Juliana', lastName: 'Almeida' },
    { firstName: 'Ricardo', lastName: 'Pereira' },
    { firstName: 'Fernanda', lastName: 'Lima' },
    { firstName: 'Paulo', lastName: 'Rodrigues' },
    { firstName: 'Beatriz', lastName: 'Martins' },
    { firstName: 'Lucas', lastName: 'Souza' },
    { firstName: 'Camila', lastName: 'Carvalho' },
    { firstName: 'Rafael', lastName: 'Ribeiro' },
    { firstName: 'Patrícia', lastName: 'Gomes' },
    { firstName: 'Bruno', lastName: 'Barbosa' },
    { firstName: 'Amanda', lastName: 'Araújo' },
    { firstName: 'Rodrigo', lastName: 'Monteiro' },
    { firstName: 'Gabriela', lastName: 'Cardoso' },
    { firstName: 'Marcos', lastName: 'Nascimento' },
    { firstName: 'Larissa', lastName: 'Moura' },
    { firstName: 'Thiago', lastName: 'Dias' },
    { firstName: 'Vanessa', lastName: 'Freitas' },
    { firstName: 'Felipe', lastName: 'Castro' },
    { firstName: 'Renata', lastName: 'Correia' },
    { firstName: 'Diego', lastName: 'Azevedo' },
    { firstName: 'Cristina', lastName: 'Rocha' },
    { firstName: 'Gustavo', lastName: 'Barros' },
    { firstName: 'Priscila', lastName: 'Teixeira' },
    { firstName: 'André', lastName: 'Melo' },
    { firstName: 'Daniela', lastName: 'Vieira' },
  ];

  const clientes: Customer[] = [];
  for (let i = 0; i < clientesNomes.length; i++) {
    const cliente = clientesNomes[i];
    const email = `${cliente.firstName.toLowerCase()}.${cliente.lastName.toLowerCase()}@email.com`;
    
    const novoCliente = await prisma.customer.create({
      data: {
        firstName: cliente.firstName,
        lastName: cliente.lastName,
        email: email,
        phone: `+55 11 9${String(Math.floor(Math.random() * 90000000) + 10000000)}`,
        address: `Rua ${cliente.lastName}, ${Math.floor(Math.random() * 500) + 1}`,
        city: 'São Paulo',
        state: 'SP',
        zipCode: `${String(Math.floor(Math.random() * 90000) + 10000)}-000`,
        isActive: true,
        storeId: mainStore.id,
      },
    });
    clientes.push(novoCliente);
  }

  console.log(`✅ ${clientes.length} clientes criados`);

  // 2. CRIAR ESTOQUE PARA OS PRODUTOS
  console.log('\n📦 Criando estoque...');
  for (const product of products) {
    const quantity = Math.floor(Math.random() * 150) + 50; // Entre 50 e 200 unidades
    await prisma.stock.upsert({
      where: {
        productId_storeId: {
          productId: product.id,
          storeId: mainStore.id,
        },
      },
      update: {
        quantity: quantity,
        minQuantity: 10,
        maxQuantity: 200,
      },
      create: {
        productId: product.id,
        storeId: mainStore.id,
        quantity: quantity,
        minQuantity: 10,
        maxQuantity: 200,
        location: `Prateleira ${String.fromCharCode(65 + Math.floor(Math.random() * 5))}-${Math.floor(Math.random() * 20) + 1}`,
      },
    });
  }

  console.log(`✅ Estoque criado para ${products.length} produtos`);

  // 3. CRIAR VENDAS (50 vendas - 40 concluídas e 10 pendentes)
  console.log('\n💰 Criando vendas...');
  const vendasConcluidas = 40;
  const vendasPendentes = 10;
  let orderNumber = 1000;

  // Vendas concluídas (últimos 30 dias)
  for (let i = 0; i < vendasConcluidas; i++) {
    orderNumber++;
    const cliente = clientes[Math.floor(Math.random() * clientes.length)];
    
    // Data aleatória nos últimos 30 dias
    const daysAgo = Math.floor(Math.random() * 30);
    const orderDate = new Date();
    orderDate.setDate(orderDate.getDate() - daysAgo);

    // Selecionar 1-4 produtos aleatórios para a venda
    const numProdutos = Math.floor(Math.random() * 4) + 1;
    const produtosVenda: Product[] = [];
    const produtosUsados = new Set<string>();

    while (produtosVenda.length < numProdutos) {
      const produto = products[Math.floor(Math.random() * products.length)];
      if (!produtosUsados.has(produto.id)) {
        produtosUsados.add(produto.id);
        produtosVenda.push(produto);
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

    for (const produto of produtosVenda) {
      const quantity = Math.floor(Math.random() * 5) + 1; // 1-5 unidades
      const discount = Math.random() > 0.7 ? Math.random() * 10 : 0; // 30% de chance de desconto
      const unitPrice = Number(produto.price);
      const itemTotal = (unitPrice * quantity) * (1 - discount / 100);
      
      total += itemTotal;

      orderItems.push({
        productId: produto.id,
        productName: produto.name,
        quantity: quantity,
        unitPrice: produto.price,
        discount: discount,
        total: itemTotal,
      });
    }

    const tax = total * 0.05; // 5% de taxa
    const totalComTaxa = total + tax;

    // Criar pedido
    const order = await prisma.order.create({
      data: {
        orderNumber: `ORD-${orderNumber}`,
        customerId: cliente.id,
        storeId: mainStore.id,
        total: totalComTaxa,
        tax: tax,
        status: 'completed',
        paymentMethod: ['cash', 'credit_card', 'debit_card', 'pix'][Math.floor(Math.random() * 4)],
        notes: Math.random() > 0.8 ? 'Entrega urgente' : null,
        createdAt: orderDate,
        updatedAt: orderDate,
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
          createdAt: orderDate,
        },
      });
    }

    // Criar transação de receita
    await prisma.transaction.create({
      data: {
        type: 'income',
        category: 'Venda',
        description: `Venda ${order.orderNumber} - ${cliente.firstName} ${cliente.lastName}`,
        amount: totalComTaxa,
        date: orderDate,
        reference: order.orderNumber,
        storeId: mainStore.id,
        userId: cassioUser.id,
        notes: `Pagamento: ${order.paymentMethod}`,
        createdAt: orderDate,
        updatedAt: orderDate,
      },
    });
  }

  console.log(`✅ ${vendasConcluidas} vendas concluídas criadas`);

  // Vendas pendentes (hoje)
  for (let i = 0; i < vendasPendentes; i++) {
    orderNumber++;
    const cliente = clientes[Math.floor(Math.random() * clientes.length)];
    
    const orderDate = new Date();

    const numProdutos = Math.floor(Math.random() * 3) + 1;
    const produtosVenda: Product[] = [];
    const produtosUsados = new Set<string>();

    while (produtosVenda.length < numProdutos) {
      const produto = products[Math.floor(Math.random() * products.length)];
      if (!produtosUsados.has(produto.id)) {
        produtosUsados.add(produto.id);
        produtosVenda.push(produto);
      }
    }

    let total = 0;
    const orderItems: Array<{
      productId: string;
      productName: string;
      quantity: number;
      unitPrice: any;
      discount: number;
      total: number;
    }> = [];

    for (const produto of produtosVenda) {
      const quantity = Math.floor(Math.random() * 3) + 1;
      const unitPrice = Number(produto.price);
      const itemTotal = unitPrice * quantity;
      
      total += itemTotal;

      orderItems.push({
        productId: produto.id,
        productName: produto.name,
        quantity: quantity,
        unitPrice: produto.price,
        discount: 0,
        total: itemTotal,
      });
    }

    const tax = total * 0.05;
    const totalComTaxa = total + tax;

    const order = await prisma.order.create({
      data: {
        orderNumber: `ORD-${orderNumber}`,
        customerId: cliente.id,
        storeId: mainStore.id,
        total: totalComTaxa,
        tax: tax,
        status: 'pending',
        paymentMethod: 'cash',
        notes: 'Aguardando confirmação',
        createdAt: orderDate,
        updatedAt: orderDate,
      },
    });

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
          createdAt: orderDate,
        },
      });
    }
  }

  console.log(`✅ ${vendasPendentes} vendas pendentes criadas`);

  // 4. CRIAR TRANSAÇÕES DE DESPESAS
  console.log('\n💸 Criando transações de despesas...');
  const despesas = [
    { category: 'Aluguel', description: 'Aluguel da loja - Janeiro 2026', amount: 3500 },
    { category: 'Energia', description: 'Conta de luz - Janeiro 2026', amount: 450 },
    { category: 'Água', description: 'Conta de água - Janeiro 2026', amount: 180 },
    { category: 'Internet', description: 'Internet e telefone - Janeiro 2026', amount: 220 },
    { category: 'Salários', description: 'Folha de pagamento - Janeiro 2026', amount: 8500 },
    { category: 'Fornecedor', description: 'Compra de produtos de limpeza', amount: 2800 },
    { category: 'Manutenção', description: 'Manutenção do ar condicionado', amount: 350 },
    { category: 'Marketing', description: 'Anúncios nas redes sociais', amount: 600 },
    { category: 'Limpeza', description: 'Serviço de limpeza mensal', amount: 400 },
    { category: 'Contabilidade', description: 'Honorários contábeis', amount: 800 },
  ];

  for (const despesa of despesas) {
    // Data aleatória nos últimos 20 dias
    const daysAgo = Math.floor(Math.random() * 20);
    const transactionDate = new Date();
    transactionDate.setDate(transactionDate.getDate() - daysAgo);

    await prisma.transaction.create({
      data: {
        type: 'expense',
        category: despesa.category,
        description: despesa.description,
        amount: despesa.amount,
        date: transactionDate,
        reference: `DEP-${Math.floor(Math.random() * 9000) + 1000}`,
        storeId: mainStore.id,
        userId: cassioUser.id,
        createdAt: transactionDate,
        updatedAt: transactionDate,
      },
    });
  }

  console.log(`✅ ${despesas.length} transações de despesas criadas`);

  // 5. CRIAR TRANSAÇÕES DE RECEITA DIVERSAS
  console.log('\n💵 Criando transações de receitas diversas...');
  const receitasDiversas = [
    { category: 'Serviços', description: 'Consultoria em limpeza industrial', amount: 1200 },
    { category: 'Aluguel de Equipamento', description: 'Aluguel de máquina lavadora', amount: 350 },
    { category: 'Treinamento', description: 'Treinamento de equipe de limpeza', amount: 800 },
  ];

  for (const receita of receitasDiversas) {
    const daysAgo = Math.floor(Math.random() * 25);
    const transactionDate = new Date();
    transactionDate.setDate(transactionDate.getDate() - daysAgo);

    await prisma.transaction.create({
      data: {
        type: 'income',
        category: receita.category,
        description: receita.description,
        amount: receita.amount,
        date: transactionDate,
        reference: `REC-${Math.floor(Math.random() * 9000) + 1000}`,
        storeId: mainStore.id,
        userId: cassioUser.id,
        createdAt: transactionDate,
        updatedAt: transactionDate,
      },
    });
  }

  console.log(`✅ ${receitasDiversas.length} transações de receitas diversas criadas`);

  // RESUMO FINAL
  console.log('\n📊 RESUMO DOS DADOS CRIADOS:');
  console.log('=====================================');

  const totalClientes = await prisma.customer.count({
    where: { storeId: mainStore.id },
  });
  console.log(`👥 Clientes: ${totalClientes}`);

  const clientesNovos = await prisma.customer.count({
    where: {
      storeId: mainStore.id,
      createdAt: {
        gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      },
    },
  });
  console.log(`   └─ Novos este mês: ${clientesNovos}`);

  const totalProdutos = await prisma.product.count({
    where: { storeId: mainStore.id },
  });
  console.log(`📦 Produtos: ${totalProdutos}`);

  const totalEstoque = await prisma.stock.aggregate({
    where: { storeId: mainStore.id },
    _sum: { quantity: true },
  });
  console.log(`   └─ Unidades em estoque: ${totalEstoque._sum.quantity || 0}`);

  const totalVendas = await prisma.order.count({
    where: { storeId: mainStore.id },
  });
  console.log(`💰 Vendas: ${totalVendas}`);

  const vendasCompletas = await prisma.order.count({
    where: { storeId: mainStore.id, status: 'completed' },
  });
  console.log(`   └─ Concluídas: ${vendasCompletas}`);

  const vendasPendentesFinal = await prisma.order.count({
    where: { storeId: mainStore.id, status: 'pending' },
  });
  console.log(`   └─ Pendentes: ${vendasPendentesFinal}`);

  const receitaTotal = await prisma.order.aggregate({
    where: {
      storeId: mainStore.id,
      status: 'completed',
      createdAt: {
        gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      },
    },
    _sum: { total: true },
  });
  console.log(`💵 Receita Total (mês): R$ ${Number(receitaTotal._sum.total || 0).toFixed(2)}`);

  const ticketMedio = await prisma.order.aggregate({
    where: {
      storeId: mainStore.id,
      status: 'completed',
    },
    _avg: { total: true },
  });
  console.log(`🎫 Ticket Médio: R$ ${Number(ticketMedio._avg.total || 0).toFixed(2)}`);

  const fluxoReceitas = await prisma.transaction.aggregate({
    where: {
      storeId: mainStore.id,
      type: 'income',
      date: {
        gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      },
    },
    _sum: { amount: true },
  });

  const fluxoDespesas = await prisma.transaction.aggregate({
    where: {
      storeId: mainStore.id,
      type: 'expense',
      date: {
        gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      },
    },
    _sum: { amount: true },
  });

  const fluxoLiquido = Number(fluxoReceitas._sum.amount || 0) - Number(fluxoDespesas._sum.amount || 0);
  console.log(`💰 Fluxo de Caixa Líquido (mês): R$ ${fluxoLiquido.toFixed(2)}`);
  console.log(`   └─ Receitas: R$ ${Number(fluxoReceitas._sum.amount || 0).toFixed(2)}`);
  console.log(`   └─ Despesas: R$ ${Number(fluxoDespesas._sum.amount || 0).toFixed(2)}`);

  // Calcular valor do estoque
  const estoquesComProduto = await prisma.stock.findMany({
    where: { storeId: mainStore.id },
    include: { product: true },
  });

  let valorEstoque = 0;
  for (const estoque of estoquesComProduto) {
    valorEstoque += estoque.quantity * Number(estoque.product.price);
  }
  console.log(`📊 Valor do Estoque: R$ ${valorEstoque.toFixed(2)}`);

  console.log('\n✅ Seed de dados de massa concluído com sucesso!');
  console.log('\n🔐 Acesse com:');
  console.log('   Email: cassiobrr@gmail.com');
  console.log('   Senha: admin123');
  console.log('   URL: http://localhost:5173/dashboard');
}

main()
  .catch((e) => {
    console.error('❌ Erro ao executar seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
