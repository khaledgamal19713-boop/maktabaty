// ===== محرك التحليل: محلي حقيقي (بلا مفتاح) + بعيد بالذكاء الاصطناعي (يتطلب AI_API_KEY) =====
// لا واجهة مستقلة — كل دالة هنا تُستدعى مباشرة من زر إجرائي داخل بيئة التحقيق نفسها
const AI_FN_URL=SUPA_URL+'/functions/v1/ai-analyze';

function extractIsnadChain(text){
  const chain=[];
  const re=/(?:حدثنا|حدثني|أخبرنا|أخبرني|سمعت)\s+([\u0621-\u064A\s]{2,25}?)(?=\s+(?:قال|عن|أن)\b)/g;
  let m;while((m=re.exec(text))!==null){chain.push(m[1].trim());}
  const reAn=/عن\s+([\u0621-\u064A]{2,4}(?:\s[\u0621-\u064A]{2,15}){0,3}?)(?=\s+(?:عن|قال|أن)\b)/g;
  while((m=reAn.exec(text))!==null){chain.push(m[1].trim());}
  return [...new Set(chain)].filter(n=>n.length>1);
}
function wordDiff(a,b){
  const wa=(a||'').split(/\s+/).filter(Boolean), wb=(b||'').split(/\s+/).filter(Boolean);
  const dp=Array(wa.length+1).fill(null).map(()=>Array(wb.length+1).fill(0));
  for(let i=1;i<=wa.length;i++)for(let j=1;j<=wb.length;j++)
    dp[i][j]=wa[i-1]===wb[j-1]?dp[i-1][j-1]+1:Math.max(dp[i-1][j],dp[i][j-1]);
  const out=[];let i=wa.length,j=wb.length;
  while(i>0&&j>0){
    if(wa[i-1]===wb[j-1]){out.unshift({w:wa[i-1],t:'same'});i--;j--;}
    else if(dp[i-1][j]>=dp[i][j-1]){out.unshift({w:wa[i-1],t:'removed'});i--;}
    else{out.unshift({w:wb[j-1],t:'added'});j--;}
  }
  while(i>0){out.unshift({w:wa[--i],t:'removed'});}
  while(j>0){out.unshift({w:wb[--j],t:'added'});}
  return out;
}
async function findCanonicalMatn(bookId,hadithNum){
  if(!bookId||!hadithNum)return null;
  const{data}=await sb.from('texts').select('matn').eq('book_id',bookId).eq('hadith_number',hadithNum).maybeSingle();
  return data?data.matn.replace(/<[^>]+>/g,''):null;
}
async function searchAcrossBooks(query){
  const q=(query||'').trim();if(q.length<2)return[];
  const results=[];
  const{data}=await sb.from('texts').select('book_id,hadith_number,matn').ilike('matn','%'+q+'%').limit(15);
  (data||[]).forEach(r=>{const bk=BOOKS.find(b=>b.id===r.book_id);results.push({book:bk?.title||r.book_id,num:r.hadith_number,snippet:r.matn.replace(/<[^>]+>/g,'').slice(0,90)});});
  return results;
}
async function callAIEdge(text,mode,context){
  try{
    const res=await fetch(AI_FN_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,mode,context})});
    const data=await res.json();
    if(!res.ok){
      if(data.error==='AI_API_KEY_NOT_CONFIGURED')return{error:true,text:'⚠️ يتطلب تفعيل مفتاح AI_API_KEY من إعدادات مشروع Supabase.'};
      return{error:true,text:'تعذّر الاتصال بخدمة الذكاء الاصطناعي: '+(data.message||data.error||'خطأ غير معروف')};
    }
    return{error:false,text:data.result};
  }catch(e){return{error:true,text:'تعذّر الاتصال بالخادم.'};}
}

// ===== ربط مباشر بأزرار بيئة التحقيق: كل زر = برومبت منفّذ فورًا على النص الحالي =====
function getEditorText(){const el=document.getElementById('editor-content');return el?el.innerText||el.textContent||'':'';}

async function actionExtractIsnad(){
  const text=getEditorText();if(!text)return toast('لا يوجد نص محرَّر حاليًا');
  const chain=extractIsnadChain(text);
  const label=chain.length?`سلسلة إسناد مُستخرَجة آليًّا (${chain.length}): `+chain.map((n,i)=>`${i+1}) ${n}`).join('؛ '):'لم يُميّز التحليل المحلي صيغ إسناد واضحة في هذا النص.';
  fnCounter++;footnotes.push({num:fnCounter,text:label});renderFootnotes();
  toast(chain.length?'أُدرجت سلسلة الإسناد في الحواشي':'لم يُعثر على إسناد');
}

async function actionCompareCanonical(){
  const text=getEditorText();if(!text)return toast('لا يوجد نص محرَّر حاليًا');
  if(!currentBook||editingNum==null)return toast('لا يوجد حديث محدد للمقارنة');
  const canonical=await findCanonicalMatn(currentBook.id,editingNum);
  const box=document.getElementById('ai-inline-result');
  if(!canonical){box.innerHTML='<div class="ai-panel-note">لا يوجد نص قانوني محفوظ لهذا الحديث للمقارنة معه.</div>';box.style.display='block';return;}
  const diff=wordDiff(canonical,text);
  const changed=diff.filter(d=>d.t!=='same').length;
  box.innerHTML=`<div class="ai-panel-note">${changed?('فروق فعلية مكتشفة ('+changed+' كلمة):'):'تطابق تام مع النص القانوني.'}</div><div class="ai-diff-line">`+
    diff.map(d=>d.t==='same'?escHtml(d.w):`<span class="ai-diff-${d.t}">${escHtml(d.w)}</span>`).join(' ')+'</div>';
  box.style.display='block';
}

async function actionRunRemoteAnalysis(extra){
  const text=getEditorText();if(!text)return toast('لا يوجد نص محرَّر حاليًا');
  const box=document.getElementById('ai-inline-result');
  box.innerHTML='<div class="ai-panel-note">جاري التحليل بالذكاء الاصطناعي...</div>';box.style.display='block';
  const ctx=(extra||'').trim();
  const r=await callAIEdge(text,'analyze',ctx||undefined);
  box.innerHTML=`<div class="ai-panel-note">${r.error?'⚠️':'نتيجة التحليل:'}</div><div class="ai-diff-line">${escHtml(r.text)}</div>`+
    (r.error?'':'<div class="ai-retry-row"><input type="text" id="ai-extra-instr" placeholder="أضف ضوابط أو تعليمات لإعادة التحليل بدقة أكبر..."><button onclick="actionRunRemoteAnalysis(document.getElementById(\'ai-extra-instr\').value)">أعد التحليل</button></div>');
}

async function actionSearchLibrary(term){
  const q=term!=null?term:prompt('ابحث في نصوص المكتبة عن:','');
  if(!q||!q.trim())return;
  const results=await searchAcrossBooks(q);
  const box=document.getElementById('ai-inline-result');
  if(!box){toast(results.length?(results.length+' نتيجة'):'لا نتائج');return;}
  box.innerHTML=results.length
    ?'<div class="ai-panel-note">نتائج فعلية ('+results.length+'):</div>'+results.map(r=>`<div class="ai-search-item">${r.book} — حديث ${r.num}: ${escHtml(r.snippet)}...</div>`).join('')
    :'<div class="ai-panel-note">لا نتائج مطابقة.</div>';
  box.style.display='block';
}
