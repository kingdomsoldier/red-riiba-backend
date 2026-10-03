import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLocaleDto } from './dto/create-locale.dto';
import { UpdateLocaleDto } from './dto/update-locale.dto';

@Injectable()
export class LocalesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Devuelve todos los idiomas ordenados por displayOrder */
  findAll() {
    return this.prisma.locale.findMany({
      orderBy: { displayOrder: 'asc' },
    });
  }

  /** Devuelve solo los idiomas activos */
  findActive() {
    return this.prisma.locale.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });
  }

  /** Busca un idioma por ID o lanza 404 */
  async findOne(id: number) {
    const locale = await this.prisma.locale.findUnique({ where: { id } });
    if (!locale) {
      throw new NotFoundException(`Locale ${id} no encontrado`);
    }
    return locale;
  }

  /**
   * Crea un idioma nuevo con transacción atómica:
   * 1. INSERT en locales
   * 2. INSERT en translation_values (PENDING) para todas las claves existentes
   */
  async create(dto: CreateLocaleDto) {
    // Verificar que el codeIso no exista ya
    const existing = await this.prisma.locale.findUnique({
      where: { codeIso: dto.codeIso },
    });
    if (existing) {
      throw new ConflictException(
        `Ya existe un idioma con el código "${dto.codeIso}"`,
      );
    }

    // Si se marca como default, quitar el default del anterior
    if (dto.isDefault) {
      await this.prisma.locale.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Crear el locale
      const locale = await tx.locale.create({
        data: {
          codeIso: dto.codeIso,
          nativeName: dto.nativeName,
          englishName: dto.englishName,
          flag: dto.flag ?? null,
          isDefault: dto.isDefault ?? false,
          isActive: false, // por defecto inactivo
          displayOrder: dto.displayOrder ?? 0,
        },
      });

      // 2. Generar translation_values vacías para todas las claves
      const keys = await tx.translationKey.findMany({
        select: { id: true },
      });

      if (keys.length > 0) {
        await tx.translationValue.createMany({
          data: keys.map((k) => ({
            keyId: k.id,
            localeId: locale.id,
            value: null,
            status: 'PENDING' as const,
          })),
          skipDuplicates: true,
        });
      }

      return { locale, keysCreated: keys.length };
    });

    return result;
  }

  /** Actualiza un idioma (parcial) */
  async update(id: number, dto: UpdateLocaleDto) {
    const locale = await this.findOne(id);

    // No permitir cambiar el codeIso
    if (dto.codeIso && dto.codeIso !== locale.codeIso) {
      throw new BadRequestException('No se puede cambiar el codeIso de un idioma');
    }

    // Si se marca como default, quitar el default del anterior
    if (dto.isDefault === true && !locale.isDefault) {
      await this.prisma.locale.updateMany({
        where: { isDefault: true, NOT: { id } },
        data: { isDefault: false },
      });
    }

    return this.prisma.locale.update({
      where: { id },
      data: {
        nativeName: dto.nativeName,
        englishName: dto.englishName,
        flag: dto.flag,
        isDefault: dto.isDefault,
        displayOrder: dto.displayOrder,
      },
    });
  }

  /** Elimina un idioma (no permite borrar el default) */
  async remove(id: number) {
    const locale = await this.findOne(id);

    if (locale.isDefault) {
      throw new BadRequestException(
        'No se puede eliminar el idioma por defecto del sistema',
      );
    }

    // El onDelete: Cascade en TranslationValue maneja el borrado en cascada
    return this.prisma.locale.delete({ where: { id } });
  }
}