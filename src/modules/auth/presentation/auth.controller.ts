import { Controller, Post, Body, HttpCode, HttpStatus, Get, UseGuards, Request } from '@nestjs/common';
import { AuthService } from '../application/auth.service';
import { Public } from '../../../shared/decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: { 
    ownerName: string; 
    storeName: string; 
    email: string; 
    whatsapp: string; 
    password: string; 
  }) {
    console.log('Tentativa de registro para:', registerDto.email);
    return this.authService.register(
      registerDto.ownerName,
      registerDto.storeName,
      registerDto.email,
      registerDto.whatsapp,
      registerDto.password
    );
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: { email: string; password: string }) {
    console.log('Tentativa de login para:', loginDto.email);
    return this.authService.login(loginDto.email, loginDto.password);
  }

  @Get('me')
  async getProfile(@Request() req) {
    return req.user;
  }

  @Public()
  @Post('validate-token')
  @HttpCode(HttpStatus.OK)
  async validateToken(@Body() body: { token: string }) {
    return this.authService.validateToken(body.token);
  }

  // Rota temporária para debug (apenas em desenvolvimento)
  @Public()
  @Post('debug-auth')
  @HttpCode(HttpStatus.OK)
  async debugAuth(@Body() loginDto: { email: string; password: string }) {
    if (process.env.NODE_ENV !== 'development') {
      return { error: 'Rota disponível apenas em ambiente de desenvolvimento' };
    }
    return this.authService.checkUserPassword(loginDto.email, loginDto.password);
  }
}