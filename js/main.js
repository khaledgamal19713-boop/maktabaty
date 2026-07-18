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
