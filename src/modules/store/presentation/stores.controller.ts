import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { StoresService } from '../application/stores.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';

@Controller('stores')
export class StoresController {
  constructor(private readonly storesService: StoresService) { }

  @Get()
  async findAll(
    @CurrentUser() user: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('city') city?: string,
    @Query('state') state?: string,
  ) {
    console.log('🔍 StoresController.findAll - User completo:', JSON.stringify(user, null, 2));
    
    if (!user?.storeId) {
      console.error('❌ StoresController.findAll - StoreId não encontrado!');
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }

    console.log('✅ StoresController.findAll - StoreId válido:', user.storeId);

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    const filters = {
      search,
      status,
      type,
      city,
      state,
    };

    return this.storesService.findAll(pageNum, limitNum, filters, user.storeId);
  }

  @Get('statistics')
  async getStatistics(@CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.storesService.getStatistics(user.storeId);
  }

  @Get('by-city/:city')
  async findByCity(@Param('city') city: string) {
    return this.storesService.findByCity(city);
  }

  @Get('by-state/:state')
  async findByState(@Param('state') state: string) {
    return this.storesService.findByState(state);
  }

  @Get('by-type/:type')
  async findByType(@Param('type') type: string) {
    return this.storesService.findByType(type);
  }

  @Get('by-manager/:managerId')
  async findByManager(@Param('managerId') managerId: string) {
    return this.storesService.findByManager(managerId);
  }

  @Get('nearby')
  async findNearby(
    @Query('lat') latitude: string,
    @Query('lng') longitude: string,
    @Query('radius') radius: string = '10',
  ) {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const radiusKm = parseFloat(radius);

    return this.storesService.findNearby(lat, lng, radiusKm);
  }

  @Get(':id')
  async findById(@Param('id') id: string, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.storesService.findById(id, user.storeId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createStoreDto: any) {
    return this.storesService.create(createStoreDto);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateStoreDto: any,
    @CurrentUser() user: any,
  ) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.storesService.update(id, updateStoreDto, user.storeId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.storesService.delete(id, user.storeId);
  }

  @Patch(':id/activate')
  async activate(@Param('id') id: string, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.storesService.activate(id, user.storeId);
  }

  @Patch(':id/deactivate')
  async deactivate(@Param('id') id: string, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.storesService.deactivate(id, user.storeId);
  }

  @Patch(':id/maintenance')
  async putInMaintenance(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @CurrentUser() user: any,
  ) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.storesService.putInMaintenance(id, body.reason, user.storeId);
  }
}
