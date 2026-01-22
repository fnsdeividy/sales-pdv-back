import { Sale, SaleItem } from '@modules/sales/entities/sale.entity';

export const SALES_REPOSITORY = 'SALES_REPOSITORY';

export interface ISalesRepository {
  findAll(page: number, limit: number, storeId?: string): Promise<{ sales: Sale[]; total: number; totalPages: number }>;
  findById(id: string, storeId?: string): Promise<Sale | null>;
  findByOrderNumber(orderNumber: string, storeId?: string): Promise<Sale | null>;
  findByCustomerId(customerId: string, page: number, limit: number, storeId?: string): Promise<{ sales: Sale[]; total: number; totalPages: number }>;
  findByStoreId(storeId: string, page: number, limit: number): Promise<{ sales: Sale[]; total: number; totalPages: number }>;
  create(data: Partial<Sale>): Promise<Sale>;
  update(id: string, data: Partial<Sale>): Promise<void>;
  delete(id: string): Promise<void>;
  getStatistics(filters: any): Promise<{
    totalSales: number;
    totalRevenue: number;
    averageTicket: number;
    salesByStatus: Record<string, number>;
    salesByPaymentMethod: Record<string, number>;
  }>;
}

export interface ISalesService {
  findAll(page: number, limit: number, storeId?: string): Promise<{ sales: Sale[]; total: number; totalPages: number }>;
  findById(id: string, storeId?: string): Promise<Sale | null>;
  findByOrderNumber(orderNumber: string, storeId?: string): Promise<Sale | null>;
  findByCustomerId(customerId: string, page: number, limit: number, storeId?: string): Promise<{ sales: Sale[]; total: number; totalPages: number }>;
  findByStoreId(storeId: string, page: number, limit: number): Promise<{ sales: Sale[]; total: number; totalPages: number }>;
  create(data: Partial<Sale>): Promise<Sale>;
  update(id: string, data: Partial<Sale>, storeId?: string): Promise<void>;
  delete(id: string, storeId?: string): Promise<void>;
  cancel(id: string, reason?: string, storeId?: string): Promise<Sale>;
  refund(id: string, amount: number, reason?: string, storeId?: string): Promise<Sale>;
  getStatistics(filters: any): Promise<{
    totalSales: number;
    totalRevenue: number;
    averageTicket: number;
    salesByStatus: Record<string, number>;
    salesByPaymentMethod: Record<string, number>;
  }>;
}
