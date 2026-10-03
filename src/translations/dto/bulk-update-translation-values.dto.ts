import {
  IsArray,
  IsInt,
  IsString,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BulkUpdateItemDto {
  @IsInt()
  id: number;

  @IsString()
  @IsOptional()
  value?: string;
}

export class BulkUpdateTranslationValuesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkUpdateItemDto)
  updates: BulkUpdateItemDto[];
}