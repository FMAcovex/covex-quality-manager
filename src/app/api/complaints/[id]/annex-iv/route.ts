import { NextResponse } from "next/server";
export const runtime="nodejs";
export async function GET(){
 return NextResponse.json(
  {error:"La respuesta formal al cliente/proveedor (Anexo IV) queda fuera del alcance de generación de la aplicación."},
  {status:410},
 );
}
