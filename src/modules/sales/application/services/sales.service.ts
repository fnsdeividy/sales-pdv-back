import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { Sale } from '@modules/sales/entities/sale.entity';
import { ISalesService, ISalesRepository, SALES_REPOSITORY } from '@modules/sales/presentation/interfaces/sales.interface';
import { NfeService } from '@modules/nfe/application/services/nfe.service';
import { StoresService } from '@modules/store/application/stores.service';

@Injectable()
export class SalesService implements ISalesService {
  constructor(
    @Inject(SALES_REPOSITORY)
    private readonly salesRepository: ISalesRepository,
    private readonly nfeService: NfeService,
    private readonly storesService: StoresService,
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

  async create(data: Partial<Sale> & { emitirNotaFiscal?: boolean; tipoNota?: 'NFCE' | 'NFE'; valorRecebido?: number }): Promise<Sale & { notaFiscalId?: string; statusNota?: string; urlDanfe?: string }> {
    if (!data.storeId) {
      throw new NotFoundException('Store ID is required');
    }

    const fiscalStatus = await this.storesService.getFiscalStatus(data.storeId);
    const isCompletedSale = (data.status || 'pending') === 'completed';
    const canIssueFiscal = fiscalStatus.isFiscalEnabled && !!data.emitirNotaFiscal && isCompletedSale;

    // Validação: NF-e exige customerId
    if (canIssueFiscal && data.tipoNota === 'NFE' && !data.customerId) {
      throw new BadRequestException('NF-e exige que um cliente seja selecionado.');
    }

    const salePayload: Partial<Sale> = {
      ...data,
      ...(isCompletedSale
        ? {
            documentType: canIssueFiscal ? 'NFC_E' : 'NON_FISCAL',
            documentIssuedAt: new Date(),
            isFiscal: canIssueFiscal,
          }
        : {}),
    };

    // Criar a venda (Order)
    const sale = await this.salesRepository.create(salePayload);

    // Se emitirNotaFiscal = true, chamar o NfeService
    let notaFiscalId: string | undefined;
    let statusNota: string | undefined;
    let urlDanfe: string | undefined;

    if (canIssueFiscal) {
      try {
        const modelo = data.tipoNota === 'NFE' ? '55' : '65';
        
        if (data.tipoNota === 'NFE') {
          const nfeDocument = await this.nfeService.emitirNfeParaOrder(sale.id, data.storeId, modelo);
          notaFiscalId = nfeDocument.id;
          statusNota = nfeDocument.status;
          await this.salesRepository.update(sale.id, {
            documentType: 'NFC_E',
            documentNumber: String(nfeDocument.numero),
            documentIssuedAt: new Date(),
            isFiscal: true,
          });
          // urlDanfe pode ser construído com base no xmlAutorizado ou outro endpoint
          // Por simplicidade, vamos retornar um campo vazio por enquanto
          // Em produção, seria necessário gerar/expor URL do DANFE
          urlDanfe = nfeDocument.xmlAutorizado ? `/api/v1/nfe/${nfeDocument.id}/danfe` : undefined;
        } else if (data.tipoNota === 'NFCE') {
          // Emitir NFC-e usando modelo 65
          const nfceDocument = await this.nfeService.emitirNfeParaOrder(sale.id, data.storeId, modelo);
          notaFiscalId = nfceDocument.id;
          statusNota = nfceDocument.status;
          await this.salesRepository.update(sale.id, {
            documentType: 'NFC_E',
            documentNumber: String(nfceDocument.numero),
            documentIssuedAt: new Date(),
            isFiscal: true,
          });
          urlDanfe = nfceDocument.xmlAutorizado ? `/api/v1/nfe/${nfceDocument.id}/danfe` : undefined;
        }
      } catch (error) {
        // Se falhar a emissão da nota, a venda já foi criada
        // Logar o erro e retornar a venda sem nota
        console.error('Erro ao emitir nota fiscal:', error);
        throw new BadRequestException(`Venda criada, mas erro ao emitir nota: ${error.message}`);
      }
    }

    const saleWithDocuments = await this.salesRepository.findById(sale.id, data.storeId);

    return {
      ...(saleWithDocuments || sale),
      notaFiscalId,
      statusNota,
      urlDanfe,
    };
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
