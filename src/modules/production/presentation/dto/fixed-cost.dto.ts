import { IsString, IsOptional, IsNumber, IsEnum, IsBoolean, IsNotEmpty, Min } from 'class-validator';

export enum FixedCostFrequency {
  DAILY = 'daily',
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

export enum FixedCostCategory {
  OVERHEAD = 'overhead',
  LABOR = 'labor',
  UTILITIES = 'utilities',
  RENT = 'rent',
  OTHER = 'other',
}

export class CreateFixedCostDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsEnum(FixedCostFrequency)
  frequency: FixedCostFrequency;

  @IsEnum(FixedCostCategory)
  category: FixedCostCategory;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}

export class UpdateFixedCostDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsEnum(FixedCostFrequency)
  frequency?: FixedCostFrequency;

  @IsOptional()
  @IsEnum(FixedCostCategory)
  category?: FixedCostCategory;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class FixedCostsFiltersDto {
  @IsOptional()
  @IsEnum(FixedCostCategory)
  category?: FixedCostCategory;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(FixedCostFrequency)
  frequency?: FixedCostFrequency;
}
