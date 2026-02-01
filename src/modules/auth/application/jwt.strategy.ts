import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

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

    // #region agent log
    try { const dir = path.join(process.cwd(), '.cursor'); if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); const logPath = path.join(dir, 'debug.log'); fs.appendFileSync(logPath, JSON.stringify({ location: 'jwt.strategy.ts:validate', message: 'JWT validate exit', data: { payloadSub: payload.sub, userId: user.id, userStoreId: storeIdFromDatabase }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'A' }) + '\n'); } catch (_) {}
    // #endregion

    return {
      id: user.id,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      role: primaryRole,
      roles: roles,
      createdAt: user.createdAt,
      storeId: storeIdFromDatabase, // SEMPRE usar o storeId do banco, nunca do payload
    };
  }
}
