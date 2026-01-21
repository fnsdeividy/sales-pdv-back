import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) { }

  async findAll(page: number = 1, limit: number = 20, filters: any = {}, storeId: string) {
    console.log('🔍 StoresService.findAll - StoreId recebido:', storeId);
    const skip = (page - 1) * limit;

    // Sempre filtrar pela loja do usuário logado
    const whereConditions: any[] = [
      { id: storeId },
    ];

    // Adicionar filtros de busca
    if (filters.search) {
      whereConditions.push({
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { address: { contains: filters.search, mode: 'insensitive' } },
          { city: { contains: filters.search, mode: 'insensitive' } },
          { state: { contains: filters.search, mode: 'insensitive' } },
        ],
      });
    }

    // Adicionar filtro de status
    if (filters.status) {
      if (filters.status === 'active') {
        whereConditions.push({ isActive: true });
      } else if (filters.status === 'inactive') {
        whereConditions.push({ isActive: false });
      }
    }

    // Adicionar filtro de cidade
    if (filters.city) {
      whereConditions.push({ city: { contains: filters.city, mode: 'insensitive' } });
    }

    // Adicionar filtro de estado
    if (filters.state) {
      whereConditions.push({ state: { contains: filters.state, mode: 'insensitive' } });
    }

    // Construir o objeto where
    const where = whereConditions.length > 1 
      ? { AND: whereConditions }
      : whereConditions[0];

    console.log('🔍 StoresService.findAll - Where clause:', JSON.stringify(where, null, 2));

    const [stores, total] = await Promise.all([
      this.prisma.store.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.store.count({ where }),
    ]);

    console.log(`✅ StoresService.findAll - Encontradas ${stores.length} lojas (total: ${total}) para storeId: ${storeId}`);

    const totalPages = Math.ceil(total / limit);

    return {
      stores,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async findById(id: string, storeId: string) {
    // Verificar se o id solicitado é o mesmo da loja do usuário
    if (id !== storeId) {
      throw new NotFoundException(`Store with ID ${id} not found or does not belong to your store`);
    }

    const store = await this.prisma.store.findUnique({
      where: { id },
    });

    if (!store) {
      throw new NotFoundException(`Store with ID ${id} not found`);
    }

    return store;
  }

  async create(data: any) {
    return this.prisma.store.create({
      data: {
        name: data.name,
        description: data.description,
        address: data.address,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
        country: data.country || 'Brasil',
        phone: data.phone,
        email: data.email,
        type: data.type || 'branch',
        isActive: data.isActive ?? true,
      },
    });
  }

  async update(id: string, data: any, storeId: string) {
    // Verificar se o id solicitado é o mesmo da loja do usuário
    await this.findById(id, storeId);

    return this.prisma.store.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        address: data.address,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
        country: data.country,
        phone: data.phone,
        email: data.email,
        type: data.type,
        isActive: data.isActive,
      },
    });
  }

  async delete(id: string, storeId: string) {
    // Verificar se o id solicitado é o mesmo da loja do usuário
    await this.findById(id, storeId);

    return this.prisma.store.delete({
      where: { id },
    });
  }

  async activate(id: string, storeId: string) {
    // Verificar se o id solicitado é o mesmo da loja do usuário
    await this.findById(id, storeId);

    return this.prisma.store.update({
      where: { id },
      data: { isActive: true },
    });
  }

  async deactivate(id: string, storeId: string) {
    // Verificar se o id solicitado é o mesmo da loja do usuário
    await this.findById(id, storeId);

    return this.prisma.store.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async putInMaintenance(id: string, reason: string | undefined, storeId: string) {
    // Verificar se o id solicitado é o mesmo da loja do usuário
    await this.findById(id, storeId);

    // Por enquanto, vamos apenas desativar a loja
    // Em uma implementação futura, podemos adicionar um campo 'status' ou 'maintenanceReason'
    return this.prisma.store.update({
      where: { id },
      data: {
        isActive: false,
        // maintenanceReason: reason // Adicionar este campo no schema se necessário
      },
    });
  }

  async findByCity(city: string) {
    return this.prisma.store.findMany({
      where: {
        city: { contains: city, mode: 'insensitive' },
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async findByState(state: string) {
    return this.prisma.store.findMany({
      where: {
        state: { contains: state, mode: 'insensitive' },
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async findByType(type: string) {
    return this.prisma.store.findMany({
      where: {
        type: type as any,
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async findByManager(managerId: string) {
    // Por enquanto retorna array vazio, pois não temos relação com manager implementada
    // Em uma implementação futura, adicionar campo managerId na tabela stores
    return [];
  }

  async findNearby(latitude: number, longitude: number, radiusKm: number) {
    // Por enquanto retorna array vazio, pois não temos coordenadas implementadas
    // Em uma implementação futura, adicionar campos latitude/longitude na tabela stores
    // e usar função de distância geográfica
    return [];
  }

  async getStatistics(storeId: string) {
    const where = { id: storeId };

    const [
      totalStores,
      activeStores,
      inactiveStores,
    ] = await Promise.all([
      this.prisma.store.count({ where }),
      this.prisma.store.count({ where: { ...where, isActive: true } }),
      this.prisma.store.count({ where: { ...where, isActive: false } }),
    ]);

    // Buscar a loja para obter informações específicas
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: {
        type: true,
        state: true,
        city: true,
      },
    });

    const typeStats: Record<string, number> = {};
    const stateStats: Record<string, number> = {};
    const cityStats: Record<string, number> = {};

    if (store) {
      typeStats[store.type || 'unknown'] = 1;
      stateStats[store.state || 'unknown'] = 1;
      cityStats[store.city || 'unknown'] = 1;
    }

    return {
      totalStores,
      activeStores,
      inactiveStores,
      maintenanceStores: 0, // Por enquanto, até implementarmos status de manutenção
      storesByType: typeStats,
      storesByState: stateStats,
      storesByCity: cityStats,
    };
  }
}
