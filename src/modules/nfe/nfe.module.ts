import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '@modules/prisma/prisma.module';
import { NfeController } from '@modules/nfe/presentation/http/controllers/nfe.controller';
import { NfeService } from '@modules/nfe/application/services/nfe.service';
import { NfeRepository } from '@modules/nfe/infra/repositories/nfe.repository';
import { getNfeConfig, NFE_CONFIG, NfeConfig } from '@modules/nfe/application/config/nfe.config';
import { NfeXmlBuilder } from '@modules/nfe/infra/xml/nfe-xml.builder';
import { NfeXmlSigner } from '@modules/nfe/infra/xml/nfe-xml.signer';
import { NfeSoapClient } from '@modules/nfe/infra/soap/nfe-soap.client';
import { NuvemFiscalClient } from '@modules/nfe/infra/nuvem-fiscal/nuvem-fiscal.client';
import { NuvemFiscalNfeBuilder } from '@modules/nfe/infra/nuvem-fiscal/nuvem-fiscal-nfe.builder';
import { SubscriptionModule } from '@modules/subscription/subscription.module';

@Module({
  imports: [PrismaModule, ConfigModule, SubscriptionModule],
  controllers: [NfeController],
  providers: [
    NfeRepository,
    {
      provide: NFE_CONFIG,
      useFactory: (configService: ConfigService): NfeConfig => getNfeConfig(configService),
      inject: [ConfigService],
    },
    {
      provide: NfeXmlBuilder,
      useFactory: (config: NfeConfig) => new NfeXmlBuilder(config),
      inject: [NFE_CONFIG],
    },
    {
      provide: NfeXmlSigner,
      useFactory: (config: NfeConfig) =>
        new NfeXmlSigner(config.certificadoPfxPath || '', config.certificadoPfxSenha || ''),
      inject: [NFE_CONFIG],
    },
    {
      provide: NfeSoapClient,
      useFactory: (config: NfeConfig) => new NfeSoapClient(config),
      inject: [NFE_CONFIG],
    },
    {
      provide: NuvemFiscalClient,
      useFactory: (config: NfeConfig) => new NuvemFiscalClient(config),
      inject: [NFE_CONFIG],
    },
    {
      provide: NuvemFiscalNfeBuilder,
      useFactory: (config: NfeConfig) => new NuvemFiscalNfeBuilder(config),
      inject: [NFE_CONFIG],
    },
    NfeService,
  ],
  exports: [NfeService],
})
export class NfeModule {}
