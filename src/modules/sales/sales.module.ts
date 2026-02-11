import { Module } from '@nestjs/common';
import { SalesController } from './presentation/http/controllers/sales.controller';
import { SalesCompatController } from './presentation/http/controllers/sales-compat.controller';
import { SalesService } from './application/services/sales.service';
import { SalesRepository } from './infra/repositories/sales.repository';
import { PrismaModule } from '@modules/prisma/prisma.module';
import { NfeModule } from '@modules/nfe/nfe.module';
import { StoresModule } from '@modules/store/stores.module';
import { SALES_REPOSITORY } from './presentation/interfaces/sales.interface';

@Module({
  imports: [PrismaModule, NfeModule, StoresModule],
  controllers: [SalesController, SalesCompatController],
  providers: [
    SalesService,
    {
      provide: SALES_REPOSITORY,
      useClass: SalesRepository,
    },
  ],
  exports: [SalesService],
})
export class SalesModule { }
