import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Stock } from '../entities/stock.entity';
import { CreateStockDto } from '../presentation/dto/createStock.dto';
import { UpdateStockDto } from '../presentation/interfaces/stock.interface';

@Injectable()
export class StockService {
  constructor(private prisma: PrismaService) { }

  async findAll(): Promise<Stock[]> {
    const stocks = await this.prisma.stock.findMany({
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

    return stocks.map(stock => {
      // Calcular custo unitário do produto
      // Prioridade: 1) FinishedGoodsInventory mais recente, 2) ProductCostCache, 3) costPrice do produto
      let unitCost = 0;
      
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

      // Calcular custo total (quantidade * custo unitário)
      const totalCost = stock.quantity * unitCost;

      return {
        ...stock,
        maxQuantity: stock.maxQuantity || undefined,
        location: stock.location || undefined,
        unitCost,
        totalCost,
      } as any;
    }) as Stock[];
  }

  async getLowStock(): Promise<Stock[]> {
    const stocks = await this.prisma.stock.findMany({
      where: {
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

    return stocks.map(stock => {
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
      } as any;
    }) as Stock[];
  }

  async getStockAlerts() {
    const lowStockItems = await this.prisma.stock.findMany({
      where: {
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

  async getTransactions() {
    return this.prisma.stockTransaction.findMany({
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

  async getStatistics() {
    const totalStock = await this.prisma.stock.aggregate({
      _sum: {
        quantity: true
      }
    });

    const lowStockCount = await this.prisma.stock.count({
      where: {
        quantity: {
          lte: 10
        }
      }
    });

    const totalProducts = await this.prisma.product.count();

    // Calcular custo total do estoque
    const allStocks = await this.findAll();
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

  async findOne(id: string): Promise<Stock> {
    const stock = await this.prisma.stock.findUnique({
      where: { id },
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

  async create(data: CreateStockDto): Promise<Stock> {
    // Mapear os campos do DTO para o schema do Prisma
    const stockData: any = {
      productId: data.productId,
      storeId: data.storeId,
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

  async update(id: string, data: UpdateStockDto): Promise<Stock> {
    const stock = await this.findOne(id);

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

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.stock.delete({
      where: { id }
    });
  }
}