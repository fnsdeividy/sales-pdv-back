import { Module } from '@nestjs/common';
import { SubscriptionController } from './presentation/subscription.controller';
import { SubscriptionService } from './application/subscription.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SubscriptionAdminController } from './presentation/subscription-admin.controller';
import { AsaasWebhookController } from './presentation/asaas-webhook.controller';
import { AsaasWebhookService } from './application/asaas-webhook.service';

@Module({
  imports: [PrismaModule],
  controllers: [SubscriptionController, SubscriptionAdminController, AsaasWebhookController],
  providers: [SubscriptionService, AsaasWebhookService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
