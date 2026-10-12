-- CreateEnum
CREATE TYPE "AccessModule" AS ENUM ('DEVIATION', 'CAPA', 'CHANGE_CONTROL', 'COMPLAINT', 'RETURN', 'AUDIT', 'PNT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AccessPermission" AS ENUM ('READ', 'CREATE', 'EDIT', 'FOLLOWUP', 'REVIEW', 'CLOSE', 'ANNUL', 'DOWNLOAD', 'EXPORT', 'IMPORT', 'MANAGE_CONFIGURATION', 'MANAGE_USERS', 'ATTACH_DOCUMENT', 'GENERATE_DOCUMENT', 'AUDIT_ISSUE_REPORT', 'AUDIT_ISSUE_PROGRAMME', 'PNT_VERIFY', 'PNT_RECORD_APPROVAL', 'PNT_ACCEPT_APPROVAL', 'PNT_ACTIVATE', 'PNT_RETIRE', 'PNT_CORRECT', 'PNT_LEGACY_REGISTER', 'PNT_MANAGE_STATE');

-- CreateEnum
CREATE TYPE "AccessScope" AS ENUM ('ALL', 'ASSIGNED');

-- AlterTable
ALTER TABLE "ChangeHistory" ADD COLUMN     "authenticatedUserId" UUID;

-- AlterTable
ALTER TABLE "QmsRecordVersion" ADD COLUMN     "authenticatedUserId" UUID;

-- AlterTable
ALTER TABLE "ReviewThread" ADD COLUMN     "authenticatedUserId" UUID;

-- AlterTable
ALTER TABLE "ReviewMessage" ADD COLUMN     "authenticatedUserId" UUID;

-- AlterTable
ALTER TABLE "GeneratedDocument" ADD COLUMN     "authenticatedUserId" UUID;

-- AlterTable
ALTER TABLE "ConfigurationChange" ADD COLUMN     "authenticatedUserId" UUID;

-- AlterTable
ALTER TABLE "AuditPlanChange" ADD COLUMN     "authenticatedUserId" UUID;

-- AlterTable
ALTER TABLE "ControlledDocumentChange" ADD COLUMN     "authenticatedUserId" UUID;

-- AlterTable
ALTER TABLE "ControlledRevisionDocument" ADD COLUMN     "authenticatedUserId" UUID;

-- AlterTable
ALTER TABLE "ControlledRevisionDecision" ADD COLUMN     "authenticatedUserId" UUID;

-- AlterTable
ALTER TABLE "ControlledDocumentImportEvent" ADD COLUMN     "authenticatedUserId" UUID;

-- AlterTable
ALTER TABLE "AuditAnnualProgrammeVersion" ADD COLUMN     "authenticatedUserId" UUID;

-- CreateTable
CREATE TABLE "AuthUser" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "objectId" UUID NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "authorizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthRole" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "qaAcceptedAt" TIMESTAMP(3),
    "qaAcceptedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthRolePermission" (
    "id" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "module" "AccessModule" NOT NULL,
    "permission" "AccessPermission" NOT NULL,
    "scope" "AccessScope" NOT NULL,

    CONSTRAINT "AuthRolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthUserRole" (
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthUserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "AuthUserDepartment" (
    "userId" UUID NOT NULL,
    "departmentId" TEXT NOT NULL,

    CONSTRAINT "AuthUserDepartment_pkey" PRIMARY KEY ("userId","departmentId")
);

-- CreateTable
CREATE TABLE "AuthRecordAssignment" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "module" "AccessModule" NOT NULL,
    "recordId" UUID NOT NULL,

    CONSTRAINT "AuthRecordAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "csrfHash" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthLoginAttempt" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "verifier" TEXT NOT NULL,
    "returnTo" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthLoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthAuthorizationChange" (
    "id" UUID NOT NULL,
    "actorUserId" UUID,
    "source" TEXT NOT NULL,
    "targetUserId" TEXT,
    "action" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthAuthorizationChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthUser_tenantId_objectId_key" ON "AuthUser"("tenantId", "objectId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthRole_key_key" ON "AuthRole"("key");

-- CreateIndex
CREATE UNIQUE INDEX "AuthRolePermission_roleId_module_permission_key" ON "AuthRolePermission"("roleId", "module", "permission");

-- CreateIndex
CREATE UNIQUE INDEX "AuthRecordAssignment_userId_module_recordId_key" ON "AuthRecordAssignment"("userId", "module", "recordId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthSession_userId_revokedAt_idx" ON "AuthSession"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

-- CreateIndex
CREATE INDEX "AuthLoginAttempt_expiresAt_idx" ON "AuthLoginAttempt"("expiresAt");

-- AddForeignKey
ALTER TABLE "ChangeHistory" ADD CONSTRAINT "ChangeHistory_authenticatedUserId_fkey" FOREIGN KEY ("authenticatedUserId") REFERENCES "AuthUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QmsRecordVersion" ADD CONSTRAINT "QmsRecordVersion_authenticatedUserId_fkey" FOREIGN KEY ("authenticatedUserId") REFERENCES "AuthUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewThread" ADD CONSTRAINT "ReviewThread_authenticatedUserId_fkey" FOREIGN KEY ("authenticatedUserId") REFERENCES "AuthUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewMessage" ADD CONSTRAINT "ReviewMessage_authenticatedUserId_fkey" FOREIGN KEY ("authenticatedUserId") REFERENCES "AuthUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_authenticatedUserId_fkey" FOREIGN KEY ("authenticatedUserId") REFERENCES "AuthUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigurationChange" ADD CONSTRAINT "ConfigurationChange_authenticatedUserId_fkey" FOREIGN KEY ("authenticatedUserId") REFERENCES "AuthUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditPlanChange" ADD CONSTRAINT "AuditPlanChange_authenticatedUserId_fkey" FOREIGN KEY ("authenticatedUserId") REFERENCES "AuthUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlledDocumentChange" ADD CONSTRAINT "ControlledDocumentChange_authenticatedUserId_fkey" FOREIGN KEY ("authenticatedUserId") REFERENCES "AuthUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlledRevisionDocument" ADD CONSTRAINT "ControlledRevisionDocument_authenticatedUserId_fkey" FOREIGN KEY ("authenticatedUserId") REFERENCES "AuthUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlledRevisionDecision" ADD CONSTRAINT "ControlledRevisionDecision_authenticatedUserId_fkey" FOREIGN KEY ("authenticatedUserId") REFERENCES "AuthUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlledDocumentImportEvent" ADD CONSTRAINT "ControlledDocumentImportEvent_authenticatedUserId_fkey" FOREIGN KEY ("authenticatedUserId") REFERENCES "AuthUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditAnnualProgrammeVersion" ADD CONSTRAINT "AuditAnnualProgrammeVersion_authenticatedUserId_fkey" FOREIGN KEY ("authenticatedUserId") REFERENCES "AuthUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthRolePermission" ADD CONSTRAINT "AuthRolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "AuthRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthUserRole" ADD CONSTRAINT "AuthUserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AuthUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthUserRole" ADD CONSTRAINT "AuthUserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "AuthRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthUserDepartment" ADD CONSTRAINT "AuthUserDepartment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AuthUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthUserDepartment" ADD CONSTRAINT "AuthUserDepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthRecordAssignment" ADD CONSTRAINT "AuthRecordAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AuthUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AuthUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthAuthorizationChange" ADD CONSTRAINT "AuthAuthorizationChange_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "AuthUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Identity keys cannot be reassigned to another person. Administrative profile,
-- admission and role changes remain available; business histories are untouched.
CREATE FUNCTION covex_auth_identity_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."id" IS DISTINCT FROM OLD."id" OR NEW."tenantId" IS DISTINCT FROM OLD."tenantId" OR NEW."objectId" IS DISTINCT FROM OLD."objectId" THEN
    RAISE EXCEPTION 'Corporate identity keys are immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER auth_identity_immutable BEFORE UPDATE ON "AuthUser"
FOR EACH ROW EXECUTE FUNCTION covex_auth_identity_immutable();
