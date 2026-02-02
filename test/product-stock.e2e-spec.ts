import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { JwtAuthGuard } from '../src/shared/presentation/http/guards/jwt-auth.guard';

describe('Product stock – Estoque controlado vs ilimitado (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let testStoreId: string;

  const mockJwtGuard = {
    canActivate: (context: any) => {
      const request = context.switchToHttp().getRequest();
      request.user = { storeId: testStoreId };
      return true;
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        AppModule,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    app.setGlobalPrefix('api/v1');
    await app.init();

    const store = await prisma.store.create({
      data: {
        name: 'Loja Teste Estoque',
        address: 'Rua Teste',
        phone: '11999999999',
      },
    });
    testStoreId = store.id;
  });

  afterEach(async () => {
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.stock.deleteMany();
    await prisma.product.deleteMany();
    await prisma.customer.deleteMany();
  });

  afterAll(async () => {
    await prisma.store.deleteMany({ where: { id: testStoreId } });
    await app?.close();
  });

  describe('Cenário 3 – Cadastro inválido', () => {
    it('retorna 400 quando isUnlimited = false e estoque vazio', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/products')
        .send({
          name: 'Produto Limitado Sem Estoque',
          price: 10,
          isUnlimited: false,
        })
        .expect(400);

      expect(res.body.message).toMatch(/Estoque obrigatório para produto limitado/i);
    });
  });

  describe('Cenário 1 – Produto ilimitado', () => {
    it('cria produto ilimitado e venda não altera estoque', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/products')
        .send({
          name: 'Produto Ilimitado',
          price: 5,
          isUnlimited: true,
        })
        .expect(201);

      expect(createRes.body.stockQuantity).toBeNull();
      expect(createRes.body.isUnlimited).toBe(true);

      const productId = createRes.body.id;

      await request(app.getHttpServer())
        .post('/api/v1/sales')
        .send({
          storeId: testStoreId,
          items: [
            { productId, quantity: 100, unitPrice: 5 },
          ],
        })
        .expect(201);

      const productAfter = await prisma.product.findUnique({
        where: { id: productId },
      });
      expect((productAfter as { stockQuantity: number | null; isUnlimited: boolean } | null)?.stockQuantity).toBeNull();
      expect((productAfter as { stockQuantity: number | null; isUnlimited: boolean } | null)?.isUnlimited).toBe(true);
    });
  });

  describe('Cenário 2 – Produto com estoque', () => {
    it('venda de 5 unidades decrementa estoque para 0', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/products')
        .send({
          name: 'Produto Controlado',
          price: 5,
          isUnlimited: false,
          stockQuantity: 5,
        })
        .expect(201);

      expect(createRes.body.stockQuantity).toBe(5);
      expect(createRes.body.isUnlimited).toBe(false);

      const productId = createRes.body.id;

      await request(app.getHttpServer())
        .post('/api/v1/sales')
        .send({
          storeId: testStoreId,
          items: [
            { productId, quantity: 5, unitPrice: 5 },
          ],
        })
        .expect(201);

      const productAfter = await prisma.product.findUnique({
        where: { id: productId },
      });
      expect((productAfter as { stockQuantity: number | null; isUnlimited: boolean } | null)?.stockQuantity).toBe(0);
      expect((productAfter as { stockQuantity: number | null; isUnlimited: boolean } | null)?.isUnlimited).toBe(false);
    });

    it('retorna 400 ao vender mais que o estoque', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/products')
        .send({
          name: 'Produto Pouco Estoque',
          price: 5,
          isUnlimited: false,
          stockQuantity: 2,
        })
        .expect(201);

      const productId = createRes.body.id;

      const res = await request(app.getHttpServer())
        .post('/api/v1/sales')
        .send({
          storeId: testStoreId,
          items: [
            { productId, quantity: 5, unitPrice: 5 },
          ],
        })
        .expect(400);

      expect(res.body.message).toMatch(/sem estoque suficiente|estoque/i);
    });
  });
});
