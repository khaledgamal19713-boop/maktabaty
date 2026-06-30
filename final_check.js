const SUPA_URL='https://uqfqpqjarofbcdzkrdgs.supabase.co';
const SUPA_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxZnFwcWphcm9mYmNkemtyZGdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4ODUwMzUsImV4cCI6MjA5MzQ2MTAzNX0.8z2Nc8t14txttepiRV5yhhkBfDdE77FJ7rx1dxQrICI';
const CDN='https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1';
const BOOKS=[{id:'bukhari',cdnId:'ara-bukhari',icon:'📗',title:'صحيح البخاري',author:'البخاري'},{id:'muslim',cdnId:'ara-muslim',icon:'📘',title:'صحيح مسلم',author:'مسلم'},{id:'abudawud',cdnId:'ara-abudawud',icon:'📙',title:'سنن أبي داود',author:'أبو داود'},{id:'tirmidhi',cdnId:'ara-tirmidhi',icon:'📕',title:'سنن الترمذي',author:'الترمذي'},{id:'nasai',cdnId:'ara-nasai',icon:'📔',title:'سنن النسائي',author:'النسائي'},{id:'ibnmajah',cdnId:'ara-ibnmajah',icon:'📓',title:'سنن ابن ماجه',author:'ابن ماجه'}];
const FN_CATS=['تخريج','فروق_نسخ','غريب'];
const FN_CAT_DB={'تخريج':'تخريج','فروق_نسخ':'فروق نسخ','غريب':'غريب'};
const{createClient}=supabase;
const sb=createClient(SUPA_URL,SUPA_KEY);
let currentUser=null,currentProfile=null,mainView='feed',feedFilter='الكل',currentPostType='حديث';
let currentBook=null,currentHadiths=[],currentChapters=[],activeChapter=null;
let currentMode='browse',activeFnCats={},openPanels={mss:false,editions:false};
let commentsDrawerOpen=false,activeHadith=null,qcHadith=null,footnotes=[],fnCounter=0;
let currentDraftId=null,addItemType=null,viewedProfileId=null,previousView='feed';

window.addEventListener('DOMContentLoaded',async()=>{
  const{data:{session}}=await sb.auth.getSession();
  if(session){currentUser=session.user;await loadProfile();showApp();}
  sb.auth.onAuthStateChange(async(event,session)=>{
    if(event==='SIGNED_IN'&&session){currentUser=session.user;await loadProfile();showApp();}
    if(event==='SIGNED_OUT'){currentUser=null;currentProfile=null;document.getElementById('auth-overlay').style.display='flex';document.getElementById('app').style.display='none';}
  });
  initPostTypes();initQCTypes();await loadCustomBooks();renderBooks();
  ['quick-comment-modal','fn-dialog','add-item-modal','add-text-modal'].forEach(id=>{document.getElementById(id).addEventListener('click',e=>{if(e.target===e.currentTarget)closeModal(id);});});
  document.addEventListener('click',e=>{if(!e.target.closest('.fn-marker')&&!e.target.closest('#fn-popover'))document.getElementById('fn-popover').style.display='none';});
});

// ===== FIX: loadProfile ينشئ profile تلقائياً إن لم يوجد =====
async function loadProfile(){
  let{data}=await sb.from('profiles').select('*').eq('id',currentUser.id).single();
  if(!data){
    // لا يوجد profile — أنشئه تلقائياً
    const meta=currentUser.user_metadata||{};
    const fallbackName=meta.full_name||meta.name||currentUser.email.split('@')[0];
    const fallbackUsername=meta.username||currentUser.email.split('@')[0];
    await sb.from('profiles').upsert({
      id:currentUser.id,
      full_name:fallbackName,
      username:fallbackUsername,
      account_type:meta.account_type||'guest',
      is_scholar:false
    });
    const res=await sb.from('profiles').select('*').eq('id',currentUser.id).single();
    data=res.data;
  }
  currentProfile=data;
}

function showApp(){
  if(!currentUser)return;
  document.getElementById('auth-overlay').style.display='none';
  document.getElementById('app').style.display='block';
  document.getElementById('nav-username').textContent=currentProfile?.full_name||currentUser.email;
  applyAccountRestrictions();
  switchMainView('feed');
}
function applyAccountRestrictions(){
  const isGuest=currentProfile?.account_type!=='verified';
  document.getElementById('guest-notice').style.display=isGuest?'block':'none';
  document.querySelectorAll('#post-types button').forEach(b=>{b.disabled=isGuest&&b.dataset.type!=='فائدة';});
  if(isGuest){document.querySelectorAll('#post-types button').forEach(b=>b.classList.remove('active'));document.querySelector('#post-types button[data-type="فائدة"]').classList.add('active');currentPostType='فائدة';}
  document.querySelectorAll('#mode-bar .modes button').forEach(b=>{if(isGuest&&b.dataset.mode!=='browse'){b.disabled=true;b.title='يتطلب حساباً موثقاً';}else{b.disabled=false;b.title='';}});
}
function switchAuthTab(tab){document.querySelectorAll('#auth-tabs button').forEach((b,i)=>b.classList.toggle('active',tab==='login'?i===0:i===1));document.getElementById('tab-login').style.display=tab==='login'?'flex':'none';document.getElementById('tab-register').style.display=tab==='register'?'flex':'none';document.getElementById('auth-msg').textContent='';}
let selectedAccType='guest';
function selectAccType(t){selectedAccType=t;document.getElementById('acc-guest').classList.toggle('active',t==='guest');document.getElementById('acc-verified').classList.toggle('active',t==='verified');}
async function doLogin(){
  const email=document.getElementById('login-email').value.trim();
  const pass=document.getElementById('login-pass').value;
  if(!email||!pass)return setAuthMsg('يرجى ملء جميع الحقول');
  setAuthMsg('جاري الدخول...');
  const{error}=await sb.auth.signInWithPassword({email,password:pass});
  if(error)setAuthMsg(error.message==='Invalid login credentials'?'بيانات الدخول غير صحيحة':error.message);
}
async function doRegister(){
  const name=document.getElementById('reg-name').value.trim();
  const username=document.getElementById('reg-username').value.trim();
  const email=document.getElementById('reg-email').value.trim();
  const pass=document.getElementById('reg-pass').value;
  if(!name||!username||!email||!pass)return setAuthMsg('يرجى ملء جميع الحقول');
  if(pass.length<6)return setAuthMsg('كلمة المرور 6 أحرف على الأقل');
  setAuthMsg('جاري إنشاء الحساب...');
  const{data,error}=await sb.auth.signUp({email,password:pass,options:{data:{full_name:name,username,account_type:selectedAccType}}});
  if(error)return setAuthMsg(error.message);
  if(data.user){
    await sb.from('profiles').upsert({id:data.user.id,full_name:name,username,account_type:selectedAccType,is_scholar:false});
    setAuthMsg('تم! يرجى تفعيل البريد الإلكتروني ثم تسجيل الدخول.');
  } else {
    setAuthMsg('تم الإنشاء، يرجى تسجيل الدخول.');
  }
}
async function doLogout(){await sb.auth.signOut();}
function setAuthMsg(m){document.getElementById('auth-msg').textContent=m;}
function goBack(){document.getElementById('page-profile').classList.remove('active');document.getElementById('nav-back-btn').style.display='none';document.getElementById('nav-toggle').style.display='flex';if(previousView==='library')switchMainView('library');else switchMainView('feed');}
function showProfilePage(userId){previousView=mainView;viewedProfileId=userId;document.getElementById('page-feed').classList.remove('active');document.getElementById('page-library').classList.remove('active');document.getElementById('page-profile').classList.add('active');document.getElementById('sub-bar').style.display='none';document.getElementById('nav-back-btn').style.display='flex';document.getElementById('nav-toggle').style.display='none';loadProfilePage();}
function switchMainView(view){mainView=view;document.getElementById('page-profile').classList.remove('active');document.getElementById('nav-back-btn').style.display='none';document.getElementById('nav-toggle').style.display='flex';document.querySelectorAll('#nav-toggle button').forEach((b,i)=>b.classList.toggle('active',view==='feed'?i===0:i===1));document.getElementById('page-feed').classList.toggle('active',view==='feed');document.getElementById('page-library').classList.toggle('active',view==='library');renderSubBar();if(view==='feed')loadPosts();}
function renderSubBar(){const bar=document.getElementById('sub-bar');if(mainView==='feed'){bar.style.display='flex';const filters=[{label:'الكل',val:'الكل'},{label:'فوائد',val:'فائدة'},{label:'تحقيقات',val:'تحقيق'},{label:'أحاديث',val:'حديث'},{label:'أسئلة',val:'سؤال'},{label:'منشورات المكتبة',val:'مكتبة'}];bar.innerHTML=filters.map(({label,val})=>`<button class="${feedFilter===val?'active':''}" onclick="setFeedFilter('${val}')">${label}</button>`).join('');}else{bar.style.display='none';}}
function setFeedFilter(val){feedFilter=val;renderSubBar();loadPosts();}
function initPostTypes(){document.querySelectorAll('#post-types button').forEach(btn=>{btn.addEventListener('click',function(){if(this.disabled)return;document.querySelectorAll('#post-types button').forEach(b=>b.classList.remove('active'));this.classList.add('active');currentPostType=this.dataset.type;});});}
async function loadPosts(){document.getElementById('posts-loading').style.display='block';document.getElementById('posts-loading').textContent='جاري التحميل...';document.getElementById('posts-list').innerHTML='';let q=sb.from('posts').select('*, profiles(full_name,username,account_type)').order('created_at',{ascending:false}).limit(50);if(feedFilter==='مكتبة'){q=q.not('book_id','is',null);}else if(feedFilter!=='الكل'){q=q.eq('post_type',feedFilter);}const{data,error}=await q;document.getElementById('posts-loading').style.display='none';if(error||!data){document.getElementById('posts-loading').style.display='block';document.getElementById('posts-loading').textContent='حدث خطأ في التحميل';return;}document.getElementById('posts-list').innerHTML=data.length?data.map(postHTML).join(''):'<div id="posts-empty">لا توجد منشورات بعد</div>';}
function postHTML(p){const date=new Date(p.created_at).toLocaleDateString('ar-SA',{year:'numeric',month:'short',day:'numeric'});const author=p.profiles?.full_name||'مجهول';const initial=author.trim().charAt(0)||'م';const hadithRef=p.book_id?`<span class="post-hadith-ref" onclick="goToHadith('${p.book_id}')">عرض في المكتبة</span>`:'';const isOwner=currentUser?.id===p.author_id;const menuHTML=isOwner?`<div class="post-menu" id="menu-${p.id}"><button class="post-menu-btn" onclick="togglePostMenu('${p.id}')">⋯</button><div class="post-menu-dropdown" id="dropdown-${p.id}"><button onclick="startEditPost('${p.id}')">✏️ تعديل</button><button class="danger" onclick="deletePost('${p.id}')">🗑️ حذف</button></div></div>`:'';return `<div class="post-card" id="post-${p.id}"><div class="post-header"><div class="post-author-row"><div class="avatar">${initial}</div><div><div class="post-author" onclick="showProfilePage('${p.author_id}')">${author}</div><div class="post-meta">${date} · ${p.track||'عام'} ${hadithRef}</div></div></div><div style="display:flex;align-items:center;gap:6px"><span class="post-type-badge ${p.post_type}">${p.post_type}</span>${menuHTML}</div></div><div class="post-content" id="content-${p.id}">${escHtml(p.content)}</div><div class="post-edit-box" id="edit-box-${p.id}" style="display:none"><textarea id="edit-textarea-${p.id}">${escHtml(p.content)}</textarea><div class="post-edit-actions"><button style="background:var(--green);color:#fff" onclick="saveEditPost('${p.id}')">حفظ</button><button style="background:#f0f0f0" onclick="cancelEditPost('${p.id}')">إلغاء</button></div></div><div class="post-footer"><button onclick="toggleLike(${p.id},this)">♡ ${p.likes||0}</button><button onclick="toggleComments(${p.id})">تعليق</button></div><div class="comments-section" id="comments-${p.id}"><div id="comments-list-${p.id}"></div><div class="comment-input-row"><input id="comment-input-${p.id}" placeholder="أضف تعليقاً..." onkeydown="if(event.key==='Enter')submitComment(${p.id})"><button onclick="submitComment(${p.id})">إرسال</button></div></div></div>`;}
async function publishPost(){const content=document.getElementById('post-content').value.trim();if(!content)return toast('أدخل محتوى المنشور');if(!currentUser)return toast('يجب تسجيل الدخول');if(currentProfile?.account_type!=='verified'&&currentPostType!=='فائدة')return toast('الحساب الزائر يسمح فقط بنشر فائدة');document.getElementById('btn-publish').disabled=true;const track=document.getElementById('post-track').value;const{error}=await sb.from('posts').insert({author_id:currentUser.id,post_type:currentPostType,content,track,likes:0});document.getElementById('btn-publish').disabled=false;if(error)return toast('خطأ في النشر: '+error.message);document.getElementById('post-content').value='';toast('تم النشر');feedFilter='الكل';renderSubBar();loadPosts();}
async function toggleLike(postId,btn){if(!currentUser)return toast('يجب تسجيل الدخول');const liked=btn.classList.contains('liked');if(liked){await sb.from('likes').delete().eq('user_id',currentUser.id).eq('post_id',postId);await sb.from('posts').update({likes:Math.max(0,(parseInt(btn.textContent.replace(/\D/g,''))||1)-1)}).eq('id',postId);btn.classList.remove('liked');}else{await sb.from('likes').insert({user_id:currentUser.id,post_id:postId});const cur=parseInt(btn.textContent.replace(/\D/g,''))||0;await sb.from('posts').update({likes:cur+1}).eq('id',postId);btn.classList.add('liked');}loadPosts();}
async function toggleComments(postId){const s=document.getElementById('comments-'+postId);if(s.style.display==='block'){s.style.display='none';return;}s.style.display='block';const{data}=await sb.from('comments').select('*, profiles(full_name)').eq('post_id',postId).order('created_at');const list=document.getElementById('comments-list-'+postId);list.innerHTML=data&&data.length?data.map(c=>`<div class="comment-item"><span class="comment-author">${c.profiles?.full_name||'مجهول'}: </span>${escHtml(c.content)}</div>`).join(''):'<div style="font-size:12px;color:#999;padding:6px">لا تعليقات بعد</div>';}
async function submitComment(postId){const input=document.getElementById('comment-input-'+postId);const content=input.value.trim();if(!content||!currentUser)return;const{error}=await sb.from('comments').insert({post_id:postId,author_id:currentUser.id,content});if(error){toast('خطأ في إرسال التعليق: '+error.message);return;}input.value='';toggleComments(postId);setTimeout(()=>toggleComments(postId),100);}
function togglePostMenu(id){document.querySelectorAll('.post-menu-dropdown.open').forEach(d=>{if(d.id!=='dropdown-'+id)d.classList.remove('open');});document.getElementById('dropdown-'+id)?.classList.toggle('open');}
document.addEventListener('click',e=>{if(!e.target.closest('.post-menu'))document.querySelectorAll('.post-menu-dropdown.open').forEach(d=>d.classList.remove('open'));});
async function deletePost(id){if(!confirm('حذف هذا المنشور نهائياً؟'))return;const{error}=await sb.from('posts').delete().eq('id',id).eq('author_id',currentUser.id);if(error)return toast('خطأ في الحذف: '+error.message);document.getElementById('post-'+id)?.remove();toast('تم الحذف');}
function startEditPost(id){togglePostMenu(id);const card=document.getElementById('post-'+id);if(!card)return;document.getElementById('content-'+id).style.display='none';document.getElementById('edit-box-'+id).style.display='block';const ta=document.getElementById('edit-textarea-'+id);ta.focus();ta.selectionStart=ta.value.length;}
function cancelEditPost(id){document.getElementById('content-'+id).style.display='block';document.getElementById('edit-box-'+id).style.display='none';}
async function saveEditPost(id){const content=document.getElementById('edit-textarea-'+id).value.trim();if(!content)return toast('لا يمكن الحفظ بمحتوى فارغ');const{error}=await sb.from('posts').update({content}).eq('id',id).eq('author_id',currentUser.id);if(error)return toast('خطأ في التعديل: '+error.message);document.getElementById('content-'+id).textContent=content;document.getElementById('edit-textarea-'+id).value=content;cancelEditPost(id);toast('تم التعديل');}
function goToHadith(bookId){switchMainView('library');selectBook(bookId);}
function toggleSidebar(){document.getElementById('lib-sidebar').classList.toggle('expanded');}
function renderBooks(){document.getElementById('books-list').innerHTML=BOOKS.map(b=>`<div class="book-item" data-id="${b.id}" onclick="selectBook('${b.id}')"><span class="book-icon">${b.icon}</span><div class="book-title">${b.title}</div><div class="book-author">${b.author}</div></div>`).join('');}
async function loadCustomBooks(){const knownIds=BOOKS.map(b=>b.id);const{data}=await sb.from('books').select('*');if(!data)return;data.forEach(row=>{if(!knownIds.includes(row.id)){BOOKS.push({id:row.id,icon:row.icon||'📜',title:row.title,author:row.author});knownIds.push(row.id);}});}
async function selectBook(bookId){document.querySelectorAll('.book-item').forEach(el=>el.classList.toggle('active',el.dataset.id===bookId));currentBook=BOOKS.find(b=>b.id===bookId);currentHadiths=[];currentChapters=[];activeChapter=null;activeHadith=null;document.getElementById('lib-empty').style.display='none';document.getElementById('lib-active').style.display='flex';document.getElementById('reader-title').textContent=currentBook.title;document.getElementById('lib-loading').style.display='block';document.getElementById('hadiths-container').innerHTML='';document.getElementById('toc-select').innerHTML='<option value="">كل الأبواب</option>';setMode('browse');try{if(currentBook.cdnId){const res=await fetch(`${CDN}/editions/${currentBook.cdnId}.min.json`);if(!res.ok)throw new Error();const json=await res.json();currentHadiths=json.hadiths||[];}else{const{data,error}=await sb.from('texts').select('*').eq('book_id',bookId).order('hadith_number');if(error)throw error;currentHadiths=(data||[]).map(t=>({text:t.matn,hadithnumber:t.hadith_number,chapter:t.chapter,isnad:t.isnad}));}const cm={};currentHadiths.forEach(h=>{const ch=h.chapter||h.chapterNumber||'عام';if(!cm[ch])cm[ch]=[];cm[ch].push(h);});currentChapters=Object.entries(cm);renderTOC();renderHadiths(currentHadiths.slice(0,30));}catch(e){document.getElementById('hadiths-container').innerHTML='<div style="text-align:center;padding:30px;color:#999">تعذّر تحميل الكتاب.</div>';}document.getElementById('lib-loading').style.display='none';loadSidePanels();}
function renderTOC(){const sel=document.getElementById('toc-select');sel.innerHTML='<option value="">كل الأبواب</option>'+currentChapters.map(([ch,hs],i)=>`<option value="${i}">${ch} (${hs.length})</option>`).join('');}
function selectChapterFromDropdown(val){if(val===''){activeChapter=null;renderHadiths(currentHadiths.slice(0,30));return;}activeChapter=parseInt(val);renderHadiths(currentChapters[activeChapter][1]);}
function setMode(mode){if(mode!=='browse'&&currentProfile?.account_type!=='verified'){toast('هذه الميزة تتطلب حساباً موثقاً');return;}currentMode=mode;document.querySelectorAll('#mode-bar .modes button').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));const isEditor=mode==='editor';document.getElementById('hadiths-container').style.display=isEditor?'none':'block';document.getElementById('editor-view').style.display=isEditor?'block':'none';document.getElementById('hadith-search-bar').style.display=isEditor?'none':'flex';const isTahqiq=mode==='tahqiq';document.getElementById('panel-toggle-left').style.display=isTahqiq?'block':'none';document.getElementById('panel-toggle-right').style.display=isTahqiq?'block':'none';if(!isTahqiq){document.getElementById('panel-mss').classList.remove('open');document.getElementById('panel-editions').classList.remove('open');openPanels={mss:false,editions:false};}document.getElementById('fn-toggles').style.display=isEditor?'none':'flex';document.getElementById('add-text-book-btn').style.display=(isTahqiq&&currentProfile?.account_type==='verified')?'inline-block':'none';if(isEditor){if(!activeHadith){document.getElementById('editor-content').innerHTML='';toast('اختر حديثاً من وضع التصفح أولاً، ثم اضغط تحرير');}else{loadEditorForHadith();}}}
function togglePanel(which){const key=which==='mss'?'mss':'editions';openPanels[key]=!openPanels[key];document.getElementById('panel-'+key).classList.toggle('open',openPanels[key]);const btn=which==='mss'?document.getElementById('panel-toggle-left'):document.getElementById('panel-toggle-right');btn.classList.toggle('open',openPanels[key]);btn.textContent=which==='mss'?(openPanels.mss?'‹':'›'):(openPanels.editions?'›':'‹');}
function renderHadiths(hadiths){document.getElementById('fn-toggles').innerHTML=FN_CATS.map(c=>{const label=c.replace('_',' ');return `<button class="fn-toggle ${activeFnCats[c]?'active '+c:''}" onclick="toggleFnCat('${c}')">${label}</button>`;}).join('');const container=document.getElementById('hadiths-container');if(!hadiths.length){container.innerHTML='<div style="text-align:center;padding:30px;color:#999">لا أحاديث</div>';return;}container.innerHTML=hadiths.slice(0,50).map(hadithCardHTML).join('');Object.keys(activeFnCats).forEach(c=>{if(activeFnCats[c])loadFnMarkers(c);});}
function hadithCardHTML(h){const text=h.text||h.hadith||'';const num=h.hadithnumber||h.number||'';const grade=h.grades?.[0]?.grade||'';const gc=grade.includes('صحيح')?'صحيح':grade.includes('حسن')?'حسن':grade.includes('ضعيف')?'ضعيف':'';const ts=JSON.stringify(escHtml(text)).replace(/"/g,'&quot;');const isVerified=currentProfile?.account_type==='verified';return `<div class="hadith-card" data-num="${num}"><div class="hadith-card-header"><span class="hadith-number">رقم ${num}</span>${grade?`<span class="hadith-grade ${gc}">${grade}</span>`:''}</div><div class="hadith-text" id="htext-${num}">${escHtml(text)}</div><div class="hadith-actions"><button onclick="openQC(${ts},${num})">تعليق</button><button onclick="setActiveHadithAndDrawer(${ts},${num})">💬 تعليقات القراء</button>${currentMode==='tahqiq'?`<button class="btn-tahqiq" onclick="setActiveHadith(${ts},${num})">تحديد للتحقيق</button>`:''}${isVerified?`<button class="btn-editor" onclick="sendToEditor(${ts},${num})">تحرير</button>`:''}</div></div>`;}
function setActiveHadith(text,num){activeHadith={text,num};toast('تم تحديد الحديث رقم '+num);}
function setActiveHadithAndDrawer(text,num){activeHadith={text,num};openCommentsDrawer();}
function sendToEditor(text,num){activeHadith={text,num};setMode('editor');}
async function toggleFnCat(cat){activeFnCats[cat]=!activeFnCats[cat];document.querySelectorAll('.fn-toggle').forEach(b=>{FN_CATS.forEach(c=>{if(b.textContent.trim()===c.replace('_',' ')){b.classList.remove('تخريج','فروق_نسخ','غريب','active');if(activeFnCats[c])b.classList.add('active',c);}});});document.querySelectorAll('.fn-marker.'+cat).forEach(m=>m.remove());if(activeFnCats[cat])await loadFnMarkers(cat);}
async function loadFnMarkers(cat){if(!currentBook)return;const{data}=await sb.from('footnotes').select('*').eq('book_id',currentBook.id).eq('category',FN_CAT_DB[cat]);if(!data)return;data.forEach(fn=>{const el=document.getElementById('htext-'+fn.hadith_number);if(el&&!el.querySelector('.fn-marker.'+cat)){const marker=document.createElement('span');marker.className='fn-marker '+cat;marker.textContent=FN_CATS.indexOf(cat)+1;marker.onclick=(e)=>showFnPopover(e,fn.content||'لا يوجد محتوى',cat);el.appendChild(marker);}});}
function showFnPopover(e,text,cat){e.stopPropagation();const pop=document.getElementById('fn-popover');pop.innerHTML=`<div class="fn-cat-label ${cat}">${cat.replace('_',' ')}</div>${escHtml(text)}`;pop.style.display='block';const rect=e.target.getBoundingClientRect();pop.style.top=(rect.bottom+6)+'px';pop.style.left=Math.max(8,rect.left-100)+'px';}
function searchHadiths(){const q=document.getElementById('hadith-search-input').value.trim();if(!q||!currentHadiths.length)return;const results=currentHadiths.filter(h=>(h.text||h.hadith||'').includes(q));renderHadiths(results);if(!results.length)toast('لا نتائج لهذا البحث');}
async function loadSidePanels(){if(!currentBook)return;const{data:mss}=await sb.from('manuscripts').select('*').eq('book_id',currentBook.id);document.getElementById('mss-list').innerHTML=mss&&mss.length?mss.map(m=>`<div class="ms-item"><h4>${m.name}${m.status!=='approved'?' <span class="status-pill" style="background:var(--gold-light);color:var(--gold)">قيد المراجعة</span>':''}</h4><p>${m.library||''}</p>${m.image_url?`<img src="${m.image_url}" onclick="zoomImg('${m.image_url}')" loading="lazy">`:'</div>'}`).join(''):'<div style="font-size:12px;color:var(--text2);text-align:center;padding:14px">لا توجد مخطوطات مضافة</div>';const{data:eds}=await sb.from('editions').select('*').eq('book_id',currentBook.id);document.getElementById('editions-list').innerHTML=eds&&eds.length?eds.map(e=>`<div class="ed-item"><h4>${e.name}${e.status!=='approved'?' <span class="status-pill" style="background:var(--gold-light);color:var(--gold)">قيد المراجعة</span>':''}</h4><p>${e.publisher||''}</p>${e.image_url?`<img src="${e.image_url}" onclick="zoomImg('${e.image_url}')" loading="lazy">`:'</div>'}`).join(''):'<div style="font-size:12px;color:var(--text2);text-align:center;padding:14px">لا توجد طبعات مضافة</div>';}
function openAddModal(type){if(currentProfile?.account_type!=='verified'){toast('يتطلب حساباً موثقاً');return;}addItemType=type;document.getElementById('add-item-title').textContent=type==='manuscript'?'إضافة مصورة مخطوط':'إضافة مصورة مطبوع';['ai-name','ai-meta','ai-image-url','ai-notes'].forEach(id=>document.getElementById(id).value='');openModal('add-item-modal');}
async function submitAddItem(){const name=document.getElementById('ai-name').value.trim();const meta=document.getElementById('ai-meta').value.trim();const url=document.getElementById('ai-image-url').value.trim();const notes=document.getElementById('ai-notes').value.trim();if(!name)return toast('أدخل الاسم');if(addItemType==='manuscript'){await sb.from('manuscripts').insert({book_id:currentBook.id,name,library:meta,image_url:url,notes,author_id:currentUser.id,status:'pending_review'});}else{await sb.from('editions').insert({book_id:currentBook.id,name,publisher:meta,image_url:url,notes,author_id:currentUser.id,status:'pending_review'});}closeModal('add-item-modal');toast('أُرسلت الإضافة للجنة العلمية، وستظهر في صفحتك حتى الإقرار');loadSidePanels();}
function openAddTextModal(){if(currentProfile?.account_type!=='verified'){toast('يتطلب حساباً موثقاً');return;}['at-title','at-author','at-content'].forEach(id=>document.getElementById(id).value='');openModal('add-text-modal');}
async function submitAddText(){const title=document.getElementById('at-title').value.trim();const author=document.getElementById('at-author').value.trim();const content=document.getElementById('at-content').value.trim();if(!title||!content)return toast('أدخل العنوان والنص');if(currentProfile?.account_type!=='verified')return toast('يتطلب حساباً موثقاً');const newId='txt_'+Date.now().toString(36);const{error:bookErr}=await sb.from('books').insert({id:newId,title,author:author||'غير معروف',icon:'📜',category:'تحقيق'});if(bookErr)return toast('خطأ في إنشاء الكتاب');const{error:textErr}=await sb.from('texts').insert({book_id:newId,hadith_number:1,matn:content});if(textErr)return toast('خطأ في حفظ النص');BOOKS.push({id:newId,icon:'📜',title,author:author||'غير معروف'});renderBooks();closeModal('add-text-modal');toast('تم حفظ الكتاب');selectBook(newId);}
function toggleCommentsDrawer(){commentsDrawerOpen=!commentsDrawerOpen;document.getElementById('comments-drawer').classList.toggle('open',commentsDrawerOpen);document.getElementById('comments-toggle-btn').classList.toggle('active',commentsDrawerOpen);if(commentsDrawerOpen)loadDrawerComments();}
function openCommentsDrawer(){if(!commentsDrawerOpen)toggleCommentsDrawer();else loadDrawerComments();}
async function loadDrawerComments(){const body=document.getElementById('comments-drawer-body');if(!activeHadith||!currentBook){body.innerHTML='<div style="font-size:12px;color:var(--text2);text-align:center;padding:14px">اختر حديثاً أولاً</div>';return;}body.innerHTML='جاري التحميل...';const{data:direct}=await sb.from('comments').select('*, profiles(full_name)').eq('book_id',currentBook.id).eq('hadith_number',activeHadith.num).order('created_at');let comments=direct&&direct.length?direct:[];if(!comments.length){const{data:fromPosts}=await sb.from('posts').select('*, profiles(full_name)').eq('book_id',currentBook.id).eq('text_id',activeHadith.num).order('created_at');comments=fromPosts||[];}body.innerHTML=comments.length?comments.map(c=>`<div style="font-size:12px;border-bottom:1px solid #f5f5f5;padding:6px 0"><b style="color:var(--green)">${c.profiles?.full_name||'مجهول'}</b><br>${escHtml(c.content)}</div>`).join(''):'<div style="font-size:12px;color:var(--text2);text-align:center;padding:14px">لا تعليقات على هذا الحديث بعد</div>';}
async function submitDrawerComment(){if(!currentUser)return toast('يجب تسجيل الدخول');if(!activeHadith)return toast('اختر حديثاً أولاً');const input=document.getElementById('drawer-comment-input');const content=input.value.trim();if(!content)return;const{error}=await sb.from('comments').insert({post_id:null,author_id:currentUser.id,content,book_id:currentBook.id,hadith_number:activeHadith.num});if(error){toast('خطأ في إرسال التعليق: '+error.message);return;}input.value='';toast('تم نشر التعليق');loadDrawerComments();}
function initQCTypes(){document.querySelectorAll('#qc-types button').forEach(btn=>{btn.addEventListener('click',function(){document.querySelectorAll('#qc-types button').forEach(b=>b.classList.remove('active'));this.classList.add('active');});});}
function openQC(text,num){qcHadith={text,num};document.getElementById('qc-hadith-preview').textContent=text.substring(0,150)+(text.length>150?'...':'');document.getElementById('qc-text').value='';openModal('quick-comment-modal');}
async function submitQC(){const content=document.getElementById('qc-text').value.trim();if(!content)return toast('أدخل تعليقاً');if(!currentUser)return toast('يجب تسجيل الدخول');const type=document.querySelector('#qc-types button.active').dataset.type;if(currentProfile?.account_type!=='verified'&&type!=='فائدة'){toast('الحساب الزائر يسمح فقط بفائدة');return;}const fullContent=`[${currentBook?.title||''} - حديث ${qcHadith?.num||''}]\n${content}`;const{error}=await sb.from('posts').insert({author_id:currentUser.id,post_type:type,content:fullContent,track:'حديث',book_id:currentBook?.id,text_id:qcHadith?.num,likes:0});if(error)return toast('خطأ في النشر');toast('نُشر التعليق في الرئيسية');closeModal('quick-comment-modal');}
async function loadEditorForHadith(){if(!activeHadith||!currentUser||!currentBook)return;document.getElementById('editor-content').innerHTML='';footnotes=[];fnCounter=0;currentDraftId=null;const{data}=await sb.from('user_edits').select('*').eq('user_id',currentUser.id).eq('book_id',currentBook.id).eq('hadith_number',activeHadith.num).maybeSingle();if(data){currentDraftId=data.id;document.getElementById('editor-content').innerHTML=data.edited_matn||escHtml(activeHadith.text);footnotes=data.custom_footnotes||[];fnCounter=footnotes.length;setEditStatus(data.status);}else{document.getElementById('editor-content').innerHTML=escHtml(activeHadith.text);setEditStatus('draft');}renderFootnotes();}
function setEditStatus(status){const badge=document.getElementById('edit-status-badge');const labels={draft:'مسودة',pending_review:'قيد المراجعة',approved:'معتمد ✓',rejected:'مرفوض'};badge.textContent=labels[status]||status;badge.className='status-badge status-'+status;}
function fmt(cmd){document.getElementById('editor-content').focus();document.execCommand(cmd,false,null);}
function insertMark(type){const labels={tashif:'تصحيف',ziyada:'زيادة',naqs:'نقص',shahid:'شاهد'};const sel=window.getSelection();if(!sel.rangeCount)return;const range=sel.getRangeAt(0);const txt=range.toString();if(!txt)return toast('حدد نصاً أولاً');const span=document.createElement('span');span.className='m-'+type;span.title=labels[type];span.textContent=txt;range.deleteContents();range.insertNode(span);sel.collapseToEnd();}
function openFnDialog(){document.getElementById('fn-text-input').value='';openModal('fn-dialog');}
function addFootnote(){const text=document.getElementById('fn-text-input').value.trim();if(!text)return toast('أدخل نص الحاشية');const sel=window.getSelection();fnCounter++;if(sel.rangeCount&&sel.toString()){const range=sel.getRangeAt(0);const ref=document.createElement('sup');ref.className='m-fn-ref';ref.textContent=fnCounter;range.collapse(false);range.insertNode(ref);}footnotes.push({num:fnCounter,text});renderFootnotes();closeModal('fn-dialog');}
function deleteFootnote(num){footnotes=footnotes.filter(f=>f.num!==num);renderFootnotes();}
function renderFootnotes(){const list=document.getElementById('fn-list');list.innerHTML=footnotes.length?footnotes.map(f=>`<div class="fn-item"><span class="fn-num">${f.num}</span><span class="fn-text">${escHtml(f.text)}</span><button class="fn-del" onclick="deleteFootnote(${f.num})">×</button></div>`).join(''):'<div style="font-size:12px;color:#bbb;padding:4px 0">لا حواشي شخصية بعد</div>';}
async function saveDraft(){if(!currentUser||!activeHadith||!currentBook)return toast('لا يوجد حديث محدد');const matn=document.getElementById('editor-content').innerHTML;const payload={user_id:currentUser.id,book_id:currentBook.id,hadith_number:activeHadith.num,edited_matn:matn,custom_footnotes:footnotes,status:'draft',updated_at:new Date().toISOString()};let res;if(currentDraftId)res=await sb.from('user_edits').update(payload).eq('id',currentDraftId);else{res=await sb.from('user_edits').insert(payload).select().single();if(res.data)currentDraftId=res.data.id;}if(res.error)return toast('خطأ في الحفظ');setEditStatus('draft');toast('تم حفظ المسودة في صفحتك الشخصية');}
async function submitForReview(){await saveDraft();if(!currentDraftId)return;const{error}=await sb.from('user_edits').update({status:'pending_review'}).eq('id',currentDraftId);if(error)return toast('خطأ');setEditStatus('pending_review');toast('أُرسل للجنة العلمية للمراجعة');}
async function loadProfilePage(){const uid=viewedProfileId||currentUser.id;viewedProfileId=null;const{data:prof}=await sb.from('profiles').select('*').eq('id',uid).single();if(!prof)return;const initial=(prof.full_name||'م').trim().charAt(0);document.getElementById('profile-avatar').textContent=initial;document.getElementById('profile-name').textContent=prof.full_name||prof.username||'مستخدم';const badge=document.getElementById('profile-acc-badge');badge.textContent=prof.account_type==='verified'?'حساب موثّق':'حساب زائر';badge.className='acc-badge'+(prof.account_type!=='verified'?' guest':'');document.getElementById('profile-bio-text').textContent=prof.bio||'';const isOwn=uid===currentUser.id;document.getElementById('profile-bio-edit').style.display=isOwn?'flex':'none';document.getElementById('profile-bio-input').value=prof.bio||'';document.getElementById('page-profile').dataset.uid=uid;switchProfileTab('posts');}
async function saveBio(){const bio=document.getElementById('profile-bio-input').value.trim();await sb.from('profiles').update({bio}).eq('id',currentUser.id);document.getElementById('profile-bio-text').textContent=bio;if(currentProfile)currentProfile.bio=bio;toast('تم الحفظ');}
function switchProfileTab(tab){document.querySelectorAll('#profile-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));const uid=document.getElementById('page-profile').dataset.uid||currentUser.id;if(tab==='posts')loadProfilePosts(uid);else if(tab==='tahqiq')loadProfileTahqiq(uid);else loadProfileAdditions(uid);}
async function loadProfilePosts(uid){const content=document.getElementById('profile-content');content.innerHTML='جاري التحميل...';const{data}=await sb.from('posts').select('*, profiles(full_name)').eq('author_id',uid).order('created_at',{ascending:false}).limit(30);content.innerHTML=data&&data.length?data.map(postHTML).join(''):'<div>لا توجد منشورات</div>';}
async function loadProfileTahqiq(uid){const content=document.getElementById('profile-content');content.innerHTML='جاري التحميل...';const isOwn=uid===currentUser.id;let q=sb.from('user_edits').select('*').eq('user_id',uid).order('updated_at',{ascending:false});if(!isOwn)q=q.eq('status','approved');const{data}=await q;if(!data||!data.length){content.innerHTML='<div>لا توجد تحقيقات شخصية بعد</div>';return;}const labels={draft:['مسودة','#f0f0f0','var(--text2)'],pending_review:['قيد المراجعة','var(--gold-light)','var(--gold)'],approved:['معتمد ✓','var(--green-light)','var(--green)'],rejected:['مرفوض','#fde8e8','#c0392b']};content.innerHTML=data.map(t=>{const book=BOOKS.find(b=>b.id===t.book_id);const[lbl,bg,fg]=labels[t.status]||['','#eee','#666'];const plain=(t.edited_matn||'').replace(/<[^>]+>/g,'');return `<div class="tahqiq-item"><div class="tahqiq-item-header"><h4>${book?.title||t.book_id} — حديث ${t.hadith_number}</h4><span class="status-pill" style="background:${bg};color:${fg}">${lbl}</span></div><div class="preview">${escHtml(plain.substring(0,160))}...</div></div>`;}).join('');}
async function loadProfileAdditions(uid){const content=document.getElementById('profile-content');content.innerHTML='جاري التحميل...';const isOwn=uid===currentUser.id;const isReviewer=isOwn&&(currentProfile?.role==='reviewer'||currentProfile?.role==='admin');const labels={pending_review:['قيد المراجعة','var(--gold-light)','var(--gold)'],approved:['معتمد ✓','var(--green-light)','var(--green)'],rejected:['مرفوض','#fde8e8','#c0392b']};const{data:mss}=await sb.from('manuscripts').select('*, books(title)').eq('author_id',uid).order('id',{ascending:false});const{data:eds}=await sb.from('editions').select('*, books(title)').eq('author_id',uid).order('id',{ascending:false});const mine=[...(mss||[]).map(m=>({...m,kind:'manuscript'})),...(eds||[]).map(e=>({...e,kind:'edition'}))];let html=mine.length?mine.map(it=>{const[lbl,bg,fg]=labels[it.status]||['','#eee','#666'];return `<div class="tahqiq-item"><div class="tahqiq-item-header"><h4>${it.kind==='manuscript'?'مخطوط':'طبعة'}: ${it.name} — ${it.books?.title||it.book_id}</h4><span class="status-pill" style="background:${bg};color:${fg}">${lbl}</span></div><div class="preview">${escHtml(it.library||it.publisher||'')}</div></div>`;}).join(''):'<div>لا توجد إضافات بعد</div>';if(isReviewer){const{data:pmss}=await sb.from('manuscripts').select('*, books(title), profiles(full_name)').eq('status','pending_review');const{data:peds}=await sb.from('editions').select('*, books(title), profiles(full_name)').eq('status','pending_review');const pending=[...(pmss||[]).map(m=>({...m,kind:'manuscript'})),...(peds||[]).map(e=>({...e,kind:'edition'}))];html+=`<h3 style="margin:20px 0 10px;color:var(--green);font-size:15px">للمراجعة (${pending.length})</h3>`;html+=pending.length?pending.map(it=>`<div class="tahqiq-item"><div class="tahqiq-item-header"><h4>${it.kind==='manuscript'?'مخطوط':'طبعة'}: ${it.name} — ${it.books?.title||it.book_id}</h4></div><div class="preview">مُرسِل: ${it.profiles?.full_name||'مجهول'} — ${escHtml(it.library||it.publisher||'')}</div><div style="display:flex;gap:6px;margin-top:8px"><button style="background:var(--green-light);color:var(--green);padding:5px 12px;border-radius:4px;font-size:12px" onclick="reviewItem('${it.kind}',${it.id},'approved')">قبول</button><button style="background:#fde8e8;color:#c0392b;padding:5px 12px;border-radius:4px;font-size:12px" onclick="reviewItem('${it.kind}',${it.id},'rejected')">رفض</button></div></div>`).join(''):'<div style="font-size:13px;color:var(--text2)">لا توجد إضافات معلّقة</div>';}content.innerHTML=html;}
async function reviewItem(kind,id,status){const table=kind==='manuscript'?'manuscripts':'editions';const{error}=await sb.from(table).update({status}).eq('id',id);if(error)return toast('خطأ في التحديث');toast(status==='approved'?'تم الاعتماد':'تم الرفض');loadProfileAdditions(currentUser.id);if(currentBook)loadSidePanels();}
function openModal(id){document.getElementById(id).style.display='flex';}
function closeModal(id){document.getElementById(id).style.display='none';}
function zoomImg(src){document.getElementById('zoom-img').src=src;document.getElementById('img-zoom').style.display='flex';}
function closeZoom(){document.getElementById('img-zoom').style.display='none';}
function toast(msg){const el=document.getElementById('toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2800);}
function escHtml(str){if(!str)return '';return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

async function runSmartTakhrij() {
    const editor = document.getElementById('editor-content');
    const text = editor.innerText.substring(0, 60).trim();
    if(!text) return toast('المحرر فارغ');

    toast('جاري البحث في المكتبة...');
    try {
        const { data, error } = await sb.from('hadiths').select('*, book_id').ilike('text', '%' + text + '%').limit(5);
        if(error) throw error;

        if(!data || data.length === 0) return toast('لم يتم العثور على شواهد مطابقة');

        let msg = '📚 شواهد مقترحة:\n' + data.map(h => `- ${h.book_id} (${h.hadithnumber})`).join('\n');
        if(confirm(msg + '\n\nهل تريد إدراج العزو المختصر؟')) {
            editor.focus();
            document.execCommand('insertText', false, '\n[أخرجه ' + data[0].book_id + ' (' + data[0].hadithnumber + ')]');
        }
    } catch(e) {
        toast('خطأ في التخريج: ' + e.message);
    }
}

function reIndexFootnotes() {
    const editor = document.getElementById('editor-content');
    const markers = editor.querySelectorAll('.m-fn-ref');
    markers.forEach((m, i) => {
        m.textContent = (i + 1);
        m.onclick = () => {
             const item = document.getElementById('fn-item-' + (i+1));
             if(item) item.scrollIntoView({behavior: 'smooth'});
        };
    });
    renderFootnotes();
}

// Override existing addFootnote and deleteFootnote to support re-indexing
window.addFootnote = function() {
    const text = document.getElementById('fn-text-input').value.trim();
    if(!text) return toast('أدخل نص الحاشية');

    const sel = window.getSelection();
    if(!sel.rangeCount) return toast('حدد مكاناً في النص');

    const range = sel.getRangeAt(0);
    const sup = document.createElement('sup');
    sup.className = 'm-fn-ref';
    sup.textContent = '*';
    range.insertNode(sup);

    footnotes.push({text});
    reIndexFootnotes();
    closeModal('fn-dialog');
};

window.deleteFootnote = function(idx) {
    const editor = document.getElementById('editor-content');
    const markers = editor.querySelectorAll('.m-fn-ref');
    if(markers[idx]) markers[idx].remove();
    footnotes.splice(idx, 1);
    reIndexFootnotes();
};

window.renderFootnotes = function() {
    const list = document.getElementById('fn-list');
    const editor = document.getElementById('editor-content');
    const markers = editor.querySelectorAll('.m-fn-ref');

    list.innerHTML = markers.length ? Array.from({length: markers.length}).map((_, i) => `
        <div class="fn-item" id="fn-item-${i+1}">
            <span class="fn-num">${i+1}</span>
            <span class="fn-text">${escHtml(footnotes[i]?.text || '...') }</span>
            <button class="fn-del" onclick="deleteFootnote(${i})">×</button>
        </div>`).join('') : '<div style="font-size:12px;color:#bbb;padding:4px 0">لا حواشي شخصية بعد</div>';
};
