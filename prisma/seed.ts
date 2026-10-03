import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const locales = [
    {
      codeIso: 'es',
      nativeName: 'Español',
      englishName: 'Spanish',
      isDefault: true,
      displayOrder: 1,
    },
    {
      codeIso: 'en',
      nativeName: 'English',
      englishName: 'English',
      isDefault: false,
      displayOrder: 2,
    },
    {
      codeIso: 'fr',
      nativeName: 'Français',
      englishName: 'French',
      isDefault: false,
      displayOrder: 3,
    },
  ];

  for (const locale of locales) {
    await prisma.locale.upsert({
      where: { codeIso: locale.codeIso },
      update: {},
      create: locale,
    });
  }

  console.log('✅ Locales insertados');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });