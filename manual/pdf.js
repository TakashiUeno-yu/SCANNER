// manual.html → A4 PDF。Chromium の場所が標準と違うときは CHROMIUM=... で指定する
const {chromium}=require('playwright');const path=require('path');
(async()=>{const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
const p=await b.newPage();await p.goto('file://'+path.join(__dirname,'manual.html'));await p.waitForTimeout(500);
await p.pdf({path:path.join(__dirname,'SCANNER_使用手順書.pdf'),format:'A4',printBackground:true,displayHeaderFooter:true,headerTemplate:'<span></span>',footerTemplate:'<div style="font-size:8px;width:100%;text-align:center;color:#888"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',margin:{top:'16mm',bottom:'16mm',left:'15mm',right:'15mm'}});
await b.close();})();
