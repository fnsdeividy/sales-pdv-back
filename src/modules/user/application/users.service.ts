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
        userRoles: {
          select: {
            role: {
              select: {
                name: true,
              },
            },
          },
        },
      }
    });

    return users.map(user => {
      const roles = user.userRoles.map(ur => ur.role.name);
      const primaryRole = roles.length > 0 ? roles[0] : 'user';

      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        isActive: user.isActive,
        emailVerified: user.emailVerified,
        storeId: user.storeId || undefined,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        name: `${user.firstName} ${user.lastName}`,
        role: primaryRole,
        status: user.isActive ? 'active' : 'inactive',
        lastLogin: user.updatedAt,
      };
    }) as User[];
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
        userRoles: {
          select: {
            role: {
              select: {
                name: true,
              },
            },
          },
        },
      }
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found or does not belong to your store`);
    }

    const roles = user.userRoles.map(ur => ur.role.name);
    const primaryRole = roles.length > 0 ? roles[0] : 'user';

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      storeId: user.storeId || undefined,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      name: `${user.firstName} ${user.lastName}`,
      role: primaryRole,
      status: user.isActive ? 'active' : 'inactive',
      lastLogin: user.updatedAt,
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

    // Associar role ao usuário
    const roleName = role || 'user';
    let roleRecord = await this.prisma.role.findUnique({
      where: { name: roleName },
    });

    // Se o role não existir, criar
    if (!roleRecord) {
      roleRecord = await this.prisma.role.create({
        data: {
          name: roleName,
          description: `Role ${roleName}`,
          isSystem: false,
        },
      });
    }

    // Criar associação UserRole
    await this.prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: roleRecord.id,
      },
    });

    return {
      ...user,
      name: `${user.firstName} ${user.lastName}`,
      role: roleName,
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
        userRoles: {
          select: {
            role: {
              select: {
                name: true,
              },
            },
          },
        },
      }
    });

    // Verificar se o usuário atualizado pertence à mesma loja
    if (updatedUser.storeId !== storeId) {
      throw new NotFoundException(`User with ID ${id} does not belong to your store`);
    }

    // Se um role foi fornecido, atualizar a associação
    if (role) {
      // Remover associações antigas
      await this.prisma.userRole.deleteMany({
        where: { userId: id },
      });

      // Buscar ou criar o role
      let roleRecord = await this.prisma.role.findUnique({
        where: { name: role },
      });

      if (!roleRecord) {
        roleRecord = await this.prisma.role.create({
          data: {
            name: role,
            description: `Role ${role}`,
            isSystem: false,
          },
        });
      }

      // Criar nova associação
      await this.prisma.userRole.create({
        data: {
          userId: id,
          roleId: roleRecord.id,
        },
      });
    }

    // Buscar roles atualizados
    const userWithRoles = await this.prisma.user.findUnique({
      where: { id },
      select: {
        userRoles: {
          select: {
            role: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    const roles = userWithRoles?.userRoles.map(ur => ur.role.name) || [];
    const primaryRole = roles.length > 0 ? roles[0] : 'user';

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      phone: updatedUser.phone,
      isActive: updatedUser.isActive,
      emailVerified: updatedUser.emailVerified,
      storeId: updatedUser.storeId || undefined,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
      name: `${updatedUser.firstName} ${updatedUser.lastName}`,
      role: primaryRole,
      status: updatedUser.isActive ? 'active' : 'inactive',
      lastLogin: updatedUser.updatedAt,
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

  async activate(id: string, storeId: string): Promise<User> {
    // Verificar se o usuário pertence à mesma loja
    await this.findOne(id, storeId);

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { isActive: true },
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
        userRoles: {
          select: {
            role: {
              select: {
                name: true,
              },
            },
          },
        },
      }
    });

    const roles = updatedUser.userRoles.map(ur => ur.role.name);
    const primaryRole = roles.length > 0 ? roles[0] : 'user';

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      phone: updatedUser.phone,
      isActive: updatedUser.isActive,
      emailVerified: updatedUser.emailVerified,
      storeId: updatedUser.storeId || undefined,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
      name: `${updatedUser.firstName} ${updatedUser.lastName}`,
      role: primaryRole,
      status: 'active',
      lastLogin: updatedUser.updatedAt,
    } as User;
  }

  async deactivate(id: string, storeId: string): Promise<User> {
    // Verificar se o usuário pertence à mesma loja
    await this.findOne(id, storeId);

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
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
        userRoles: {
          select: {
            role: {
              select: {
                name: true,
              },
            },
          },
        },
      }
    });

    const roles = updatedUser.userRoles.map(ur => ur.role.name);
    const primaryRole = roles.length > 0 ? roles[0] : 'user';

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      phone: updatedUser.phone,
      isActive: updatedUser.isActive,
      emailVerified: updatedUser.emailVerified,
      storeId: updatedUser.storeId || undefined,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
      name: `${updatedUser.firstName} ${updatedUser.lastName}`,
      role: primaryRole,
      status: 'inactive',
      lastLogin: updatedUser.updatedAt,
    } as User;
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