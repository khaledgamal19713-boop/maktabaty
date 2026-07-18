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
