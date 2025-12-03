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
  ParseUUIDPipe,
} from '@nestjs/common';
import { MeasurementUnitsService } from '../../../application/services/measurement-units.service';
import {
  CreateMeasurementUnitDto,
  UpdateMeasurementUnitDto,
  MeasurementUnitsFiltersDto,
} from '../../dto/measurement-unit.dto';

@Controller('production/measurement-units')
export class MeasurementUnitsController {
  constructor(private readonly measurementUnitsService: MeasurementUnitsService) {}

  @Get()
  async getMeasurementUnits(@Query() filters: MeasurementUnitsFiltersDto) {
    return this.measurementUnitsService.getMeasurementUnits(filters);
  }

  @Get('active')
  async getActiveMeasurementUnits() {
    return this.measurementUnitsService.getActiveMeasurementUnits();
  }

  @Get(':id')
  async getMeasurementUnitById(@Param('id', ParseUUIDPipe) id: string) {
    return this.measurementUnitsService.getMeasurementUnitById(id);
  }

  @Post()
  async createMeasurementUnit(@Body() data: CreateMeasurementUnitDto) {
    return this.measurementUnitsService.createMeasurementUnit(data);
  }

  @Put(':id')
  async updateMeasurementUnit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: UpdateMeasurementUnitDto,
  ) {
    return this.measurementUnitsService.updateMeasurementUnit(id, data);
  }

  @Patch(':id/toggle-status')
  async toggleUnitStatus(@Param('id', ParseUUIDPipe) id: string) {
    return this.measurementUnitsService.toggleUnitStatus(id);
  }

  @Delete(':id')
  async deleteMeasurementUnit(@Param('id', ParseUUIDPipe) id: string) {
    await this.measurementUnitsService.deleteMeasurementUnit(id);
    return { message: 'Measurement unit deleted successfully' };
  }
}

