async function loadProfilePage(){
  const uid=viewedProfileId||currentUser.id;viewedProfileId=null;
  const{data:prof}=await sb.from('profiles').select('*').eq('id',uid).single();
  if(!prof)return;
  document.getElementById('profile-avatar').textContent=initial(prof.full_name);
  document.getElementById('profile-name').textContent=prof.full_name||prof.username||'مستخدم';
  const badge=document.getElementById('profile-acc-badge');
  badge.textContent=prof.account_type==='verified'?'حساب موثّق':'حساب زائر';
  document.getElementById('profile-bio-text').textContent=prof.bio||'';
  const isOwn=uid===currentUser.id;
  document.getElementById('profile-bio-edit').style.display=isOwn?'block':'none';
  document.getElementById('profile-bio-input').value=prof.bio||'';
  document.getElementById('page-profile').dataset.uid=uid;
  switchProfileTab('posts');
}
async function saveBio(){
  const bio=document.getElementById('profile-bio-input').value.trim();
  await sb.from('profiles').update({bio}).eq('id',currentUser.id);
  document.getElementById('profile-bio-text').textContent=bio;
  if(currentProfile)currentProfile.bio=bio;
  toast('تم الحفظ');
}
function switchProfileTab(tab){
  document.querySelectorAll('.profile-nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  const uid=document.getElementById('page-profile').dataset.uid||currentUser.id;
  if(tab==='posts')loadProfilePosts(uid);
  else if(tab==='tahqiq')loadProfileTahqiq(uid);
  else loadProfileAdditions(uid);
}
async function loadProfilePosts(uid){
  const content=document.getElementById('profile-content');
  content.innerHTML='<div class="empty-state">جاري التحميل...</div>';
  const{data}=await sb.from('posts').select('*, profiles(full_name)').eq('author_id',uid).order('created_at',{ascending:false}).limit(30);
  content.innerHTML=(data&&data.length)?data.map(p=>postCardHTML(p,null)).join(''):'<div class="empty-state"><div class="empty-icon">📭</div>لا توجد منشورات</div>';
}
async function loadProfileTahqiq(uid){
  const content=document.getElementById('profile-content');
  content.innerHTML='<div class="empty-state">جاري التحميل...</div>';
  const isOwn=uid===currentUser.id;
  let q=sb.from('user_edits').select('*').eq('user_id',uid).order('updated_at',{ascending:false});
  if(!isOwn)q=q.eq('status','approved');
  const{data}=await q;
  if(!data||!data.length){content.innerHTML='<div class="empty-state">لا توجد تحقيقات شخصية بعد</div>';return;}
  const labels={draft:['مسودة','#f0f0f0','var(--fb-text-secondary)'],pending_review:['قيد المراجعة','var(--fb-gold-light)','var(--fb-gold)'],approved:['معتمد ✓','var(--fb-green-light)','var(--fb-green)'],rejected:['مرفوض','#fde8e8','#c0392b']};
  content.innerHTML=data.map(t=>{
    const book=BOOKS.find(b=>b.id===t.book_id);
    const[lbl,bg,fg]=labels[t.status]||['','#eee','#666'];
    const plain=(t.edited_matn||'').replace(/<[^>]+>/g,'');
    return `<div class="post-card" style="padding:14px 16px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><h4 style="font-size:14.5px">${book?.title||t.book_id} — حديث ${t.hadith_number}</h4><span class="status-pill" style="background:${bg};color:${fg};padding:3px 10px;border-radius:10px;font-size:11px">${lbl}</span></div><div style="font-size:13px;color:var(--fb-text-secondary)">${escHtml(plain.substring(0,160))}...</div></div>`;
  }).join('');
}
async function loadProfileAdditions(uid){
  const content=document.getElementById('profile-content');
  content.innerHTML='<div class="empty-state">جاري التحميل...</div>';
  const isOwn=uid===currentUser.id;
  const isReviewer=isOwn&&(currentProfile?.role==='reviewer'||currentProfile?.role==='admin');
  const labels={pending_review:['قيد المراجعة','var(--fb-gold-light)','var(--fb-gold)'],approved:['معتمد ✓','var(--fb-green-light)','var(--fb-green)'],rejected:['مرفوض','#fde8e8','#c0392b']};
  const{data:mss}=await sb.from('manuscripts').select('*, books(title)').eq('author_id',uid).order('id',{ascending:false});
  const{data:eds}=await sb.from('editions').select('*, books(title)').eq('author_id',uid).order('id',{ascending:false});
  const mine=[...(mss||[]).map(m=>({...m,kind:'manuscript'})),...(eds||[]).map(e=>({...e,kind:'edition'}))];
  let html=mine.length?mine.map(it=>{const[lbl,bg,fg]=labels[it.status]||['','#eee','#666'];return `<div class="post-card" style="padding:14px 16px"><div style="display:flex;justify-content:space-between;align-items:center"><h4 style="font-size:14.5px">${it.kind==='manuscript'?'مخطوط':'طبعة'}: ${it.name} — ${it.books?.title||it.book_id}</h4><span class="status-pill" style="background:${bg};color:${fg};padding:3px 10px;border-radius:10px;font-size:11px">${lbl}</span></div><div style="font-size:13px;color:var(--fb-text-secondary);margin-top:4px">${escHtml(it.library||it.publisher||'')}</div></div>`;}).join(''):'<div class="empty-state">لا توجد إضافات بعد</div>';
  if(isReviewer){
    const{data:pmss}=await sb.from('manuscripts').select('*, books(title), profiles(full_name)').eq('status','pending_review');
    const{data:peds}=await sb.from('editions').select('*, books(title), profiles(full_name)').eq('status','pending_review');
    const pending=[...(pmss||[]).map(m=>({...m,kind:'manuscript'})),...(peds||[]).map(e=>({...e,kind:'edition'}))];
    html+=`<h3 style="margin:20px 0 10px;color:var(--fb-green);font-size:15px">للمراجعة (${pending.length})</h3>`;
    html+=pending.length?pending.map(it=>`<div class="post-card" style="padding:14px 16px"><h4 style="font-size:14.5px">${it.kind==='manuscript'?'مخطوط':'طبعة'}: ${it.name} — ${it.books?.title||it.book_id}</h4><div style="font-size:12.5px;color:var(--fb-text-secondary);margin:4px 0">مُرسِل: ${it.profiles?.full_name||'مجهول'} — ${escHtml(it.library||it.publisher||'')}</div><div style="display:flex;gap:6px;margin-top:6px"><button style="background:var(--fb-green-light);color:var(--fb-green);padding:5px 12px;border-radius:4px;font-size:12px" onclick="reviewItem('${it.kind}',${it.id},'approved')">قبول</button><button style="background:#fde8e8;color:#c0392b;padding:5px 12px;border-radius:4px;font-size:12px" onclick="reviewItem('${it.kind}',${it.id},'rejected')">رفض</button></div></div>`).join(''):'<div style="font-size:13px;color:var(--fb-text-secondary)">لا توجد إضافات معلّقة</div>';
    const{data:pedits}=await sb.from('user_edits').select('*, profiles(full_name)').eq('status','pending_review').order('updated_at',{ascending:false});
    html+=`<h3 style="margin:20px 0 10px;color:#8e44ad;font-size:15px">تحقيقات نصوص للمراجعة (${pedits?.length||0})</h3>`;
    html+=(pedits&&pedits.length)?pedits.map(t=>{const bk=BOOKS.find(b=>b.id===t.book_id);const plain=(t.edited_matn||'').replace(/<[^>]+>/g,'');return `<div class="post-card" style="padding:14px 16px"><h4 style="font-size:14.5px">${bk?.title||t.book_id} — حديث ${t.hadith_number}</h4><div style="font-size:12.5px;color:var(--fb-text-secondary);margin:4px 0">مُرسِل: ${t.profiles?.full_name||'مجهول'}<br>${escHtml(plain.substring(0,160))}...</div><div style="display:flex;gap:6px;margin-top:6px"><button style="background:var(--fb-green-light);color:var(--fb-green);padding:5px 12px;border-radius:4px;font-size:12px" onclick="reviewTahqiq(${t.id},'approved')">اعتماد ونشر</button><button style="background:#fde8e8;color:#c0392b;padding:5px 12px;border-radius:4px;font-size:12px" onclick="reviewTahqiq(${t.id},'rejected')">رفض</button></div></div>`;}).join(''):'<div style="font-size:13px;color:var(--fb-text-secondary)">لا توجد تحقيقات معلّقة</div>';
  }
  content.innerHTML=html;
}
async function reviewTahqiq(id,status){
  const{error}=await sb.from('user_edits').update({status,reviewed_by:currentUser.id,reviewed_at:new Date().toISOString()}).eq('id',id);
  if(error)return toast('خطأ في التحديث');
  toast(status==='approved'?'تم اعتماد التحقيق ونشر النص المصحَّح':'تم رفض التحقيق');
  loadProfileAdditions(currentUser.id);
  if(currentBook)selectBook(currentBook.id);
}
async function reviewItem(kind,id,status){
  const table=kind==='manuscript'?'manuscripts':'editions';
  const{error}=await sb.from(table).update({status}).eq('id',id);
  if(error)return toast('خطأ في التحديث');
  toast(status==='approved'?'تم الاعتماد':'تم الرفض');
  loadProfileAdditions(currentUser.id);
  if(currentBook)loadSidePanels();
}
