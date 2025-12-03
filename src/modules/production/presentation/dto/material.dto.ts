import { IsString, IsOptional, IsNumber, IsEnum, IsDateString, IsNotEmpty, Min, Max } from 'class-validator';
import { Unit, BatchStatus } from '../../entities/material.entity';
import { IsValidUnit } from '../validators/is-valid-unit.validator';

export class CreateMaterialDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsValidUnit()
  baseUnit: Unit;

  @IsOptional()
  @IsNumber()
  @Min(0)
  densityGPerMl?: number;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsNumber()
  @Min(0)
  minStock: number;
}

export class UpdateMaterialDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsValidUnit()
  baseUnit?: Unit;

  @IsOptional()
  @IsNumber()
  @Min(0)
  densityGPerMl?: number;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minStock?: number;
}

export class CreateMaterialBatchDto {
  @IsString()
  @IsNotEmpty()
  materialId: string;

  @IsNumber()
  @Min(0.001)
  qty: number;

  @IsValidUnit()
  unit: Unit;

  @IsNumber()
  @Min(0.0001)
  unitCost: number;

  @IsOptional()
  @IsString()
  supplier?: string;

  @IsOptional()
  @IsString()
  lotCode?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsDateString()
  receivedAt: string;
}

export class UpdateMaterialBatchDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  qty?: number;

  @IsOptional()
  @IsValidUnit()
  unit?: Unit;

  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  unitCost?: number;

  @IsOptional()
  @IsString()
  supplier?: string;

  @IsOptional()
  @IsString()
  lotCode?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsDateString()
  receivedAt?: string;

  @IsOptional()
  @IsEnum(BatchStatus)
  status?: BatchStatus;
}

export class CreateProductBomDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsString()
  @IsNotEmpty()
  materialId: string;

  @IsNumber()
  @Min(0.001)
  qty: number;

  @IsValidUnit()
  unit: Unit;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  wastePercent?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateProductBomDto {
  @IsOptional()
  @IsNumber()
  @Min(0.001)
  qty?: number;

  @IsOptional()
  @IsValidUnit()
  unit?: Unit;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  wastePercent?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateUnitConversionDto {
  @IsOptional()
  @IsString()
  materialId?: string;

  @IsValidUnit()
  fromUnit: Unit;

  @IsValidUnit()
  toUnit: Unit;

  @IsNumber()
  @Min(0.000001)
  factor: number;
}

export class ScaleRecipeDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  @Min(0.001)
  targetOutputQty: number;

  @IsValidUnit()
  targetUnit: Unit;
}
