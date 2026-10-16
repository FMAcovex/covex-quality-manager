-- Vistas guardadas de listados (preferencia personal, D-084).
-- No es dato GMP: queda fuera de la captura obligatoria del audit trail
-- (sin disparador audit_b2_required). Los permisos de covex_app llegan por
-- los privilegios por defecto de covex_migrator (ops/postgres/roles.sql).

-- CreateTable
CREATE TABLE "SavedListView" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "listPath" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedListView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedListView_userId_listPath_idx" ON "SavedListView"("userId", "listPath");

-- CreateIndex
CREATE UNIQUE INDEX "SavedListView_userId_listPath_name_key" ON "SavedListView"("userId", "listPath", "name");

-- AddForeignKey
ALTER TABLE "SavedListView" ADD CONSTRAINT "SavedListView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AuthUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
