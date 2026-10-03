-- CreateTable
CREATE TABLE "locales" (
    "id" SERIAL NOT NULL,
    "code_iso" VARCHAR(10) NOT NULL,
    "native_name" VARCHAR(100) NOT NULL,
    "english_name" VARCHAR(100) NOT NULL,
    "flag" VARCHAR(10),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "completion_status" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "locales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "locales_code_iso_key" ON "locales"("code_iso");

-- Índice parcial único: solo puede haber un idioma por defecto
CREATE UNIQUE INDEX "uq_locales_default" ON "locales" ("is_default") WHERE "is_default" = true;