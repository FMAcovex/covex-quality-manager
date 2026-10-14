import { randomUUID } from "node:crypto";
import { ActorField } from "@/components/permissions";
import { PermissionGate } from "@/components/permissions";
import { currentActor } from "@/lib/auth/presentation";

import { CsrfField } from "@/components/csrf";
import { authorizedPage } from "@/lib/auth/page-guard";
import Link from "next/link";
import { DocumentType, QmsRecordType } from "@prisma/client";
import { SettingsNav } from "@/components/settings-nav";
import {
  activateFormVersionAction,
  activateTemplateVersionAction,
  cloneFormVersionAction,
  registerTemplateVersionAction,
} from "@/modules/configuration/admin-actions";
import { getAdministrationOverview, moduleLabel } from "@/modules/configuration/admin-queries";
import { evaluateRequiredTemplateReadiness } from "@/modules/configuration/template-readiness";

export const dynamic = "force-dynamic";

const docLabel = (value: DocumentType) => value.replaceAll("_", " ");

async function VersionsPageAuthenticatedContent() {
  const data = await getAdministrationOverview();
  const readiness = evaluateRequiredTemplateReadiness(data.templates);

  return (
    <section className="workspace">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Administración</p>
          <h1>Versiones y plantillas</h1>
          <p>Evolución controlada sin modificar expedientes históricos.</p>
        </div>
      </div>

      <SettingsNav active="/settings/versions" />

      <section className="card template-readiness-card">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Estado documental</p>
            <h2>Plantillas controladas · {readiness.ready}/{readiness.total} listas</h2>
            <p className="muted-note">
              {readiness.complete
                ? "Todas las plantillas necesarias para generar anexos y listados oficiales están cargadas."
                : "Faltan archivos controlados. Las descargas oficiales afectadas permanecerán bloqueadas hasta cargarlos."}
            </p>
          </div>
          <span className={`badge ${readiness.complete ? "open" : "warning"}`}>
            {readiness.complete ? "Preparado" : `${readiness.total - readiness.ready} pendientes`}
          </span>
        </div>
        {!readiness.complete ? (
          <div className="readiness-grid">
            {readiness.items.filter((item) => !item.ready).map((item) => (
              <div className="readiness-item" key={`${item.module}-${item.documentType}-${item.versionCode}`}>
                <strong>{item.label}</strong>
                <span>v{item.versionCode} · archivo no cargado</span>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <div className="analytics-note">
        <strong>Activación controlada:</strong> clonar un formulario crea un borrador.
        Solo al activarlo pasa a aplicarse a nuevos expedientes desde su fecha de vigencia;
        la versión anterior se retira automáticamente el día previo.
      </div>

      <section className="card">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Formularios</p>
            <h2>Versiones de estructura</h2>
          </div>
        </div>

        <div className="table-scroll">
          <table className="records-table compact-table admin-version-table">
            <thead>
              <tr>
                <th>Módulo</th>
                <th>Versión</th>
                <th>Estado</th>
                <th>Vigencia</th>
                <th>Campos</th>
                <th>Uso</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.forms.map((form) => {
                const usage =
                  form._count.deviations +
                  form._count.capas +
                  form._count.changeControls +
                  form._count.complaints +
                  form._count.returnRecords;

                return (
                  <tr key={form.id}>
                    <td>{moduleLabel(form.module)}</td>
                    <td>
                      <strong>{form.versionCode}</strong>
                      <br />
                      <small>{form.notes ?? ""}</small>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          form.status === "ACTIVE"
                            ? "open"
                            : form.status === "DRAFT"
                              ? "warning"
                              : "neutral"
                        }`}
                      >
                        {form.status}
                      </span>
                    </td>
                    <td>
                      {form.effectiveFrom.toLocaleDateString("es-ES")} →{" "}
                      {form.effectiveTo?.toLocaleDateString("es-ES") ?? "actual"}
                    </td>
                    <td>{form._count.fieldConfigs}</td>
                    <td>{usage} expedientes</td>
                    <td>
                      <div className="admin-action-stack">
                        <Link className="button small" href={`/settings/versions/${form.id}`}>
                          {form.status === "DRAFT" ? "Editar borrador" : "Ver campos"}
                        </Link>

                        {form.status === "DRAFT" ? (
                          <PermissionGate permission="MANAGE_CONFIGURATION" module={form.module}><form action={activateFormVersionAction.bind(null, form.id)}><CsrfField requestId={randomUUID()} />
                            <ActorField
                              type="hidden"
                              name="actor"
                              value={currentActor()}
                            />
                            <input
                              type="hidden"
                              name="reason"
                              value="Activación de nueva versión de formulario"
                            />
                            <button className="button small primary">Activar</button>
                          </form></PermissionGate>
                        ) : null}

                        <PermissionGate permission="MANAGE_CONFIGURATION" module={form.module}><details>
                          <summary className="button small">Clonar</summary>
                          <PermissionGate permission="MANAGE_CONFIGURATION" module={form.module}><form
                            action={cloneFormVersionAction.bind(null, form.id)}
                            className="admin-pop-form"
                          ><CsrfField requestId={randomUUID()} />
                            <label>
                              Nuevo código
                              <input name="versionCode" placeholder="DEV-07" required />
                            </label>
                            <label>
                              Vigente desde
                              <input name="effectiveFrom" type="date" required />
                            </label>
                            <label>
                              Notas
                              <input
                                name="notes"
                                placeholder={`Clonada desde ${form.versionCode}`}
                              />
                            </label>
                            <label>
                              Motivo
                              <input name="reason" />
                            </label>
                            <ActorField
                              type="hidden"
                              name="actor"
                              value={currentActor()}
                            />
                            <button className="button small primary">Crear borrador</button>
                          </form></PermissionGate>
                        </details></PermissionGate>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="muted-note">
          Los cambios de campos GMP tipados o de reglas de negocio siguen requiriendo
          actualización técnica y pruebas. Esta pantalla controla la versión aplicable
          y permite preparar el borrador sin alterar el histórico.
        </p>
      </section>

      <section className="card">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Documentación</p>
            <h2>Versiones de plantillas</h2>
          </div>
        </div>

        <div className="table-scroll">
          <table className="records-table compact-table admin-template-table">
            <thead>
              <tr>
                <th>Módulo</th>
                <th>Documento</th>
                <th>Versión</th>
                <th>Vigencia</th>
                <th>Estado</th>
                <th>Checksum / ubicación</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {data.templates.map((template) => (
                <tr key={template.id}>
                  <td>{moduleLabel(template.module)}</td>
                  <td>{docLabel(template.documentType)}</td>
                  <td>
                    <strong>{template.versionCode}</strong>
                  </td>
                  <td>
                    {template.effectiveFrom.toLocaleDateString("es-ES")} →{" "}
                    {template.effectiveTo?.toLocaleDateString("es-ES") ?? "actual"}
                  </td>
                  <td>
                    <span className={`badge ${template.isActive ? "open" : "neutral"}`}>
                      {template.isActive ? "Activa" : "Inactiva"}
                    </span>
                  </td>
                  <td className="table-cell-wrap">
                    <code>{template.checksum ?? "Sin checksum registrado"}</code>
                    <br />
                    <small>
                      {template.fileName
                        ? `${template.fileName}${
                            template.fileSize
                              ? ` · ${Math.round(template.fileSize / 1024)} KB`
                              : ""
                          }`
                        : template.filePath ?? "Sin archivo almacenado"}
                    </small>
                  </td>
                  <td>
                    <div className="admin-action-stack">
                      {template.fileName || template.filePath ? (
                        <PermissionGate permission="DOWNLOAD" module={template.module}><a
                          className="button small"
                          href={`/api/settings/templates/${template.id}/download`}
                        >
                          Descargar
                        </a></PermissionGate>
                      ) : null}

                      {!template.isActive ? (
                        <PermissionGate permission="MANAGE_CONFIGURATION" module={template.module}><form action={activateTemplateVersionAction.bind(null, template.id)}><CsrfField requestId={randomUUID()} />
                          <ActorField
                            type="hidden"
                            name="actor"
                            value={currentActor()}
                          />
                          <input
                            type="hidden"
                            name="reason"
                            value="Activación de plantilla controlada"
                          />
                          <button className="button small primary">Activar</button>
                        </form></PermissionGate>
                      ) : (
                        <span className="muted-note">Aplicable</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <PermissionGate permission="MANAGE_CONFIGURATION" anyModule><details className="admin-create-panel">
          <summary className="button">+ Registrar nueva plantilla</summary>
          <PermissionGate permission="MANAGE_CONFIGURATION" anyModule><form
            action={registerTemplateVersionAction}
            className="form-grid admin-template-form"
          ><CsrfField requestId={randomUUID()} />
            <label className="field">
              <span>Módulo</span>
              <select name="module" required>
                {Object.values(QmsRecordType).map((module) => (
                  <PermissionGate permission="MANAGE_CONFIGURATION" module={module} key={module}><option key={module} value={module}>
                    {moduleLabel(module)}
                  </option></PermissionGate>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Documento</span>
              <select name="documentType" required>
                {Object.values(DocumentType).map((documentType) => (
                  <option key={documentType} value={documentType}>
                    {docLabel(documentType)}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Versión</span>
              <input name="versionCode" required />
            </label>

            <label className="field">
              <span>Vigente desde</span>
              <input name="effectiveFrom" type="date" required />
            </label>

            <label className="field span-2">
              <span>Archivo controlado DOCX/XLSX</span>
              <input
                name="file"
                type="file"
                accept=".docx,.xlsx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              />
            </label>

            <label className="field span-2">
              <span>Ruta alternativa gestionada técnicamente</span>
              <input name="filePath" placeholder="templates/..." />
            </label>

            <label className="field span-2">
              <span>SHA-256 si se usa ruta alternativa</span>
              <input
                name="checksum"
                pattern="[a-fA-F0-9]{64}"
                placeholder="64 caracteres hexadecimales"
              />
            </label>

            <label className="field full">
              <span>Motivo / referencia documental</span>
              <input name="reason" />
            </label>

            <ActorField
              type="hidden"
              name="actor"
              value={currentActor()}
            />

            <div className="full">
              <button className="button primary">Registrar como inactiva</button>
            </div>
          </form></PermissionGate>
        </details></PermissionGate>

        <div className="analytics-note">
          <strong>Importante:</strong> si adjuntas el archivo, la aplicación calcula y
          guarda automáticamente su SHA-256 y el binario queda en PostgreSQL. Registrar
          una plantilla no significa que cualquier Word/Excel nuevo sea compatible: si
          cambia la estructura de tablas/campos del anexo, el generador debe adaptarse y
          validarse antes de activar la versión. Para Reclamaciones y Devoluciones debe
          cargarse el PNT DOCX completo, porque sus anexos se extraen de esa fuente controlada.
        </div>
      </section>
    </section>
  );
}

export default async function VersionsPage(...args: Parameters<typeof VersionsPageAuthenticatedContent>) {
  return authorizedPage("src/app/settings/versions/page.tsx", () => VersionsPageAuthenticatedContent(...args), args);
}
