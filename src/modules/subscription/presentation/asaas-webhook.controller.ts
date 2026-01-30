import { Body, Controller, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Public } from '../../../shared/decorators/public.decorator';
import { AsaasWebhookService } from '../application/asaas-webhook.service';

@Controller('webhooks/asaas')
@Public()
export class AsaasWebhookController {
  constructor(private readonly asaasWebhookService: AsaasWebhookService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() payload: any,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    return this.asaasWebhookService.handleWebhook(payload, headers);
  }
}
