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
  HttpStatus,
  HttpCode,
  BadRequestException,
  StreamableFile,
} from '@nestjs/common';
import { IsString, IsNumber, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { InvoiceService } from '../application/invoice.service';
import { CurrentUser } from '@shared/decorators/current-user.decorator';

export class CreateInvoiceDto {
  @IsString()
  customerId!: string;

  @IsString()
  customerName!: string;

  @Type(() => Number)
  @IsNumber()
  totalAmount!: number;

  @IsOptional()
  @IsString()
  issueDate?: string;

  @IsOptional()
  @IsString()
  dueDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  taxAmount?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

@Controller('invoices')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @CurrentUser() user: { storeId?: string },
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('customerName') customerName?: string,
  ) {
    if (!user?.storeId) {
      throw new BadRequestException('StoreId não encontrado. Usuário não está associado a uma loja.');
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    return this.invoiceService.findAll(
      pageNum,
      limitNum,
      { status, startDate, endDate, customerName },
      user.storeId,
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: { storeId?: string },
    @Body() body: CreateInvoiceDto,
  ) {
    if (!user?.storeId) {
      throw new BadRequestException('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.invoiceService.create(user.storeId, body);
  }

  @Patch(':id/issue')
  @HttpCode(HttpStatus.OK)
  async issue(@Param('id') id: string, @CurrentUser() user: { storeId?: string }) {
    if (!user?.storeId) throw new BadRequestException('StoreId não encontrado.');
    return this.invoiceService.issue(id, user.storeId);
  }

  @Patch(':id/send')
  @HttpCode(HttpStatus.OK)
  async send(@Param('id') id: string, @CurrentUser() user: { storeId?: string }, @Body() _body?: { email?: string }) {
    if (!user?.storeId) throw new BadRequestException('StoreId não encontrado.');
    return this.invoiceService.send(id, user.storeId);
  }

  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(@Param('id') id: string, @CurrentUser() user: { storeId?: string }, @Body() _body?: { reason?: string }) {
    if (!user?.storeId) throw new BadRequestException('StoreId não encontrado.');
    return this.invoiceService.cancel(id, user.storeId);
  }

  @Patch(':id/mark-paid')
  @HttpCode(HttpStatus.OK)
  async markPaid(@Param('id') id: string, @CurrentUser() user: { storeId?: string }, @Body() _body?: { paymentDate?: string }) {
    if (!user?.storeId) throw new BadRequestException('StoreId não encontrado.');
    return this.invoiceService.markPaid(id, user.storeId);
  }

  @Get(':id/download')
  async download(
    @Param('id') id: string,
    @Query('format') format: 'pdf' | 'xml' = 'pdf',
    @CurrentUser() user?: { storeId?: string },
  ): Promise<StreamableFile | { downloadUrl: string }> {
    if (!user?.storeId) throw new BadRequestException('StoreId não encontrado.');
    if (format === 'pdf') {
      const buffer = await this.invoiceService.getPdfBuffer(id, user.storeId);
      return new StreamableFile(buffer, {
        type: 'application/pdf',
        disposition: `attachment; filename="nota-fiscal-${id}.pdf"`,
      });
    }
    return this.invoiceService.getDownloadUrl(id, user.storeId, format);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @CurrentUser() user: { storeId?: string },
    @Body() body: { customerName?: string; totalAmount?: number; issueDate?: string; dueDate?: string; notes?: string },
  ) {
    if (!user?.storeId) throw new BadRequestException('StoreId não encontrado.');
    return this.invoiceService.update(id, user.storeId, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string, @CurrentUser() user: { storeId?: string }) {
    if (!user?.storeId) throw new BadRequestException('StoreId não encontrado.');
    await this.invoiceService.delete(id, user.storeId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findById(@Param('id') id: string, @CurrentUser() user: { storeId?: string }) {
    if (!user?.storeId) {
      throw new BadRequestException('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.invoiceService.findById(id, user.storeId);
  }
}
