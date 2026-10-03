import {
  IsString,
  IsBoolean,
  IsOptional,
  IsInt,
  MaxLength,
  MinLength,
  Matches,
  Min,
} from 'class-validator';

export class CreateLocaleDto {
  @IsString()
  @MinLength(2)
  @MaxLength(10)
  @Matches(/^[a-z]{2}(-[A-Z]{2})?$/, {
    message:
      'codeIso debe ser un código ISO 639-1 válido (ej: "es", "en", "pt-BR")',
  })
  codeIso: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  nativeName: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  englishName: string;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  flag?: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @IsInt()
  @IsOptional()
  @Min(0)
  displayOrder?: number;
}