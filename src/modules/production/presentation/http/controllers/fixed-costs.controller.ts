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
import { FixedCostsService } from '../../../application/services/fixed-costs.service';
import {
  CreateFixedCostDto,
  UpdateFixedCostDto,
  FixedCostsFiltersDto,
} from '../../dto/fixed-cost.dto';

@Controller('production/fixed-costs')
export class FixedCostsController {
  constructor(private readonly fixedCostsService: FixedCostsService) {}

  @Get()
  async getFixedCosts(@Query() filters: FixedCostsFiltersDto) {
    return this.fixedCostsService.getFixedCosts(filters);
  }

  @Get('summary')
  async getCostsSummary(@Query() filters: FixedCostsFiltersDto) {
    return this.fixedCostsService.getCostsSummary(filters);
  }

  @Get(':id')
  async getFixedCostById(@Param('id', ParseUUIDPipe) id: string) {
    return this.fixedCostsService.getFixedCostById(id);
  }

  @Post()
  async createFixedCost(@Body() data: CreateFixedCostDto) {
    return this.fixedCostsService.createFixedCost(data);
  }

  @Patch(':id')
  async updateFixedCost(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: UpdateFixedCostDto,
  ) {
    return this.fixedCostsService.updateFixedCost(id, data);
  }

  @Delete(':id')
  async deleteFixedCost(@Param('id', ParseUUIDPipe) id: string) {
    await this.fixedCostsService.deleteFixedCost(id);
    return { message: 'Fixed cost deleted successfully' };
  }

  @Patch(':id/toggle-status')
  async toggleCostStatus(@Param('id', ParseUUIDPipe) id: string) {
    return this.fixedCostsService.toggleCostStatus(id);
  }

  @Post(':id/duplicate')
  async duplicateCost(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: { name: string },
  ) {
    return this.fixedCostsService.duplicateCost(id, data.name);
  }
}
