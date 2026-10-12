export const syntheticTenant = "11111111-1111-4111-8111-111111111111";
export const syntheticClient = "22222222-2222-4222-8222-222222222222";
export const fixtureUsers = {
  qa: { id: "44444444-4444-4444-8444-444444444441", oid: "33333333-3333-4333-8333-333333333331", name: "Usuario sintético QA 4B1", role: "QUALITY_ASSURANCE", active: true, admitted: true },
  reader: { id: "44444444-4444-4444-8444-444444444442", oid: "33333333-3333-4333-8333-333333333332", name: "Usuario sintético consulta 4B1", role: "READER", active: true, admitted: true },
  admin: { id: "44444444-4444-4444-8444-444444444443", oid: "33333333-3333-4333-8333-333333333333", name: "Usuario sintético IT 4B1", role: "TECHNICAL_ADMIN", active: true, admitted: true },
  manager: { id: "44444444-4444-4444-8444-444444444444", oid: "33333333-3333-4333-8333-333333333334", name: "Usuario sintético departamento 4B1", role: "DEPARTMENT_MANAGER", active: true, admitted: true },
  inactive: { id: "44444444-4444-4444-8444-444444444445", oid: "33333333-3333-4333-8333-333333333335", name: "Usuario sintético inactivo 4B1", role: "READER", active: false, admitted: true },
  unadmitted: { id: "44444444-4444-4444-8444-444444444446", oid: "33333333-3333-4333-8333-333333333336", name: "Usuario sintético pendiente 4B1", role: "READER", active: true, admitted: false },
  documentWriter: { id: "44444444-4444-4444-8444-444444444447", oid: "33333333-3333-4333-8333-333333333337", name: "Usuario sintético documentos 4B1", role: "OPERATOR", active: true, admitted: true },
} as const;
