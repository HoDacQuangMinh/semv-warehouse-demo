import { readFile, writeFile } from 'node:fs/promises';
import { deflateRawSync } from 'node:zlib';

const folder = new URL('../docs/', import.meta.url);
const markdown = await readFile(new URL('technical-guide.md', folder), 'utf8');
const lines = markdown.split(/\r?\n/), blocks = [];
for (let i = 0; i < lines.length;) {
  const line = lines[i];
  if (!line.trim()) { i++; continue; }
  if (line.startsWith('```')) {
    const text = []; i++;
    while (i < lines.length && !lines[i].startsWith('```')) text.push(lines[i++]);
    i++; blocks.push({ type: 'code', text: text.join('\n') }); continue;
  }
  const heading = line.match(/^(#{1,3}) (.+)$/);
  if (heading) { blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] }); i++; continue; }
  if (line.startsWith('|')) {
    const rows = [];
    while (i < lines.length && lines[i].startsWith('|')) {
      const cells = lines[i++].slice(1,-1).split('|').map(s => s.trim());
      if (!cells.every(s => /^:?-+:?$/.test(s))) rows.push(cells);
    }
    blocks.push({ type: 'table', rows }); continue;
  }
  const text = [line]; i++;
  while (i < lines.length && lines[i].trim() && !/^(#|\||```)/.test(lines[i])) text.push(lines[i++]);
  blocks.push({ type: 'paragraph', text: text.join(' ') });
}
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const htmlBlocks = blocks.map(b => b.type === 'heading' ? `<h${b.level}>${esc(b.text)}</h${b.level}>`
  : b.type === 'table' ? `<table>${b.rows.map((r,i) => `<tr>${r.map(c => `<${i?'td':'th'}>${esc(c)}</${i?'td':'th'}>`).join('')}</tr>`).join('')}</table>`
  : b.type === 'code' ? `<pre>${esc(b.text)}</pre>` : `<p>${esc(b.text)}</p>`).join('\n');
await writeFile(new URL('technical-guide.html', folder), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>SEMV Warehouse — Technical Guide</title><style>
*{box-sizing:border-box}body{font:11pt/1.5 Calibri,Arial,sans-serif;color:#203237;margin:0;background:#edf2f1}main{max-width:900px;margin:32px auto;background:white;padding:50px 58px}h1{font-size:30pt;line-height:1.12;letter-spacing:-1px;border-top:7px solid #168451;padding-top:22px;margin:0 0 18px}h2{font-size:17pt;color:#08663c;margin:30px 0 10px;break-after:avoid}p{margin:0 0 11px;orphans:3;widows:3}table{border-collapse:collapse;width:100%;margin:14px 0 20px;font-size:10pt;table-layout:fixed}th,td{border:1px solid #ced9d5;padding:8px 10px;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#e7f1eb;color:#164a33}tr{break-inside:avoid}td:first-child,th:first-child{width:33%}pre{font:9pt/1.45 Consolas,monospace;background:#f0f5f3;border-left:3px solid #168451;padding:14px;white-space:pre-wrap;overflow-wrap:anywhere;break-inside:avoid}@media print{body{background:white}main{margin:0;padding:0;max-width:none}h2{margin-top:23px}table{font-size:9.3pt}}@media(max-width:640px){main{margin:0;padding:24px}h1{font-size:25pt}}
</style></head><body><main>${htmlBlocks}</main></body></html>`);

const w = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
function paragraph(text, style = 'Normal', bold = false) {
  return `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr><w:r>${bold?'<w:rPr><w:b/></w:rPr>':''}<w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;
}
const documentBody = blocks.map(b => b.type === 'heading' ? paragraph(b.text, b.level === 1 ? 'Title' : 'Heading'+(b.level-1))
  : b.type === 'code' ? b.text.split('\n').map(t => paragraph(t, 'Code')).join('')
  : b.type === 'paragraph' ? paragraph(b.text)
  : `<w:tbl><w:tblPr><w:tblStyle w:val="GuideTable"/><w:tblW w:w="10206" w:type="dxa"/><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid><w:gridCol w:w="3402"/><w:gridCol w:w="6804"/></w:tblGrid>${b.rows.map((r,i) => `<w:tr><w:trPr><w:cantSplit/>${i?'':'<w:tblHeader/>'}</w:trPr>${r.map((c,j) => `<w:tc><w:tcPr><w:tcW w:w="${j?6804:3402}" w:type="dxa"/>${i?'':'<w:shd w:fill="E7F1EB"/>'}</w:tcPr>${paragraph(c,'TableText',!i)}</w:tc>`).join('')}</w:tr>`).join('')}</w:tbl>`).join('');
const files = new Map();
files.set('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>');
files.set('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>');
files.set('docProps/core.xml','<?xml version="1.0" encoding="UTF-8"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>SEMV Warehouse — Technical Guide</dc:title><dc:subject>Implementation and maintenance reference</dc:subject><dc:creator>SEMV Warehouse project</dc:creator></cp:coreProperties>');
files.set('word/_rels/document.xml.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>');
files.set('word/document.xml',`<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="${w}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${documentBody}<w:sectPr><w:footerReference w:type="default" r:id="rId2"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="850" w:right="850" w:bottom="950" w:left="850" w:header="350" w:footer="400"/></w:sectPr></w:body></w:document>`);
files.set('word/footer1.xml',`<?xml version="1.0" encoding="UTF-8"?><w:ftr xmlns:w="${w}"><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:color w:val="62736E"/><w:sz w:val="18"/></w:rPr><w:t>SEMV Warehouse · Technical Guide  |  </w:t></w:r><w:fldSimple w:instr="PAGE"/></w:p></w:ftr>`);
files.set('word/styles.xml',`<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="${w}">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/><w:color w:val="203237"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="140" w:line="276" w:lineRule="auto"/><w:widowControl/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="320"/></w:pPr><w:rPr><w:b/><w:sz w:val="60"/><w:color w:val="08663C"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:keepLines/><w:outlineLvl w:val="0"/><w:spacing w:before="360" w:after="140"/></w:pPr><w:rPr><w:b/><w:sz w:val="34"/><w:color w:val="08663C"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Heading1"/><w:pPr><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:sz w:val="28"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0" w:line="240"/><w:shd w:fill="F0F5F3"/></w:pPr><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="19"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="TableText"><w:name w:val="Table Text"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="70" w:line="252"/></w:pPr><w:rPr><w:sz w:val="20"/></w:rPr></w:style>
<w:style w:type="table" w:styleId="GuideTable"><w:name w:val="Guide Table"/><w:tblPr><w:tblBorders>${['top','left','bottom','right','insideH','insideV'].map(side=>`<w:${side} w:val="single" w:sz="4" w:color="CED9D5"/>`).join('')}</w:tblBorders><w:tblCellMar><w:top w:w="100" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>`);

// A DOCX is an Open XML ZIP package. Use Node's standard library only.
function crc32(bytes) { let crc=0xffffffff; for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);} return (crc^0xffffffff)>>>0; }
const local=[],central=[];let offset=0;
for(const [name,xml] of files){
  const filename=Buffer.from(name),data=Buffer.from(xml),compressed=deflateRawSync(data),crc=crc32(data);
  const header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(8,8);header.writeUInt32LE(crc,14);header.writeUInt32LE(compressed.length,18);header.writeUInt32LE(data.length,22);header.writeUInt16LE(filename.length,26);
  local.push(header,filename,compressed);
  const directory=Buffer.alloc(46);directory.writeUInt32LE(0x02014b50);directory.writeUInt16LE(20,4);directory.writeUInt16LE(20,6);directory.writeUInt16LE(8,10);directory.writeUInt32LE(crc,16);directory.writeUInt32LE(compressed.length,20);directory.writeUInt32LE(data.length,24);directory.writeUInt16LE(filename.length,28);directory.writeUInt32LE(offset,42);central.push(directory,filename);
  offset+=header.length+filename.length+compressed.length;
}
const index=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.size,8);end.writeUInt16LE(files.size,10);end.writeUInt32LE(index.length,12);end.writeUInt32LE(offset,16);
await writeFile(new URL('SEMV-Warehouse-Technical-Guide.docx',folder),Buffer.concat([...local,index,end]));
console.log(`Built Word and HTML guide: ${blocks.filter(b=>b.type==='heading' && b.level===2).length} sections, ${markdown.split(/\s+/).length} words.`);
