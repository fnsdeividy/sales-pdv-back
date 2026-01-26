import { Module } from '@nestjs/common';
import { SubscriptionController } from './presentation/subscription.controller';
import { SubscriptionService } from './application/subscription.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SubscriptionController],
  providers: [SubscriptionService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
