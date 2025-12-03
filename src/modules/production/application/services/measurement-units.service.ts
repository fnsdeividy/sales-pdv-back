import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Unit } from '@prisma/client';
import {
  CreateMeasurementUnitDto,
  UpdateMeasurementUnitDto,
  MeasurementUnitsFiltersDto,
} from '../../presentation/dto/measurement-unit.dto';

@Injectable()
export class MeasurementUnitsService {
  constructor(private prisma: PrismaService) {}

  async getMeasurementUnits(filters: MeasurementUnitsFiltersDto = {}) {
    const where: any = {};

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { symbol: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.measurementUnit.findMany({
      where,
      orderBy: [
        { isActive: 'desc' },
        { symbol: 'asc' },
      ],
    });
  }

  async getMeasurementUnitById(id: string) {
    const unit = await this.prisma.measurementUnit.findUnique({
      where: { id },
    });

    if (!unit) {
      throw new NotFoundException(`Measurement unit with ID ${id} not found`);
    }

    return unit;
  }

  async getActiveMeasurementUnits() {
    return this.prisma.measurementUnit.findMany({
      where: { isActive: true },
      orderBy: { symbol: 'asc' },
    });
  }

  async createMeasurementUnit(data: CreateMeasurementUnitDto) {
    // Validar se o símbolo corresponde a um valor válido do enum Unit
    const validUnits = Object.values(Unit);
    if (!validUnits.includes(data.symbol as Unit)) {
      throw new BadRequestException(
        `Symbol "${data.symbol}" is not a valid unit. Valid units are: ${validUnits.join(', ')}`
      );
    }

    // Verificar se já existe uma unidade com o mesmo símbolo
    const existingUnit = await this.prisma.measurementUnit.findFirst({
      where: {
        symbol: data.symbol,
      },
    });

    if (existingUnit) {
      throw new BadRequestException(
        `A measurement unit with symbol "${data.symbol}" already exists`
      );
    }

    return this.prisma.measurementUnit.create({
      data: {
        ...data,
        isActive: data.isActive ?? true,
      },
    });
  }

  async updateMeasurementUnit(id: string, data: UpdateMeasurementUnitDto) {
    const existingUnit = await this.getMeasurementUnitById(id);

    // Validar se o símbolo corresponde a um valor válido do enum Unit (se estiver sendo alterado)
    if (data.symbol && data.symbol !== existingUnit.symbol) {
      const validUnits = Object.values(Unit);
      if (!validUnits.includes(data.symbol as Unit)) {
        throw new BadRequestException(
          `Symbol "${data.symbol}" is not a valid unit. Valid units are: ${validUnits.join(', ')}`
        );
      }

      // Verificar se o novo símbolo já existe
      const symbolExists = await this.prisma.measurementUnit.findFirst({
        where: {
          symbol: data.symbol,
          id: { not: id },
        },
      });

      if (symbolExists) {
        throw new BadRequestException(
          `A measurement unit with symbol "${data.symbol}" already exists`
        );
      }
    }

    return this.prisma.measurementUnit.update({
      where: { id },
      data,
    });
  }

  async deleteMeasurementUnit(id: string) {
    const unit = await this.getMeasurementUnitById(id);

    // Verificar se a unidade está sendo usada em algum material
    const materialsCount = await this.prisma.material.count({
      where: {
        baseUnit: unit.symbol as any,
      },
    });

    if (materialsCount > 0) {
      throw new BadRequestException(
        `Cannot delete measurement unit that is being used by ${materialsCount} material(s)`
      );
    }

    return this.prisma.measurementUnit.delete({
      where: { id },
    });
  }

  async toggleUnitStatus(id: string) {
    const unit = await this.getMeasurementUnitById(id);

    return this.prisma.measurementUnit.update({
      where: { id },
      data: {
        isActive: !unit.isActive,
      },
    });
  }
}

