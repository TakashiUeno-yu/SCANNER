const {chromium}=require('playwright');const fs=require('fs'),path=require('path'),http=require('http');
const srv=http.createServer((q,s)=>{const f=path.join(__dirname,'site','index.html');s.writeHead(200,{'content-type':'text/html; charset=utf-8'});fs.createReadStream(f).pipe(s)}).listen(8791);
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'});
for(const w of [375,390,320]){const p=await b.newPage({viewport:{width:w,height:300},deviceScaleFactor:2});
await p.route('https://**',r=>r.fulfill({status:200,body:'',contentType:'text/css'}));
await p.goto('http://localhost:8791/');await p.waitForTimeout(500);
await p.screenshot({path:'/tmp/claude-0/hdr'+w+'.png',clip:{x:0,y:0,width:w,height:110}});await p.close()}
await b.close();srv.close()})();
