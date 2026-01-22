import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { MaterialsService } from '../../../application/services/materials.service';
import { UnitConversionService } from '../../../application/services/unit-conversion.service';
import {
  CreateMaterialDto,
  UpdateMaterialDto,
  CreateMaterialBatchDto,
  UpdateMaterialBatchDto,
  CreateProductBomDto,
  UpdateProductBomDto,
  CreateUnitConversionDto,
  ScaleRecipeDto,
} from '../../dto/material.dto';
import { CurrentUser } from '../../../../../shared/decorators/current-user.decorator';

@Controller('production/materials')
export class MaterialsController {
  constructor(
    private readonly materialsService: MaterialsService,
    private readonly unitConversionService: UnitConversionService
  ) {}

  // Materials endpoints
  @Get()
  async findAllMaterials(@CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.materialsService.findAllMaterials(user.storeId);
  }

  @Get('low-stock')
  async getLowStockMaterials(@CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.materialsService.getLowStockMaterials(user.storeId);
  }

  @Get(':id')
  async findMaterialById(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.materialsService.findMaterialById(id, user.storeId);
  }

  @Post()
  async createMaterial(@Body() data: CreateMaterialDto, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    // Garantir que o storeId do body seja ignorado
    delete (data as any).storeId;
    return this.materialsService.createMaterial(data, user.storeId);
  }

  @Put(':id')
  async updateMaterial(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: UpdateMaterialDto,
    @CurrentUser() user: any
  ) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    // Garantir que o storeId do body seja ignorado
    delete (data as any).storeId;
    return this.materialsService.updateMaterial(id, data, user.storeId);
  }

  @Delete(':id')
  async deleteMaterial(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    await this.materialsService.deleteMaterial(id, user.storeId);
    return { message: 'Material deleted successfully' };
  }

  // Material availability check
  @Get(':id/availability')
  async checkMaterialAvailability(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('qty') qty: number,
    @Query('unit') unit: string,
    @CurrentUser() user: any
  ) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.materialsService.checkMaterialAvailability(id, qty, unit as any, user.storeId);
  }
}

@Controller('production/batches')
export class MaterialBatchesController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Get('material/:materialId')
  async findMaterialBatches(
    @Param('materialId', ParseUUIDPipe) materialId: string,
    @CurrentUser() user: any
  ) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.materialsService.findMaterialBatches(materialId, user.storeId);
  }

  @Get(':id')
  async findBatchById(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.materialsService.findBatchById(id, user.storeId);
  }

  @Post()
  async createMaterialBatch(@Body() data: CreateMaterialBatchDto, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    // Garantir que o storeId do body seja ignorado
    delete (data as any).storeId;
    return this.materialsService.createMaterialBatch(data, user.storeId);
  }

  @Put(':id')
  async updateMaterialBatch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: UpdateMaterialBatchDto,
    @CurrentUser() user: any
  ) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    // Garantir que o storeId do body seja ignorado
    delete (data as any).storeId;
    return this.materialsService.updateMaterialBatch(id, data, user.storeId);
  }

  @Delete(':id')
  async deleteMaterialBatch(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    await this.materialsService.deleteMaterialBatch(id, user.storeId);
    return { message: 'Material batch deleted successfully' };
  }
}

@Controller('production/bom')
export class BomController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Get('product/:productId')
  async findProductBom(
    @Param('productId', ParseUUIDPipe) productId: string,
    @CurrentUser() user: any
  ) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.materialsService.findProductBom(productId, user.storeId);
  }

  @Post('batch/products')
  async findMultipleProductsBom(
    @Body() data: { productIds: string[] },
    @CurrentUser() user: any
  ) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.materialsService.findMultipleProductsBom(data.productIds, user.storeId);
  }

  @Post()
  async createBomItem(@Body() data: CreateProductBomDto, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.materialsService.createBomItem(data, user.storeId);
  }

  @Post('batch')
  async createBomItemsBatch(@Body() data: CreateProductBomDto[], @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.materialsService.createBomItemsBatch(data, user.storeId);
  }

  @Put(':id')
  async updateBomItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: UpdateProductBomDto,
    @CurrentUser() user: any
  ) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.materialsService.updateBomItem(id, data, user.storeId);
  }

  @Delete(':id')
  async deleteBomItem(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    await this.materialsService.deleteBomItem(id, user.storeId);
    return { message: 'BOM item deleted successfully' };
  }

  @Post('scale-recipe')
  async scaleRecipe(@Body() data: ScaleRecipeDto, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.materialsService.scaleRecipe(data, user.storeId);
  }
}

@Controller('production/unit-conversions')
export class UnitConversionsController {
  constructor(private readonly unitConversionService: UnitConversionService) {}

  @Get()
  async getConversions(@Query('materialId') materialId?: string) {
    return this.unitConversionService.getConversions(materialId);
  }

  @Post()
  async createConversion(@Body() data: CreateUnitConversionDto) {
    return this.unitConversionService.createConversion(data);
  }

  @Delete(':id')
  async deleteConversion(@Param('id', ParseUUIDPipe) id: string) {
    await this.unitConversionService.deleteConversion(id);
    return { message: 'Unit conversion deleted successfully' };
  }

  @Get('available/:unit')
  async getAvailableConversions(
    @Param('unit') unit: string,
    @Query('materialId') materialId?: string
  ) {
    return this.unitConversionService.getAvailableConversions(unit as any, materialId);
  }
}
