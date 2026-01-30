import {
  Controller,
  Post,
  Get,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { NfeService } from '@modules/nfe/application/services/nfe.service';

@Controller('nfe')
export class NfeController {
  constructor(private readonly nfeService: NfeService) {}

  @Post('orders/:orderId/emit')
  @HttpCode(HttpStatus.ACCEPTED)
  async emitir(@Param('orderId') orderId: string, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.nfeService.emitirNfeParaOrder(orderId, user.storeId);
  }

  @Post(':id/consultar-recibo')
  @HttpCode(HttpStatus.OK)
  async consultarRecibo(@Param('id') nfeId: string, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.nfeService.consultarRecibo(nfeId, user.storeId);
  }

  @Post(':id/consultar')
  @HttpCode(HttpStatus.OK)
  async consultarNfe(@Param('id') nfeId: string, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.nfeService.consultarNfePorChave(nfeId, user.storeId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async buscar(@Param('id') nfeId: string, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.nfeService.buscarNfePorId(nfeId, user.storeId);
  }

  @Get(':id/xml')
  @HttpCode(HttpStatus.OK)
  async baixarXml(@Param('id') nfeId: string, @CurrentUser() user: any) {
    if (!user?.storeId) {
      throw new Error('StoreId não encontrado. Usuário não está associado a uma loja.');
    }
    return this.nfeService.buscarXmlAutorizado(nfeId, user.storeId);
  }
}
