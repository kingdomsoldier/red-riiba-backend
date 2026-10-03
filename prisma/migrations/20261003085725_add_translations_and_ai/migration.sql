/*
  Warnings:

  - You are about to drop the column `completion_status` on the `locales` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "TranslationStatus" AS ENUM ('PENDING', 'TRANSLATED', 'OUTDATED');

-- AlterTable
ALTER TABLE "locales" DROP COLUMN "completion_status";

-- CreateTable
CREATE TABLE "translation_schemas" (
    "id" SERIAL NOT NULL,
    "namespace" VARCHAR(100) NOT NULL,
    "display_name" VARCHAR(150) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "translation_schemas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "translation_keys" (
    "id" SERIAL NOT NULL,
    "schema_id" INTEGER NOT NULL,
    "key" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "translation_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "translation_values" (
    "id" SERIAL NOT NULL,
    "key_id" INTEGER NOT NULL,
    "locale_id" INTEGER NOT NULL,
    "value" TEXT,
    "status" "TranslationStatus" NOT NULL DEFAULT 'PENDING',
    "is_ai_generated" BOOLEAN NOT NULL DEFAULT false,
    "translated_at" TIMESTAMPTZ,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "translation_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_config" (
    "id" SERIAL NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "api_key" TEXT NOT NULL,
    "model" VARCHAR(100) NOT NULL,
    "enabled_tasks" JSONB NOT NULL,
    "monthly_limit" DECIMAL(10,2),
    "monthly_spent" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ai_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_log" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" INTEGER,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "translation_schemas_namespace_key" ON "translation_schemas"("namespace");

-- CreateIndex
CREATE UNIQUE INDEX "translation_keys_schema_id_key_key" ON "translation_keys"("schema_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "translation_values_key_id_locale_id_key" ON "translation_values"("key_id", "locale_id");

-- CreateIndex
CREATE INDEX "activity_log_entity_type_entity_id_idx" ON "activity_log"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "activity_log_user_id_created_at_idx" ON "activity_log"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "translation_keys" ADD CONSTRAINT "translation_keys_schema_id_fkey" FOREIGN KEY ("schema_id") REFERENCES "translation_schemas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "translation_values" ADD CONSTRAINT "translation_values_key_id_fkey" FOREIGN KEY ("key_id") REFERENCES "translation_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "translation_values" ADD CONSTRAINT "translation_values_locale_id_fkey" FOREIGN KEY ("locale_id") REFERENCES "locales"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Safety: garantizar que el índice parcial único sobrevive a la migración
CREATE UNIQUE INDEX IF NOT EXISTS "uq_locales_default" ON "locales" ("is_default") WHERE "is_default" = true;