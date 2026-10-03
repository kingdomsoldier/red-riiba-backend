import { Module } from '@nestjs/common';
import { TranslationsService } from './translations.service';
import { TranslationsController } from './translations.controller';
import { TranslationsAdminController } from './translations-admin.controller';

@Module({
  controllers: [TranslationsController, TranslationsAdminController],
  providers: [TranslationsService],
  exports: [TranslationsService],
})
export class TranslationsModule {}