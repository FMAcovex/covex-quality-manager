import { defineReviewTargets } from "./catalog";
import type { ReviewSnapshotValue, ReviewTargetInstance } from "./types";
const section = (key: string, label: string, tab = "information") => ({ key:`audit.${key}`, module:"AUDIT" as const, targetKind:"SECTION" as const, tabKey:tab, sectionKey:key, fieldPath:null, label, anchorId:`review-audit-${key}` });
export const auditReviewTargets = defineReviewTargets({ identification: section("identification","Identificación"), scope: section("scope","Alcance"), planning: section("planning","Planificación"), participants: section("participants","Participantes"), conclusion: section("conclusion","Conclusión","report"), closure: section("closure","Cierre","report") });
function item(kind: "finding" | "action" | "followup", id: string, value: ReviewSnapshotValue): ReviewTargetInstance {
  const tab = kind === "followup" ? "followup" : "findings", entity = { finding:"AuditFinding", action:"AuditFindingAction", followup:"AuditFollowup" }[kind];
  return { key:`audit.${kind}.${id}`, module:"AUDIT", targetKind:"ITEM", tabKey:tab, sectionKey:kind, fieldPath:null, label:{ finding:"Hallazgo", action:"Acción", followup:"Seguimiento" }[kind], anchorId:`audit-${kind}-${id}`, targetEntityType:entity, targetEntityId:id, valueSnapshot:value };
}
export const auditFindingReviewTarget = (id: string, value: ReviewSnapshotValue) => item("finding",id,value);
export const auditActionReviewTarget = (id: string, value: ReviewSnapshotValue) => item("action",id,value);
export const auditFollowupReviewTarget = (id: string, value: ReviewSnapshotValue) => item("followup",id,value);
