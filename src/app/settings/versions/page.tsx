import Link from "next/link";
import { DocumentType, QmsRecordType } from "@prisma/client";
import { SettingsNav } from "@/components/settings-nav";
import {
  activateFormVersionAction,
  activateTemplateVersionAction,
  cloneFormVersionAction,
  registerTemplateVersionAction,
  importTemplatePackageAction,
} from "@/modules/configuration/admin-actions";
import { getAdministrationOverview, moduleLabel } from "@/modules/configuration/admin-queries";

export const dynamic = "force-dynamic";

const docLabel = (value: DocumentType) => value.replaceAll("_", " ");

export default async function VersionsPage() {
  const data = await getAdministrationOverview();

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
                          <form action={activateFormVersionAction.bind(null, form.id)}>
                            <input
                              type="hidden"
                              name="actor"
                              value={process.env.DEFAULT_ACTOR_NAME || "Usuario demo"}
                            />
                            <input
                              type="hidden"
                              name="reason"
                              value="Activación de nueva versión de formulario"
                            />
                            <button className="button small primary">Activar</button>
                          </form>
                        ) : null}

                        <details>
                          <summary className="button small">Clonar</summary>
                          <form
                            action={cloneFormVersionAction.bind(null, form.id)}
                            className="admin-pop-form"
                          >
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
                            <input
                              type="hidden"
                              name="actor"
                              value={process.env.DEFAULT_ACTOR_NAME || "Usuario demo"}
                            />
                            <button className="button small primary">Crear borrador</button>
                          </form>
                        </details>
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

        <div className="analytics-note">
          <strong>Paquete oficial de prueba:</strong> puedes cargar el ZIP «ANEXOS PARA APP» completo.
          La aplicación valida cada archivo por SHA-256 y registra automáticamente las plantillas
          de Desviaciones, CAPA, Controles de Cambios, Reclamaciones y Devoluciones. El PNT de
          Reclamaciones se usa como referencia documental, pero no se genera la respuesta formal (Anexo IV).
        </div>
        <form action={importTemplatePackageAction} className="form-grid admin-template-form" encType="multipart/form-data">
          <label className="field span-2">
            <span>Paquete ZIP de plantillas</span>
            <input name="package" type="file" accept=".zip,application/zip" required />
          </label>
          <input type="hidden" name="actor" value={process.env.DEFAULT_ACTOR_NAME || "Usuario demo"} />
          <input type="hidden" name="reason" value="Carga del paquete auditado de plantillas para pruebas Hito 10.2" />
          <div className="field form-submit">
            <span>&nbsp;</span>
            <button className="button primary">Importar y verificar ZIP</button>
          </div>
        </form>

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
                        <a
                          className="button small"
                          href={`/api/settings/templates/${template.id}/download`}
                        >
                          Descargar
                        </a>
                      ) : null}

                      {!template.isActive ? (
                        <form action={activateTemplateVersionAction.bind(null, template.id)}>
                          <input
                            type="hidden"
                            name="actor"
                            value={process.env.DEFAULT_ACTOR_NAME || "Usuario demo"}
                          />
                          <input
                            type="hidden"
                            name="reason"
                            value="Activación de plantilla controlada"
                          />
                          <button className="button small primary">Activar</button>
                        </form>
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

        <details className="admin-create-panel">
          <summary className="button">+ Registrar nueva plantilla</summary>
          <form
            action={registerTemplateVersionAction}
            className="form-grid admin-template-form"
          >
            <label className="field">
              <span>Módulo</span>
              <select name="module" required>
                {Object.values(QmsRecordType).map((module) => (
                  <option key={module} value={module}>
                    {moduleLabel(module)}
                  </option>
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

            <input
              type="hidden"
              name="actor"
              value={process.env.DEFAULT_ACTOR_NAME || "Usuario demo"}
            />

            <div className="full">
              <button className="button primary">Registrar como inactiva</button>
            </div>
          </form>
        </details>

        <div className="analytics-note">
          <strong>Importante:</strong> si adjuntas el archivo, la aplicación calcula y
          guarda automáticamente su SHA-256 y el binario queda en PostgreSQL. Registrar
          una plantilla no significa que cualquier Word/Excel nuevo sea compatible: si
          cambia la estructura de tablas/campos del anexo, el generador debe adaptarse y
          validarse antes de activar la versión. En Devoluciones, los Anexos IV y V se extraen
          del PNT GC-00/028/03; el importador ZIP registra automáticamente esa fuente para ambos.
        </div>
      </section>
    </section>
  );
}
