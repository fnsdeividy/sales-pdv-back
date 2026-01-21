import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { Product } from '../entities/product.entity';
import { CreateProductDto, UpdateProductDto } from '../presentation/interfaces/product.interface';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) { }

  async findAll(storeId?: string): Promise<Product[]> {
    console.log('🔍 ProductsService.findAll - Buscando produtos no banco de dados...', { storeId });

    // Validação rigorosa do storeId
    if (!storeId || typeof storeId !== 'string' || storeId.trim() === '') {
      console.error('❌ ProductsService.findAll - Store ID inválido ou não fornecido!', { storeId });
      throw new NotFoundException('Store ID is required and must be a valid UUID');
    }

    // Verificar se a loja existe
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, name: true },
    });

    if (!store) {
      console.error(`❌ ProductsService.findAll - Loja ${storeId} não encontrada!`);
      throw new NotFoundException(`Store with ID ${storeId} not found`);
    }

    console.log(`✅ ProductsService.findAll - Loja encontrada: ${store.name} (${store.id})`);

    // Query com filtro explícito e rigoroso por storeId
    const products = await this.prisma.product.findMany({
      where: {
        storeId: {
          equals: storeId, // Filtro explícito
        },
      },
      include: {
        stock: {
          where: {
            storeId: {
              equals: storeId, // Filtro explícito para stock também
            },
          },
        },
      },
    });

    console.log(`📦 ProductsService.findAll - Encontrados ${products.length} produtos para a loja ${storeId} (${store.name})`);
    
    // FILTRO ADICIONAL DE SEGURANÇA: Garantir que NENHUM produto de outra loja seja retornado
    const filteredProducts = products.filter(p => {
      const matches = p.storeId === storeId;
      if (!matches) {
        console.error(`❌ ERRO CRÍTICO DE MULTITENANCY: Produto ${p.id} (${p.name}) pertence à loja ${p.storeId}, mas deveria ser ${storeId}`);
      }
      return matches;
    });

    // Se houver produtos filtrados, logar alerta crítico
    if (filteredProducts.length !== products.length) {
      const wrongStoreProducts = products.filter(p => p.storeId !== storeId);
      console.error(`❌ ERRO CRÍTICO DE MULTITENANCY: ${wrongStoreProducts.length} produtos foram filtrados por pertencerem a outra loja!`);
      wrongStoreProducts.forEach(p => {
        console.error(`  - Produto ${p.id} (${p.name}) pertence à loja ${p.storeId}, mas deveria ser ${storeId}`);
      });
    }

    if (filteredProducts.length > 0) {
      console.log('📦 Primeiro produto encontrado:', {
        id: filteredProducts[0].id,
        name: filteredProducts[0].name,
        storeId: filteredProducts[0].storeId,
        expectedStoreId: storeId,
        match: filteredProducts[0].storeId === storeId,
      });
    }

    // Retornar APENAS produtos filtrados (garantia adicional de segurança)
    return filteredProducts;
  }

  async findOne(id: string, storeId?: string): Promise<Product> {
    if (!storeId) {
      throw new NotFoundException('Store ID is required');
    }

    const product = await this.prisma.product.findFirst({
      where: {
        id,
        storeId: storeId,
      },
      include: {
        stock: {
          where: {
            storeId: storeId,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found in your store`);
    }

    return product;
  }

  async create(data: CreateProductDto, storeId?: string): Promise<Product> {
    if (!storeId) {
      throw new NotFoundException('Store ID is required');
    }

    const product = await this.prisma.product.create({
      data: {
        ...data,
        storeId: storeId,
        isActive: true,
      } as Prisma.ProductUncheckedCreateInput,
      include: {
        stock: true,
      },
    });

    return product;
  }

  async update(id: string, data: UpdateProductDto, storeId?: string): Promise<Product> {
    if (!storeId) {
      throw new NotFoundException('Store ID is required');
    }

    // Verificar se o produto pertence à loja do usuário
    await this.findOne(id, storeId);

    const updatedProduct = await this.prisma.product.update({
      where: { id },
      data: {
        ...data,
        storeId: storeId, // Garantir que não pode mudar a loja
      } as Prisma.ProductUncheckedUpdateInput,
      include: {
        stock: {
          where: {
            storeId: storeId,
          },
        },
      },
    });

    return updatedProduct;
  }

  async remove(id: string, storeId?: string): Promise<void> {
    if (!storeId) {
      throw new NotFoundException('Store ID is required');
    }

    // Verificar se o produto pertence à loja do usuário
    await this.findOne(id, storeId);

    await this.prisma.product.delete({
      where: { id },
    });
  }
}