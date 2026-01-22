import { Injectable, NotFoundException } from '@nestjs/common';
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

    // Criar ou encontrar cliente baseado nos dados fornecidos
    let customerId = '4F461257-2F49-4667-83E4-A9510DDAE575'; // Cliente padrão como fallback
    let customerFound = false;

    // Se customerId foi fornecido diretamente, usar ele
    if (data.customerId) {
      const existingCustomer = await this.prisma.customer.findUnique({
        where: { id: data.customerId }
      });
      
      if (existingCustomer) {
        customerId = existingCustomer.id;
        customerFound = true;
        console.log(`Using provided customer ID: ${existingCustomer.firstName} ${existingCustomer.lastName}`);
      } else {
        console.warn(`Customer with ID ${data.customerId} not found, will try to find or create by name`);
      }
    }

    // Se não encontramos cliente pelo ID e temos customerName, buscar ou criar cliente
    if (!customerFound && data.customerName) {
      // Separar nome completo em primeiro e último nome
      const nameParts = data.customerName.trim().split(/\s+/);
      const firstName = nameParts[0] || data.customerName;
      const lastName = nameParts.slice(1).join(' ') || '';

      // Tentar encontrar cliente existente pelo nome completo ou email
      const existingCustomer = await this.prisma.customer.findFirst({
        where: {
          OR: [
            {
              AND: [
                { firstName: { equals: firstName, mode: 'insensitive' } },
                { lastName: { equals: lastName, mode: 'insensitive' } }
              ]
            },
            { email: data.customerEmail || undefined },
            { phone: data.customerPhone || undefined }
          ]
        }
      });

      if (existingCustomer) {
        customerId = existingCustomer.id;
        console.log(`Using existing customer: ${existingCustomer.firstName} ${existingCustomer.lastName}`);
      } else {
        // Criar novo cliente
        const newCustomer = await this.prisma.customer.create({
          data: {
            firstName: firstName,
            lastName: lastName,
            email: data.customerEmail || null,
            phone: data.customerPhone || null,
            isActive: true,
            store: {
              connect: { id: storeId },
            },
          },
        });
        customerId = newCustomer.id;
        console.log(`Created new customer: ${newCustomer.firstName} ${newCustomer.lastName}`);
      }
    }

    const order = await this.prisma.order.create({
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
          create: data.items?.map(item => {
            const unitPrice = item.unitPrice || item.price || 0;
            const quantity = item.quantity || 1;
            const total = unitPrice * quantity;

            return {
              productId: item.productId,
              productName: item.productName || 'Produto',
              quantity: quantity,
              unitPrice: unitPrice,
              discount: item.discount || 0,
              total: total,
            };
          }) || [],
        },
      },
      include: {
        orderItems: true,
        customer: true,
        store: true,
      },
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
}
