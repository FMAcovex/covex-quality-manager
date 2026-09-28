import type { Prisma } from "@prisma/client";

export type ReturnDeclarationData = {
  signatoryName: string | null;
  signatoryRole: string | null;
  observations: string | null;
  signedAt: string | null;
};

export const emptyReturnDeclaration: ReturnDeclarationData = {
  signatoryName: null,
  signatoryRole: null,
  observations: null,
  signedAt: null,
};

const s=(v:unknown)=>typeof v==="string"&&v.trim()?v.trim():null;

export function parseReturnDeclaration(value:unknown):ReturnDeclarationData{
 const root=value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};
 const raw=root.customerDeclaration&&typeof root.customerDeclaration==="object"&&!Array.isArray(root.customerDeclaration)
   ? root.customerDeclaration as Record<string,unknown>
   : root;
 return {signatoryName:s(raw.signatoryName),signatoryRole:s(raw.signatoryRole),observations:s(raw.observations),signedAt:s(raw.signedAt)};
}

export function returnDeclarationToJson(data:ReturnDeclarationData):Prisma.InputJsonValue{
 return {customerDeclaration:data} as unknown as Prisma.InputJsonValue;
}
