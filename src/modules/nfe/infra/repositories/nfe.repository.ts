import { Injectable } from '@nestjs/common';
import { PrismaService } from '@modules/prisma/prisma.service';
import { NfeStatus } from '@modules/nfe/domain/entities/nfe-document.entity';

@Injectable()
export class NfeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.nfeDocument.findUnique({ where: { id } });
  }

  async findLatestByOrderId(orderId: string) {
    return this.prisma.nfeDocument.findFirst({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getNextNumero(storeId: string, numeroInicial: number): Promise<number> {
    const latest = await this.prisma.nfeDocument.findFirst({
      where: {
        order: {
          storeId,
        },
      },
      orderBy: {
        numero: 'desc',
      },
    });

    if (!latest) {
      return numeroInicial;
    }

    return latest.numero + 1;
  }

  async create(data: {
    orderId: string;
    chaveAcesso: string;
    numero: number;
    serie: string;
    uf: string;
    modelo: string;
    ambiente: 'homolog' | 'producao';
    status: NfeStatus;
    recibo?: string | null;
    protocolo?: string | null;
    mensagemRetorno?: string | null;
    xmlAssinado: string;
    xmlAutorizado?: string | null;
  }) {
    return this.prisma.nfeDocument.create({
      data: {
        orderId: data.orderId,
        chaveAcesso: data.chaveAcesso,
        numero: data.numero,
        serie: data.serie,
        uf: data.uf,
        modelo: data.modelo,
        ambiente: data.ambiente,
        status: data.status,
        recibo: data.recibo,
        protocolo: data.protocolo,
        mensagemRetorno: data.mensagemRetorno,
        xmlAssinado: data.xmlAssinado,
        xmlAutorizado: data.xmlAutorizado,
      },
    });
  }

  async updateStatus(id: string, data: {
    status?: NfeStatus;
    recibo?: string | null;
    protocolo?: string | null;
    mensagemRetorno?: string | null;
    xmlAutorizado?: string | null;
  }) {
    return this.prisma.nfeDocument.update({
      where: { id },
      data,
    });
  }
}
