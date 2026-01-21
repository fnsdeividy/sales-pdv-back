import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CustomerService {
  constructor(private readonly prisma: PrismaService) { }

  async findAll(page: number = 1, limit: number = 20, filters: any = {}, storeId: string) {
    if (!storeId) {
      throw new NotFoundException('Store ID is required');
    }

    const skip = (page - 1) * limit;

    const where: any = {
      storeId: storeId, // Filtro obrigatório por loja
    };
    
    if (filters.search) {
      where.AND = [
        {
          OR: [
            { firstName: { contains: filters.search, mode: 'insensitive' } },
            { lastName: { contains: filters.search, mode: 'insensitive' } },
            { email: { contains: filters.search, mode: 'insensitive' } },
            { phone: { contains: filters.search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters.city) {
      where.city = { contains: filters.city, mode: 'insensitive' };
    }

    if (filters.state) {
      where.state = { contains: filters.state, mode: 'insensitive' };
    }

    if (filters.hasEmail !== undefined) {
      if (filters.hasEmail) {
        where.email = { not: null };
      } else {
        where.email = null;
      }
    }

    if (filters.hasPhone !== undefined) {
      if (filters.hasPhone) {
        where.phone = { not: null };
      } else {
        where.phone = null;
      }
    }

    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.customer.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      customers,
      total,
      totalPages,
      currentPage: page,
    };
  }

  async findById(id: string, storeId: string) {
    if (!storeId) {
      throw new NotFoundException('Store ID is required');
    }

    const customer = await this.prisma.customer.findFirst({
      where: { 
        id,
        storeId: storeId, // Filtro obrigatório por loja
      },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found in your store`);
    }

    return customer;
  }

  async create(data: any, storeId: string) {
    if (!storeId) {
      throw new NotFoundException('Store ID is required');
    }

    return this.prisma.customer.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        address: data.address,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
        isActive: data.isActive ?? true,
        storeId: storeId, // Sempre usar o storeId do usuário autenticado
      },
    });
  }

  async update(id: string, data: any, storeId: string) {
    const customer = await this.findById(id, storeId);

    return this.prisma.customer.update({
      where: { id },
      data: {
        firstName: data.firstName ?? customer.firstName,
        lastName: data.lastName ?? customer.lastName,
        email: data.email ?? customer.email,
        phone: data.phone ?? customer.phone,
        address: data.address ?? customer.address,
        city: data.city ?? customer.city,
        state: data.state ?? customer.state,
        zipCode: data.zipCode ?? customer.zipCode,
        birthDate: data.birthDate ? new Date(data.birthDate) : customer.birthDate,
        isActive: data.isActive ?? customer.isActive,
        // storeId não é alterável
      },
    });
  }

  async delete(id: string, storeId: string) {
    await this.findById(id, storeId);

    return this.prisma.customer.delete({
      where: { id },
    });
  }

  async activate(id: string, storeId: string) {
    await this.findById(id, storeId);

    return this.prisma.customer.update({
      where: { id },
      data: { isActive: true },
    });
  }

  async deactivate(id: string, storeId: string) {
    await this.findById(id, storeId);

    return this.prisma.customer.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async getStatistics(storeId: string) {
    if (!storeId) {
      throw new NotFoundException('Store ID is required');
    }

    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const baseWhere = { storeId: storeId };

    const [
      totalCustomers,
      activeCustomers,
      inactiveCustomers,
      newCustomersThisMonth,
      newCustomersLastMonth,
    ] = await Promise.all([
      this.prisma.customer.count({ where: baseWhere }),
      this.prisma.customer.count({ where: { ...baseWhere, isActive: true } }),
      this.prisma.customer.count({ where: { ...baseWhere, isActive: false } }),
      this.prisma.customer.count({
        where: { ...baseWhere, createdAt: { gte: thisMonth } },
      }),
      this.prisma.customer.count({
        where: {
          ...baseWhere,
          createdAt: {
            gte: lastMonth,
            lt: thisMonth,
          },
        },
      }),
    ]);

    return {
      totalCustomers,
      activeCustomers,
      inactiveCustomers,
      newCustomersThisMonth,
      newCustomersLastMonth,
    };
  }

  async getCustomerOrders(customerId: string, page: number = 1, limit: number = 10, storeId: string) {
    await this.findById(customerId, storeId);

    const skip = (page - 1) * limit;

    // Buscar orders do cliente que pertencem à mesma loja
    const [orders, total] = await Promise.all([
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
      orders,
      total,
      totalPages,
      currentPage: page,
    };
  }

  async exportToCSV(filters: {
    search?: string;
    isActive?: boolean;
    city?: string;
    state?: string;
  } = {}, storeId: string): Promise<string> {
    if (!storeId) {
      throw new NotFoundException('Store ID is required');
    }

    const where: any = {
      storeId: storeId, // Filtro obrigatório por loja
    };

    if (filters.search) {
      where.AND = [
        {
          OR: [
            { firstName: { contains: filters.search, mode: 'insensitive' } },
            { lastName: { contains: filters.search, mode: 'insensitive' } },
            { email: { contains: filters.search, mode: 'insensitive' } },
            { phone: { contains: filters.search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters.city) {
      where.city = { contains: filters.city, mode: 'insensitive' };
    }

    if (filters.state) {
      where.state = { contains: filters.state, mode: 'insensitive' };
    }

    const customers = await this.prisma.customer.findMany({
      where,
      orderBy: { firstName: 'asc' },
    });

    // Cabeçalho do CSV
    const headers = [
      'Nome',
      'Sobrenome',
      'Email',
      'Telefone',
      'Endereço',
      'Cidade',
      'Estado',
      'CEP',
      'Status',
      'Data de Cadastro',
    ];

    // Converter dados para CSV
    const csvRows = [
      headers.join(','), // Cabeçalho
      ...customers.map(customer => [
        `"${customer.firstName || ''}"`,
        `"${customer.lastName || ''}"`,
        `"${customer.email || ''}"`,
        `"${customer.phone || ''}"`,
        `"${customer.address || ''}"`,
        `"${customer.city || ''}"`,
        `"${customer.state || ''}"`,
        `"${customer.zipCode || ''}"`,
        customer.isActive ? 'Ativo' : 'Inativo',
        `"${customer.createdAt.toISOString().split('T')[0]}"`,
      ].join(','))
    ];

    return csvRows.join('\n');
  }
}
