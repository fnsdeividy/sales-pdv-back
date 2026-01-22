import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Sale } from '@modules/sales/entities/sale.entity';
import { ISalesService, ISalesRepository, SALES_REPOSITORY } from '@modules/sales/presentation/interfaces/sales.interface';

@Injectable()
export class SalesService implements ISalesService {
  constructor(
    @Inject(SALES_REPOSITORY)
    private readonly salesRepository: ISalesRepository
  ) { }

  async findAll(page: number = 1, limit: number = 10, storeId?: string): Promise<{ sales: Sale[]; total: number; totalPages: number }> {
    if (!storeId) {
      throw new NotFoundException('Store ID is required');
    }
    return await this.salesRepository.findAll(page, limit, storeId);
  }

  async findById(id: string, storeId?: string): Promise<Sale | null> {
    if (!storeId) {
      throw new NotFoundException('Store ID is required');
    }
    const sale = await this.salesRepository.findById(id, storeId);
    if (!sale) {
      throw new NotFoundException('Sale not found in your store');
    }
    return sale;
  }

  async findByOrderNumber(orderNumber: string, storeId?: string): Promise<Sale | null> {
    if (!storeId) {
      throw new NotFoundException('Store ID is required');
    }
    return await this.salesRepository.findByOrderNumber(orderNumber, storeId);
  }

  async findByCustomerId(customerId: string, page: number = 1, limit: number = 10, storeId?: string): Promise<{ sales: Sale[]; total: number; totalPages: number }> {
    if (!storeId) {
      throw new NotFoundException('Store ID is required');
    }
    return await this.salesRepository.findByCustomerId(customerId, page, limit, storeId);
  }

  async findByStoreId(storeId: string, page: number, limit: number): Promise<{ sales: Sale[]; total: number; totalPages: number }> {
    if (!storeId) {
      throw new NotFoundException('Store ID is required');
    }
    return this.salesRepository.findByStoreId(storeId, page, limit);
  }

  async create(data: Partial<Sale>): Promise<Sale> {
    if (!data.storeId) {
      throw new NotFoundException('Store ID is required');
    }
    return await this.salesRepository.create(data);
  }

  async update(id: string, data: Partial<Sale>, storeId?: string): Promise<void> {
    if (!storeId) {
      throw new NotFoundException('Store ID is required');
    }
    const existingSale = await this.salesRepository.findById(id, storeId);
    if (!existingSale) {
      throw new NotFoundException('Sale not found in your store');
    }
    await this.salesRepository.update(id, data);
  }

  async delete(id: string, storeId?: string): Promise<void> {
    if (!storeId) {
      throw new NotFoundException('Store ID is required');
    }
    const existingSale = await this.salesRepository.findById(id, storeId);
    if (!existingSale) {
      throw new NotFoundException('Sale not found in your store');
    }
    await this.salesRepository.delete(id);
  }

  async cancel(id: string, reason?: string, storeId?: string): Promise<Sale> {
    if (!storeId) {
      throw new NotFoundException('Store ID is required');
    }
    const existingSale = await this.salesRepository.findById(id, storeId);
    if (!existingSale) {
      throw new NotFoundException('Sale not found in your store');
    }
    
    await this.salesRepository.update(id, { 
      status: 'cancelled',
      notes: reason ? `Cancelado: ${reason}` : 'Cancelado'
    });
    
    return await this.salesRepository.findById(id, storeId) as Sale;
  }

  async refund(id: string, amount: number, reason?: string, storeId?: string): Promise<Sale> {
    if (!storeId) {
      throw new NotFoundException('Store ID is required');
    }
    const existingSale = await this.salesRepository.findById(id, storeId);
    if (!existingSale) {
      throw new NotFoundException('Sale not found in your store');
    }
    
    await this.salesRepository.update(id, { 
      status: 'refunded',
      notes: reason ? `Reembolsado: ${reason} - Valor: R$ ${amount}` : `Reembolsado - Valor: R$ ${amount}`
    });
    
    return await this.salesRepository.findById(id, storeId) as Sale;
  }

  async getStatistics(filters: any): Promise<{
    totalSales: number;
    totalRevenue: number;
    averageTicket: number;
    salesByStatus: Record<string, number>;
    salesByPaymentMethod: Record<string, number>;
  }> {
    return await this.salesRepository.getStatistics(filters);
  }
}
