import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { LocalesService } from './locales.service';
import { CreateLocaleDto } from './dto/create-locale.dto';
import { UpdateLocaleDto } from './dto/update-locale.dto';

@Controller('admin/locales')
export class LocalesAdminController {
  constructor(private readonly localesService: LocalesService) {}

  @Get()
  findAll() {
    return this.localesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.localesService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateLocaleDto) {
    return this.localesService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLocaleDto,
  ) {
    return this.localesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.localesService.remove(id);
  }
}