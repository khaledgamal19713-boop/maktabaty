let book=null,index=0,recordIndex=0,flatRecords=[],prefs={size:20,lh:2,font:"Amiri",diacritics:true,dark:false,width:980};
const $=s=>document.querySelector(s);
async function load(){
  try{
    const r=await fetch("artifacts/kamil/book.json");
    if(!r.ok)throw Error("book data unavailable");
    book=await r.json(); renderTree(); showTranslation(0);
    $("#status").remove();
  }catch(e){$("#status").textContent="تعذّر تحميل بيانات الكتاب: "+e.message}
}
function save(){localStorage.setItem("kamilPrefs",JSON.stringify(prefs))}
function restore(){try{prefs={...prefs,...JSON.parse(localStorage.getItem("kamilPrefs")||"{}")}}catch{};applyPrefs()}
function applyPrefs(){document.documentElement.style.setProperty("--size",prefs.size+"px");document.documentElement.style.setProperty("--lh",prefs.lh);\n  document.documentElement.style.setProperty("--width",prefs.width+"px");document.body.classList.toggle("dark",!!prefs.dark);document.body.style.fontFamily=prefs.font+",serif"}
function text(t){return prefs.diacritics?t:t.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g,"")}
function renderTree(filter=""){
  const list=$("#treeList"), q=filter.trim();
  const trs=book.translations.filter(t=>!q||t.name.includes(q));
  list.innerHTML=trs.map((t,i)=>`<div class="tree-row ${i===index?"current expanded":""}" data-i="${i}" aria-current="${i===index?"true":"false"}"><span>${t.order}. ${t.name}</span><small>${(t.critics?.length||0)} نقول · ${(t.hadith_groups?.length||0)} مجموعة</small></div>`).join("");
  list.querySelectorAll(".tree-row").forEach(el=>el.onclick=()=>showTranslation(+el.dataset.i));
}
function recordsFor(t){
  const r=[{type:"name",label:"اسم صاحب الترجمة",text:t.name}];
  if(t.intro)r.push({type:"intro",label:"المقدمة",text:t.intro});
  if(t.critics?.length)r.push({type:"critics",label:"نقولات الأئمة",text:t.critics.map(x=>x.number+" - "+x.text).join("\n\n"),refs:t.critics.flatMap(x=>x.source_pages||[]),numbers:t.critics.map(x=>x.number)});
  for(const g of (t.hadith_groups||[])){
    r.push({type:"hadith",label:g.grouping_reason==="single"?"حديث "+g.numbers[0]:"مجموعة أحاديث: "+g.numbers.join("، "),kind:g.type,text:g.items.map(x=>x.number+" - "+x.text).join("\n\n"),numbers:g.numbers,refs:g.items.flatMap(x=>x.source_pages||[])});
  }
  return r;
}
function showTranslation(i){
  if(!book?.translations?.[i])return;
  index=i; recordIndex=0;
  const t=book.translations[i]; flatRecords=recordsFor(t);
  $("#stickyTitle").textContent=t.name;
  $("#records").innerHTML=flatRecords.map((r,n)=>`<article class="record ${r.type}" id="rec-${n}"><div class="meta">سجل ${n+1} / ${flatRecords.length} — ${r.label}${r.kind?" — "+r.kind:""}</div><div class="content">${escapeHtml(text(r.text)).replace(/\n/g,"<br>")}</div></article>`).join("");
  bindRecordObserver();
  updatePosition(); renderTree($("#treeSearch").value);
}
function escapeHtml(s){return s.replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}
function move(d){const n=index+d;if(n>=0&&n<book.translations.length)showTranslation(n)}
function moveRecord(d){
  const n=recordIndex+d;
  if(n<0){ if(index>0){showTranslation(index-1); recordIndex=Math.max(0,flatRecords.length-1); scrollToRecord(recordIndex);} return; }
  if(n>=flatRecords.length){ if(index+1<book.translations.length){showTranslation(index+1); scrollToRecord(0);} return; }
  recordIndex=n; scrollToRecord(n);
}
function scrollToRecord(n){
  document.getElementById("rec-"+n)?.scrollIntoView({behavior:"smooth",block:"center"});
  document.querySelectorAll(".record.active").forEach(x=>x.classList.remove("active"));
  document.getElementById("rec-"+n)?.classList.add("active");
  updatePosition();
}
function bindRecordObserver(){
  if(window.__kamilObserver) window.__kamilObserver.disconnect();
  window.__kamilObserver=new IntersectionObserver(entries=>{
    const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
    if(!visible)return;
    const n=Number(visible.target.id.replace("rec-",""));
    if(Number.isInteger(n)){recordIndex=n; updatePosition();}
  },{root:null,rootMargin:"-120px 0px -55% 0px",threshold:[0.1,0.35,0.6]});
  document.querySelectorAll(".record").forEach(el=>window.__kamilObserver.observe(el));
}
$("#prev").onclick=()=>move(-1);$("#next").onclick=()=>move(1);
$("#treeBtn").onclick=()=>$("#tree").classList.add("open");$("#closeTree").onclick=()=>$("#tree").classList.remove("open");
$("#treeSearch").oninput=e=>renderTree(e.target.value);
$("#search").oninput=e=>{const q=e.target.value.trim();if(!q)return;const i=book.translations.findIndex(t=>t.name.includes(q));if(i>=0)showTranslation(i)};
$("#copyBtn").onclick=async()=>{const r=flatRecords[recordIndex];if(!r)return;const ref=r.refs?.length?"\n\n[المصدر: "+r.refs.join("، ")+"]":"";await navigator.clipboard.writeText(r.text+"\n\n["+book.translations[index].name+"]"+ref);};\n$("#jumpBtn").onclick=()=>jumpToNumber();$("#jump").onkeydown=e=>{if(e.key==="Enter")jumpToNumber()};\nfunction jumpToNumber(){const n=Number($("#jump").value);if(!Number.isInteger(n))return;let ri=flatRecords.findIndex(r=>r.numbers?.includes(n));if(ri>=0){recordIndex=ri;document.getElementById("rec-"+ri)?.scrollIntoView({behavior:"smooth"});return}const ti=book.translations.findIndex(t=>t.hadith_groups?.some(g=>g.numbers?.includes(n)));if(ti>=0){showTranslation(ti);ri=flatRecords.findIndex(r=>r.numbers?.includes(n));if(ri>=0){recordIndex=ri;document.getElementById("rec-"+ri)?.scrollIntoView({behavior:"smooth"})}}}
document.querySelectorAll("[data-action]").forEach(b=>b.onclick=()=>{

 const a=b.dataset.action;
 if(a==="smaller")prefs.size=Math.max(14,prefs.size-1);
 if(a==="larger")prefs.size=Math.min(40,prefs.size+1);
 if(a==="line")prefs.lh=prefs.lh===2?2.4:2;
 if(a==="diacritics")prefs.diacritics=!prefs.diacritics;
 if(a==="font"){const fonts=["Amiri","Cairo","Noto Naskh Arabic"];prefs.font=fonts[(fonts.indexOf(prefs.font)+1)%fonts.length];}\n if(a==="width")prefs.width=prefs.width>=1180?760:prefs.width+140;
 if(a==="dark")prefs.dark=!prefs.dark;
 if(a==="record-prev"){moveRecord(-1);return;}
 if(a==="record-next"){moveRecord(1);return;}
 applyPrefs();save();showTranslation(index);
});
document.addEventListener("keydown",e=>{
 if(e.target.matches("input,textarea"))return;
 if(e.key==="ArrowUp")moveRecord(-1);
 if(e.key==="ArrowDown")moveRecord(1);
 if(e.key==="PageUp")moveRecord(-1);
 if(e.key==="PageDown")moveRecord(1);
 if(e.key==="ArrowLeft")move(-1);
 if(e.key==="ArrowRight")move(1);
});
function updatePosition(){$("#position").textContent=`الترجمة ${index+1} من ${book.translations.length} — السجل ${recordIndex+1} من ${flatRecords.length}`}
restore();load();
