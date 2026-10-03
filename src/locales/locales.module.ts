import { Module } from '@nestjs/common';
import { LocalesService } from './locales.service';
import { LocalesController } from './locales.controller';
import { LocalesAdminController } from './locales-admin.controller';

@Module({
  controllers: [LocalesController, LocalesAdminController],
  providers: [LocalesService],
  exports: [LocalesService],
})
export class LocalesModule {}