import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { StockService } from '../application/stock.service';
import { CreateStockDto } from './dto/createStock.dto';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';

@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) { }

  @Get()
  async findAll(@CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.stockService.findAll(user.storeId);
  }

  @Get('low-stock')
  async getLowStock(@CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.stockService.getLowStock(user.storeId);
  }

  @Get('alerts')
  async getStockAlerts(@CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.stockService.getStockAlerts(user.storeId);
  }

  @Get('transactions')
  async getTransactions(@CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.stockService.getTransactions(user.storeId);
  }

  @Get('statistics')
  async getStatistics(@CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.stockService.getStatistics(user.storeId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.stockService.findOne(id, user.storeId);
  }

  @Post()
  async create(@Body() data: CreateStockDto, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    // Garantir que o storeId do body seja ignorado e use o do usuário autenticado
    const payload: CreateStockDto = {
      ...data,
      storeId: user.storeId,
    };
    return this.stockService.create(payload, user.storeId);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() data: any, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    // Garantir que o storeId do body seja ignorado e use o do usuário autenticado
    const payload = {
      ...data,
      storeId: user.storeId,
    };
    await this.stockService.update(id, payload, user.storeId);
    return this.stockService.findOne(id, user.storeId);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.stockService.remove(id, user.storeId);
  }
}


