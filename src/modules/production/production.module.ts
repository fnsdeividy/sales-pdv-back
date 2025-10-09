import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';

// Services
import { MaterialsService } from './application/services/materials.service';
import { UnitConversionService } from './application/services/unit-conversion.service';
import { CostCalculationService } from './application/services/cost-calculation.service';
import { ProductionOrdersService } from './application/services/production-orders.service';
import { FixedCostsService } from './application/services/fixed-costs.service';

// Controllers
import {
  MaterialsController,
  MaterialBatchesController,
  BomController,
  UnitConversionsController,
} from './presentation/http/controllers/materials.controller';
import {
  ProductionOrdersController,
  CostCalculationController,
} from './presentation/http/controllers/production-orders.controller';
import { FixedCostsController } from './presentation/http/controllers/fixed-costs.controller';

@Module({
  imports: [PrismaModule],
  controllers: [
    MaterialsController,
    MaterialBatchesController,
    BomController,
    UnitConversionsController,
    ProductionOrdersController,
    CostCalculationController,
    FixedCostsController,
  ],
  providers: [
    UnitConversionService,
    MaterialsService,
    CostCalculationService,
    ProductionOrdersService,
    FixedCostsService,
  ],
  exports: [
    MaterialsService,
    UnitConversionService,
    CostCalculationService,
    ProductionOrdersService,
    FixedCostsService,
  ],
})
export class ProductionModule {}
