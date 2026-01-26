import 'reflect-metadata';
import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { JwtAuthGuard } from './shared/presentation/http/guards/jwt-auth.guard';
import { useContainer } from 'class-validator';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configurar container para validators customizados
  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  // Configuração de CORS para permitir requisições do frontend
  app.enableCors({
    origin: [
      // Desenvolvimento local
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://localhost:3000',
      'http://localhost:4173',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000',
      // Produção - domínios Vercel específicos
      // Produção - domínio principal
      'https://www.pdv-ai.com.br',
      'https://pdv-ai.com.br',
      // Permitir qualquer subdomínio da Vercel durante desenvolvimento
      /^https:\/\/.*\.vercel\.app$/,
      // Render backend (para permitir requisições do frontend para o próprio backend)
      /^https:\/\/.*\.onrender\.com$/,
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Configuração de validação global
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Configurar guard JWT global
  const reflector = app.get(Reflector);
  app.useGlobalGuards(new JwtAuthGuard(reflector));

  // Prefixo global para API
  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT || 3001;
  await app.listen(port);

  console.log(`🚀 Backend rodando na porta ${port}`);
  console.log(`📡 API disponível em: http://localhost:${port}/api/v1`);
  console.log(`🔗 Sales (compatibilidade) em: http://localhost:${port}/sales`);
}
bootstrap();