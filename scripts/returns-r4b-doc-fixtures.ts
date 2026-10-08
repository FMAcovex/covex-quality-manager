// Synthetic test fixtures only; never a controlled source or production fallback.
import {writeZip,readZip,updateZipEntry} from "../src/lib/ooxml/zip";
import {generateSimpleXlsx} from "../src/lib/ooxml/simple-xlsx";
export function syntheticReturnDoc(annex:"III"|"IV"|"V"){
 const sizes=annex==="III"?[1,5,2,2,1,13,7,3,2]:annex==="IV"?[7]:[1,4,1,1,1,2];
 const body=sizes.map((rows,t)=>`<w:tbl>${Array.from({length:rows},(_,r)=>`<w:tr>${Array.from({length:6},(_,c)=>`<w:tc><w:p><w:r><w:t>TEST ${t}/${r}/${c}</w:t></w:r></w:p></w:tc>`).join("")}</w:tr>`).join("")}</w:tbl>`).join("");
 return writeZip([{name:"[Content_Types].xml",data:Buffer.from('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')},{name:"_rels/.rels",data:Buffer.from('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')},{name:"word/document.xml",data:Buffer.from(`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr/></w:body></w:document>`)}]);
}
export function syntheticReturnXlsx(){
 const entries=readZip(generateSimpleXlsx('"AÑO"',Array.from({length:13},(_,i)=>`TEST ${i}`),Array.from({length:5},()=>Array.from({length:13},()=>"TEST"))));
 const sheet=entries.find(x=>x.name==="xl/worksheets/sheet1.xml")!;
 updateZipEntry(entries,sheet.name,sheet.data.toString().replace('</worksheet>','<pageMargins left="0.25" right="0.25" top="0.25" bottom="0.25" header="0" footer="0"/></worksheet>'));
 return writeZip(entries);
}
