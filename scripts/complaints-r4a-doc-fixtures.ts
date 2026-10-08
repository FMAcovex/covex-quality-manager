// Synthetic OOXML for automated tests only; never an official template.
import { writeZip } from "../src/lib/ooxml/zip";
export function syntheticComplaintDoc(annex:"III"|"IV"){
 const sizes=annex==="III"?[2,64,3,15,2]:[2,3,8,5];
 const body=sizes.map((rows,t)=>`<w:tbl>${Array.from({length:rows},(_,r)=>`<w:tr>${Array.from({length:6},(_,c)=>`<w:tc><w:p><w:r><w:t>TEST ${t}/${r}/${c}</w:t></w:r></w:p></w:tc>`).join("")}</w:tr>`).join("")}</w:tbl>`).join("");
 return writeZip([{name:"[Content_Types].xml",data:Buffer.from('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')},{name:"_rels/.rels",data:Buffer.from('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')},{name:"word/document.xml",data:Buffer.from(`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr/></w:body></w:document>`)}]);
}
