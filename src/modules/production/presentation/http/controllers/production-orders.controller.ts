import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ProductionOrdersService } from '../../../application/services/production-orders.service';
import { CostCalculationService } from '../../../application/services/cost-calculation.service';
import {
  CreateProductionOrderDto,
  UpdateProductionOrderDto,
  StartProductionOrderDto,
  FinishProductionOrderDto,
} from '../../dto/production-order.dto';
import { CurrentUser } from '../../../../../shared/decorators/current-user.decorator';

@Controller('production/orders')
export class ProductionOrdersController {
  constructor(
    private readonly productionOrdersService: ProductionOrdersService,
    private readonly costCalculationService: CostCalculationService
  ) {}

  @Get()
  async findAll(@CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.productionOrdersService.findAll(user.storeId);
  }

  @Get('metrics')
  async getProductionMetrics(@CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.productionOrdersService.getProductionMetrics(user.storeId);
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.productionOrdersService.findById(id, user.storeId);
  }

  @Post()
  async create(@Body() data: CreateProductionOrderDto, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    // Garantir que o storeId do body seja ignorado
    delete (data as any).storeId;
    return this.productionOrdersService.create(data, user.storeId);
  }

  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: UpdateProductionOrderDto,
    @CurrentUser() user: any
  ) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    // Garantir que o storeId do body seja ignorado
    delete (data as any).storeId;
    return this.productionOrdersService.update(id, data, user.storeId);
  }

  @Delete(':id')
  async delete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    await this.productionOrdersService.delete(id, user.storeId);
    return { message: 'Production order deleted successfully' };
  }

  @Post(':id/start')
  async startProduction(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: StartProductionOrderDto,
    @CurrentUser() user: any
  ) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.productionOrdersService.startProduction(id, data, user.storeId);
  }

  @Post(':id/finish')
  async finishProduction(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: FinishProductionOrderDto,
    @CurrentUser() user: any
  ) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.productionOrdersService.finishProduction(id, data, user.storeId);
  }

  @Post(':id/cancel')
  async cancelProduction(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.productionOrdersService.cancelProduction(id, user.storeId);
  }

  @Get(':id/material-availability')
  async checkMaterialAvailability(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.productionOrdersService.checkMaterialAvailability(id, user.storeId);
  }

  @Get(':id/cost-breakdown')
  async getCostBreakdown(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.productionOrdersService.getCostBreakdown(id, user.storeId);
  }
}

@Controller('production/costs')
export class CostCalculationController {
  constructor(private readonly costCalculationService: CostCalculationService) {}

  @Get('suggested-price/:productId')
  async getSuggestedPrice(
    @Param('productId', ParseUUIDPipe) productId: string,
    @CurrentUser() user: any,
    @Query('markup') markup: number = 30,
    @Query('outputQty') outputQty?: number,
    @Query('outputUnit') outputUnit?: string,
    @Query('packagingCostPerUnit') packagingCostPerUnit?: number,
    @Query('overheadPercent') overheadPercent?: number
  ) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    const suggestedPrice = await this.costCalculationService.getSuggestedPrice(
      productId,
      markup,
      outputQty ? parseFloat(outputQty.toString()) : undefined,
      outputUnit as any,
      packagingCostPerUnit ? parseFloat(packagingCostPerUnit.toString()) : undefined,
      overheadPercent ? parseFloat(overheadPercent.toString()) : undefined,
    );
    return { productId, markup, suggestedPrice };
  }

  @Get('history/:productId')
  async getProductCostHistory(
    @Param('productId', ParseUUIDPipe) productId: string,
    @CurrentUser() user: any,
    @Query('limit') limit?: number
  ) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.costCalculationService.getProductCostHistory(
      productId,
      limit ? parseInt(limit.toString()) : 10,
    );
  }
}
