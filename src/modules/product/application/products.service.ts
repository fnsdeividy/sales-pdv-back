import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { Product } from '../entities/product.entity';
import { CreateProductDto, UpdateProductDto } from '../presentation/interfaces/product.interface';
import * as fs from 'fs';
import * as path from 'path';

/** Decimal(10,2): máx 8 dígitos inteiros + 2 decimais (evita overflow no PostgreSQL) */
const MAX_DECIMAL_10_2 = 99_999_999.99;
/** Decimal(8,3): máx 5 dígitos inteiros + 3 decimais */
const MAX_DECIMAL_8_3 = 99_999.999;

function toNumber(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string') {
    const n = parseFloat(value.replace(',', '.'));
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

function validateProductDecimals(
  data: Record<string, unknown>,
  isCreate: boolean,
): void {
  if (isCreate) {
    const price = toNumber(data.price);
    if (price === null || price <= 0) {
      throw new BadRequestException('Preço é obrigatório e deve ser maior que zero.');
    }
    if (price > MAX_DECIMAL_10_2) {
      throw new BadRequestException(
        `Preço deve ser no máximo R$ ${MAX_DECIMAL_10_2.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
      );
    }
  } else {
    if (data.price !== undefined) {
      const price = toNumber(data.price);
      if (price !== null && (price <= 0 || price > MAX_DECIMAL_10_2)) {
        throw new BadRequestException(
          `Preço deve ser maior que zero e no máximo R$ ${MAX_DECIMAL_10_2.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
        );
      }
    }
  }

  if (data.costPrice !== undefined && data.costPrice !== null) {
    const costPrice = toNumber(data.costPrice);
    if (costPrice !== null && (costPrice < 0 || costPrice > MAX_DECIMAL_10_2)) {
      throw new BadRequestException(
        `Preço de custo deve ser no máximo R$ ${MAX_DECIMAL_10_2.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
      );
    }
  }

  if (data.weight !== undefined && data.weight !== null) {
    const weight = toNumber(data.weight);
    if (weight !== null && (weight < 0 || weight > MAX_DECIMAL_8_3)) {
      throw new BadRequestException(
        `Peso deve ser no máximo ${MAX_DECIMAL_8_3.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} kg.`,
      );
    }
  }
}

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) { }

  async findAll(storeId?: string): Promise<Product[]> {
    if (!storeId || typeof storeId !== 'string' || storeId.trim() === '') {
      throw new NotFoundException('Store ID is required and must be a valid UUID');
    }

    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, name: true },
    });

    if (!store) {
      throw new NotFoundException(`Store with ID ${storeId} not found`);
    }

    const products = await this.prisma.product.findMany({
      where: { storeId: { equals: storeId } },
      include: {
        stock: {
          where: { storeId: { equals: storeId } },
        },
      },
    });

    // #region agent log
    try { const dir = path.join(process.cwd(), '.cursor'); if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); const logPath = path.join(dir, 'debug.log'); fs.appendFileSync(logPath, JSON.stringify({ location: 'products.service.ts:findAll', message: 'findAll result', data: { storeId, count: products.length, productIds: products.slice(0, 5).map(p => p.id) }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'C' }) + '\n'); } catch (_) {}
    // #endregion

    return products.filter((p) => p.storeId === storeId);
  }

  async findOne(id: string, storeId?: string): Promise<Product> {
    if (!storeId) {
      throw new NotFoundException('Store ID is required');
    }

    const product = await this.prisma.product.findFirst({
      where: {
        id,
        storeId: storeId,
      },
      include: {
        stock: {
          where: {
            storeId: storeId,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found in your store`);
    }

    return product;
  }

  async create(data: CreateProductDto, storeId?: string): Promise<Product> {
    if (!storeId) {
      throw new NotFoundException('Store ID is required');
    }
    validateProductDecimals(data as Record<string, unknown>, true);
    const { storeId: _ignored, ...rest } = data as any;
    const product = await this.prisma.product.create({
      data: {
        ...rest,
        storeId: storeId,
        isActive: true,
      } as Prisma.ProductUncheckedCreateInput,
      include: {
        stock: true,
      },
    });

    return product;
  }

  async update(id: string, data: UpdateProductDto, storeId?: string): Promise<Product> {
    if (!storeId) {
      throw new NotFoundException('Store ID is required');
    }
    validateProductDecimals(data as Record<string, unknown>, false);
    const { storeId: _ignored, ...rest } = data as any;
    const result = await this.prisma.product.updateMany({
      where: { id, storeId },
      data: {
        ...rest,
      } as Prisma.ProductUncheckedUpdateInput,
    });
    if (result.count === 0) {
      throw new NotFoundException(`Product with ID ${id} not found in your store`);
    }
    const updatedProduct = await this.prisma.product.findFirst({
      where: { id, storeId },
      include: {
        stock: { where: { storeId } },
      },
    });
    if (!updatedProduct) {
      throw new NotFoundException(`Product with ID ${id} not found in your store`);
    }
    return updatedProduct;
  }

  async remove(id: string, storeId?: string): Promise<void> {
    if (!storeId) {
      throw new NotFoundException('Store ID is required');
    }

    const result = await this.prisma.product.deleteMany({
      where: { id, storeId },
    });
    if (result.count === 0) {
      throw new NotFoundException(`Product with ID ${id} not found in your store`);
    }
  }
}