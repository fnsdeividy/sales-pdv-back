export class Stock {
  id: string;
  productId: string;
  storeId: string;
  quantity: number;
  minQuantity: number;
  maxQuantity?: number;
  location?: string;
  unitCost?: number;
  totalCost?: number;
  costBreakdown?: {
    materialCost?: number;
    packagingCost?: number;
    overheadCost?: number;
    unitMaterialCost?: number;
    unitPackagingCost?: number;
    unitOverheadCost?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}