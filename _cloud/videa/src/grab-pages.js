const { chromium } = require('playwright');
const out = process.argv[2];
const jobs = [
 ['tvuj-coach','/tvuj-coach/','Celá appka','vip-card'],
 ['tvuj-coach','/tvuj-coach/','Levnější volba bez AI','basic-card'],
 ['tvuj-coach','/tvuj-coach/','128 cviků s technikou','tc-cviky'],
 ['videokurz','/videokurz.html','Šest modulů, od základů','vk-moduly'],
 ['videokurz','/videokurz.html','Kuchařka 40+ receptů','vk-bonus'],
 ['videokurz','/videokurz.html','Chci rovnou všechno','vk-cena'],
 ['akademie','/akademie/','Měsíční členství','ak-mesic'],
 ['akademie','/akademie/','NEJLEPŠÍ HODNOTA','ak-dozivotni'],
 ['koucing','/koucing/','Vedení na dálku, tohle si vybírá většina','ko-gold'],
 ['koucing','/koucing/','Moderní klientská sekce','ko-novinka'],
 ['koucing','/koucing/','Napíšeš mi','ko-kroky'],
];
(async()=>{
  const b = await chromium.launch();
  const ctx = await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2.5,isMobile:true,hasTouch:true});
  const p = await ctx.newPage();
  let cur='';
  for (const [k,u,txt,name] of jobs) {
    if (cur!==u){ await p.goto('http://localhost:8099'+u,{waitUntil:'networkidle'}); cur=u;
      const btn = await p.$('text=Odmítnout'); if (btn) { try{await btn.click({timeout:1500})}catch(e){} }
      const h = await p.evaluate(()=>document.body.scrollHeight);
      for (let y=0;y<h;y+=500){ await p.evaluate(y=>window.scrollTo(0,y),y); await p.waitForTimeout(60);}
      await p.evaluate(()=>{for(const e of document.querySelectorAll('body *')){const cs=getComputedStyle(e);if(cs.position==='fixed'||cs.position==='sticky')e.style.setProperty('display','none','important');}});
      await p.addStyleTag({content:'.mb-wa,.wa-float,[class*=whatsapp],[href*="wa.me"].float,#cookie-banner,.cookie-banner,.sticky-cta,.vk-sticky{display:none!important}'});
    }
    // find smallest card-like ancestor (with border/background) of element containing text
    const handle = await p.evaluateHandle((txt)=>{
      const all=[...document.querySelectorAll('body *')].filter(e=>e.children.length<6 && e.innerText && e.innerText.trim().startsWith(txt));
      let e=all[0]; if(!e) return null;
      let n=e;
      for(let i=0;i<8 && n.parentElement;i++){
        n=n.parentElement; const r=n.getBoundingClientRect(); const cs=getComputedStyle(n);
        if (r.height>250 && (cs.borderRadius!=='0px' || n.tagName==='SECTION')) return n;
      }
      return n;
    }, txt);
    const el = handle.asElement();
    if(!el){console.log('NOTFOUND',name);continue;}
    await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
    await el.screenshot({path:`${out}/${name}.png`});
    const bb=await el.boundingBox(); console.log(name, Math.round(bb.width), Math.round(bb.height));
  }
  await b.close();
})();
