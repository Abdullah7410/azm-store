
(async function main(){
/* البيانات من قاعدة البيانات: الأصناف المعروضة، السيارات، الأجيال، الإعدادات */
let SET,rows,carRows,genRows;
try{[SET,rows,carRows,genRows]=await Promise.all([AZM.settings(),AZM.sbAll("store_products?select=*&order=part_no"),AZM.sbAll("cars?select=name,make"),AZM.sbAll("generations?select=*")])}
catch(e){document.getElementById("grid")&&(document.getElementById("homeCats").innerHTML='<div class="empty"><h3>تعذّر تحميل المتجر</h3><p>تأكد من الاتصال بالإنترنت وحدّث الصفحة.</p></div>');return}
const STORE=Object.assign({name:"عزم المتحدة",whatsapp:"",vat_included:true},SET.store||{});
const CATS=[["eng","المحرك والزيوت والفلاتر"],["brk","الفرامل"],["sus","التعليق والمقود"],["cool","التبريد والمكيف"],["elec","الكهرباء والحساسات"],["light","الإضاءة"],["body","الهيكل والصدامات"],["int","المقصورة الداخلية"],["etc","قطع أخرى"]];
const MK=Object.fromEntries(carRows.map(c=>[c.name,c.make]));
const GEN={};genRows.forEach(g=>(GEN[g.car]=GEN[g.car]||[]).push({k:g.code,a:g.y_from,b:g.y_to,n:g.weight}));
const P=rows.map(r=>({n:r.name,p:r.part_no,ty:r.type,q:r.stock,pr:Number(r.price)||0,c:r.cars||[],y:r.y_from?[r.y_from,r.y_to||r.y_from]:null,k:r.gen_code||"",g:r.category||"etc",img:r.image_url||""}));
const $=s=>document.querySelector(s),AR="٠١٢٣٤٥٦٧٨٩";
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const norm=s=>String(s).toLowerCase().replace(/[٠-٩]/g,c=>AR.indexOf(c)).replace(/[ً-ٟـ]/g,"").replace(/[أإآٱ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه").replace(/ؤ/g,"و").replace(/ئ/g,"ي").replace(/ء/g,"").replace(/[\s\-\/\.\(\)+]+/g," ").trim();
const ld=AZM.ls.get,sv=AZM.ls.set;
const TL={a:"وكالة",m:"موبس",k:"كوري",c:"تجاري"},TD={a:"أصلية من الوكيل",m:"أصلية من موبيس",k:"صناعة كورية",c:"بديل اقتصادي"};
const AVL=["غير متوفر حالياً","كمية محدودة","متوفر"];
const fmt=n=>Number(n).toLocaleString("en-US");
const price=d=>d.pr||0;
const effOf=(d,c)=>{if(d.y)return d.y;const g=d.k&&GEN[c]?GEN[c].find(g=>g.k===d.k):null;return g?[g.a,g.b]:null};
const CATN=Object.fromEntries(CATS);

/* ---------- illustrations (drawn, theme-aware) ---------- */
const ART={
 brk:`<svg viewBox="0 0 120 90"><circle cx="58" cy="46" r="34" fill="var(--il-metal)"/><circle cx="58" cy="46" r="34" fill="none" stroke="var(--il-metal2)" stroke-width="3"/><circle cx="58" cy="46" r="24" fill="none" stroke="var(--il-metal2)" stroke-width="1.5" stroke-dasharray="2 5"/><circle cx="58" cy="46" r="14" fill="var(--il-dark)"/><circle cx="58" cy="46" r="5" fill="var(--il-metal)"/>${[0,72,144,216,288].map(a=>`<circle cx="${58+9*Math.cos(a*Math.PI/180)}" cy="${46+9*Math.sin(a*Math.PI/180)}" r="1.8" fill="var(--il-metal)"/>`).join("")}<path d="M84 22c10 6 16 15 17 26l-12 2c-1-7-4-13-10-17z" fill="var(--il-red)"/><rect x="88" y="30" width="8" height="5" rx="1.5" fill="var(--il-hi)" opacity=".7"/></svg>`,
 sus:`<svg viewBox="0 0 120 90"><rect x="56" y="4" width="8" height="18" rx="2" fill="var(--il-metal2)"/><ellipse cx="60" cy="22" rx="18" ry="5" fill="var(--il-dark)"/><path d="M44 30q16 6 32 0M44 38q16 6 32 0M44 46q16 6 32 0M44 54q16 6 32 0M44 62q16 6 32 0" stroke="var(--il-red)" stroke-width="5" fill="none" stroke-linecap="round"/><rect x="53" y="26" width="14" height="48" rx="4" fill="var(--il-metal)"/><ellipse cx="60" cy="68" rx="15" ry="4" fill="var(--il-dark)"/><rect x="54" y="72" width="12" height="12" rx="2" fill="var(--il-dark)"/><circle cx="60" cy="81" r="2.5" fill="var(--il-metal)"/></svg>`,
 light:`<svg viewBox="0 0 120 90"><path d="M10 34c0-10 8-16 18-16h54c14 0 26 10 28 24l2 10c1 8-5 14-13 14H26c-9 0-16-7-16-16z" fill="var(--il-dark)"/><path d="M16 35c0-7 5-11 12-11h52c11 0 20 8 22 18l1 6c1 5-3 10-9 10H28c-7 0-12-5-12-12z" fill="var(--il-glass)"/><circle cx="40" cy="42" r="11" fill="var(--il-metal)"/><circle cx="40" cy="42" r="6" fill="var(--il-hi)"/><circle cx="70" cy="42" r="9" fill="var(--il-metal)"/><circle cx="70" cy="42" r="4.5" fill="var(--il-hi)"/><path d="M22 54h70" stroke="var(--il-blue)" stroke-width="3" stroke-linecap="round"/></svg>`,
 body:`<svg viewBox="0 0 120 90"><path d="M6 40c4-10 14-14 26-14h56c12 0 22 4 26 14l-2 18c-1 6-6 10-12 10H20c-6 0-11-4-12-10z" fill="var(--il-dark)"/><path d="M30 38h60l-4 12H34z" fill="var(--il-metal2)"/><path d="M36 42h48M38 46h44" stroke="var(--il-dark)" stroke-width="1.5"/><circle cx="20" cy="54" r="5" fill="var(--il-metal)"/><circle cx="100" cy="54" r="5" fill="var(--il-metal)"/><path d="M34 60h52" stroke="var(--il-metal)" stroke-width="2.5" stroke-linecap="round"/></svg>`,
 cool:`<svg viewBox="0 0 120 90"><rect x="14" y="16" width="92" height="60" rx="3" fill="var(--il-dark)"/><rect x="22" y="22" width="76" height="48" fill="var(--il-metal)"/>${Array.from({length:18},(_,i)=>`<path d="M${25+i*4.2} 22v48" stroke="var(--il-metal2)" stroke-width="1.6"/>`).join("")}<rect x="8" y="22" width="10" height="48" rx="3" fill="var(--il-blue)"/><rect x="102" y="22" width="10" height="48" rx="3" fill="var(--il-blue)"/><circle cx="107" cy="14" r="5" fill="var(--il-dark)"/></svg>`,
 eng:`<svg viewBox="0 0 120 90"><rect x="22" y="22" width="40" height="56" rx="8" fill="var(--il-blue)"/><rect x="22" y="22" width="40" height="12" rx="4" fill="var(--il-dark)"/>${Array.from({length:7},(_,i)=>`<path d="M${26+i*5} 24v8" stroke="var(--il-metal)" stroke-width="1.4"/>`).join("")}<rect x="28" y="44" width="28" height="18" rx="2" fill="var(--il-hi)" opacity=".85"/><path d="M78 78V46l4-6h14l4 6v32z" fill="var(--il-metal)"/><rect x="83" y="28" width="12" height="12" rx="2" fill="var(--il-dark)"/><rect x="86" y="18" width="6" height="10" fill="var(--il-metal2)"/><rect x="81" y="54" width="16" height="12" rx="2" fill="var(--il-red)"/></svg>`,
 elec:`<svg viewBox="0 0 120 90"><rect x="18" y="26" width="84" height="50" rx="5" fill="var(--il-dark)"/><rect x="18" y="26" width="84" height="12" rx="5" fill="var(--il-metal2)"/><rect x="30" y="16" width="12" height="10" rx="2" fill="var(--il-red)"/><rect x="78" y="16" width="12" height="10" rx="2" fill="var(--il-metal)"/><path d="M64 44 52 60h9l-3 12 13-17h-9l3-11z" fill="var(--il-hi)"/></svg>`,
 int:`<svg viewBox="0 0 120 90"><path d="M44 8h20c6 0 9 4 8 10l-6 40H40L36 18c-1-6 2-10 8-10z" fill="var(--il-dark)"/><rect x="46" y="2" width="16" height="8" rx="3" fill="var(--il-metal2)"/><path d="M40 20h28M41 30h26M42 40h24" stroke="var(--il-metal2)" stroke-width="1.5"/><path d="M28 58h56c6 0 9 4 9 9v5H28z" fill="var(--il-dark)"/><path d="M30 64h60" stroke="var(--il-metal2)" stroke-width="1.5"/><path d="M38 72v12M80 72v12" stroke="var(--il-metal)" stroke-width="4" stroke-linecap="round"/></svg>`,
 etc:`<svg viewBox="0 0 120 90"><g transform="translate(48 46)"><circle r="22" fill="var(--il-metal)"/>${Array.from({length:8},(_,i)=>`<rect x="-5" y="-30" width="10" height="12" rx="2" fill="var(--il-metal)" transform="rotate(${i*45})"/>`).join("")}<circle r="9" fill="var(--il-dark)"/></g><path d="M80 20l12 12-26 30-8-8z" fill="var(--il-dark)"/><circle cx="92" cy="24" r="10" fill="none" stroke="var(--il-dark)" stroke-width="6"/></svg>`,
 car:`<svg viewBox="0 0 120 60"><path d="M8 40v-8l10-14c2-3 5-4 8-4h46c4 0 7 2 9 5l9 12 18 4c3 1 4 3 4 6v6H8z" fill="var(--il-dark)"/><path d="M30 18h18v14H20zM54 18h20l8 14H54z" fill="var(--il-glass)"/><circle cx="30" cy="46" r="9" fill="var(--il-metal2)"/><circle cx="30" cy="46" r="4" fill="var(--il-metal)"/><circle cx="88" cy="46" r="9" fill="var(--il-metal2)"/><circle cx="88" cy="46" r="4" fill="var(--il-metal)"/></svg>`
};
const art=g=>ART[g]||ART.etc;
const pic=d=>d.img?`<img src="${esc(d.img)}" alt="${esc(d.n)}" loading="lazy">`:art(d.g);

/* ---------- search helpers ---------- */
const SYN={"فرامل":["فحمات","هوب","فرامل"],"بريك":["فحمات","هوب"],"تيل":["فحمات"],"قدام":["امامي","قدام"],"امام":["امامي"],"ورا":["خلفي"],"وراء":["خلفي"],"خلف":["خلفي"],
 "ضوء":["كشاف","اسطب","شمعه","ضوء"],"نور":["كشاف","اسطب","شمعه"],"لمبه":["كشاف","اسطب","شمعه","لمبه"],"اضاءه":["كشاف","اسطب","شمعه"],"سطب":["اسطب"],"ستوب":["اسطب"],
 "مكيف":["كمبروسر","ثلاجه","مكيف"],"تكييف":["كمبروسر","ثلاجه","مكيف"],"تبريد":["رديتر","مروحه","قربه"],"حراره":["رديتر","مروحه","حراره"],"رادياتير":["رديتر"],"ردياتير":["رديتر"],
 "مساعدات":["مساعد"],"ممتص":["مساعد"],"شوك":["مساعد"],"صدمات":["مساعد"],"زيوت":["زيت"],"فلاتر":["فلتر"],"بوجي":["بواجي"],"بوجيه":["بواجي"],"شمعات":["بواجي"],
 "مرايه":["مرايه","مرايا"],"مرايات":["مرايه","مرايا"],"دعاميه":["صدام"],"صدامات":["صدام"],"بطاريه":["بطاريه","نيكل"],"قير":["قير","جير"],"جير":["جير","قير"]};
P.forEach((d,i)=>{d.i=i;d.b=d.p.replace(/[A-Z]+$/,"");d.nn=norm(d.n);d.h=norm([d.n,TL[d.ty],d.c.join(" "),d.c.map(c=>MK[c]||"").join(" ")].join(" "))+" "+d.p.toLowerCase().replace(/-/g,"")});
const BYP=new Map(P.map(d=>[d.p,d]));
const GRP={};P.forEach(d=>(GRP[d.b]=GRP[d.b]||[]).push(d));
const VOC=[...new Set(P.flatMap(d=>d.nn.split(" ")).filter(w=>w.length>2&&!/\d/.test(w)))];
function lev(a,b){const m=a.length,n=b.length;let p=Array.from({length:n+1},(_,j)=>j);for(let i=1;i<=m;i++){const c=[i];for(let j=1;j<=n;j++)c[j]=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));p=c}return p[n]}
function fix(w){if(w.length<4||/\d/.test(w)||SYN[w]||VOC.some(v=>v.includes(w)))return w;let b=w,bd=3;for(const v of VOC){if(Math.abs(v.length-w.length)>2)continue;const x=lev(w,v);if(x<bd){bd=x;b=v}}return b}
const hit=(d,t)=>t.every(w=>(SYN[w]||[w]).some(a=>d.h.includes(a)));

/* ---------- state ---------- */
const CNT={};P.forEach(d=>d.c.forEach(c=>CNT[c]=(CNT[c]||0)+1));
let V=ld("vehicle",null);if(V&&!CNT[V.car])V=null;   // {make,car,yr,gen,vin}
let S={view:"home",cat:"",av:false,sort:""},CART=ld("cart",{}),res=[],lim=24,fixedTo="";
for(const p in CART)if(!BYP.has(p)||!buyable(BYP.get(p)))delete CART[p];
$("#sname").textContent=STORE.name;
$("#foot").innerHTML=`${esc(STORE.name)} · قطع غيار هونداي وكيا · الأسعار بالريال السعودي${STORE.vat_included?" وشاملة ضريبة القيمة المضافة":""} · <a href="/order">تتبّع طلبك</a>`;
$("#stItems").textContent=fmt(P.length);$("#stStock").textContent=fmt(P.filter(d=>d.q).length);$("#stCars").textContent=Object.keys(CNT).filter(c=>MK[c]!=="تويوتا").length;

const gensFor=(c,y)=>(GEN[c]||[]).filter(g=>!y||(g.a<=y&&y<=g.b)).sort((a,b)=>b.n-a.n);
const yearsOf=c=>{const ys=new Set();(GEN[c]||[]).forEach(g=>{for(let y=g.a;y<=g.b;y++)ys.add(y)});P.forEach(d=>{if(d.c.includes(c)&&d.y&&d.y[1]-d.y[0]<=30)for(let y=d.y[0];y<=d.y[1];y++)ys.add(y)});return[...ys].sort((a,b)=>b-a)};
const vTxt=()=>V?`${MK[V.car]} ${V.car}${V.yr?" "+V.yr:""}`:"";
function setVehicle(v){V=v;if(V&&!V.gen){const g=gensFor(V.car,V.yr)[0];V.gen=g?g.k:""}sv("vehicle",V);$("#mycarTxt").textContent=V?V.car+(V.yr?" "+V.yr:""):"حدد سيارتك";$("#hCar").value=vTxt()}

/* fit level of a part for the current vehicle: 2 = matched by generation code or year range, 1 = same model but no year info, 0 = does not fit */
function fitLevel(d){if(!V)return -1;if(!d.c.includes(V.car))return d.c.length?0:1;
 if(V.gen&&d.k===V.gen)return 2;const e=effOf(d,V.car);if(!V.yr)return e?2:1;if(e)return e[0]<=V.yr&&V.yr<=e[1]?2:0;return 1}

/* ---------- finder: tabs ---------- */
document.querySelectorAll(".ftab").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".ftab").forEach(x=>x.setAttribute("aria-selected",x===b));["vin","car","pn"].forEach(k=>$("#pane-"+k).hidden=k!==b.dataset.tab);const f=$("#pane-"+b.dataset.tab).querySelector("input,select");if(f)f.focus()}));

/* VIN: maker from characters 1–3, model year from character 10. The model is confirmed by the customer, then the generation follows from the year. */
const WMI={KMH:"هونداي",KM8:"هونداي",KMF:"هونداي",KMJ:"هونداي",KMC:"هونداي","5NP":"هونداي","5NM":"هونداي",MAL:"هونداي",NLH:"هونداي",TMA:"هونداي",KNA:"كيا",KND:"كيا",KNC:"كيا",KNE:"كيا","5XY":"كيا","5XX":"كيا","3KP":"كيا",U5Y:"كيا",U6Y:"كيا",MZB:"كيا"};
const YC="ABCDEFGHJKLMNPRSTVWXY123456789";
const vinYear=ch=>{const i=YC.indexOf(ch);if(i<0)return 0;let y=2010+i;if(y>new Date().getFullYear()+1)y-=30;return y};
let vinState={};
function drawVin(){const el=$("#vin");const v=el.value.toUpperCase().replace(/[^A-Z0-9]/g,"");if(el.value!==v)el.value=v;
 $("#vinmap").innerHTML=Array.from({length:17},(_,i)=>`<span class="${i<3?"w":i===9?"y":""}">${esc(v[i]||"·")}</span>`).join("");
 const out=$("#vinres");out.className="vinres";vinState={};
 if(v.length<3){out.innerHTML="اكتب رقم الهيكل، ونعرف منه الشركة وسنة الصنع مباشرة.";return}
 const mk=WMI[v.slice(0,3)];
 if(!mk){out.className="vinres bad";out.innerHTML=`الرقم يبدأ بـ <b class="ltr">${esc(v.slice(0,3))}</b>، وهذا ليس رمز هونداي أو كيا. تأكد من الرقم، أو <button class="linkb" type="button" data-help>أرسله لنا</button>.`;return}
 if(/[IOQ]/.test(v)){out.className="vinres bad";out.innerHTML="رقم الهيكل لا يحتوي على الحروف I أو O أو Q. غالباً المقصود 1 أو 0.";return}
 if(v.length<17){out.innerHTML=`<b>${mk}</b> ✓ أكمل باقي الخانات (${v.length} من 17)`;return}
 const y=vinYear(v[9]);vinState={vin:v,make:mk,yr:y};
 const cs=Object.keys(CNT).filter(c=>MK[c]===mk&&(!y||gensFor(c,y).length||yearsOf(c).includes(y))).sort((a,b)=>CNT[b]-CNT[a]);
 const all=Object.keys(CNT).filter(c=>MK[c]===mk).sort((a,b)=>CNT[b]-CNT[a]);
 out.className="vinres ok";
 out.innerHTML=`<b>${mk}${y?" · موديل "+y:""}</b> — اضغط على اسم سيارتك:<div class="pills">${(cs.length?cs:all).map(c=>`<button class="pill" type="button" data-vcar="${esc(c)}">${esc(c)}</button>`).join("")}</div>`}
$("#vin").addEventListener("input",drawVin);
$("#vinres").addEventListener("click",e=>{const b=e.target.closest("[data-vcar]");if(!b)return;setVehicle({make:vinState.make,car:b.dataset.vcar,yr:vinState.yr,vin:vinState.vin});openCatalog()});

/* car dropdowns */
const sMake=$("#sMake"),sCar=$("#sCar"),sYr=$("#sYr");
sMake.addEventListener("change",()=>{const m=sMake.value;sCar.disabled=!m;sCar.innerHTML=m?'<option value="">السيارة</option>'+Object.keys(CNT).filter(c=>MK[c]===m).sort((a,b)=>CNT[b]-CNT[a]).map(c=>`<option>${esc(c)}</option>`).join(""):'<option value="">اختر الشركة أولاً</option>';sYr.disabled=true;sYr.innerHTML='<option value="">اختر السيارة أولاً</option>'});
sCar.addEventListener("change",()=>{const c=sCar.value;sYr.disabled=!c;sYr.innerHTML=c?'<option value="">سنة الصنع</option>'+yearsOf(c).map(y=>`<option>${y}</option>`).join(""):'<option value="">اختر السيارة أولاً</option>'});
$("#goCar").addEventListener("click",()=>{if(!sCar.value){toast(sMake.value?"اختر السيارة":"اختر الشركة أولاً");return}setVehicle({make:sMake.value,car:sCar.value,yr:+sYr.value||0});openCatalog()});
$("#goPn").addEventListener("click",()=>{const v=$("#pnIn").value.trim();if(!v){toast("اكتب رقم القطعة");return}$("#q").value=v;openCatalog(true)});
$("#pnIn").addEventListener("keydown",e=>{if(e.key==="Enter")$("#goPn").click()});

/* ---------- views ---------- */
function showView(v){S.view=v;$("#homeView").hidden=v!=="home";$("#catView").hidden=v!=="cat";window.scrollTo({top:0,behavior:"instant"in window?"instant":"auto"})}
function openCatalog(keepQ){if(!keepQ)$("#q").value="";S.cat="";showView("cat");drawGarage();render()}
$("#home").addEventListener("click",()=>{$("#q").value="";showView("home");drawHome()});
$("#mycarBtn").addEventListener("click",()=>{if(V){openCatalog()}else{showView("home");$("#finder").scrollIntoView({behavior:"smooth",block:"center"})}});

function drawGarage(){const g=$("#garage");
 if(!V){g.innerHTML=`<div class="wrap"><div class="gcar"><div class="art">${ART.car}</div><div><h2>كل القطع</h2><div class="gmeta">حدد سيارتك عشان نعرض لك القطع المطابقة فقط</div></div></div><div class="gacts"><button class="btn pri" type="button" data-pick>حدد سيارتك</button></div></div>`;return}
 const gs=gensFor(V.car,V.yr),all=GEN[V.car]||[];
 g.innerHTML=`<div class="wrap"><div class="gcar"><div class="art">${ART.car}</div><div><h2>${esc(vTxt())}</h2><div class="gmeta">${V.gen?`<span>الجيل <span class="chip ltr">${esc(V.gen)}</span></span>`:""}${V.vin?`<span>رقم الهيكل <span class="chip ltr">${esc(V.vin)}</span></span>`:""}</div></div></div>
 <div class="gacts">${gs.length>1||(!V.yr&&all.length>1)?`<select class="gsel" id="genSel" aria-label="الجيل">${(V.yr?gs:all).map(x=>`<option value="${x.k}" ${x.k===V.gen?"selected":""}>جيل ${x.k} · ${x.a}–${x.b}</option>`).join("")}</select>`:""}<button class="btn" type="button" data-pick>تغيير السيارة</button><button class="btn" type="button" data-clear>كل القطع</button></div></div>
 <div class="wrap" style="padding-bottom:14px"><div class="fitnote"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/></svg><span>نعرض فقط القطع المسجلة لـ ${esc(V.car)}${V.gen?" جيل "+esc(V.gen):""}. علامة <b>مطابقة</b> تعني أن رمز القطعة أو سنواتها تطابق سيارتك، و<b>تحقق</b> تعني أننا نأكدها برقم الهيكل قبل الشحن.</span></div></div>`;
 const gsel=$("#genSel");if(gsel)gsel.addEventListener("change",()=>{V.gen=gsel.value;if(!V.yr){}setVehicle(V);drawGarage();render()})}

/* ---------- catalog ---------- */
function base(){return P.filter(d=>{if(S.av&&!d.q)return false;if(V){const f=fitLevel(d);if(f<=0)return false}return true})}
function matchQ(list){fixedTo="";const raw=$("#q").value.trim();if(!raw)return V?list.filter(d=>d.c.length):list;
 const flat=raw.replace(/[\s\-]/g,"").toLowerCase();let t=norm(raw).split(" ").filter(Boolean);
 let r=list.filter(d=>hit(d,t)||(flat.length>4&&d.h.includes(flat)));
 if(r.length<3){const f=t.map(fix);if(f.join()!==t.join()){const r2=list.filter(d=>hit(d,f));if(r2.length>r.length){r=r2;fixedTo=f.join(" ")}}}return r}
function catTile(k,l,n,on,attr){return `<button class="cat" type="button" ${attr}="${k}" aria-pressed="${on}" ${n===0?"disabled":""}><span class="art">${art(k||"etc")}</span>${l}<small>${n===null?"":fmt(n)+" قطعة"}</small></button>`}
function render(){const b=matchQ(base());const cc={};b.forEach(d=>cc[d.g]=(cc[d.g]||0)+1);if(S.cat&&!cc[S.cat])S.cat="";
 $("#cats").innerHTML=catTile("","كل الأقسام",b.length,!S.cat,"data-cat")+CATS.map(([k,l])=>catTile(k,l,cc[k]||0,S.cat===k,"data-cat")).join("");
 let r=S.cat?b.filter(d=>d.g===S.cat):b;const ps=d=>price(d)||(S.sort==="lo"?1e9:-1);
 r=r.slice().sort(S.sort==="lo"?(x,y)=>ps(x)-ps(y):S.sort==="hi"?(x,y)=>ps(y)-ps(x):(x,y)=>(fitLevel(y)-fitLevel(x))||((y.q>0)-(x.q>0))||((!!y.w)-(!!x.w)));
 res=r;lim=24;$("#fixed").innerHTML=fixedTo?`· نعرض نتائج <b>${esc(fixedTo)}</b>`:"";draw()}
const agencyPrice=d=>{const a=GRP[d.b].find(x=>x.ty==="a"&&price(x));return a?price(a):0};
const saveTxt=d=>{if(d.ty==="a")return"";const a=agencyPrice(d),p=price(d);return a&&p&&p<a?`أوفر من الوكالة بـ ${fmt(a-p)} ر.س`:""};
const WHY={a:"تبغى نفس قطعة المصنع بالضبط، أو السيارة تحت الضمان.",m:"تبغى جودة أصلية بسعر أقل من الوكالة غالباً.",k:"تبغى توازن بين الجودة والسعر.",c:"تبغى أقل تكلفة، أو السيارة قديمة وتبغى حل اقتصادي."};
const buyable=d=>d.q>0&&price(d)>0;
const btnTxt=d=>CART[d.p]?"✓ في السلة ("+CART[d.p]+")":"أضف إلى السلة";
const buyBtn=(d,cls="",style="")=>buyable(d)?`<button class="btn ${cls} ${CART[d.p]?"added":""}" type="button" data-add="${esc(d.p)}" style="${style}">${btnTxt(d)}</button>`:`<button class="btn ${cls}" type="button" data-ask="${esc(d.p)}" style="${style}">${d.q?"اسأل عن السعر":"اطلب توفيرها"}</button>`;
function card(d){const pr=price(d),f=fitLevel(d),g=GRP[d.b],prs=g.map(price).filter(Boolean);
 return `<article class="prod" data-open="${esc(d.p)}" tabindex="0" aria-label="${esc(d.n)}"><div class="art">${pic(d)}<div class="badges"><span class="ty ${d.ty}">${TL[d.ty]}</span>${f===2?'<span class="fit">✓ مطابقة</span>':f===1?'<span class="fit chk">تحقق</span>':""}</div></div>
 <div class="body"><h3>${esc(d.n)}</h3><div class="pno">${esc(d.p)}</div>${!V&&d.c.length?`<div class="cars">${esc(d.c.slice(0,3).join("، "))}${d.c.length>3?" +"+(d.c.length-3):""}</div>`:""}${g.length>1?`<div class="alt">${g.length} أنواع${prs.length>1?" · من "+fmt(Math.min(...prs))+" ر.س":""}</div>`:""}${saveTxt(d)?`<div class="save">${saveTxt(d)}</div>`:""}
 <div class="prow">${pr?`<div class="price">${fmt(pr)}<small>ر.س</small></div>`:`<div class="price ask">السعر عند الطلب</div>`}<span class="av s${d.q}"><i></i>${AVL[d.q]}</span></div>
 ${buyBtn(d,"block")}</div></article>`}
function draw(){const el=$("#grid");const raw=$("#q").value.trim();
 $("#info").textContent=res.length?`${fmt(res.length)} قطعة${V?" لسيارتك":""}${raw?" عن «"+raw+"»":""}`:"";
 if(!res.length){el.innerHTML=`<div class="empty"><h3>ما لقينا${raw?" «"+esc(raw)+"»":" قطع"}${V?" لسيارتك":""}</h3><p>جرّب كلمة أقصر أو قسماً آخر. أو أرسل لنا وصف القطعة مع صورة الاستمارة ونحددها لك من كتالوج الوكالة.</p><button class="btn wa" type="button" data-help>اطلب القطعة على واتساب</button></div>`;$("#moreBtn").hidden=true;return}
 el.innerHTML=res.slice(0,lim).map(card).join("");$("#moreBtn").hidden=res.length<=lim;$("#moreBtn").textContent=`عرض المزيد (${fmt(res.length-lim)} متبقية)`}
$("#moreBtn").addEventListener("click",()=>{lim+=24;draw()});
$("#cats").addEventListener("click",e=>{const b=e.target.closest("[data-cat]");if(!b||b.disabled)return;S.cat=b.dataset.cat;render()});
$("#avOnly").addEventListener("change",e=>{S.av=e.target.checked;render()});
$("#sort").addEventListener("change",e=>{S.sort=e.target.value;render()});

/* home */
function drawHome(){const cc={};P.forEach(d=>cc[d.g]=(cc[d.g]||0)+1);
 $("#homeCats").innerHTML=CATS.map(([k,l])=>catTile(k,l,cc[k]||0,false,"data-hcat")).join("");
 const seen=new Set(),pop=[];for(const d of P.filter(d=>d.q===2&&d.w&&d.c.length).sort((a,b)=>b.c.length-a.c.length)){if(seen.has(d.g)&&pop.length<6)continue;seen.add(d.g);pop.push(d);if(pop.length>=8)break}
 $("#popGrid").innerHTML=pop.map(card).join("")}
$("#homeCats").addEventListener("click",e=>{const b=e.target.closest("[data-hcat]");if(!b)return;$("#q").value="";S.cat="";showView("cat");drawGarage();S.cat=b.dataset.hcat;render()});

/* header search with suggestions */
let tm,si=-1;
function sugg(){const raw=$("#q").value.trim(),el=$("#sugg");if(raw.length<2){hideSugg();return}
 const t=norm(raw).split(" ").filter(Boolean),pool=V?P.filter(d=>fitLevel(d)>0):P;const seen=new Map();
 for(const d of pool){if(!hit(d,t))continue;const k=d.nn.split(" ").slice(0,3).join(" ");seen.set(k,(seen.get(k)||0)+1);if(seen.size>40)break}
 const top=[...seen].sort((a,b)=>b[1]-a[1]).slice(0,6);if(!top.length){hideSugg();return}si=-1;
 el.innerHTML=top.map(([k,n])=>`<button type="button" role="option" data-s="${esc(k)}"><span>${esc(k)}</span><small>${n}</small></button>`).join("");el.hidden=false}
function hideSugg(){$("#sugg").hidden=true;si=-1}
function goSearch(){hideSugg();if(S.view!=="cat"){S.cat="";showView("cat");drawGarage()}render()}
$("#q").addEventListener("input",()=>{clearTimeout(tm);tm=setTimeout(()=>{sugg();if(S.view==="cat")render()},120)});
$("#q").addEventListener("keydown",e=>{const bs=[...$("#sugg").querySelectorAll("button")];
 if(!$("#sugg").hidden&&bs.length&&(e.key==="ArrowDown"||e.key==="ArrowUp")){e.preventDefault();si=(si+(e.key==="ArrowDown"?1:-1)+bs.length)%bs.length;bs.forEach((b,i)=>b.classList.toggle("on",i===si));return}
 if(e.key==="Enter"){e.preventDefault();if(si>=0&&bs[si])$("#q").value=bs[si].dataset.s;goSearch()}else if(e.key==="Escape")hideSugg()});
$("#sugg").addEventListener("click",e=>{const b=e.target.closest("[data-s]");if(!b)return;e.preventDefault();$("#q").value=b.dataset.s;goSearch()});
document.addEventListener("click",e=>{if(!e.target.closest(".hsearch"))hideSugg()});

/* ---------- part sheet ---------- */
let lastFocus=null;
function openSheet(p){const d=BYP.get(p);if(!d)return;const e=effOf(d,V&&d.c.includes(V.car)?V.car:d.c[0]),f=fitLevel(d);
 const g=GRP[d.b].slice().sort((a,b)=>(price(a)||1e9)-(price(b)||1e9));const cheapest=g.filter(x=>price(x)&&x.q)[0];
 $("#shTitle").textContent=CATN[d.g];
 $("#shBody").innerHTML=`<div class="ph"><div class="art">${pic(d)}</div><div><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="ty ${d.ty}">${TL[d.ty]}</span><span class="av s${d.q}"><i></i>${AVL[d.q]}</span></div><h3>${esc(d.n)}</h3>
 <div class="tag"><code>${esc(d.p)}</code><button type="button" data-copy="${esc(d.p)}" aria-label="نسخ رقم القطعة"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg></button></div></div></div>
 ${V?`<div class="fitnote" style="margin:0;${f===2?"":"background:var(--warn-soft)"}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${f===2?'<path d="M20 6 9 17l-5-5"/>':'<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.5"/>'}</svg><span>${f===2?`مطابقة لـ <b>${esc(vTxt())}</b>${V.gen?" (جيل "+esc(V.gen)+")":""}.`:f===1?`مسجلة لـ ${esc(V.car)} بدون تحديد السنة. نتحقق منها برقم الهيكل قبل الشحن.`:`هذه القطعة غير مسجلة لـ ${esc(vTxt())}.`}</span></div>`:""}
 <dl class="facts"><dt>تركب على</dt><dd>${d.c.length?esc(d.c.join("، ")):"قطعة عامة لعدة سيارات"}</dd>${e?`<dt>السنوات</dt><dd><span class="ltr">${e[0]===e[1]?e[0]:e[0]+" – "+e[1]}</span></dd>`:""}${d.k?`<dt>رمز الجيل</dt><dd><span class="chip ltr">${esc(d.k)}</span></dd>`:""}<dt>النوع</dt><dd>${TL[d.ty]} — ${TD[d.ty]}</dd></dl>
 <div class="decide"><h4>مناسبة لك إذا…</h4><ul><li>${WHY[d.ty]}${saveTxt(d)?` <b>${saveTxt(d)}.</b>`:""}</li><li>تقدر تطابق الرقم <b class="ltr">${esc(d.p)}</b> مع القطعة القديمة أو مع فني الورشة.</li></ul>
 <h4 style="margin-top:4px">بعد ما تطلب</h4><ul><li>يوصلنا الطلب على واتساب مع ${V&&V.vin?"رقم الهيكل":"بيانات سيارتك"}.</li><li>نتأكد من التوافق في كتالوج الوكالة ونرد عليك بالسعر النهائي.</li><li>${d.q?"القطعة متوفرة عندنا وتجهز بعد التأكيد.":"القطعة غير متوفرة حالياً، ونعطيك موعد توفيرها قبل أي دفع."}</li></ul></div>
 ${g.length>1?`<div class="cmp"><h4>نفس القطعة بأنواع أخرى</h4><div style="overflow-x:auto"><table>${g.map(x=>{const xp=price(x);return `<tr class="${x.p===d.p?"cur":""}"><td><span class="ty ${x.ty}">${TL[x.ty]}</span>${x===cheapest?'<span class="badge">الأوفر</span>':""}</td><td><span class="av s${x.q}"><i></i>${AVL[x.q]}</span></td><td class="pr">${xp?fmt(xp)+" ر.س":"عند الطلب"}</td><td style="text-align:left">${x.p===d.p?'<small style="color:var(--mut)">المعروضة</small>':`<button class="btn" type="button" data-open="${esc(x.p)}">عرض</button>`}</td></tr>`}).join("")}</table></div></div>`:""}`;
 drawSheetBuy(d);if($("#sheet").hidden)lastFocus=document.activeElement;$("#drawer").hidden=true;$("#sheet").hidden=false;$("#scrim").hidden=false;$("#shBody").scrollTop=0;$("#sheet .x").focus()}
function drawSheetBuy(d){const pr=price(d);$("#shBuy").innerHTML=`<div>${pr?`<div class="price">${fmt(pr)}<small>ر.س</small></div>`:`<div class="price ask">السعر عند الطلب</div>`}<button class="linkb" type="button" data-ask="${esc(d.p)}" style="font-size:13px">اسأل عنها على واتساب</button></div>${buyBtn(d,CART[d.p]?"":"pri","padding:12px 20px")}`}
function closeAll(){$("#sheet").hidden=true;$("#drawer").hidden=true;$("#scrim").hidden=true;if(S.view==="cat")draw();else drawHome();if(lastFocus&&lastFocus.focus&&document.contains(lastFocus))lastFocus.focus()}

/* ---------- whatsapp ---------- */
function waOpen(text,inCart){const n=STORE.whatsapp.replace(/\D/g,"");
 if(!n){if(inCart)showMsg(text,"رقم الواتساب لم يُضبط بعد. انسخ نص الطلب وأرسله لنا.");else copyText(text,"رقم الواتساب لم يُضبط بعد — تم نسخ الرسالة");return}
 const a=document.createElement("a");a.href=AZM.waLink(n,text);a.target="_blank";a.rel="noopener";document.body.appendChild(a);a.click();a.remove();
 if(inCart)showMsg(text,`إذا ما فتح واتساب، انسخ النص وأرسله للرقم +${n}`)}
function showMsg(text,hint){copyText(text,hint)}
function copyText(t,okMsg){const done=()=>toast(okMsg||"تم النسخ");const fb=()=>{const x=document.createElement("textarea");x.value=t;document.body.appendChild(x);x.select();try{document.execCommand("copy")}catch(e){}x.remove();done()};try{navigator.clipboard.writeText(t).then(done,fb)}catch(e){fb()}}
const vLines=()=>V?`\nالسيارة: ${vTxt()}${V.gen?" (جيل "+V.gen+")":""}${V.vin?"\nرقم الهيكل: "+V.vin:""}`:"";
$("#helpForm").addEventListener("submit",e=>{e.preventDefault();const c=$("#hCar").value.trim(),d=$("#hDesc").value.trim();if(!d){toast("اكتب وصف القطعة أولاً");$("#hDesc").focus();return}
 waOpen(`السلام عليكم، أبحث عن قطعة:\n${d}${c?"\nالسيارة: "+c:""}${V&&V.vin?"\nرقم الهيكل: "+V.vin:""}\n(سأرفق صورة الاستمارة أو القطعة)`)});

/* ---------- cart ---------- */
function cartSum(){let tot=0,n=0,ask=false;for(const p in CART){const pr=price(BYP.get(p));n+=CART[p];if(pr)tot+=pr*CART[p];else ask=true}return{tot,n,ask}}
function saveCart(){sv("cart",CART);const {tot,n,ask}=cartSum();const b=$("#cn");b.textContent=n;b.dataset.n=n;$("#checkout").hidden=!n;$("#coTotal").textContent=fmt(tot)+" ر.س"+(ask?" +":"");$("#coCount").textContent=n+" قطعة في السلة"}
document.addEventListener("click",e=>{
 const a=e.target.closest("[data-add]");if(a){e.stopPropagation();const p=a.dataset.add,d=BYP.get(p);CART[p]=(CART[p]||0)+1;saveCart();a.textContent=btnTxt(d);a.classList.remove("pri");a.classList.add("added");const cb=$("#opencart");cb.classList.remove("bump");void cb.offsetWidth;cb.classList.add("bump");toast("أضيفت إلى السلة");return}
 const q=e.target.closest("[data-ask]");if(q){const d=BYP.get(q.dataset.ask);waOpen(`السلام عليكم، أستفسر عن:\n${d.n} (${TL[d.ty]})\nرقم القطعة: ${d.p}${vLines()}`);return}
 const c=e.target.closest("[data-copy]");if(c){copyText(c.dataset.copy,"تم نسخ رقم القطعة");return}
 const o=e.target.closest("[data-open]");if(o){openSheet(o.dataset.open);return}
 if(e.target.closest("[data-close]")){closeAll();return}
 if(e.target.closest("[data-pick]")){showView("home");setTimeout(()=>$("#finder").scrollIntoView({behavior:"smooth",block:"center"}),30);return}
 if(e.target.closest("[data-clear]")){setVehicle(null);drawGarage();render();return}
 if(e.target.closest("[data-help]")){if(!$("#sheet").hidden||!$("#drawer").hidden)closeAll();$("#help").scrollIntoView({behavior:"smooth"});setTimeout(()=>$("#hDesc").focus({preventScroll:true}),450)}});
document.addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target.matches(".prod"))openSheet(e.target.dataset.open);if(e.key==="Escape"&&(!$("#drawer").hidden||!$("#sheet").hidden))closeAll()});
function drawCart(){const ks=Object.keys(CART);const {tot,ask}=cartSum();
 $("#items").innerHTML=ks.length?ks.map(p=>{const d=BYP.get(p),pr=price(d);
  return `<div class="li"><div class="art">${pic(d)}</div><div class="nm">${esc(d.n)}<div><span class="ty ${d.ty}" style="font-size:11px;padding:0 6px">${TL[d.ty]}</span> <code class="ltr">${esc(d.p)}</code>${d.q?"":` <small style="color:var(--no)">· نطلبها لك</small>`}</div></div>
  <div class="qty"><button type="button" data-inc="${esc(p)}" aria-label="زيادة">+</button><span>${CART[p]}</span><button type="button" data-dec="${esc(p)}" aria-label="إنقاص">−</button></div>
  <div class="lp"><span style="font-family:var(--f-body);color:var(--mut);font-size:12.5px">${pr?fmt(pr)+" × "+CART[p]:""}</span><span>${pr?fmt(pr*CART[p])+" ر.س":"السعر عند الطلب"}</span></div></div>`}).join(""):`<div class="empty"><h3>السلة فاضية</h3><p>حدد سيارتك وأضف القطع اللي تحتاجها.</p></div>`;
 $("#total").textContent=fmt(tot)+" ر.س"+(ask?" + قطع بسعر عند الطلب":"");$("#cartfoot").hidden=!ks.length;}
$("#items").addEventListener("click",e=>{const i=e.target.closest("[data-inc]"),d=e.target.closest("[data-dec]");if(i)CART[i.dataset.inc]++;if(d){const p=d.dataset.dec;if(--CART[p]<=0)delete CART[p]}if(i||d){saveCart();drawCart()}});
function openCart(){lastFocus=document.activeElement;$("#sheet").hidden=true;drawCart();$("#drawer").hidden=false;$("#scrim").hidden=false;$("#drawer .x").focus()}
$("#opencart").addEventListener("click",openCart);$("#coBtn").addEventListener("click",openCart);$("#scrim").addEventListener("click",closeAll);
$("#send").addEventListener("click",()=>{if(!Object.keys(CART).length)return;saveCart();location.href="/checkout"});

let tt;function toast(t){const e=$("#toast");e.textContent=t;e.classList.add("on");clearTimeout(tt);tt=setTimeout(()=>e.classList.remove("on"),1800)}

/* ---------- boot ---------- */
setVehicle(V);if(V&&V.vin)$("#vin").value=V.vin;drawVin();drawHome();saveCart();
})();
