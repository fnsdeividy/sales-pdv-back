import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SalesService } from '@modules/sales/application/services/sales.service';
import { CurrentUser } from '@shared/decorators/current-user.decorator';

@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) { }

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @CurrentUser() user: any,
  ) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    return await this.salesService.findAll(pageNum, limitNum, user.storeId);
  }

  @Get('statistics')
  @HttpCode(HttpStatus.OK)
  async getStatistics(@Query() filters: any, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return await this.salesService.getStatistics({ ...filters, storeId: user.storeId });
  }

  @Get('order/:orderNumber')
  @HttpCode(HttpStatus.OK)
  async findByOrderNumber(@Param('orderNumber') orderNumber: string, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return await this.salesService.findByOrderNumber(orderNumber, user.storeId);
  }

  @Get('customer/:customerId')
  @HttpCode(HttpStatus.OK)
  async findByCustomerId(
    @Param('customerId') customerId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @CurrentUser() user: any,
  ) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    return await this.salesService.findByCustomerId(customerId, pageNum, limitNum, user.storeId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findById(@Param('id') id: string, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return await this.salesService.findById(id, user.storeId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() data: any, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    // Garantir que o storeId do body seja ignorado e use o do usuário autenticado
    delete data.storeId;
    return await this.salesService.create({ ...data, storeId: user.storeId });
  }

  @Post('simple')
  @HttpCode(HttpStatus.CREATED)
  async createSimple(@Body() data: any, @CurrentUser() user: any) {
    // Validação de segurança: garantir que o usuário está autenticado e tem storeId
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    
    // Endpoint simples que cria apenas a order sem items
    // SEMPRE usar o storeId do usuário autenticado, nunca aceitar do body ou usar hardcoded
    const orderData = {
      orderNumber: data.orderNumber || `ORD-${Date.now()}`,
      customerId: data.customerId || null,
      storeId: user.storeId, // SEMPRE usar o storeId do usuário autenticado
      status: data.status || 'pending',
      totalAmount: data.totalAmount || 0,
      items: []
    };
    return await this.salesService.create(orderData);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  async update(@Param('id') id: string, @Body() data: any, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    // Garantir que o storeId do body seja ignorado e use o do usuário autenticado
    delete data.storeId;
    await this.salesService.update(id, data, user.storeId);
    const updatedSale = await this.salesService.findById(id, user.storeId);
    return updatedSale;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    await this.salesService.delete(id, user.storeId);
  }

  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(@Param('id') id: string, @Body() body: { reason?: string }, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return await this.salesService.cancel(id, body.reason, user.storeId);
  }

  @Patch(':id/refund')
  @HttpCode(HttpStatus.OK)
  async refund(@Param('id') id: string, @Body() body: { amount: number; reason?: string }, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return await this.salesService.refund(id, body.amount, body.reason, user.storeId);
  }
}
