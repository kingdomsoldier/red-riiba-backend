import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  async health() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const localesCount = await this.prisma.locale.count();
      return {
        status: 'ok',
        db: 'connected',
        locales: localesCount,
      };
    } catch (error) {
      return {
        status: 'error',
        db: 'disconnected',
        message: (error as Error).message,
      };
    }
  }
}