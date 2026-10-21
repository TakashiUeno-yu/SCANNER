const {chromium}=require('playwright');const fs=require('fs'),path=require('path'),http=require('http');
const srv=http.createServer((q,s)=>{const u=q.url.split('?')[0];const f=path.join(__dirname,'site',u==='/'?'index.html':u);
 if(!fs.existsSync(f)){s.writeHead(404);return s.end()} s.writeHead(200,{'content-type':f.endsWith('.wasm')?'application/wasm':'text/html; charset=utf-8'});fs.createReadStream(f).pipe(s)}).listen(8790);
const out='/home/claude/manual/';
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--use-file-for-fake-video-capture=/tmp/claude-0/t/cam_cc2.y4m','--font-render-hinting=none']});
 const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,permissions:['camera']});const p=await ctx.newPage();
 await p.route('https://cdn.jsdelivr.net/**',r=>{const u=r.request().url();let f=u.includes('@zxing/library')?path.join(__dirname,'zl/package/umd/index.min.js'):'/tmp/claude-0/zw/x/package/'+u.split('zxing-wasm@2.2.4/')[1];r.fulfill({status:200,body:fs.readFileSync(f),contentType:f.endsWith('.wasm')?'application/wasm':'application/javascript'})});
 await p.route('https://fonts.googleapis.com/**',r=>r.fulfill({status:200,body:'',contentType:'text/css'}));
 await p.goto('http://localhost:8790/');await p.waitForTimeout(1500);
 await p.setInputFiles('#mstFile','/tmp/claude-0/t/A_20260930_2.zip');await p.waitForFunction(()=>/版/.test(document.getElementById('mstStatA').textContent),null,{timeout:60000});
 await p.evaluate(()=>{localStorage.clear()});await p.waitForTimeout(2200);
 // 連続読み取り中（読めるまでの短い間に撮る）
 await p.evaluate(()=>window.scrollTo(0,0));
 await p.click('#liveBtn');await p.waitForFunction(()=>document.getElementById('view').classList.contains('live'),null,{timeout:5000});await p.waitForTimeout(350);
 await p.screenshot({path:out+'a_live.png'});
 await p.waitForFunction(()=>document.body.classList.contains('sheet'),null,{timeout:30000});await p.waitForTimeout(700);
 await p.screenshot({path:out+'a_live_result.png'});
 await p.click('#sheetClose');
 // 撮影→期限・ロットまで読めた結果
 await p.setInputFiles('#pick','/tmp/claude-0/t/p_cc.jpg');await p.waitForFunction(()=>document.body.classList.contains('sheet'),null,{timeout:30000});await p.waitForTimeout(700);
 await p.screenshot({path:out+'a_shot_result.png'});
 await p.evaluate(()=>{document.getElementById('slip').scrollTop=400});await p.waitForTimeout(300);
 await p.screenshot({path:out+'a_shot_result2.png'});
 await p.click('#sheetClose');
 // サイズ計測
 await p.setInputFiles('#pick','/tmp/claude-0/gen/ruler_syn.jpg');await p.waitForTimeout(8000);if(await p.evaluate(()=>document.body.classList.contains('sheet')))await p.click('#sheetClose');
 await p.click('#measureBtn');await p.waitForTimeout(600);await p.evaluate(()=>{const cv=document.getElementById('mCanvas'),k=cv.width/1500;__M.p.r1={x:306.4*k,y:846.6*k};__M.p.r2={x:786.1*k,y:863.3*k};__M.sel='w1';__dm()});await p.waitForTimeout(300);
 await p.evaluate(()=>document.getElementById('measure').scrollIntoView());await p.waitForTimeout(400);
 await p.screenshot({path:out+'a_measure.png'});
 await b.close();srv.close();
})();
