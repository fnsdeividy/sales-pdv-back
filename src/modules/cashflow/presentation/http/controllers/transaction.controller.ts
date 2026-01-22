import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Request,
} from '@nestjs/common';
import { TransactionService } from '@modules/cashflow/application/services/transaction.service';
import { CreateTransactionDto } from '@modules/cashflow/presentation/dto/createTransaction.dto';
import { UpdateTransactionDto } from '@modules/cashflow/presentation/dto/updateTransaction.dto';
import { CurrentUser } from '../../../../../shared/decorators/current-user.decorator';

@Controller('cashflow')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) { }

  @Post()
  async create(@Body() createTransactionDto: CreateTransactionDto, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    if (!user?.id) {
      throw new Error('Usuário não autenticado.');
    }
    
    // Garantir que o storeId do body seja ignorado e use o do usuário autenticado
    delete (createTransactionDto as any).storeId;
    
    const result = await this.transactionService.create(createTransactionDto, user.id, user.storeId);

    return {
      success: true,
      data: result
    };
  }

  @Get()
  async findAll(
    @CurrentUser() user: any,
    @Query('type') type?: string,
    @Query('category') category?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('minAmount') minAmount?: number,
    @Query('maxAmount') maxAmount?: number,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }

    // Sempre usar o storeId do usuário autenticado, ignorando query parameter
    const result = await this.transactionService.findAll({
      type: type as any,
      category,
      startDate,
      endDate,
      storeId: user.storeId, // Sempre do usuário autenticado
      minAmount,
      maxAmount,
      page,
      limit
    });

    return {
      success: true,
      data: result
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.transactionService.findById(id, user.storeId);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string, 
    @Body() updateTransactionDto: UpdateTransactionDto,
    @CurrentUser() user: any,
  ) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    // Garantir que o storeId do body seja ignorado
    delete (updateTransactionDto as any).storeId;
    return this.transactionService.update(id, updateTransactionDto, user.storeId);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.transactionService.delete(id, user.storeId);
  }

  @Get('summary/overview')
  async getCashFlowSummary(
    @CurrentUser() user: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }

    const result = await this.transactionService.getCashFlowSummary({ 
      startDate, 
      endDate, 
      storeId: user.storeId // Sempre do usuário autenticado
    });

    return {
      success: true,
      data: result
    };
  }

  @Get('categories/list')
  async getCategories(@CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.transactionService.getCategories(user.storeId);
  }

  @Get('by-date-range')
  async findByDateRange(
    @CurrentUser() user: any,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.transactionService.findByDateRange(startDate, endDate, user.storeId);
  }

  @Get('by-category/:category')
  async findByCategory(@Param('category') category: string, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.transactionService.findByCategory(category, user.storeId);
  }

  @Get('statistics/overview')
  async getStatistics(
    @CurrentUser() user: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.transactionService.getStatistics({ 
      startDate, 
      endDate, 
      storeId: user.storeId // Sempre do usuário autenticado
    });
  }

  @Get('export/transactions')
  async exportTransactions(
    @CurrentUser() user: any,
    @Query('type') type?: string,
    @Query('category') category?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('format') format: 'csv' | 'xlsx' = 'csv',
  ) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.transactionService.exportTransactions(
      { 
        type: type as any, 
        category, 
        startDate, 
        endDate, 
        storeId: user.storeId // Sempre do usuário autenticado
      },
      format
    );
  }
}
