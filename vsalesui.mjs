import { chromium } from 'playwright'; import { writeFileSync } from 'fs';
const OUT='/Users/amiran/fitcrm/vsalesui.txt'; const log=[]; const w=s=>{log.push(s);writeFileSync(OUT,log.join('\n'));};
const PROD='https://fitcrm-three.vercel.app';
try{
const b=await chromium.launch(); const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
p.setDefaultNavigationTimeout(180000); const err=[]; p.on('pageerror',e=>err.push(e.message.slice(0,70)));
await p.goto(`${PROD}/login`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(2000);
await p.fill('input[name=email]','qa.autotest@fitcrm.uz'); await p.fill('input[name=password]','QaTest-2026x');
await p.getByRole('button',{name:/^Войти/}).click(); await p.waitForTimeout(4000);
await p.goto(`${PROD}/reports`,{waitUntil:'commit'});
const ok=await p.getByRole('button',{name:/^Продажи$/}).waitFor({timeout:170000}).then(()=>true).catch(()=>false);
w('reports rendered: '+ok);
if(ok){ await p.getByRole('button',{name:/^Продажи$/}).click();
  await p.waitForFunction(()=>/Продано/.test(document.body.innerText)&&/По тарифам/.test(document.body.innerText),{timeout:30000}).catch(()=>{});
  await p.waitForTimeout(1500); const t=await p.locator('body').innerText();
  const sold=t.match(/Продано\s*([\d\s]+)/); const rev=t.match(/Выручка\s*([\d\s]+)\s*сум/);
  w('Продано: '+(sold?sold[1].trim():'NF')+' | Выручка: '+(rev?rev[1].replace(/\s+/g,''):'NF')+' | таблица тарифов: '+/По тарифам/.test(t)+' | svg: '+(await p.locator('svg').count()));
}
w('pageerrors: '+JSON.stringify([...new Set(err)])); await b.close(); w('DONE');
}catch(e){ w('EXC: '+e.message.slice(0,120)); }
