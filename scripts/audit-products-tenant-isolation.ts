/**
 * Script de auditoria: isolamento multi-tenant de produtos
 *
 * - Lista produtos sem store_id (NULL) no banco (dados sujos de migrations antigas)
 * - Conta produtos por loja
 * - Útil para validar que nenhum produto "vaza" entre lojas
 *
 * Uso: npx ts-node scripts/audit-products-tenant-isolation.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Auditoria de isolamento multi-tenant (produtos)\n');

  // 1. Produtos sem storeId (via raw: no Prisma o campo é obrigatório, mas no banco pode ser nullable)
  // Coluna na tabela products é "storeId" (camelCase) desde a migration add_payment_method_to_orders
  const rawProductsWithoutStore = await prisma.$queryRaw<
    Array<{ id: string; name: string; storeId: string | null }>
  >`
    SELECT id, name, "storeId"
    FROM products
    WHERE "storeId" IS NULL
  `;

  if (rawProductsWithoutStore.length > 0) {
    console.log('❌ PRODUTOS SEM STORE_ID (violação de multi-tenant):');
    console.log(`   Total: ${rawProductsWithoutStore.length}`);
    rawProductsWithoutStore.slice(0, 10).forEach((p) => {
      console.log(`   - ${p.id} | ${p.name}`);
    });
    if (rawProductsWithoutStore.length > 10) {
      console.log(`   ... e mais ${rawProductsWithoutStore.length - 10}`);
    }
    console.log('');
  } else {
    console.log('✅ Nenhum produto com store_id NULL encontrado.\n');
  }

  // 2. Contagem por loja
  const byStore = await prisma.product.groupBy({
    by: ['storeId'],
    _count: { id: true },
  });

  const byStoreSorted = [...byStore].sort((a, b) => b._count.id - a._count.id);

  console.log('📊 Produtos por loja:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  for (const row of byStoreSorted) {
    const store = await prisma.store.findUnique({
      where: { id: row.storeId },
      select: { name: true },
    });
    console.log(`   ${row.storeId} (${store?.name ?? 'N/A'}): ${row._count.id} produtos`);
  }
  console.log('');

  const totalProducts = await prisma.product.count();
  const totalStores = await prisma.store.count();
  console.log(`Total: ${totalProducts} produtos em ${totalStores} lojas.\n`);

  if (rawProductsWithoutStore.length > 0) {
    console.log('⚠️ AÇÃO: Corrija ou remova produtos sem store_id antes de considerar o isolamento correto.');
    process.exit(1);
  }

  console.log('✅ Auditoria concluída. Isolamento por store_id está consistente no banco.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
