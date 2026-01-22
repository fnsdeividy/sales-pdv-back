import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) { }

  async validateUser(email: string, password: string) {
    console.log('Tentando autenticar usuário:', email);

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        firstName: true,
        lastName: true,
        isActive: true,
        storeId: true,
        createdAt: true,
      },
    });

    if (!user) {
      console.log('Usuário não encontrado:', email);
      throw new UnauthorizedException('Credenciais inválidas');
    }

    console.log('Usuário encontrado, verificando senha');
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      console.log('Senha inválida para o usuário:', email);
      throw new UnauthorizedException('Credenciais inválidas');
    }

    console.log('Autenticação bem-sucedida para:', email);
    const { password: _, ...result } = user;
    return result;
  }

  async login(email: string, password: string) {
    try {
      const user = await this.validateUser(email, password);

      // Get user roles
      const userRoles = await this.prisma.userRole.findMany({
        where: { userId: user.id },
        include: {role: true }
      });

      const roles = userRoles.map(ur => ur.role.name);
      const primaryRole = roles.length > 0 ? roles[0] : 'user';

      const payload = {
        sub: user.id,
        email: user.email,
        roles: roles,
        role: primaryRole,
        name: user.firstName + ' ' + user.lastName,
        storeId: user.storeId,
      };

      console.log('Login bem-sucedido. Payload:', { ...payload, sub: '***' });

      const token = this.jwtService.sign(payload);

      return {
        user: {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          role: primaryRole,
          roles: roles,
          createdAt: user.createdAt,
          storeId: user.storeId,
        },
        token: token,
      };
    } catch (error) {
      console.error('Erro durante o login:', error);
      throw error;
    }
  }

  async validateToken(token: string) {
    try {
      const payload = await this.jwtService.verifyAsync(token);

      // Verificar se o usuário ainda existe e está ativo
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          isActive: true,
          storeId: true,
          createdAt: true,
        },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('Usuário não encontrado ou inativo');
      }

      // Buscar roles do usuário
      const userRoles = await this.prisma.userRole.findMany({
        where: { userId: user.id },
        include: { role: true }
      });

      const roles = userRoles.map(ur => ur.role.name);
      const primaryRole = roles.length > 0 ? roles[0] : 'user';

      return {
        user: {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          role: primaryRole,
          roles: roles,
          createdAt: user.createdAt,
        }
      };
    } catch (error) {
      console.error('Erro na validação do token:', error);
      throw new UnauthorizedException('Token inválido');
    }
  }

  async register(ownerName: string, storeName: string, email: string, whatsapp: string, password: string) {
    try {
      // Verificar se o email já está cadastrado
      const existingUser = await this.prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        throw new ConflictException('Email já cadastrado');
      }

      // Validar senha
      if (!password || password.length < 6) {
        throw new BadRequestException('Senha deve ter pelo menos 6 caracteres');
      }

      // Validar campos obrigatórios
      if (!ownerName || ownerName.trim().length < 3) {
        throw new BadRequestException('Nome do proprietário deve ter pelo menos 3 caracteres');
      }

      if (!storeName || storeName.trim().length < 3) {
        throw new BadRequestException('Nome da loja deve ter pelo menos 3 caracteres');
      }

      // Validar WhatsApp (deve existir e ter pelo menos 10 caracteres após trim)
      if (!whatsapp || typeof whatsapp !== 'string') {
        throw new BadRequestException('Número do WhatsApp é obrigatório');
      }

      const whatsappTrimmed = whatsapp.trim();
      if (whatsappTrimmed.length < 10) {
        throw new BadRequestException('Número do WhatsApp deve ter pelo menos 10 dígitos');
      }

      // Fazer hash da senha
      const hashedPassword = await bcrypt.hash(password, 10);

      // Separar nome do proprietário em firstName e lastName
      const nameParts = ownerName.trim().split(' ');
      const firstName = nameParts[0] || ownerName.trim();
      const lastName = nameParts.slice(1).join(' ') || '';

      // Criar loja com o nome fornecido pelo usuário
      const store = await this.prisma.store.create({
        data: {
          name: storeName.trim(),
          description: `Loja ${storeName.trim()}`,
          type: 'main',
          isActive: true,
        },
      });

      console.log('🏪 Nova loja criada durante registro:', {
        storeId: store.id,
        storeName: store.name,
        ownerName: ownerName,
        email: email,
        whatsapp: whatsappTrimmed,
      });

      // Criar o usuário associado à loja
      const user = await this.prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          phone: whatsappTrimmed, // Salvar WhatsApp no campo phone (já validado e trimado)
          isActive: true,
          emailVerified: false,
          storeId: store.id,
        },
      });

      // Buscar a role "admin" e associar ao novo usuário (dono da loja)
      let adminRole = await this.prisma.role.findUnique({
        where: { name: 'admin' },
      });

      // Se a role admin não existir, criar ela
      if (!adminRole) {
        adminRole = await this.prisma.role.create({
          data: {
            name: 'admin',
            description: 'Administrador da loja',
            isSystem: true,
          },
        });
        console.log('✅ Role admin criada:', adminRole.id);
      }

      await this.prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: adminRole.id,
        },
      });

      console.log('✅ Usuário criado como ADMIN da loja');

      // Buscar roles do usuário para gerar o token
      const userRoles = await this.prisma.userRole.findMany({
        where: { userId: user.id },
        include: { role: true },
      });

      const roles = userRoles.map(ur => ur.role.name);
      const primaryRole = roles.length > 0 ? roles[0] : 'user';

      // Gerar token JWT
      const payload = {
        sub: user.id,
        email: user.email,
        roles: roles,
        role: primaryRole,
        name: `${user.firstName} ${user.lastName}`,
        storeId: user.storeId,
      };

      const token = this.jwtService.sign(payload);

      console.log('✅ Registro bem-sucedido para:', email);
      console.log('✅ Loja criada:', { storeId: store.id, storeName: store.name });
      console.log('✅ Usuário criado:', { 
        userId: user.id, 
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        storeId: user.storeId 
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          role: primaryRole,
          roles: roles,
          createdAt: user.createdAt,
          storeId: user.storeId,
        },
        token: token,
      };
    } catch (error) {
      console.error('Erro durante o registro:', error);
      throw error;
    }
  }

  // Método auxiliar para debug
  async checkUserPassword(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
      },
    });

    if (!user) {
      return { exists: false };
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    const isHashed = user.password.startsWith('$2b$') || user.password.startsWith('$2a$');

    return {
      exists: true,
      passwordValid: isPasswordValid,
      isHashed: isHashed,
      passwordHash: user.password.substring(0, 10) + '...',
    };
  }
}