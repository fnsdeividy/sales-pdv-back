import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateFixedCostDto,
  UpdateFixedCostDto,
  FixedCostsFiltersDto,
  FixedCostFrequency,
  FixedCostCategory,
} from '../../presentation/dto/fixed-cost.dto';

interface CostSummary {
  totalMonthly: number;
  totalDaily: number;
  totalYearly: number;
  byCategory: Record<string, number>;
  byFrequency: Record<string, number>;
  activeCosts: number;
  inactiveCosts: number;
}

@Injectable()
export class FixedCostsService {
  constructor(private prisma: PrismaService) {}

  async getFixedCosts(filters: FixedCostsFiltersDto = {}) {
    const where: any = {};

    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters.frequency) {
      where.frequency = filters.frequency;
    }

    return this.prisma.fixedCost.findMany({
      where,
      orderBy: [
        { isActive: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async getFixedCostById(id: string) {
    const cost = await this.prisma.fixedCost.findUnique({
      where: { id },
    });

    if (!cost) {
      throw new NotFoundException(`Fixed cost with ID ${id} not found`);
    }

    return cost;
  }

  async createFixedCost(data: CreateFixedCostDto) {
    // Verificar se já existe um custo com o mesmo nome
    const existingCost = await this.prisma.fixedCost.findFirst({
      where: {
        name: data.name,
      },
    });

    if (existingCost) {
      throw new BadRequestException(`A fixed cost with name "${data.name}" already exists`);
    }

    return this.prisma.fixedCost.create({
      data: {
        ...data,
        isActive: data.isActive ?? true,
      },
    });
  }

  async updateFixedCost(id: string, data: UpdateFixedCostDto) {
    const existingCost = await this.getFixedCostById(id);

    // Verificar se o novo nome já existe (se estiver sendo alterado)
    if (data.name && data.name !== existingCost.name) {
      const nameExists = await this.prisma.fixedCost.findFirst({
        where: {
          name: data.name,
          id: { not: id },
        },
      });

      if (nameExists) {
        throw new BadRequestException(`A fixed cost with name "${data.name}" already exists`);
      }
    }

    return this.prisma.fixedCost.update({
      where: { id },
      data,
    });
  }

  async deleteFixedCost(id: string) {
    await this.getFixedCostById(id);

    return this.prisma.fixedCost.delete({
      where: { id },
    });
  }

  async toggleCostStatus(id: string) {
    const cost = await this.getFixedCostById(id);

    return this.prisma.fixedCost.update({
      where: { id },
      data: {
        isActive: !cost.isActive,
      },
    });
  }

  async duplicateCost(id: string, newName: string) {
    const originalCost = await this.getFixedCostById(id);

    // Verificar se o novo nome já existe
    const nameExists = await this.prisma.fixedCost.findFirst({
      where: { name: newName },
    });

    if (nameExists) {
      throw new BadRequestException(`A fixed cost with name "${newName}" already exists`);
    }

    return this.prisma.fixedCost.create({
      data: {
        name: newName,
        description: originalCost.description,
        amount: originalCost.amount,
        frequency: originalCost.frequency as FixedCostFrequency,
        category: originalCost.category as FixedCostCategory,
        isActive: true, // Sempre criar como ativo
      },
    });
  }

  async getCostsSummary(filters: FixedCostsFiltersDto = {}): Promise<CostSummary> {
    const costs = await this.getFixedCosts(filters);

    const summary: CostSummary = {
      totalMonthly: 0,
      totalDaily: 0,
      totalYearly: 0,
      byCategory: {},
      byFrequency: {},
      activeCosts: 0,
      inactiveCosts: 0,
    };

    costs.forEach(cost => {
      // Contar custos ativos/inativos
      if (cost.isActive) {
        summary.activeCosts++;
      } else {
        summary.inactiveCosts++;
      }

      // Contar por frequência
      if (!summary.byFrequency[cost.frequency]) {
        summary.byFrequency[cost.frequency] = 0;
      }
      summary.byFrequency[cost.frequency]++;

      // Calcular apenas custos ativos para o resumo financeiro
      if (!cost.isActive) return;

      let monthlyAmount = 0;
      switch (cost.frequency) {
        case FixedCostFrequency.MONTHLY:
          monthlyAmount = Number(cost.amount);
          break;
        case FixedCostFrequency.DAILY:
          monthlyAmount = Number(cost.amount) * 30;
          break;
        case FixedCostFrequency.YEARLY:
          monthlyAmount = Number(cost.amount) / 12;
          break;
      }

      summary.totalMonthly += monthlyAmount;
      summary.totalDaily += monthlyAmount / 30;
      summary.totalYearly += monthlyAmount * 12;

      // Agrupar por categoria
      if (!summary.byCategory[cost.category]) {
        summary.byCategory[cost.category] = 0;
      }
      summary.byCategory[cost.category] += monthlyAmount;
    });

    return summary;
  }
}
