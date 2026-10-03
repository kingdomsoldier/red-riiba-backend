import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const MESSAGES_DIR = path.resolve(process.cwd(), '..', 'frontend', 'messages');
const FORCE = process.argv.includes('--force');

const DISPLAY_NAMES: Record<string, string> = {
  HomePage: 'Página de inicio',
  AboutPage: 'Nosotros',
  ContactPage: 'Contacto',
  MembersPage: 'Miembros',
  PublicationsPage: 'Publicaciones',
  PoliciesPage: 'Políticas',
  Common: 'Común',
  Navigation: 'Navegación',
  Footer: 'Pie de página',
  Social: 'Redes sociales',
};

/** Aplana un objeto anidado a claves con notación de puntos */
function flatten(obj: unknown, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  if (typeof obj !== 'object' || obj === null) return result;

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      Object.assign(result, flatten(value, newKey));
    } else if (typeof value === 'string') {
      result[newKey] = value;
    }
  }
  return result;
}

interface NamespaceData {
  keys: Set<string>;
  values: Map<string, string>;
}

async function main() {
  console.log(`📁 Buscando JSON en: ${MESSAGES_DIR}`);
  console.log(`🔧 Modo: ${FORCE ? 'FORCE (sobrescribe existentes)' : 'SAFE (solo inserta faltantes)'}`);

  if (!fs.existsSync(MESSAGES_DIR)) {
    throw new Error(`No existe el directorio: ${MESSAGES_DIR}`);
  }

  // 1. Detectar locales disponibles
  const locales = fs
    .readdirSync(MESSAGES_DIR)
    .filter((name) => fs.statSync(path.join(MESSAGES_DIR, name)).isDirectory());

  console.log(`🌍 Locales encontrados: ${locales.join(', ')}`);

  // 2. Escanear todos los JSON
  const data: Record<string, Record<string, NamespaceData>> = {};

  for (const locale of locales) {
    data[locale] = {};
    const localeDir = path.join(MESSAGES_DIR, locale);
    const files = fs.readdirSync(localeDir).filter((f) => f.endsWith('.json'));

    for (const file of files) {
      const content = JSON.parse(
        fs.readFileSync(path.join(localeDir, file), 'utf-8'),
      ) as Record<string, unknown>;

      const namespaces = Object.keys(content);
      if (namespaces.length !== 1) {
        console.warn(
          `⚠️  ${locale}/${file}: se esperaba 1 namespace, hay ${namespaces.length}. Saltando.`,
        );
        continue;
      }

      const namespace = namespaces[0];
      const flat = flatten(content[namespace]);

      if (!data[locale][namespace]) {
        data[locale][namespace] = { keys: new Set(), values: new Map() };
      }

      for (const [key, value] of Object.entries(flat)) {
        data[locale][namespace].keys.add(key);
        data[locale][namespace].values.set(key, value);
      }
    }
  }

  // 3. Unión de namespaces y claves
  const allNamespaces = new Set<string>();
  const keysByNamespace = new Map<string, Set<string>>();

  for (const locale of locales) {
    for (const [namespace, nsData] of Object.entries(data[locale])) {
      allNamespaces.add(namespace);
      if (!keysByNamespace.has(namespace)) {
        keysByNamespace.set(namespace, new Set());
      }
      for (const key of nsData.keys) {
        keysByNamespace.get(namespace)!.add(key);
      }
    }
  }

  const totalKeys = Array.from(keysByNamespace.values()).reduce(
    (sum, s) => sum + s.size,
    0,
  );
  console.log(`📦 Namespaces: ${allNamespaces.size}`);
  console.log(`🔑 Claves totales: ${totalKeys}`);

  // ─────────────────────────────────────────────
  // 4. Schemas
  // ─────────────────────────────────────────────
  let schemasCreated = 0;
  let schemasSkipped = 0;

  for (const namespace of allNamespaces) {
    const existing = await prisma.translationSchema.findUnique({
      where: { namespace },
    });

    if (existing) {
      schemasSkipped++;
      continue;
    }

    await prisma.translationSchema.create({
      data: {
        namespace,
        displayName: DISPLAY_NAMES[namespace] ?? namespace,
      },
    });
    schemasCreated++;
  }
  console.log(`✅ Schemas: ${schemasCreated} creados, ${schemasSkipped} ya existían`);

  // ─────────────────────────────────────────────
  // 5. Keys
  // ─────────────────────────────────────────────
  const schemas = await prisma.translationSchema.findMany();
  const schemaMap = new Map(schemas.map((s) => [s.namespace, s.id]));

  let keysCreated = 0;
  let keysSkipped = 0;

  for (const [namespace, keys] of keysByNamespace.entries()) {
    const schemaId = schemaMap.get(namespace)!;
    for (const key of keys) {
      const existing = await prisma.translationKey.findUnique({
        where: { schemaId_key: { schemaId, key } },
      });

      if (existing) {
        keysSkipped++;
        continue;
      }

      await prisma.translationKey.create({
        data: { schemaId, key },
      });
      keysCreated++;
    }
  }
  console.log(`✅ Keys: ${keysCreated} creadas, ${keysSkipped} ya existían`);

  // ─────────────────────────────────────────────
  // 6. Values desde JSON
  // ─────────────────────────────────────────────
  const localesFromDb = await prisma.locale.findMany();
  const localeMap = new Map(localesFromDb.map((l) => [l.codeIso, l.id]));

  const keysFromDb = await prisma.translationKey.findMany({
    include: { schema: true },
  });
  const keyIdMap = new Map(
    keysFromDb.map((k) => [`${k.schema.namespace}.${k.key}`, k.id]),
  );

  let valuesCreated = 0;
  let valuesUpdated = 0;
  let valuesSkipped = 0;

  for (const locale of locales) {
    const localeId = localeMap.get(locale);
    if (!localeId) {
      console.warn(`⚠️  Locale ${locale} no existe en DB. Saltando sus valores.`);
      continue;
    }

    for (const [namespace, nsData] of Object.entries(data[locale])) {
      for (const key of nsData.keys) {
        const keyId = keyIdMap.get(`${namespace}.${key}`);
        if (!keyId) continue;

        const jsonValue = nsData.values.get(key) ?? null;
        const jsonStatus = jsonValue ? 'TRANSLATED' : 'PENDING';

        const existing = await prisma.translationValue.findUnique({
          where: { keyId_localeId: { keyId, localeId } },
        });

        if (existing) {
          if (FORCE) {
            // Sobrescribe
            await prisma.translationValue.update({
              where: { id: existing.id },
              data: {
                value: jsonValue,
                status: jsonStatus,
                translatedAt: jsonValue ? new Date() : null,
                isAiGenerated: false,
              },
            });
            valuesUpdated++;
          } else {
            valuesSkipped++;
          }
          continue;
        }

        // No existe → crear
        await prisma.translationValue.create({
          data: {
            keyId,
            localeId,
            value: jsonValue,
            status: jsonStatus,
            translatedAt: jsonValue ? new Date() : null,
          },
        });
        valuesCreated++;
      }
    }
  }
  console.log(
    `✅ Values con JSON: ${valuesCreated} creados, ${valuesUpdated} actualizados, ${valuesSkipped} ignorados`,
  );

  // ─────────────────────────────────────────────
  // 7. Rellenar valores faltantes (PENDING)
  // ─────────────────────────────────────────────
  console.log('🔍 Buscando valores faltantes...');
  let missingCreated = 0;

  for (const [namespace, keys] of keysByNamespace.entries()) {
    const schemaId = schemaMap.get(namespace)!;

    for (const key of keys) {
      const keyId = keyIdMap.get(`${namespace}.${key}`)!;

      for (const locale of localesFromDb) {
        const exists = await prisma.translationValue.findUnique({
          where: { keyId_localeId: { keyId, localeId: locale.id } },
        });

        if (!exists) {
          await prisma.translationValue.create({
            data: {
              keyId,
              localeId: locale.id,
              value: null,
              status: 'PENDING',
            },
          });
          missingCreated++;
        }
      }
    }
  }
  console.log(`✅ ${missingCreated} valores faltantes rellenados como PENDING`);

  console.log('🎉 Migración de traducciones completa');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });