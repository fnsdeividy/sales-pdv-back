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

  async search(
    params: { name?: string; email?: string; phone?: string },
    storeId: string,
  ) {
    // #region agent log
    fetch('http://127.0.0.1:7251/ingest/1e176226-6578-43f9-889c-e98ee7f619a4', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'customers-search',
        hypothesisId: 'H2',
        location: 'customer.service.ts:search',
        message: 'CustomerService.search called',
        data: { hasStoreId: !!storeId, params },
        timestamp: Date.now(),
      }),
    }).catch(() => { });
    // #endregion

    if (!storeId) {
      throw new NotFoundException('Store ID is required');
    }

    const { name, email, phone } = params;

    // Se nenhum critério foi informado, retornar lista vazia para evitar buscar tudo.
    if (!name && !email && !phone) {
      return [];
    }

    const where: any = {
      storeId,
    };

    const orConditions: any[] = [];

    if (name) {
      orConditions.push(
        { firstName: { contains: name, mode: 'insensitive' } },
        { lastName: { contains: name, mode: 'insensitive' } },
        { email: { contains: name, mode: 'insensitive' } },
      );
    }

    if (email) {
      orConditions.push({ email: { contains: email, mode: 'insensitive' } });
    }

    if (phone) {
      orConditions.push({ phone: { contains: phone, mode: 'insensitive' } });
    }

    if (orConditions.length > 0) {
      where.OR = orConditions;
    }

    return this.prisma.customer.findMany({
      where,
      orderBy: { firstName: 'asc' },
      take: 50,
    });
  }

  async findById(id: string, storeId: string) {
    // #region agent log
    fetch('http://127.0.0.1:7251/ingest/1e176226-6578-43f9-889c-e98ee7f619a4', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'customers-search',
        hypothesisId: 'H3',
        location: 'customer.service.ts:findById',
        message: 'CustomerService.findById called',
        data: { id, hasStoreId: !!storeId },
        timestamp: Date.now(),
      }),
    }).catch(() => { });
    // #endregion

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
