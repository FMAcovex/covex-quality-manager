// Test-only OOXML with enough cells/checkboxes for the unchanged native fillers.
// This is never installed outside the disposable capture fixture.
import { writeZip } from "../../src/lib/ooxml/zip";
export function syntheticWorkingDocumentTemplate() {
  const checkbox='<w:sdt><w:sdtPr><w14:checkbox><w14:checked w14:val="0"/></w14:checkbox></w:sdtPr><w:sdtContent><w:r><w:t>☐</w:t></w:r></w:sdtContent></w:sdt>';
  const cell=(index:number)=>`<w:tc><w:p><w:r><w:t>SYNTHETIC CELL</w:t></w:r>${index===0?checkbox.repeat(12):""}</w:p></w:tc>`;
  const row=`<w:tr>${Array.from({length:8},(_,i)=>cell(i)).join("")}</w:tr>`;
  const body=`<w:body>${(`<w:tbl>${row.repeat(80)}</w:tbl>`).repeat(8)}<w:sectPr/></w:body>`;
  return writeZip([{name:"word/document.xml",data:Buffer.from(`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml">${body}</w:document>`)}]);
}
