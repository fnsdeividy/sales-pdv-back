import { Controller, Get, Post, Body, Patch, Param, Delete, Put, HttpCode, HttpStatus } from '@nestjs/common';
import { UsersService } from '../application/users.service';
import { CreateUserDto, UpdateUserDto } from './interfaces/user.interface';
import { Public } from '../../../shared/decorators/public.decorator';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Post()
  create(@Body() createUserDto: CreateUserDto, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    // Garantir que o storeId do body seja ignorado e use o do usuário autenticado
    delete createUserDto.storeId;
    return this.usersService.create(createUserDto, user.storeId);
  }

  @Get()
  findAll(@CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.usersService.findAll(user.storeId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.usersService.findOne(id, user.storeId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    // Garantir que o storeId do body seja ignorado e use o do usuário autenticado
    delete updateUserDto.storeId;
    return this.usersService.update(id, updateUserDto, user.storeId);
  }

  @Put(':id')
  updatePut(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    // Garantir que o storeId do body seja ignorado e use o do usuário autenticado
    delete updateUserDto.storeId;
    return this.usersService.update(id, updateUserDto, user.storeId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.usersService.remove(id, user.storeId);
  }

  // Rota temporária para atualizar senhas em texto plano para hash
  @Public()
  @Post('update-plaintext-passwords')
  @HttpCode(HttpStatus.OK)
  async updatePlaintextPasswords() {
    if (process.env.NODE_ENV !== 'development') {
      return { error: 'Rota disponível apenas em ambiente de desenvolvimento' };
    }
    return this.usersService.updatePlaintextPasswords();
  }
}