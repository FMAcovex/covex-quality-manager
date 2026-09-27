import { mkdir,readFile,writeFile } from "node:fs/promises";
import path from "node:path";
import { analyzeHistoricalChangeImport,applyHistoricalChangeImport } from "@/modules/change-control/import/import-service";
function arg(n:string){const i=process.argv.indexOf(n);return i>=0?process.argv[i+1]:undefined;}function has(n:string){return process.argv.includes(n);}
async function main(){const file=arg("--file");if(!file)throw new Error("Uso: pnpm import:changes -- --file <xlsx> [--apply --confirm APPLY_CHANGES_2025_2026]");
 const buffer=await readFile(path.resolve(file));const apply=has("--apply");if(apply&&arg("--confirm")!=="APPLY_CHANGES_2025_2026")throw new Error("La importación real requiere --confirm APPLY_CHANGES_2025_2026.");
 const report=apply?await applyHistoricalChangeImport(buffer,path.basename(file),arg("--actor")??"Importación histórica Controles de Cambio"):(await analyzeHistoricalChangeImport(buffer,path.basename(file))).report;
 await mkdir("reports/imports",{recursive:true});const out=`reports/imports/changes-${report.mode}-${Date.now()}.json`;await writeFile(out,JSON.stringify(report,null,2));console.log(report.counts);console.log("Informe:",out);if(!apply)console.log("DRY-RUN: no se ha escrito ningún expediente.");
}
main().catch((e)=>{console.error(e);process.exitCode=1;});
