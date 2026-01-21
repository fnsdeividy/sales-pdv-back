import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { ProductsService } from '../application/products.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) { }

  @Get()
  async findAll(@CurrentUser() user: any) {
    console.log('🔍 ProductsController.findAll - User completo:', JSON.stringify(user, null, 2));
    
    // Validação rigorosa do usuário
    if (!user) {
      console.error('❌ ProductsController.findAll - Usuário não autenticado!');
      throw new Error('Usuário não autenticado');
    }

    // Validação rigorosa do storeId
    if (!user.storeId || typeof user.storeId !== 'string' || user.storeId.trim() === '') {
      console.error('❌ ProductsController.findAll - StoreId inválido ou não encontrado no usuário!', {
        userId: user.id,
        email: user.email,
        storeId: user.storeId,
        storeIdType: typeof user.storeId,
        userKeys: Object.keys(user),
      });
      throw new Error('StoreId não encontrado ou inválido. Usuário não está associado a uma loja válida.');
    }

    console.log('✅ ProductsController.findAll - StoreId válido:', user.storeId);
    
    // Garantir que o storeId seja passado corretamente para o service
    const storeId = user.storeId.trim();
    return this.productsService.findAll(storeId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.productsService.findOne(id, user.storeId);
  }

  @Post()
  async create(@Body() data: any, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    // Garantir que o storeId do body seja ignorado e use o do usuário autenticado
    delete data.storeId;
    return this.productsService.create(data, user.storeId);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() data: any, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    // Garantir que o storeId do body seja ignorado e use o do usuário autenticado
    delete data.storeId;
    return this.productsService.update(id, data, user.storeId);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.productsService.remove(id, user.storeId);
  }
}


