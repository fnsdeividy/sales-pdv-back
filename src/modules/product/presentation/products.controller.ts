import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ProductsService } from '../application/products.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import * as fs from 'fs';
import * as path from 'path';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async findAll(@CurrentUser() user: any) {
    // #region agent log
    try { const dir = path.join(process.cwd(), '.cursor'); if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); const logPath = path.join(dir, 'debug.log'); fs.appendFileSync(logPath, JSON.stringify({ location: 'products.controller.ts:findAll', message: 'findAll entry', data: { userId: user?.id, userStoreId: user?.storeId }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'B' }) + '\n'); } catch (_) {}
    // #endregion
    if (!user) {
      throw new UnauthorizedException('Usuário não autenticado');
    }
    if (!user.storeId || typeof user.storeId !== 'string' || user.storeId.trim() === '') {
      throw new ForbiddenException(
        'StoreId não encontrado ou inválido. Usuário não está associado a uma loja válida.',
      );
    }
    const storeId = user.storeId.trim();
    return this.productsService.findAll(storeId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new ForbiddenException('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.productsService.findOne(id, user.storeId.trim());
  }

  @Post()
  async create(@Body() data: any, @CurrentUser() user: any) {
    // #region agent log
    try { const dir = path.join(process.cwd(), '.cursor'); if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); const logPath = path.join(dir, 'debug.log'); fs.appendFileSync(logPath, JSON.stringify({ location: 'products.controller.ts:create', message: 'create product', data: { userId: user?.id, userStoreId: user?.storeId, productName: data?.name }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'A' }) + '\n'); } catch (_) {}
    // #endregion
    if (!user?.storeId) {
      throw new ForbiddenException('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    delete data.storeId;
    return this.productsService.create(data, user.storeId.trim());
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() data: any, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new ForbiddenException('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    delete data.storeId;
    return this.productsService.update(id, data, user.storeId.trim());
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new ForbiddenException('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.productsService.remove(id, user.storeId.trim());
  }
}
