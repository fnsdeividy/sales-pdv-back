import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../mail/mail.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

const PASSWORD_RESET_EXPIRATION_MS = 60 * 60 * 1000; // 1 hora

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailService: MailService,
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

  async register(
    ownerName: string,
    storeName: string,
    email: string,
    whatsapp: string,
    password: string,
    cnpj?: string,
    address?: string,
    city?: string,
    state?: string,
    zipCode?: string,
  ) {
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

      // Validar CNPJ quando informado
      const cnpjTrimmed = cnpj?.trim();
      const cnpjDigits = cnpjTrimmed ? cnpjTrimmed.replace(/\D/g, '') : '';
      if (cnpjTrimmed) {
        if (cnpjDigits.length !== 11 && cnpjDigits.length !== 14) {
          throw new BadRequestException('CPF/CNPJ inválido. Informe 11 ou 14 dígitos.');
        }
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
          cnpj: cnpjDigits || null,
          address: address?.trim() || null,
          city: city?.trim() || null,
          state: state?.trim() || null,
          zipCode: zipCode?.trim() || null,
        } as Prisma.StoreCreateInput,
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

  /**
   * Solicitação de redefinição de senha. Sempre retorna sucesso (mensagem genérica)
   * para não revelar se o email existe na base.
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    const emailTrimmed = email?.trim()?.toLowerCase();
    if (!emailTrimmed) {
      throw new BadRequestException('Email é obrigatório');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrimmed)) {
      throw new BadRequestException('Digite um email válido');
    }

    const user = await this.prisma.user.findUnique({
      where: { email: emailTrimmed },
      select: { id: true, email: true },
    });

    if (user) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpires = new Date(Date.now() + PASSWORD_RESET_EXPIRATION_MS);
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: resetToken,
          passwordResetExpires: resetExpires,
        } as Prisma.UserUpdateInput,
      });
      try {
        await this.mailService.sendPasswordResetEmail(user.email, resetToken);
      } catch (error) {
        console.error('Erro ao enviar email de redefinição:', error);
        // Não lançar erro ao usuário para não revelar se o email existe
      }
    }

    return {
      message: 'Se este email estiver cadastrado, você receberá um link para redefinir a senha.',
    };
  }

  /**
   * Redefine a senha usando o token recebido por email.
   */
  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const tokenTrimmed = token?.trim();
    if (!tokenTrimmed) {
      throw new BadRequestException('Token é obrigatório');
    }
    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestException('Senha deve ter pelo menos 6 caracteres');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: tokenTrimmed,
        passwordResetExpires: { gt: new Date() },
      } as Prisma.UserWhereInput,
      select: { id: true },
    });

    if (!user) {
      throw new BadRequestException('Token inválido ou expirado. Solicite um novo link de redefinição.');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      } as Prisma.UserUpdateInput,
    });

    return { message: 'Senha alterada com sucesso. Faça login com a nova senha.' };
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