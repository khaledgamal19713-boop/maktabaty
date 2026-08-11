const REACTIONS=[{k:'like',e:'👍',l:'إعجاب'},{k:'love',e:'❤️',l:'حب'},{k:'care',e:'🤗',l:'اهتمام'},{k:'wow',e:'😮',l:'إعجاب شديد'},{k:'sad',e:'😢',l:'حزن'}];
let composerType='حديث';
function timeAgo(iso){const d=Math.floor((Date.now()-new Date(iso).getTime())/1000);if(d<60)return'الآن';if(d<3600)return Math.floor(d/60)+' د';if(d<86400)return Math.floor(d/3600)+' س';if(d<2592000)return Math.floor(d/86400)+' يوم';return new Date(iso).toLocaleDateString('ar-EG');}
function initial(name){return(name||'م').trim().charAt(0);}
function renderSubBar(){const bar=document.getElementById('sub-bar');bar.style.display='none';}
function initPostTypes(){}

async function loadPosts(){
  const list=document.getElementById('posts-list');
  document.getElementById('posts-loading').style.display='block';
  const{data:posts,error}=await sb.from('posts').select('*, profiles(full_name)').order('created_at',{ascending:false}).limit(30);
  document.getElementById('posts-loading').style.display='none';
  if(error||!posts||!posts.length){list.innerHTML='<div class="empty-state"><div class="empty-icon">📭</div>لا توجد منشورات بعد</div>';return;}
  const ids=posts.map(p=>p.id);
  let myReactions={};
  if(currentUser){const{data:mine}=await sb.from('reactions').select('post_id,reaction_type').eq('user_id',currentUser.id).in('post_id',ids);(mine||[]).forEach(r=>myReactions[r.post_id]=r.reaction_type);}
  list.innerHTML=posts.map(p=>postCardHTML(p,myReactions[p.id])).join('');
}

function postCardHTML(p,myReaction){
  const author=p.profiles?.full_name||'مجهول';
  const hadithRef=p.book_id&&p.text_id?`<span class="post-hadith-ref" onclick="jumpToHadith('${p.book_id}',${p.text_id})">${p.book_id} — حديث ${p.text_id}</span>`:'';
  const reactEmoji=myReaction?(REACTIONS.find(r=>r.k===myReaction)?.e||'👍'):'👍';
  const reactLabel=myReaction?(REACTIONS.find(r=>r.k===myReaction)?.l||'إعجاب'):'إعجاب';
  return `<div class="post-card" data-id="${p.id}">
    <div class="post-header">
      <div class="post-author-section">
        <div class="post-avatar">${initial(author)}</div>
        <div class="post-meta-info">
          <span class="post-author-name" onclick="showProfilePage('${p.author_id}')">${escHtml(author)}</span>
          <span class="post-meta-row"><span>${p.post_type||''}</span><span class="dot"></span><span>${timeAgo(p.created_at)}</span>${hadithRef}</span>
        </div>
      </div>
      <button class="post-menu-btn">⋯</button>
    </div>
    <div class="post-content">${escHtml(p.content)}</div>
    <div class="post-stats">
      <div class="post-reactions">${(p.likes_count||0)>0?`<div class="reaction-icons"><span class="reaction-icon">👍</span><span class="reaction-icon">❤️</span></div><span>${p.likes_count}</span>`:''}</div>
      <div class="stats-right">${(p.comments_count||0)>0?p.comments_count+' تعليق':''}</div>
    </div>
    <div class="post-actions">
      <div class="post-action ${myReaction?'liked':''}" id="reaction-btn-${p.id}" onclick="toggleReaction(${p.id},'${myReaction||''}')" onmouseenter="showReactionsPopover(${p.id})" onmouseleave="hideReactionsPopoverDelayed(${p.id})">
        <div class="reactions-popover" id="reactions-popover-${p.id}">${REACTIONS.map(r=>`<span class="reaction-btn" onclick="event.stopPropagation();pickReaction(${p.id},'${r.k}')" title="${r.l}">${r.e}</span>`).join('')}</div>
        <span class="pa-icon">${reactEmoji}</span><span>${reactLabel}</span>
      </div>
      <div class="post-action" onclick="toggleComments(${p.id})"><span class="pa-icon">💬</span><span>تعليق</span></div>
      <div class="post-action"><span class="pa-icon">🔗</span><span>مشاركة</span></div>
    </div>
    <div class="comments-section" id="comments-${p.id}">
      <div id="comments-list-${p.id}"></div>
      <div class="comment-input-row">
        <div class="my-avatar">${initial(currentProfile?.full_name)}</div>
        <div class="comment-input-wrapper"><input type="text" id="comment-input-${p.id}" placeholder="اكتب تعليقاً..." onkeydown="if(event.key==='Enter')submitComment(${p.id})"><span class="comment-send-btn" onclick="submitComment(${p.id})">➤</span></div>
      </div>
    </div>
  </div>`;
}

function showReactionsPopover(pid){const el=document.getElementById('reactions-popover-'+pid);if(el)el.classList.add('show');}
function hideReactionsPopoverDelayed(pid){setTimeout(()=>{const el=document.getElementById('reactions-popover-'+pid);if(el)el.classList.remove('show');},300);}

async function toggleReaction(postId,current){
  if(!currentUser)return toast('يجب تسجيل الدخول');
  if(current){await sb.from('reactions').delete().eq('post_id',postId).eq('user_id',currentUser.id);await bumpCount(postId,'likes_count',-1);loadPosts();}
  else{await pickReaction(postId,'like');}
}
async function pickReaction(postId,type){
  if(!currentUser)return toast('يجب تسجيل الدخول');
  const{data:existing}=await sb.from('reactions').select('id').eq('post_id',postId).eq('user_id',currentUser.id).maybeSingle();
  if(existing){await sb.from('reactions').update({reaction_type:type}).eq('id',existing.id);}
  else{await sb.from('reactions').insert({post_id:postId,user_id:currentUser.id,reaction_type:type});await bumpCount(postId,'likes_count',1);}
  loadPosts();
}
async function bumpCount(postId,field,delta){
  const{data}=await sb.from('posts').select(field).eq('id',postId).single();
  if(data)await sb.from('posts').update({[field]:Math.max(0,(data[field]||0)+delta)}).eq('id',postId);
}

async function toggleComments(postId){
  const sec=document.getElementById('comments-'+postId);
  const opening=!sec.classList.contains('open');
  sec.classList.toggle('open');
  if(opening)await loadComments(postId);
}
async function loadComments(postId){
  const box=document.getElementById('comments-list-'+postId);
  box.innerHTML='جاري التحميل...';
  const{data}=await sb.from('comments').select('*, profiles(full_name)').eq('post_id',postId).order('created_at');
  box.innerHTML=(data&&data.length)?data.map(c=>`<div class="comment-item"><div class="comment-avatar">${initial(c.profiles?.full_name)}</div><div><div class="comment-bubble"><div class="comment-author">${escHtml(c.profiles?.full_name||'مجهول')}</div><div class="comment-text">${escHtml(c.content)}</div></div><div class="comment-actions"><span class="comment-action">إعجاب</span><span class="comment-action">رد</span><span>${timeAgo(c.created_at)}</span></div></div></div>`).join(''):'<div style="font-size:12px;color:var(--fb-text-secondary);padding:6px 0">لا تعليقات بعد</div>';
}
async function submitComment(postId){
  if(!currentUser)return toast('يجب تسجيل الدخول');
  const input=document.getElementById('comment-input-'+postId);
  const content=input.value.trim();if(!content)return;
  const{error}=await sb.from('comments').insert({post_id:postId,author_id:currentUser.id,content});
  if(error)return toast('خطأ في نشر التعليق');
  await bumpCount(postId,'comments_count',1);
  input.value='';loadComments(postId);
}
function jumpToHadith(bookId,textId){switchMainView('library');selectBook(bookId);}

function openComposerModal(){
  if(!currentUser)return toast('يجب تسجيل الدخول');
  document.getElementById('composer-modal-user-name').textContent=currentProfile?.full_name||'مستخدم';
  document.getElementById('composer-modal-avatar').textContent=initial(currentProfile?.full_name);
  document.getElementById('composer-textarea').value='';
  selectComposerType('حديث');
  document.getElementById('composer-modal-overlay').style.display='flex';
  updatePublishBtnState();
}
function closeComposerModal(){document.getElementById('composer-modal-overlay').style.display='none';}
function selectComposerType(type){
  composerType=type;
  document.querySelectorAll('.composer-type').forEach(b=>b.classList.toggle('active',b.dataset.type===type));
}
function updatePublishBtnState(){
  const btn=document.getElementById('btn-publish-modal');
  const val=document.getElementById('composer-textarea').value.trim();
  btn.disabled=!val;
}
async function publishPostFromModal(){
  const content=document.getElementById('composer-textarea').value.trim();
  if(!content)return;
  if(!currentUser)return toast('يجب تسجيل الدخول');
  if(currentProfile?.account_type!=='verified'&&composerType!=='فائدة'){toast('الحساب الزائر يسمح فقط بمنشورات فائدة');return;}
  const track=document.getElementById('post-track-fb')?.value||'عام';
  const{error}=await sb.from('posts').insert({author_id:currentUser.id,post_type:composerType,content,track,likes_count:0,comments_count:0,shares_count:0});
  if(error)return toast('خطأ في النشر');
  closeComposerModal();toast('تم النشر');loadPosts();
}
