import { PermissionGate } from "@/components/permissions";
import { authorizedPage } from "@/lib/auth/page-guard";
import { appUserOptions } from "@/lib/auth/app-users";
import Link from "next/link";
import { notFound } from "next/navigation";
import { updateChangeControlFollowupAction } from "@/modules/change-control/actions";
import { ChangeFollowupForm } from "@/modules/change-control/components/change-followup-form";
import { getChangeControlDetail, getChangeControlLookups } from "@/modules/change-control/queries";
import { formatDate } from "@/modules/change-control/domain";
import { qmsRecordDisplayCode } from "@/lib/qms/record-links";

export const dynamic = "force-dynamic";

async function EditChangeControlFollowupPageAuthenticatedContent({
  params,
}: {
  params: Promise<{ id: string; sequence: string }>;
}) {
  const { id, sequence } = await params;
  if (!/^\d+$/.test(sequence)) notFound();
  const sequenceNumber = Number(sequence);
  const [record, lookups] = await Promise.all([
    getChangeControlDetail(id),
    getChangeControlLookups(),
  ]);
  if (!record) notFound();

  const followup = record.followups.find((item) => item.sequenceNumber === sequenceNumber);
  if (!followup) notFound();
  const users = await appUserOptions([followup.responsibleUserId]);

  const tasks = followup.taskStates.map((state) => ({
    id: state.task.id,
    departmentId: state.task.departmentId,
    departmentCodeSnapshot: state.task.departmentCodeSnapshot,
    description: state.task.description,
    responsible: state.task.responsible,
    plannedDate: state.task.plannedDate,
  }));

  return (
    <section className="form-page">
      <div className="record-header">
        <div>
          <p className="eyebrow">
            <Link href={`/changes/${id}?tab=followups`}>← Volver a Seguimientos</Link>
          </p>
          <h1>
            Editar Seguimiento {String(sequenceNumber).padStart(2, "0")} ·{" "}
            {qmsRecordDisplayCode(record.qmsRecord, "Control de Cambio")}
          </h1>
          <p className="muted-note">
            Corrige únicamente este seguimiento. Su número no cambia y las versiones/documentos posteriores no se eliminan.
          </p>
        </div>
        <span className="badge neutral">{formatDate(followup.followupDate)}</span>
      </div>

      <div className="card">
        <PermissionGate permission="FOLLOWUP"><ChangeFollowupForm
          action={updateChangeControlFollowupAction.bind(null, id, followup.id)}
          departments={lookups.departments}
          tasks={tasks}
          users={users}
          defaultResponsible={record.followupResponsible}
          editing
          defaults={{
            followupDate: followup.followupDate,
            responsible: followup.responsible,
            responsibleUserId: followup.responsibleUserId,
            observations: followup.observations,
            executionStatus: followup.executionStatus,
            executionDate: followup.executionDate,
            effectivenessStatus: followup.effectivenessStatus,
            effectivenessObservations: followup.effectivenessObservations,
            closeChange: followup.closeChange,
            nextFollowupDate: followup.nextFollowupDate,
            remainOpenReason: followup.remainOpenReason,
            conclusion: followup.conclusion,
            approvalByText: followup.approvalByText,
            taskStates: followup.taskStates.map((state) => ({
              taskId: state.taskId,
              status: state.status,
              actualDate: state.actualDate,
              evidenceComment: state.evidenceComment,
            })),
          }}
        /></PermissionGate>
      </div>
    </section>
  );
}

export default async function EditChangeControlFollowupPage(...args: Parameters<typeof EditChangeControlFollowupPageAuthenticatedContent>) {
  return authorizedPage("src/app/changes/[id]/followups/[sequence]/edit/page.tsx", () => EditChangeControlFollowupPageAuthenticatedContent(...args), args);
}
