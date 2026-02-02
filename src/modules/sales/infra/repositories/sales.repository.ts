import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@modules/prisma/prisma.service';
import { Sale, SaleItem } from '@modules/sales/entities/sale.entity';
import { ISalesRepository } from '@modules/sales/presentation/interfaces/sales.interface';

@Injectable()
export class SalesRepository implements ISalesRepository {
  constructor(private readonly prisma: PrismaService) { }

  async findAll(page: number, limit: number, storeId?: string): Promise<{ sales: Sale[]; total: number; totalPages: number }> {
    if (!storeId) {
      throw new NotFoundException('Store ID is required');
    }

    const skip = (page - 1) * limit;

    const [sales, total] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          storeId: storeId,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          orderItems: true,
          customer: true,
          store: true,
        },
      }),
      this.prisma.order.count({
        where: {
          storeId: storeId,
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      sales: sales.map(this.mapPrismaOrderToSale),
      total,
      totalPages,
    };
  }

  async findById(id: string, storeId?: string): Promise<Sale | null> {
    if (!storeId) {
      throw new NotFoundException('Store ID is required');
    }

    const order = await this.prisma.order.findFirst({
      where: {
        id,
        storeId: storeId,
      },
      include: {
        orderItems: true,
        customer: true,
        store: true,
      },
    });

    return order ? this.mapPrismaOrderToSale(order) : null;
  }

  async findByOrderNumber(orderNumber: string, storeId?: string): Promise<Sale | null> {
    if (!storeId) {
      throw new NotFoundException('Store ID is required');
    }

    const order = await this.prisma.order.findFirst({
      where: {
        orderNumber,
        storeId: storeId,
      },
      include: {
        orderItems: true,
        customer: true,
        store: true,
      },
    });

    return order ? this.mapPrismaOrderToSale(order) : null;
  }

  async findByCustomerId(customerId: string, page: number, limit: number, storeId?: string): Promise<{ sales: Sale[]; total: number; totalPages: number }> {
    if (!storeId) {
      throw new NotFoundException('Store ID is required');
    }

    const skip = (page - 1) * limit;

    const [sales, total] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          customerId,
          storeId: storeId,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          orderItems: true,
          customer: true,
          store: true,
        },
      }),
      this.prisma.order.count({
        where: {
          customerId,
          storeId: storeId,
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      sales: sales.map(this.mapPrismaOrderToSale),
      total,
      totalPages,
    };
  }

  async findByStoreId(storeId: string, page: number, limit: number): Promise<{ sales: Sale[]; total: number; totalPages: number }> {
    const skip = (page - 1) * limit;

    const [sales, total] = await Promise.all([
      this.prisma.order.findMany({
        where: { storeId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          orderItems: true,
          customer: true,
          store: true,
        },
      }),
      this.prisma.order.count({ where: { storeId } }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      sales: sales.map(this.mapPrismaOrderToSale),
      total,
      totalPages,
    };
  }

  async create(data: Partial<Sale>): Promise<Sale> {
    // Gerar orderNumber se não fornecido
    const orderNumber = data.orderNumber || `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Calcular totalAmount se não fornecido
    let totalAmount = data.totalAmount || 0;
    if (data.items && data.items.length > 0) {
      totalAmount = data.items.reduce((sum, item) => {
        const itemTotal = (item.unitPrice || 0) * (item.quantity || 1);
        return sum + itemTotal;
      }, 0);
    }

    // Verificar se o storeId foi fornecido e existe
    if (!data.storeId) {
      throw new NotFoundException('Store ID is required');
    }

    const storeExists = await this.prisma.store.findUnique({
      where: { id: data.storeId }
    });

    if (!storeExists) {
      throw new NotFoundException(`Store with ID ${data.storeId} not found`);
    }

    const storeId = data.storeId;

    const items = Array.isArray(data.items) ? data.items : [];

    if (items.some(item => !item.productId)) {
      throw new BadRequestException('Product ID is required for all items');
    }

    const uniqueProductIds = Array.from(new Set(items.map(item => item.productId)));
    let productMap = new Map<string, { id: string; name: string; isUnlimited: boolean; stockQuantity: number | null }>();

    if (uniqueProductIds.length > 0) {
      const products = await this.prisma.product.findMany({
        where: {
          id: { in: uniqueProductIds },
          storeId,
        },
        select: {
          id: true,
          name: true,
          isUnlimited: true,
          stockQuantity: true,
        },
      });

      if (products.length !== uniqueProductIds.length) {
        throw new NotFoundException('One or more products not found in your store');
      }

      productMap = new Map(products.map(p => [p.id, { id: p.id, name: p.name, isUnlimited: p.isUnlimited, stockQuantity: p.stockQuantity }]));

      for (const item of items) {
        const product = productMap.get(item.productId);
        if (!product) continue;
        const qty = item.quantity || 1;
        if (!product.isUnlimited) {
          const stock = product.stockQuantity ?? 0;
          if (stock < qty) {
            throw new BadRequestException(
              `Produto "${product.name}" sem estoque suficiente. Disponível: ${stock}, solicitado: ${qty}.`,
            );
          }
        }
      }
    }

    // Criar ou encontrar cliente baseado nos dados fornecidos
    let customerId: string | null = null;
    const normalizedName = data.customerName?.trim();
    const normalizedEmail = data.customerEmail?.trim();
    const normalizedPhone = data.customerPhone?.trim();

    // Se customerId foi fornecido diretamente, validar que pertence à loja
    if (data.customerId) {
      const existingCustomer = await this.prisma.customer.findFirst({
        where: {
          id: data.customerId,
          storeId,
        },
      });

      if (!existingCustomer) {
        throw new NotFoundException('Customer not found in your store');
      }

      customerId = existingCustomer.id;
    }

    // Se não encontramos cliente pelo ID, buscar cliente existente na mesma loja
    if (!customerId) {
      const orFilters: any[] = [];

      if (normalizedName) {
        const nameParts = normalizedName.split(/\s+/);
        const firstName = nameParts[0] || normalizedName;
        const lastName = nameParts.slice(1).join(' ') || '';

        orFilters.push({
          AND: [
            { firstName: { equals: firstName, mode: 'insensitive' } },
            { lastName: { equals: lastName, mode: 'insensitive' } },
          ],
        });
      }

      if (normalizedEmail) {
        orFilters.push({ email: { equals: normalizedEmail, mode: 'insensitive' } });
      }

      if (normalizedPhone) {
        orFilters.push({ phone: normalizedPhone });
      }

      if (orFilters.length > 0) {
        const existingCustomer = await this.prisma.customer.findFirst({
          where: {
            storeId,
            OR: orFilters,
          },
        });

        if (existingCustomer) {
          customerId = existingCustomer.id;
        }
      }
    }

    // Se ainda não encontrou cliente, criar novo ou usar cliente padrão por loja
    if (!customerId) {
      if (normalizedName || normalizedEmail || normalizedPhone) {
        const nameParts = (normalizedName || 'Cliente').split(/\s+/);
        const firstName = nameParts[0] || normalizedName || 'Cliente';
        const lastName = nameParts.slice(1).join(' ') || '';

        const newCustomer = await this.prisma.customer.create({
          data: {
            firstName,
            lastName,
            email: normalizedEmail || null,
            phone: normalizedPhone || null,
            isActive: true,
            store: {
              connect: { id: storeId },
            },
          },
        });
        customerId = newCustomer.id;
      } else {
        const defaultCustomer = await this.getOrCreateDefaultCustomer(storeId);
        customerId = defaultCustomer.id;
      }
    }

    if (!customerId) {
      throw new BadRequestException('Customer ID is required');
    }

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber,
          customerId,
          storeId,
          status: data.status || 'pending',
          total: totalAmount,
          discount: data.discount || 0,
          tax: data.taxAmount || 0,
          paymentMethod: data.paymentMethod || 'cash',
          notes: data.notes || '',
          orderItems: {
            create: items.map(item => {
              const unitPrice = item.unitPrice || item.price || 0;
              const quantity = item.quantity || 1;
              const total = unitPrice * quantity;
              const product = productMap.get(item.productId);

              return {
                productId: item.productId,
                productName: item.productName || product?.name || 'Produto',
                quantity,
                unitPrice,
                discount: item.discount || 0,
                total,
              };
            }),
          },
        },
        include: {
          orderItems: true,
          customer: true,
          store: true,
        },
      });

      for (const item of items) {
        const product = productMap.get(item.productId);
        if (!product || product.isUnlimited) continue;
        const qty = item.quantity || 1;
        await tx.product.updateMany({
          where: { id: item.productId, storeId },
          data: { stockQuantity: { decrement: qty } },
        });
        const stockRow = await tx.stock.findUnique({
          where: { productId_storeId: { productId: item.productId, storeId } },
        });
        if (stockRow) {
          await tx.stock.update({
            where: { id: stockRow.id },
            data: { quantity: { decrement: qty } },
          });
        }
      }

      return created;
    });

    return this.mapPrismaOrderToSale(order);
  }

  async update(id: string, data: Partial<Sale>): Promise<void> {
    await this.prisma.order.update({
      where: { id },
      data: {
        status: data.status,
        total: data.totalAmount,
        discount: data.discount,
        tax: data.taxAmount,
        paymentMethod: data.paymentMethod,
        notes: data.notes,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.order.delete({
      where: { id },
    });
  }

  async getStatistics(filters: any): Promise<{
    totalSales: number;
    totalRevenue: number;
    averageTicket: number;
    salesByStatus: Record<string, number>;
    salesByPaymentMethod: Record<string, number>;
  }> {
    console.log('SalesRepository.getStatistics called with filters:', filters);
    const where: any = {};

    if (filters.startDate && filters.endDate) {
      where.createdAt = {
        gte: new Date(filters.startDate),
        lte: new Date(filters.endDate),
      };
    }

    if (filters.storeId) {
      where.storeId = filters.storeId;
    }

    const [totalSales, totalRevenue, salesByStatus] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.aggregate({
        where: {
          ...where,
          status: 'completed', // Apenas vendas concluídas contam para receita
        },
        _sum: { total: true },
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        where,
        _count: { status: true },
      }),
    ]);

    // Calcular ticket médio apenas com vendas concluídas
    const completedSalesCount = salesByStatus.find(s => s.status === 'completed')?._count.status || 0;
    const averageTicket = completedSalesCount > 0 ? Number(totalRevenue._sum.total || 0) / completedSalesCount : 0;

    return {
      totalSales,
      totalRevenue: Number(totalRevenue._sum.total || 0),
      averageTicket,
      salesByStatus: salesByStatus.reduce((acc, item) => {
        acc[item.status] = item._count.status;
        return acc;
      }, {} as Record<string, number>),
      salesByPaymentMethod: { cash: totalSales }, // Fallback para compatibilidade
    };
  }

  private mapPrismaOrderToSale(order: any): Sale {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      customerName: order.customer ? `${order.customer.firstName} ${order.customer.lastName}` : 'Cliente',
      customerEmail: order.customer?.email || null,
      customerPhone: order.customer?.phone || null,
      storeId: order.storeId,
      status: order.status,
      totalAmount: Number(order.total),
      total: Number(order.total), // Para compatibilidade com frontend
      discount: order.discount ? Number(order.discount) : null,
      taxAmount: order.tax ? Number(order.tax) : null,
      paymentMethod: order.paymentMethod || 'cash',
      notes: order.notes,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      userId: 'system', // Fallback para compatibilidade
      items: order.orderItems?.map(item => ({
        id: item.id,
        orderId: order.id,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        price: Number(item.unitPrice), // Para compatibilidade com frontend
        discount: item.discount ? Number(item.discount) : null,
        total: Number(item.total),
        createdAt: item.createdAt,
      })) || [],
    };
  }

  private async getOrCreateDefaultCustomer(storeId: string) {
    const firstName = 'Cliente';
    const lastName = 'Padrão';

    const existing = await this.prisma.customer.findFirst({
      where: {
        storeId,
        firstName,
        lastName,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.customer.create({
      data: {
        firstName,
        lastName,
        email: null,
        phone: null,
        isActive: true,
        store: {
          connect: { id: storeId },
        },
      },
    });
  }
}
