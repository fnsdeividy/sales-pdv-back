import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FixedCostsService } from '../../../application/services/fixed-costs.service';
import {
  CreateFixedCostDto,
  UpdateFixedCostDto,
  FixedCostsFiltersDto,
} from '../../dto/fixed-cost.dto';
import { CurrentUser } from '../../../../../shared/decorators/current-user.decorator';

@Controller('production/fixed-costs')
export class FixedCostsController {
  constructor(private readonly fixedCostsService: FixedCostsService) {}

  @Get()
  async getFixedCosts(@Query() filters: FixedCostsFiltersDto, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.fixedCostsService.getFixedCosts(filters, user.storeId);
  }

  @Get('summary')
  async getCostsSummary(@Query() filters: FixedCostsFiltersDto, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.fixedCostsService.getCostsSummary(filters, user.storeId);
  }

  @Get(':id')
  async getFixedCostById(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.fixedCostsService.getFixedCostById(id, user.storeId);
  }

  @Post()
  async createFixedCost(@Body() data: CreateFixedCostDto, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    // Garantir que o storeId do body seja ignorado
    delete (data as any).storeId;
    return this.fixedCostsService.createFixedCost(data, user.storeId);
  }

  @Patch(':id')
  async updateFixedCost(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: UpdateFixedCostDto,
    @CurrentUser() user: any,
  ) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    // Garantir que o storeId do body seja ignorado
    delete (data as any).storeId;
    return this.fixedCostsService.updateFixedCost(id, data, user.storeId);
  }

  @Delete(':id')
  async deleteFixedCost(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    await this.fixedCostsService.deleteFixedCost(id, user.storeId);
    return { message: 'Fixed cost deleted successfully' };
  }

  @Patch(':id/toggle-status')
  async toggleCostStatus(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.fixedCostsService.toggleCostStatus(id, user.storeId);
  }

  @Post(':id/duplicate')
  async duplicateCost(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: { name: string },
    @CurrentUser() user: any,
  ) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.fixedCostsService.duplicateCost(id, data.name, user.storeId);
  }
}
