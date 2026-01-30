import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface InvoiceListFilters {
  status?: string;
  startDate?: string;
  endDate?: string;
  customerName?: string;
  page?: number;
  limit?: number;
}

export interface InvoiceListResult {
  invoices: Array<{
    id: string;
    number: string;
    series: string | null;
    customerId: string;
    customerName: string;
    customerDocument: string;
    customerAddress: string;
    customerCity: string;
    customerState: string;
    customerZipCode: string;
    total: number;
    subtotal: number;
    taxAmount: number;
    discountAmount: number;
    status: string;
    issueDate: string;
    dueDate: string;
    paymentDate?: string;
    items: Array<unknown>;
    notes?: string;
    terms?: string;
    storeId: string;
    userId: string;
    createdAt: string;
    updatedAt: string;
  }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class InvoiceService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    page: number = 1,
    limit: number = 20,
    filters: InvoiceListFilters = {},
    storeId: string,
  ): Promise<InvoiceListResult> {
    if (!storeId) {
      throw new NotFoundException('StoreId não encontrado.');
    }

    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = { storeId };

    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.customerName) {
      where.customerName = { contains: filters.customerName, mode: 'insensitive' };
    }
    if (filters.startDate || filters.endDate) {
      where.issueDate = {};
      if (filters.startDate) {
        (where.issueDate as Record<string, unknown>).gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        (where.issueDate as Record<string, unknown>).lte = new Date(filters.endDate);
      }
    }

    const [rows, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { customer: true },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);
    const invoices = rows.map((inv) => this.toApiInvoice(inv));

    return {
      invoices,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async findById(id: string, storeId: string) {
    if (!storeId) {
      throw new NotFoundException('StoreId não encontrado.');
    }
    const inv = await this.prisma.invoice.findFirst({
      where: { id, storeId },
      include: { customer: true },
    });
    if (!inv) {
      throw new NotFoundException('Nota fiscal não encontrada.');
    }
    return this.toApiInvoice(inv);
  }

  /** Corpo esperado pelo frontend (CreateInvoiceRequest) ou simplificado com customerId */
  async create(
    storeId: string,
    body: {
      customerId: string;
      customerName: string;
      totalAmount: number;
      issueDate?: string;
      dueDate?: string;
      taxAmount?: number;
      notes?: string;
    },
  ) {
    if (!storeId) {
      throw new NotFoundException('StoreId não encontrado.');
    }

    const customer = await this.prisma.customer.findFirst({
      where: { id: body.customerId, storeId },
    });
    if (!customer) {
      throw new NotFoundException('Cliente não encontrado.');
    }

    const count = await this.prisma.invoice.count({ where: { storeId } });
    const invoiceNumber = `NF-${String(count + 1).padStart(6, '0')}`;
    const issueDate = body.issueDate ? new Date(body.issueDate) : new Date();
    const dueDate = body.dueDate ? new Date(body.dueDate) : null;
    const taxAmount = body.taxAmount ?? 0;

    const inv = await this.prisma.invoice.create({
      data: {
        invoiceNumber,
        series: null,
        customerId: body.customerId,
        customerName: body.customerName,
        status: 'draft',
        issueDate,
        dueDate,
        totalAmount: body.totalAmount,
        taxAmount,
        notes: body.notes ?? null,
        storeId,
      },
      include: { customer: true },
    });

    return this.toApiInvoice(inv);
  }

  async update(
    id: string,
    storeId: string,
    body: { customerName?: string; totalAmount?: number; issueDate?: string; dueDate?: string; notes?: string },
  ) {
    await this.ensureExistsAndOwnership(id, storeId);
    const inv = await this.prisma.invoice.update({
      where: { id },
      data: {
        ...(body.customerName != null && { customerName: body.customerName }),
        ...(body.totalAmount != null && { totalAmount: body.totalAmount }),
        ...(body.issueDate != null && { issueDate: new Date(body.issueDate) }),
        ...(body.dueDate != null && { dueDate: new Date(body.dueDate) }),
        ...(body.notes !== undefined && { notes: body.notes }),
      },
      include: { customer: true },
    });
    return this.toApiInvoice(inv);
  }

  async delete(id: string, storeId: string): Promise<void> {
    await this.ensureExistsAndOwnership(id, storeId);
    await this.prisma.invoice.delete({ where: { id } });
  }

  async issue(id: string, storeId: string) {
    const inv = await this.ensureExistsAndOwnership(id, storeId);
    if (inv.status !== 'draft') {
      throw new NotFoundException('Apenas rascunhos podem ser emitidos.');
    }
    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { status: 'issued' },
      include: { customer: true },
    });
    return this.toApiInvoice(updated);
  }

  async send(id: string, _storeId: string): Promise<{ message: string }> {
    await this.ensureExistsAndOwnership(id, _storeId);
    return { message: 'Envio de nota fiscal registrado.' };
  }

  async cancel(id: string, storeId: string) {
    await this.ensureExistsAndOwnership(id, storeId);
    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { status: 'cancelled' },
      include: { customer: true },
    });
    return this.toApiInvoice(updated);
  }

  async markPaid(id: string, storeId: string) {
    await this.ensureExistsAndOwnership(id, storeId);
    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { status: 'paid' },
      include: { customer: true },
    });
    return this.toApiInvoice(updated);
  }

  async getDownloadUrl(id: string, storeId: string, _format: 'pdf' | 'xml'): Promise<{ downloadUrl: string }> {
    await this.ensureExistsAndOwnership(id, storeId);
    return { downloadUrl: `/api/v1/invoices/${id}/download?format=pdf` };
  }

  private async ensureExistsAndOwnership(id: string, storeId: string) {
    const inv = await this.prisma.invoice.findFirst({
      where: { id, storeId },
      include: { customer: true },
    });
    if (!inv) throw new NotFoundException('Nota fiscal não encontrada.');
    return inv;
  }

  private toApiInvoice(inv: {
    id: string;
    invoiceNumber: string;
    series: string | null;
    customerId: string;
    customerName: string;
    status: string;
    issueDate: Date;
    dueDate: Date | null;
    totalAmount: unknown;
    taxAmount: unknown;
    notes: string | null;
    storeId: string;
    createdAt: Date;
    updatedAt: Date;
    customer?: { address: string | null; city: string | null; state: string | null; zipCode: string | null };
  }) {
    const total = Number(inv.totalAmount);
    const taxAmount = inv.taxAmount != null ? Number(inv.taxAmount) : 0;
    const customer = inv.customer;
    return {
      id: inv.id,
      number: inv.invoiceNumber,
      series: inv.series ?? '',
      customerId: inv.customerId,
      customerName: inv.customerName,
      customerDocument: '',
      customerAddress: customer?.address ?? '',
      customerCity: customer?.city ?? '',
      customerState: customer?.state ?? '',
      customerZipCode: customer?.zipCode ?? '',
      total,
      subtotal: total - taxAmount,
      taxAmount,
      discountAmount: 0,
      status: inv.status,
      issueDate: inv.issueDate.toISOString(),
      dueDate: (inv.dueDate ?? inv.issueDate).toISOString(),
      paymentDate: undefined,
      items: [],
      notes: inv.notes ?? undefined,
      terms: undefined,
      storeId: inv.storeId,
      userId: '',
      createdAt: inv.createdAt.toISOString(),
      updatedAt: inv.updatedAt.toISOString(),
    };
  }
}
