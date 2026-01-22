import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { UnitConversionService } from './unit-conversion.service';
import {
  CreateMaterialDto,
  UpdateMaterialDto,
  CreateMaterialBatchDto,
  UpdateMaterialBatchDto,
  CreateProductBomDto,
  UpdateProductBomDto,
  ScaleRecipeDto,
} from '../../presentation/dto/material.dto';
import { Unit, BatchStatus } from '../../entities/material.entity';
import { toNumber, toDecimal } from './decimal-utils';

@Injectable()
export class MaterialsService {
  constructor(
    private prisma: PrismaService,
    private unitConversionService: UnitConversionService
  ) { }

  // Materials CRUD
  async findAllMaterials(storeId: string) {
    if (!storeId) {
      throw new NotFoundException('Store ID is required');
    }

    return this.prisma.material.findMany({
      where: {
        storeId: storeId, // Filtro obrigatório por loja
      },
      include: {
        batches: {
          where: { 
            status: { not: BatchStatus.consumed },
            storeId: storeId,
          },
          orderBy: { receivedAt: 'asc' },
        },
        bomItems: true,
        conversions: true,
      },
    });
  }

  async findMaterialById(id: string, storeId?: string) {
    const where: any = { id };
    if (storeId) {
      where.storeId = storeId; // Filtro por loja quando fornecido
    }

    const material = await this.prisma.material.findFirst({
      where,
      include: {
        batches: {
          orderBy: { receivedAt: 'asc' },
        },
        bomItems: {
          include: {
            product: true,
          },
        },
        conversions: true,
      },
    });

    if (!material) {
      throw new NotFoundException(`Material with ID ${id} not found${storeId ? ' in your store' : ''}`);
    }

    return material;
  }

  async createMaterial(data: CreateMaterialDto, storeId: string) {
    if (!storeId) {
      throw new NotFoundException('Store ID is required');
    }

    return this.prisma.material.create({
      data: {
        ...data,
        storeId: storeId, // Sempre usar o storeId do usuário autenticado
      },
      include: {
        batches: true,
        bomItems: true,
        conversions: true,
      },
    });
  }

  async updateMaterial(id: string, data: UpdateMaterialDto, storeId: string) {
    if (!storeId) {
      throw new NotFoundException('Store ID is required');
    }

    await this.findMaterialById(id, storeId);

    // Garantir que storeId não seja alterado
    const updateData = { ...data };
    delete (updateData as any).storeId;

    return this.prisma.material.update({
      where: { id },
      data: updateData,
      include: {
        batches: true,
        bomItems: true,
        conversions: true,
      },
    });
  }

  async deleteMaterial(id: string, storeId: string): Promise<void> {
    if (!storeId) {
      throw new NotFoundException('Store ID is required');
    }

    await this.findMaterialById(id, storeId);

    // Check if material is used in any BOM
    const bomCount = await this.prisma.productBom.count({
      where: { materialId: id },
    });

    if (bomCount > 0) {
      throw new BadRequestException(
        'Cannot delete material that is used in product recipes'
      );
    }

    // Check if material has available batches
    const availableBatches = await this.prisma.materialBatch.count({
      where: {
        materialId: id,
        status: { in: [BatchStatus.available, BatchStatus.reserved] },
      },
    });

    if (availableBatches > 0) {
      throw new BadRequestException(
        'Cannot delete material that has available or reserved batches'
      );
    }

    await this.prisma.material.delete({ where: { id } });
  }

  // Material Batches CRUD
  async findMaterialBatches(materialId: string, storeId: string) {
    if (!storeId) {
      throw new NotFoundException('Store ID is required');
    }

    // Verificar se o material pertence à loja
    await this.findMaterialById(materialId, storeId);

    return this.prisma.materialBatch.findMany({
      where: { 
        materialId,
        storeId: storeId, // Filtro obrigatório por loja
      },
      include: {
        material: true,
        consumptions: true,
      },
      orderBy: { receivedAt: 'asc' },
    });
  }

  async findBatchById(id: string, storeId?: string) {
    const where: any = { id };
    if (storeId) {
      where.storeId = storeId;
    }

    const batch = await this.prisma.materialBatch.findFirst({
      where,
      include: {
        material: true,
        consumptions: true,
      },
    });

    if (!batch) {
      throw new NotFoundException(`Material batch with ID ${id} not found${storeId ? ' in your store' : ''}`);
    }

    return batch;
  }

  async createMaterialBatch(data: CreateMaterialBatchDto, storeId: string) {
    if (!storeId) {
      throw new NotFoundException('Store ID is required');
    }

    // Verify material exists and belongs to the store
    await this.findMaterialById(data.materialId, storeId);

    // Calculate total cost
    const totalCost = data.qty * data.unitCost;

    return this.prisma.materialBatch.create({
      data: {
        ...data,
        totalCost,
        storeId: storeId, // Sempre usar o storeId do usuário autenticado
        receivedAt: new Date(data.receivedAt),
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
      },
      include: {
        material: true,
        consumptions: true,
      },
    });
  }

  async updateMaterialBatch(id: string, data: UpdateMaterialBatchDto, storeId: string) {
    if (!storeId) {
      throw new NotFoundException('Store ID is required');
    }

    const batch = await this.findBatchById(id, storeId);

    // Recalculate total cost if qty or unitCost changed
    const updateData: any = { ...data };
    if (data.qty !== undefined || data.unitCost !== undefined) {
      const newQty = data.qty ?? toNumber(batch.qty);
      const newUnitCost = data.unitCost ?? toNumber(batch.unitCost);
      updateData.totalCost = newQty * newUnitCost;
    }

    if (data.receivedAt) {
      updateData.receivedAt = new Date(data.receivedAt);
    }

    if (data.expiryDate) {
      updateData.expiryDate = new Date(data.expiryDate);
    }

    // Garantir que storeId não seja alterado
    delete updateData.storeId;

    return this.prisma.materialBatch.update({
      where: { id },
      data: updateData,
      include: {
        material: true,
        consumptions: true,
      },
    });
  }

  async deleteMaterialBatch(id: string, storeId: string): Promise<void> {
    if (!storeId) {
      throw new NotFoundException('Store ID is required');
    }

    const batch = await this.findBatchById(id, storeId);

    if (batch.status === BatchStatus.consumed) {
      throw new BadRequestException('Cannot delete consumed batch');
    }

    // Check if batch has consumptions
    const consumptionCount = await this.prisma.productionConsumption.count({
      where: { batchId: id },
    });

    if (consumptionCount > 0) {
      throw new BadRequestException(
        'Cannot delete batch that has been used in production'
      );
    }

    await this.prisma.materialBatch.delete({ where: { id } });
  }

  // Product BOM (Bill of Materials) CRUD
  async findProductBom(productId: string, storeId?: string) {
    const where: any = { productId };
    
    // Se storeId fornecido, verificar se o produto pertence à loja
    if (storeId) {
      const product = await this.prisma.product.findFirst({
        where: {
          id: productId,
          storeId: storeId,
        },
      });
      if (!product) {
        throw new NotFoundException(`Product with ID ${productId} not found in your store`);
      }
    }

    return this.prisma.productBom.findMany({
      where,
      include: {
        material: true,
        product: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findMultipleProductsBom(productIds: string[], storeId?: string) {
    // Filter valid UUIDs to avoid database errors
    const validProductIds = productIds.filter(id => {
      try {
        // Simple UUID validation
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      } catch {
        return false;
      }
    });

    if (validProductIds.length === 0) {
      return {};
    }

    // Se storeId fornecido, filtrar apenas produtos da loja
    let filteredProductIds = validProductIds;
    if (storeId) {
      const products = await this.prisma.product.findMany({
        where: {
          id: { in: validProductIds },
          storeId: storeId,
        },
        select: { id: true },
      });
      filteredProductIds = products.map(p => p.id);
    }

    if (filteredProductIds.length === 0) {
      return {};
    }

    const bomItems = await this.prisma.productBom.findMany({
      where: { 
        productId: { 
          in: filteredProductIds 
        } 
      },
      include: {
        material: true,
        product: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by productId
    const groupedBom = bomItems.reduce((acc, item) => {
      if (!acc[item.productId]) {
        acc[item.productId] = [];
      }
      acc[item.productId].push(item);
      return acc;
    }, {} as Record<string, any[]>);

    return groupedBom;
  }

  async createBomItem(data: CreateProductBomDto, storeId?: string) {
    // Verify product exists (and belongs to store if storeId provided)
    const productWhere: any = { id: data.productId };
    if (storeId) {
      productWhere.storeId = storeId;
    }

    const product = await this.prisma.product.findFirst({
      where: productWhere,
    });
    if (!product) {
      throw new NotFoundException(`Product with ID ${data.productId} not found${storeId ? ' in your store' : ''}`);
    }

    // Verify material exists (and belongs to store if storeId provided)
    await this.findMaterialById(data.materialId, storeId);

    return this.prisma.productBom.create({
      data: {
        ...data,
        wastePercent: data.wastePercent || 0,
      },
      include: {
        material: true,
        product: true,
      },
    });
  }

  async createBomItemsBatch(items: CreateProductBomDto[], storeId?: string) {
    // Validate all items first
    for (const item of items) {
      // Verify product exists (and belongs to store if storeId provided)
      const productWhere: any = { id: item.productId };
      if (storeId) {
        productWhere.storeId = storeId;
      }

      const product = await this.prisma.product.findFirst({
        where: productWhere,
      });
      if (!product) {
        throw new NotFoundException(`Product with ID ${item.productId} not found${storeId ? ' in your store' : ''}`);
      }

      // Verify material exists (and belongs to store if storeId provided)
      await this.findMaterialById(item.materialId, storeId);
    }

    // Create all items in a transaction
    return this.prisma.$transaction(async (tx) => {
      const createdItems: any[] = [];
      for (const item of items) {
        const created = await tx.productBom.create({
          data: {
            ...item,
            wastePercent: item.wastePercent || 0,
          },
          include: {
            material: true,
            product: true,
          },
        });
        createdItems.push(created);
      }
      return createdItems;
    });
  }

  async updateBomItem(id: string, data: UpdateProductBomDto, storeId?: string) {
    const bomItem = await this.prisma.productBom.findUnique({
      where: { id },
      include: {
        material: true,
        product: true,
      },
    });

    if (!bomItem) {
      throw new NotFoundException(`BOM item with ID ${id} not found`);
    }

    // Verificar se o produto pertence à loja
    if (storeId && bomItem.product.storeId !== storeId) {
      throw new NotFoundException(`BOM item with ID ${id} not found in your store`);
    }

    return this.prisma.productBom.update({
      where: { id },
      data,
      include: {
        material: true,
        product: true,
      },
    });
  }

  async deleteBomItem(id: string, storeId?: string): Promise<void> {
    const bomItem = await this.prisma.productBom.findUnique({
      where: { id },
      include: {
        product: true,
      },
    });

    if (!bomItem) {
      throw new NotFoundException(`BOM item with ID ${id} not found`);
    }

    // Verificar se o produto pertence à loja
    if (storeId && bomItem.product.storeId !== storeId) {
      throw new NotFoundException(`BOM item with ID ${id} not found in your store`);
    }

    await this.prisma.productBom.delete({ where: { id } });
  }

  // Recipe scaling
  async scaleRecipe(data: ScaleRecipeDto, storeId?: string) {
    const bom = await this.findProductBom(data.productId, storeId);

    if (bom.length === 0) {
      throw new NotFoundException(`No recipe found for product ${data.productId}`);
    }

    // Get product info to determine base recipe size
    const productWhere: any = { id: data.productId };
    if (storeId) {
      productWhere.storeId = storeId;
    }

    const product = await this.prisma.product.findFirst({
      where: productWhere,
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${data.productId} not found${storeId ? ' in your store' : ''}`);
    }

    // Assume base recipe is for 100 units of the product's base unit
    const baseRecipeSize = 100;
    const baseRecipeUnit = product.baseUnit || Unit.L;

    // Calculate scaling factor
    let scalingFactor: number;

    if (data.targetUnit === baseRecipeUnit) {
      scalingFactor = data.targetOutputQty / baseRecipeSize;
    } else {
      // Convert target to base unit
      const convertedTarget = await this.unitConversionService.convertUnit(
        data.targetOutputQty,
        data.targetUnit,
        baseRecipeUnit
      );
      scalingFactor = convertedTarget / baseRecipeSize;
    }

    // Scale each ingredient
    const scaledBom = await Promise.all(
      bom.map(async (item) => {
        const scaledQty = toNumber(item.qty) * scalingFactor;
        const wasteMultiplier = 1 + (toNumber(item.wastePercent) / 100);
        const finalQty = scaledQty * wasteMultiplier;

        return {
          materialId: item.materialId,
          materialName: item.material?.name,
          baseQty: toNumber(item.qty),
          scaledQty: scaledQty,
          wastePercent: toNumber(item.wastePercent),
          finalQty: finalQty,
          unit: item.unit,
          notes: item.notes,
        };
      })
    );

    return {
      productId: data.productId,
      targetOutputQty: data.targetOutputQty,
      targetUnit: data.targetUnit,
      scalingFactor,
      ingredients: scaledBom,
    };
  }

  // Material availability check
  async checkMaterialAvailability(materialId: string, requiredQty: number, requiredUnit: Unit, storeId?: string) {
    const material = await this.findMaterialById(materialId, storeId);

    // Get all available batches
    const batchWhere: any = {
      materialId,
      status: BatchStatus.available,
      qty: { gt: 0 },
    };
    if (storeId) {
      batchWhere.storeId = storeId;
    }

    const availableBatches = await this.prisma.materialBatch.findMany({
      where: batchWhere,
      orderBy: { receivedAt: 'asc' }, // FIFO order
    });

    let totalAvailable = 0;
    const batchDetails: any[] = [];

    for (const batch of availableBatches) {
      // Convert batch quantity to required unit
      const convertedQty = await this.unitConversionService.convertUnit(
        toNumber(batch.qty),
        batch.unit,
        requiredUnit,
        materialId,
        material.densityGPerMl ? toNumber(material.densityGPerMl) : undefined
      );

      totalAvailable += convertedQty;
      batchDetails.push({
        batchId: batch.id,
        lotCode: batch.lotCode,
        availableQty: convertedQty,
        unitCost: toNumber(batch.unitCost),
        expiryDate: batch.expiryDate,
      });
    }

    const status = totalAvailable >= requiredQty ? 'available' :
      totalAvailable > 0 ? 'partial' : 'unavailable';

    return {
      materialId,
      materialName: material.name,
      requiredQty,
      requiredUnit,
      totalAvailable,
      status,
      shortfall: Math.max(0, requiredQty - totalAvailable),
      batches: batchDetails,
    };
  }

  // Get low stock materials
  async getLowStockMaterials(storeId: string) {
    if (!storeId) {
      throw new NotFoundException('Store ID is required');
    }

    const materials = await this.prisma.material.findMany({
      where: {
        storeId: storeId, // Filtro obrigatório por loja
      },
      include: {
        batches: {
          where: { 
            status: BatchStatus.available,
            storeId: storeId,
          },
        },
      },
    });

    const lowStockMaterials: any[] = [];

    for (const material of materials) {
      let totalStock = 0;

      for (const batch of material.batches) {
        // Convert to material's base unit for comparison
        const convertedQty = await this.unitConversionService.convertUnit(
          toNumber(batch.qty),
          batch.unit,
          material.baseUnit,
          material.id,
          material.densityGPerMl ? toNumber(material.densityGPerMl) : undefined
        );
        totalStock += convertedQty;
      }

      if (totalStock <= toNumber(material.minStock)) {
        lowStockMaterials.push({
          id: material.id,
          name: material.name,
          currentStock: totalStock,
          minStock: toNumber(material.minStock),
          baseUnit: material.baseUnit,
          shortfall: toNumber(material.minStock) - totalStock,
        });
      }
    }

    return lowStockMaterials;
  }
}