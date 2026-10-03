import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateTranslationValueDto {
  @IsString()
  @IsOptional()
  @MaxLength(10000)
  value?: string;

  @IsOptional()
  isAiGenerated?: boolean;
}