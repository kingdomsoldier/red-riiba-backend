import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { TranslationsService } from './translations.service';
import { UpdateTranslationValueDto } from './dto/update-translation-value.dto';
import { BulkUpdateTranslationValuesDto } from './dto/bulk-update-translation-values.dto';

@Controller('admin')
export class TranslationsAdminController {
  constructor(private readonly translationsService: TranslationsService) {}

  @Get('translation-schemas')
  findAllSchemas() {
    return this.translationsService.findAllSchemas();
  }

  @Get('translation-schemas/:id/keys')
  findKeysBySchema(
    @Param('id', ParseIntPipe) id: number,
    @Query('locales') localesQuery?: string,
  ) {
    const locales = localesQuery
      ? localesQuery.split(',').map((s) => s.trim())
      : ['es'];
    return this.translationsService.findKeysBySchema(id, locales);
  }

  @Patch('translation-values/bulk')
  bulkUpdate(@Body() dto: BulkUpdateTranslationValuesDto) {
    return this.translationsService.bulkUpdate(dto);
  }

  @Patch('translation-values/:id')
  updateValue(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTranslationValueDto,
  ) {
    return this.translationsService.updateValue(id, dto);
  }
}
