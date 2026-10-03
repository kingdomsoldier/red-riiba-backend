import { Controller, Get, Param, Header, Res } from '@nestjs/common';
import type { Response } from 'express';
import { TranslationsService } from './translations.service';

@Controller('translations')
export class TranslationsController {
  constructor(private readonly translationsService: TranslationsService) {}

  @Get(':locale')
  @Header('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
  async getTranslations(
    @Param('locale') locale: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.translationsService.getTranslationsByLocale(locale);
    const version = await this.translationsService.getVersionHash(locale);
    res.setHeader('ETag', `"${version.version}"`);
    return data;
  }

  @Get(':locale/version')
  async getVersion(@Param('locale') locale: string) {
    return this.translationsService.getVersionHash(locale);
  }
}