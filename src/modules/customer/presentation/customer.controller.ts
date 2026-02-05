import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpCode,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { CustomerService } from '../application/customer.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';

@Controller('customers')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) { }

  @Get()
  async findAll(
    @CurrentUser() user: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
    @Query('city') city?: string,
    @Query('state') state?: string,
    @Query('hasEmail') hasEmail?: string,
    @Query('hasPhone') hasPhone?: string,
  ) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    const filters = {
      search,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      city,
      state,
      hasEmail: hasEmail !== undefined ? hasEmail === 'true' : undefined,
      hasPhone: hasPhone !== undefined ? hasPhone === 'true' : undefined,
    };

    return this.customerService.findAll(pageNum, limitNum, filters, user.storeId);
  }

  @Get('search')
  async search(
    @CurrentUser() user: any,
    @Query('name') name?: string,
    @Query('email') email?: string,
    @Query('phone') phone?: string,
  ) {
    // #region agent log
    fetch('http://127.0.0.1:7251/ingest/1e176226-6578-43f9-889c-e98ee7f619a4', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'customers-search',
        hypothesisId: 'H1',
        location: 'customer.controller.ts:search',
        message: 'CustomerController.search called',
        data: { hasStoreId: !!user?.storeId, name, email, phone },
        timestamp: Date.now(),
      }),
    }).catch(() => { });
    // #endregion

    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }

    return this.customerService.search(
      {
        name,
        email,
        phone,
      },
      user.storeId,
    );
  }

  @Get('statistics')
  async getStatistics(@CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.customerService.getStatistics(user.storeId);
  }

  @Get(':id')
  async findById(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Query('name') name?: string,
    @Query('email') email?: string,
    @Query('phone') phone?: string,
  ) {
    // #region agent log
    fetch('http://127.0.0.1:7251/ingest/1e176226-6578-43f9-889c-e98ee7f619a4', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'customers-search',
        hypothesisId: 'H1',
        location: 'customer.controller.ts:findById',
        message: 'CustomerController.findById called',
        data: { id, hasStoreId: !!user?.storeId, name, email, phone },
        timestamp: Date.now(),
      }),
    }).catch(() => { });
    // #endregion

    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }

    // Compatibilidade: se a rota bater em /customers/search, tratar como busca em vez de buscar por ID literal "search"
    if (id === 'search') {
      return this.customerService.search(
        {
          name,
          email,
          phone,
        },
        user.storeId,
      );
    }

    return this.customerService.findById(id, user.storeId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createCustomerDto: any, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    // Garantir que o storeId do body seja ignorado e use o do usuário autenticado
    delete createCustomerDto.storeId;
    return this.customerService.create(createCustomerDto, user.storeId);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateCustomerDto: any,
    @CurrentUser() user: any,
  ) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    // Garantir que o storeId do body seja ignorado e use o do usuário autenticado
    delete updateCustomerDto.storeId;
    return this.customerService.update(id, updateCustomerDto, user.storeId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.customerService.delete(id, user.storeId);
  }

  @Post(':id/activate')
  async activate(@Param('id') id: string, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.customerService.activate(id, user.storeId);
  }

  @Post(':id/deactivate')
  async deactivate(@Param('id') id: string, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.customerService.deactivate(id, user.storeId);
  }

  @Get(':id/orders')
  async getCustomerOrders(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    return this.customerService.getCustomerOrders(id, pageNum, limitNum, user.storeId);
  }

  @Get('export/csv')
  async exportToCSV(
    @Res() res: Response,
    @CurrentUser() user: any,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
    @Query('city') city?: string,
    @Query('state') state?: string,
  ) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }

    const filters = {
      search,
      isActive: isActive ? isActive === 'true' : undefined,
      city,
      state,
    };

    const csvData = await this.customerService.exportToCSV(filters, user.storeId);

    const fileName = `clientes-${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'no-cache');

    return res.send(csvData);
  }
}
