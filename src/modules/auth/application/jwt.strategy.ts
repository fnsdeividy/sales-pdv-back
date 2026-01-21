import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'your-secret-key',
    });
  }

  async validate(payload: any) {
    console.log('🔐 JwtStrategy.validate - Payload recebido:', {
      sub: payload.sub,
      email: payload.email,
      storeIdFromPayload: payload.storeId,
      payloadKeys: Object.keys(payload),
    });

    // Verificar se o usuário ainda existe
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        createdAt: true,
        storeId: true,
      },
    });

    if (!user || !user.isActive) {
      console.error('❌ JwtStrategy.validate - Usuário não encontrado ou inativo:', payload.sub);
      throw new UnauthorizedException('Usuário não encontrado ou inativo');
    }

    // Validação rigorosa do storeId do banco de dados
    if (!user.storeId || typeof user.storeId !== 'string' || user.storeId.trim() === '') {
      console.error('❌ JwtStrategy.validate - Usuário não tem storeId válido associado!', {
        userId: user.id,
        email: user.email,
        storeId: user.storeId,
        storeIdType: typeof user.storeId,
      });
      throw new UnauthorizedException('Usuário não está associado a uma loja válida. Contate o administrador.');
    }

    // Verificar se o storeId do payload corresponde ao do banco (aviso de segurança)
    if (payload.storeId && payload.storeId !== user.storeId) {
      console.warn('⚠️ JwtStrategy.validate - StoreId do payload difere do banco de dados!', {
        userId: user.id,
        email: user.email,
        storeIdFromPayload: payload.storeId,
        storeIdFromDatabase: user.storeId,
      });
      console.warn('⚠️ Usando storeId do banco de dados (fonte de verdade)');
    }

    // Buscar roles do usuário
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId: user.id },
      include: { role: true }
    });

    const roles = userRoles.map(ur => ur.role.name);
    const primaryRole = roles.length > 0 ? roles[0] : 'user';

    // SEMPRE usar o storeId do banco de dados (fonte de verdade)
    const storeIdFromDatabase = user.storeId.trim();

    const userData = {
      id: user.id,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      role: primaryRole,
      roles: roles,
      createdAt: user.createdAt,
      storeId: storeIdFromDatabase, // SEMPRE usar o storeId do banco, nunca do payload
    };

    console.log('✅ JwtStrategy.validate - Usuário validado:', {
      userId: userData.id,
      email: userData.email,
      storeId: userData.storeId,
      role: userData.role,
      storeIdFromPayload: payload.storeId,
      storeIdFromDatabase: storeIdFromDatabase,
      storeIdMatch: storeIdFromDatabase === payload.storeId,
    });

    return userData;
  }
}
