import { Module } from '@nestjs/common';
import { InvoiceController } from './presentation/invoice.controller';
import { InvoiceService } from './application/invoice.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [InvoiceController],
  providers: [InvoiceService],
  exports: [InvoiceService],
})
export class InvoiceModule {}
