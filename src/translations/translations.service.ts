import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateTranslationValueDto } from './dto/update-translation-value.dto';
import { BulkUpdateTranslationValuesDto } from './dto/bulk-update-translation-values.dto';

@Injectable()
export class TranslationsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────
  // ENDPOINTS PÚBLICOS
  // ─────────────────────────────────────────────

  /**
   * Devuelve el objeto anidado de traducciones para un locale.
   * Aplica fallback al locale por defecto si una clave está PENDING.
   */
  async getTranslationsByLocale(localeCode: string) {
    const locale = await this.prisma.locale.findUnique({
      where: { codeIso: localeCode },
    });
    if (!locale) {
      throw new NotFoundException(`Locale "${localeCode}" no encontrado`);
    }

    const defaultLocale = await this.prisma.locale.findFirst({
      where: { isDefault: true },
    });
    if (!defaultLocale) {
      throw new BadRequestException('No hay idioma por defecto configurado');
    }

    // Traer todos los schemas con sus keys y values de los dos locales
    const schemas = await this.prisma.translationSchema.findMany({
      include: {
        keys: {
          include: {
            values: {
              where: {
                localeId: { in: [locale.id, defaultLocale.id] },
              },
            },
          },
        },
      },
    });

    const result: Record<string, any> = {};

    for (const schema of schemas) {
      const schemaObj: Record<string, any> = {};

      for (const key of schema.keys) {
        const requestedValue = key.values.find(
          (v) => v.localeId === locale.id,
        );
        const defaultValue = key.values.find(
          (v) => v.localeId === defaultLocale.id,
        );

        // Fallback: si el value solicitado no tiene texto, usar el default
        const finalValue =
          requestedValue?.value && requestedValue.value.length > 0
            ? requestedValue.value
            : defaultValue?.value ?? '';

        setNestedValue(schemaObj, key.key, finalValue);
      }

      result[schema.namespace] = schemaObj;
    }

    return result;
  }

  /**
   * Devuelve un hash que representa el estado actual de las traducciones
   * de un locale. Cambia cuando cualquier valor cambia.
   */
  async getVersionHash(localeCode: string) {
    const locale = await this.prisma.locale.findUnique({
      where: { codeIso: localeCode },
    });
    if (!locale) {
      throw new NotFoundException(`Locale "${localeCode}" no encontrado`);
    }

    const values = await this.prisma.translationValue.findMany({
      where: { localeId: locale.id },
      select: { id: true, value: true, status: true, updatedAt: true },
      orderBy: { id: 'asc' },
    });

    const payload = values
      .map((v) => `${v.id}:${v.value ?? ''}:${v.status}:${v.updatedAt.toISOString()}`)
      .join('|');

    const hash = createHash('sha256').update(payload).digest('hex');

    return { locale: localeCode, version: hash };
  }

  // ─────────────────────────────────────────────
  // ENDPOINTS ADMIN
  // ─────────────────────────────────────────────

  /**
   * Lista todos los schemas con porcentaje de completitud por idioma.
   */
  async findAllSchemas() {
    const schemas = await this.prisma.translationSchema.findMany({
      include: {
        keys: {
          include: {
            values: {
              include: { locale: true },
            },
          },
        },
      },
      orderBy: { namespace: 'asc' },
    });

    const locales = await this.prisma.locale.findMany({
      orderBy: { displayOrder: 'asc' },
    });

    return schemas.map((schema) => {
      const totalKeys = schema.keys.length;
      const completionByLocale: Record<string, number> = {};

      for (const locale of locales) {
        const translated = schema.keys.filter((k) =>
          k.values.some(
            (v) =>
              v.localeId === locale.id &&
              v.status === 'TRANSLATED' &&
              v.value,
          ),
        ).length;

        completionByLocale[locale.codeIso] =
          totalKeys === 0 ? 100 : Math.round((translated / totalKeys) * 100);
      }

      return {
        id: schema.id,
        namespace: schema.namespace,
        displayName: schema.displayName,
        totalKeys,
        completionByLocale,
      };
    });
  }

  /**
   * Devuelve las claves de un schema con sus valores en los locales pedidos.
   */
  async findKeysBySchema(schemaId: number, localeCodes: string[]) {
    const schema = await this.prisma.translationSchema.findUnique({
      where: { id: schemaId },
    });
    if (!schema) {
      throw new NotFoundException(`Schema ${schemaId} no encontrado`);
    }

    const locales = await this.prisma.locale.findMany({
      where: { codeIso: { in: localeCodes } },
    });

    const keys = await this.prisma.translationKey.findMany({
      where: { schemaId },
      include: {
        values: {
          where: { localeId: { in: locales.map((l) => l.id) } },
        },
      },
      orderBy: { key: 'asc' },
    });

    return {
      schema: {
        id: schema.id,
        namespace: schema.namespace,
        displayName: schema.displayName,
      },
      keys: keys.map((k) => {
        const values: Record<string, any> = {};
        for (const locale of locales) {
          const val = k.values.find((v) => v.localeId === locale.id);
          values[locale.codeIso] = val
            ? {
                id: val.id,
                value: val.value,
                status: val.status,
                isAiGenerated: val.isAiGenerated,
              }
            : { id: null, value: null, status: 'PENDING', isAiGenerated: false };
        }
        return { id: k.id, key: k.key, values };
      }),
    };
  }

  /**
   * Actualiza un valor de traducción.
   */
  async updateValue(id: number, dto: UpdateTranslationValueDto) {
    const existing = await this.prisma.translationValue.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`TranslationValue ${id} no encontrado`);
    }

    const newValue = dto.value ?? null;
    const newStatus = newValue && newValue.length > 0 ? 'TRANSLATED' : 'PENDING';

    return this.prisma.translationValue.update({
      where: { id },
      data: {
        value: newValue,
        status: newStatus,
        isAiGenerated: dto.isAiGenerated ?? false,
        translatedAt: newValue ? new Date() : null,
      },
    });
  }

  /**
   * Actualiza varios valores a la vez.
   */
  async bulkUpdate(dto: BulkUpdateTranslationValuesDto) {
    const results = await this.prisma.$transaction(
      dto.updates.map((item) => {
        const newValue = item.value ?? null;
        const newStatus =
          newValue && newValue.length > 0 ? 'TRANSLATED' : 'PENDING';

        return this.prisma.translationValue.update({
          where: { id: item.id },
          data: {
            value: newValue,
            status: newStatus,
            translatedAt: newValue ? new Date() : null,
          },
        });
      }),
    );

    return { updated: results.length };
  }
}

/**
 * Asigna un valor en un objeto anidado usando notación de puntos.
 * Ejemplo: setNestedValue({}, "objective.title", "Objetivo")
 *          → { objective: { title: "Objetivo" } }
 */
function setNestedValue(obj: Record<string, any>, path: string, value: any) {
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!current[part] || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
}