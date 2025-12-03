import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@ValidatorConstraint({ name: 'IsValidUnit', async: true })
@Injectable()
export class IsValidUnitConstraint implements ValidatorConstraintInterface {
  constructor(private prisma: PrismaService) {}

  async validate(value: any, args: ValidationArguments): Promise<boolean> {
    if (typeof value !== 'string') {
      return false;
    }

    // Verificar se o símbolo existe no banco como unidade ativa
    const unit = await this.prisma.measurementUnit.findFirst({
      where: {
        symbol: value,
        isActive: true,
      },
    });

    return !!unit;
  }

  defaultMessage(args: ValidationArguments): string {
    return `Unit "${args.value}" is not valid or is not active. Please use a valid measurement unit symbol.`;
  }
}

export function IsValidUnit(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isValidUnit',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidUnitConstraint,
    });
  };
}

