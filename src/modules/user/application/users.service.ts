import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { User } from '../entities/user.entity';
import { CreateUserDto, UpdateUserDto } from '../presentation/interfaces/user.interface';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) { }

  async findAll(storeId: string): Promise<User[]> {
    const users = await this.prisma.user.findMany({
      where: {
        storeId: storeId,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        isActive: true,
        emailVerified: true,
        storeId: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    return users.map(user => ({
      ...user,
      name: `${user.firstName} ${user.lastName}`,
      role: 'user', // Valor padrão para compatibilidade com frontend
      storeId: user.storeId || undefined,
      status: user.isActive ? 'active' : 'inactive', // Converter isActive para status
      lastLogin: user.updatedAt, // Usar updatedAt como lastLogin temporariamente
    })) as User[];
  }

  async findOne(id: string, storeId: string): Promise<User> {
    const user = await this.prisma.user.findFirst({
      where: { 
        id,
        storeId: storeId, // Garantir que o usuário pertence à mesma loja
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        isActive: true,
        emailVerified: true,
        storeId: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found or does not belong to your store`);
    }

    return {
      ...user,
      name: `${user.firstName} ${user.lastName}`,
      role: 'user', // Valor padrão para compatibilidade com frontend
      storeId: user.storeId || undefined,
      status: user.isActive ? 'active' : 'inactive', // Converter isActive para status
      lastLogin: user.updatedAt, // Usar updatedAt como lastLogin temporariamente
    } as User;
  }

  async create(data: CreateUserDto, storeId: string): Promise<User> {
    // Extrair campos que não existem no modelo User
    const { role, password, ...userData } = data;

    // Hash da senha antes de salvar
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        ...userData,
        password: hashedPassword,
        storeId: storeId, // Usar o storeId do usuário autenticado
        isActive: true,
        emailVerified: false,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        isActive: true,
        emailVerified: true,
        storeId: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    return {
      ...user,
      name: `${user.firstName} ${user.lastName}`,
      role: role || 'user', // Manter role para compatibilidade com frontend
      storeId: user.storeId || undefined,
      status: user.isActive ? 'active' : 'inactive', // Converter isActive para status
      lastLogin: user.updatedAt, // Usar updatedAt como lastLogin temporariamente
    } as User;
  }

  async update(id: string, data: UpdateUserDto, storeId: string): Promise<User> {
    // Verificar se o usuário pertence à mesma loja antes de atualizar
    await this.findOne(id, storeId);

    // Extrair campos que não existem no modelo User
    const { role, password, ...userData } = data;

    // Preparar dados para atualização
    let updateData: any = userData;

    // Se a senha foi fornecida, fazer hash dela
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateData = { ...userData, password: hashedPassword };
    }

    const updatedUser = await this.prisma.user.update({
      where: { 
        id, // findUnique só aceita campos únicos, então usamos apenas id
      },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        isActive: true,
        emailVerified: true,
        storeId: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    // Verificar se o usuário atualizado pertence à mesma loja
    if (updatedUser.storeId !== storeId) {
      throw new NotFoundException(`User with ID ${id} does not belong to your store`);
    }

    return {
      ...updatedUser,
      name: `${updatedUser.firstName} ${updatedUser.lastName}`,
      role: role || 'user', // Manter role para compatibilidade com frontend
      storeId: updatedUser.storeId || undefined,
      status: updatedUser.isActive ? 'active' : 'inactive', // Converter isActive para status
      lastLogin: updatedUser.updatedAt, // Usar updatedAt como lastLogin temporariamente
    } as User;
  }

  async remove(id: string, storeId: string): Promise<void> {
    // Verificar se o usuário pertence à mesma loja antes de remover
    await this.findOne(id, storeId);
    await this.prisma.user.delete({
      where: { 
        id, // findUnique só aceita campos únicos, então usamos apenas id
      }
    });
  }

  // Método para atualizar senhas em texto plano existentes para hash
  async updatePlaintextPasswords(): Promise<{ updated: number }> {
    // Buscar usuários com senhas em texto plano (não começam com $2b$ ou $2a$)
    const users = await this.prisma.user.findMany({
      where: {
        NOT: {
          OR: [
            { password: { startsWith: '$2b$' } },
            { password: { startsWith: '$2a$' } }
          ]
        }
      },
      select: { id: true, password: true }
    });

    let updatedCount = 0;

    for (const user of users) {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      await this.prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword }
      });
      updatedCount++;
    }

    return { updated: updatedCount };
  }
}