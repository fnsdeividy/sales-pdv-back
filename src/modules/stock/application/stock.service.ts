import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Stock } from '../entities/stock.entity';
import { CreateStockDto } from '../presentation/dto/createStock.dto';
import { UpdateStockDto } from '../presentation/interfaces/stock.interface';

@Injectable()
export class StockService {
  constructor(private prisma: PrismaService) { }

  async findAll(storeId?: string): Promise<Stock[]> {
    if (!storeId) {
      throw new NotFoundException('Store ID is required');
    }

    const stocks = await this.prisma.stock.findMany({
      where: {
        storeId: storeId,
      },
      include: {
        product: {
          include: {
            costCache: true,
            finishedGoods: {
              orderBy: {
                createdAt: 'desc'
              },
              take: 1
            },
            productionOrders: {
              where: {
                status: 'finished'
              },
              orderBy: {
                finishedAt: 'desc'
              },
              take: 1,
              select: {
                totalMaterialCost: true,
                totalPackagingCost: true,
                totalOverheadCost: true,
                totalCost: true,
                unitCost: true,
                actualOutputQty: true
              }
            }
          }
        }
      }
    });

    return stocks.map(stock => {
      // Calcular custo unitário do produto
      // Prioridade: 1) FinishedGoodsInventory mais recente, 2) ProductCostCache, 3) costPrice do produto
      let unitCost = 0;
      let costBreakdown: any = undefined;
      
      // Buscar última ordem de produção finalizada para obter breakdown de custos
      const lastProductionOrder = stock.product.productionOrders && stock.product.productionOrders.length > 0
        ? stock.product.productionOrders[0]
        : null;

      if (stock.product.finishedGoods && stock.product.finishedGoods.length > 0) {
        // Usar o custo do último lote de produção
        unitCost = Number(stock.product.finishedGoods[0].unitCost);
      } else if (stock.product.costCache) {
        // Usar o cache de custo
        unitCost = Number(stock.product.costCache.unitCost);
      } else if (stock.product.costPrice) {
        // Usar o preço de custo do produto
        unitCost = Number(stock.product.costPrice);
      }

      // Se temos ordem de produção, calcular breakdown de custos
      if (lastProductionOrder && lastProductionOrder.actualOutputQty && Number(lastProductionOrder.actualOutputQty) > 0) {
        const outputQty = Number(lastProductionOrder.actualOutputQty);
        const totalMaterialCost = Number(lastProductionOrder.totalMaterialCost) || 0;
        const totalPackagingCost = Number(lastProductionOrder.totalPackagingCost) || 0;
        const totalOverheadCost = Number(lastProductionOrder.totalOverheadCost) || 0;

        costBreakdown = {
          materialCost: totalMaterialCost,
          packagingCost: totalPackagingCost,
          overheadCost: totalOverheadCost,
          unitMaterialCost: outputQty > 0 ? totalMaterialCost / outputQty : 0,
          unitPackagingCost: outputQty > 0 ? totalPackagingCost / outputQty : 0,
          unitOverheadCost: outputQty > 0 ? totalOverheadCost / outputQty : 0,
        };
      }

      // Calcular custo total (quantidade * custo unitário)
      const totalCost = stock.quantity * unitCost;

      return {
        ...stock,
        maxQuantity: stock.maxQuantity || undefined,
        location: stock.location || undefined,
        unitCost,
        totalCost,
        costBreakdown,
      } as any;
    }) as Stock[];
  }

  async getLowStock(storeId?: string): Promise<Stock[]> {
    if (!storeId) {
      throw new NotFoundException('Store ID is required');
    }

    const stocks = await this.prisma.stock.findMany({
      where: {
        storeId: storeId,
        quantity: {
          lte: 10
        }
      },
      include: {
        product: {
          include: {
            costCache: true,
            finishedGoods: {
              orderBy: {
                createdAt: 'desc'
              },
              take: 1
            },
            productionOrders: {
              where: {
                status: 'finished'
              },
              orderBy: {
                finishedAt: 'desc'
              },
              take: 1,
              select: {
                totalMaterialCost: true,
                totalPackagingCost: true,
                totalOverheadCost: true,
                totalCost: true,
                unitCost: true,
                actualOutputQty: true
              }
            }
          }
        }
      }
    });

    return stocks.map(stock => {
      let unitCost = 0;
      let costBreakdown: any = undefined;
      
      const lastProductionOrder = stock.product.productionOrders && stock.product.productionOrders.length > 0
        ? stock.product.productionOrders[0]
        : null;
      
      if (stock.product.finishedGoods && stock.product.finishedGoods.length > 0) {
        unitCost = Number(stock.product.finishedGoods[0].unitCost);
      } else if (stock.product.costCache) {
        unitCost = Number(stock.product.costCache.unitCost);
      } else if (stock.product.costPrice) {
        unitCost = Number(stock.product.costPrice);
      }

      if (lastProductionOrder && lastProductionOrder.actualOutputQty && Number(lastProductionOrder.actualOutputQty) > 0) {
        const outputQty = Number(lastProductionOrder.actualOutputQty);
        const totalMaterialCost = Number(lastProductionOrder.totalMaterialCost) || 0;
        const totalPackagingCost = Number(lastProductionOrder.totalPackagingCost) || 0;
        const totalOverheadCost = Number(lastProductionOrder.totalOverheadCost) || 0;

        costBreakdown = {
          materialCost: totalMaterialCost,
          packagingCost: totalPackagingCost,
          overheadCost: totalOverheadCost,
          unitMaterialCost: outputQty > 0 ? totalMaterialCost / outputQty : 0,
          unitPackagingCost: outputQty > 0 ? totalPackagingCost / outputQty : 0,
          unitOverheadCost: outputQty > 0 ? totalOverheadCost / outputQty : 0,
        };
      }

      const totalCost = stock.quantity * unitCost;

      return {
        ...stock,
        maxQuantity: stock.maxQuantity || undefined,
        location: stock.location || undefined,
        unitCost,
        totalCost,
        costBreakdown,
      } as any;
    }) as Stock[];
  }

  async getStockAlerts(storeId?: string) {
    if (!storeId) {
      throw new NotFoundException('Store ID is required');
    }

    const lowStockItems = await this.prisma.stock.findMany({
      where: {
        storeId: storeId,
        quantity: {
          lte: 10
        }
      },
      include: {
        product: {
          include: {
            costCache: true,
            finishedGoods: {
              orderBy: {
                createdAt: 'desc'
              },
              take: 1
            }
          }
        }
      }
    });

    const outOfStockItems = await this.prisma.stock.findMany({
      where: {
        storeId: storeId,
        quantity: 0
      },
      include: {
        product: {
          include: {
            costCache: true,
            finishedGoods: {
              orderBy: {
                createdAt: 'desc'
              },
              take: 1
            }
          }
        }
      }
    });

    const calculateCosts = (stock: any) => {
      let unitCost = 0;
      
      if (stock.product.finishedGoods && stock.product.finishedGoods.length > 0) {
        unitCost = Number(stock.product.finishedGoods[0].unitCost);
      } else if (stock.product.costCache) {
        unitCost = Number(stock.product.costCache.unitCost);
      } else if (stock.product.costPrice) {
        unitCost = Number(stock.product.costPrice);
      }

      const totalCost = stock.quantity * unitCost;

      return {
        ...stock,
        maxQuantity: stock.maxQuantity || undefined,
        location: stock.location || undefined,
        unitCost,
        totalCost,
      };
    };

    return {
      lowStock: lowStockItems.map(calculateCosts),
      outOfStock: outOfStockItems.map(calculateCosts),
      totalAlerts: lowStockItems.length + outOfStockItems.length
    };
  }

  async getTransactions(storeId?: string) {
    if (!storeId) {
      throw new NotFoundException('Store ID is required');
    }

    return this.prisma.stockTransaction.findMany({
      where: {
        stock: {
          storeId: storeId,
        },
      },
      include: {
        stock: {
          include: {
            product: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  async getStatistics(storeId?: string) {
    if (!storeId) {
      throw new NotFoundException('Store ID is required');
    }

    const totalStock = await this.prisma.stock.aggregate({
      where: {
        storeId: storeId,
      },
      _sum: {
        quantity: true
      }
    });

    const lowStockCount = await this.prisma.stock.count({
      where: {
        storeId: storeId,
        quantity: {
          lte: 10
        }
      }
    });

    const totalProducts = await this.prisma.product.count({
      where: {
        storeId: storeId,
      },
    });

    // Calcular custo total do estoque
    const allStocks = await this.findAll(storeId);
    const totalCost = allStocks.reduce((sum, stock) => {
      return sum + ((stock as any).totalCost || 0);
    }, 0);

    return {
      totalStock: totalStock._sum.quantity || 0,
      lowStockCount,
      totalProducts,
      totalCost
    };
  }

  async findOne(id: string, storeId?: string): Promise<Stock> {
    if (!storeId) {
      throw new NotFoundException('Store ID is required');
    }

    const stock = await this.prisma.stock.findFirst({
      where: {
        id,
        storeId: storeId,
      },
      include: {
        product: {
          include: {
            costCache: true,
            finishedGoods: {
              orderBy: {
                createdAt: 'desc'
              },
              take: 1
            }
          }
        }
      }
    });

    if (!stock) {
      throw new NotFoundException(`Stock with ID ${id} not found`);
    }

    let unitCost = 0;
    
    if (stock.product.finishedGoods && stock.product.finishedGoods.length > 0) {
      unitCost = Number(stock.product.finishedGoods[0].unitCost);
    } else if (stock.product.costCache) {
      unitCost = Number(stock.product.costCache.unitCost);
    } else if (stock.product.costPrice) {
      unitCost = Number(stock.product.costPrice);
    }

    const totalCost = stock.quantity * unitCost;

    return {
      ...stock,
      maxQuantity: stock.maxQuantity || undefined,
      location: stock.location || undefined,
      unitCost,
      totalCost,
    } as Stock;
  }

  async create(data: CreateStockDto, storeId?: string): Promise<Stock> {
    if (!storeId) {
      throw new NotFoundException('Store ID is required');
    }

    // Verificar se o produto pertence à loja do usuário
    const product = await this.prisma.product.findFirst({
      where: {
        id: data.productId,
        storeId: storeId,
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${data.productId} not found in your store`);
    }

    // Mapear os campos do DTO para o schema do Prisma
    const stockData: any = {
      productId: data.productId,
      storeId: storeId, // Usar storeId do usuário, não do DTO
      quantity: data.quantity,
    };

    if (data.minStockLevel !== undefined) {
      stockData.minQuantity = data.minStockLevel;
    }

    if (data.maxStockLevel !== undefined) {
      stockData.maxQuantity = data.maxStockLevel;
    }

    if (data.location !== undefined) {
      stockData.location = data.location;
    }

    const stock = await this.prisma.stock.create({
      data: stockData,
      include: {
        product: {
          include: {
            costCache: true,
            finishedGoods: {
              orderBy: {
                createdAt: 'desc'
              },
              take: 1
            }
          }
        }
      }
    });

    let unitCost = 0;
    
    if (stock.product.finishedGoods && stock.product.finishedGoods.length > 0) {
      unitCost = Number(stock.product.finishedGoods[0].unitCost);
    } else if (stock.product.costCache) {
      unitCost = Number(stock.product.costCache.unitCost);
    } else if (stock.product.costPrice) {
      unitCost = Number(stock.product.costPrice);
    }

    const totalCost = stock.quantity * unitCost;

    return {
      ...stock,
      maxQuantity: stock.maxQuantity || undefined,
      location: stock.location || undefined,
      unitCost,
      totalCost,
    } as Stock;
  }

  async update(id: string, data: UpdateStockDto, storeId?: string): Promise<Stock> {
    if (!storeId) {
      throw new NotFoundException('Store ID is required');
    }

    const stock = await this.findOne(id, storeId);

    // Mapear os campos do DTO para o schema do Prisma
    const updateData: any = {};
    if (data.quantity !== undefined) updateData.quantity = data.quantity;
    if (data.minStockLevel !== undefined) updateData.minQuantity = data.minStockLevel;
    if (data.maxStockLevel !== undefined) updateData.maxQuantity = data.maxStockLevel;
    if (data.location !== undefined) updateData.location = data.location;

    const updatedStock = await this.prisma.stock.update({
      where: { id },
      data: updateData,
      include: {
        product: {
          include: {
            costCache: true,
            finishedGoods: {
              orderBy: {
                createdAt: 'desc'
              },
              take: 1
            }
          }
        }
      }
    });

    let unitCost = 0;
    
    if (updatedStock.product.finishedGoods && updatedStock.product.finishedGoods.length > 0) {
      unitCost = Number(updatedStock.product.finishedGoods[0].unitCost);
    } else if (updatedStock.product.costCache) {
      unitCost = Number(updatedStock.product.costCache.unitCost);
    } else if (updatedStock.product.costPrice) {
      unitCost = Number(updatedStock.product.costPrice);
    }

    const totalCost = updatedStock.quantity * unitCost;

    return {
      ...updatedStock,
      maxQuantity: updatedStock.maxQuantity || undefined,
      location: updatedStock.location || undefined,
      unitCost,
      totalCost,
    } as Stock;
  }

  async remove(id: string, storeId?: string): Promise<void> {
    if (!storeId) {
      throw new NotFoundException('Store ID is required');
    }

    await this.findOne(id, storeId);
    await this.prisma.stock.delete({
      where: { id }
    });
  }
}