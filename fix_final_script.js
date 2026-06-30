const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const scriptContent = `
    const SUPA_URL='https://uqfqpqjarofbcdzkrdgs.supabase.co';
    const SUPA_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxZnFwcWphcm9mYmNkemtyZGdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4ODUwMzUsImV4cCI6MjA5MzQ2MTAzNX0.8z2Nc8t14txttepiRV5yhhkBfDdE77FJ7rx1dxQrICI';
    const sb = supabase.createClient(SUPA_URL, SUPA_KEY);

    let user = null, layer = 'browsing', book = null;

    async function init() {
        sb.auth.onAuthStateChange(async (event, session) => {
            if (session) {
                user = session.user;
                document.getElementById('auth-page').style.display = 'none';
                document.getElementById('app').style.display = 'block';

                const { data: prof } = await sb.from('profiles').select('full_name').eq('id', user.id).single();
                document.getElementById('username').textContent = prof?.full_name || 'باحث';

                if(!prof) {
                    await sb.from('profiles').upsert({ id: user.id, full_name: 'باحث جديد' });
                }

                loadPosts();
                renderBooks();
                if(window.location.hash === '#profile') showProfile();
            } else {
                document.getElementById('app').style.display = 'none';
                document.getElementById('auth-page').style.display = 'block';
            }
        });
    }

    function switchView(v) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const target = document.getElementById('page-' + v);
        if(target) target.classList.add('active');

        document.querySelectorAll('#nav-toggle button').forEach(b => b.classList.remove('active'));
        const btn = document.getElementById('btn-' + v);
        if(btn) btn.classList.add('active');
    }

    function renderBooks() {
        const books = [{id:'bukhari', title:'صحيح البخاري', icon:'📗'}, {id:'muslim', title:'صحيح مسلم', icon:'📘'}];
        document.getElementById('books-list').innerHTML = books.map(b => \`<div class="p-2 border-bottom pointer" onclick="selectBook('\${b.id}', '\${b.title}')">\${b.icon} \${b.title}</div>\`).join('');
    }

    async function selectBook(id, title) {
        book = id;
        document.getElementById('current-book-title').textContent = title;
        const { data } = await sb.from('hadiths').select('*').eq('book_id', id).limit(50);
        document.getElementById('hadiths-container').innerHTML = data.map(h => \`
            <div class="hadith-card" id="h-\${h.hadithnumber}">
                <div class="hadith-text" id="htext-\${h.hadithnumber}">\${h.text}</div>
                <div class="mt-2">
                    <button class="btn btn-sm btn-outline-warning editor-only" style="display:none;" onclick="openEditor('\${h.hadithnumber}')">🛠 تحرير</button>
                    <div class="sandbox-ind text-warning" style="display:none; font-size:12px;">✨ مسودة شخصية</div>
                </div>
            </div>
        \`).join('');
        applySandbox();
    }

    function setLayer(l) {
        layer = l;
        const container = document.getElementById('lib-content');
        const intel = document.getElementById('intel-content');
        const workspace = document.getElementById('editor-content');

        if(l === 'editor' || l === 'verification') {
            container.classList.add('tahqiq-mode');
            document.querySelectorAll('.side-panel').forEach(p => p.classList.add('open'));
            intel.innerHTML = '<div class="p-2 border rounded bg-light mb-2"><h6>📜 صورة المخطوطة</h6><img src="https://via.placeholder.com/200x300?text=Manuscript+Image" class="img-fluid"></div>';
            workspace.innerHTML = '<div class="p-2 border rounded bg-light mb-2"><h6>📖 المطبوعة المقابلة</h6><img src="https://via.placeholder.com/200x300?text=Printed+Edition" class="img-fluid"></div>';
        } else {
            container.classList.remove('tahqiq-mode');
            document.querySelectorAll('.side-panel').forEach(p => p.classList.remove('open'));
        }
        document.querySelectorAll('.editor-only').forEach(b => b.style.display = (l === 'editor' ? 'inline-block' : 'none'));
        showToast('الطبقة الحالية: ' + (l==='browsing'?'تصفح': l==='editor'?'تحقيق':'توثيق'));
    }

    async function openEditor(num) {
        const text = document.getElementById('htext-' + num).innerText;
        const pane = document.getElementById('pane-d');
        pane.classList.add('open');
        pane.innerHTML = \`
            <div class="p-3">
                <h6>📝 محرر المحقق - حديث \${num}</h6>
                <textarea id="edit-area-\${num}" class="form-control mb-2" style="height:250px; font-family:'Amiri', serif; font-size:18px; direction:rtl;">\${text}</textarea>
                <div class="mb-2 d-flex gap-2">
                    <button class="btn btn-sm btn-outline-info" onclick="insertFN('\${num}')">📑 حاشية</button>
                    <button class="btn btn-sm btn-outline-success" onclick="startTakhrij('\${num}')">🔍 تخريج</button>
                    <button class="btn btn-sm btn-outline-warning" onclick="showChain('\${num}')">⛓️ إسناد</button>
                </div>
                <button onclick="saveEdit('\${num}')" class="btn btn-gold w-100">💾 حفظ المسودة</button>
            </div>
        \`;
    }

    window.insertFN = function(num) {
        const ta = document.getElementById('edit-area-' + num);
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const text = ta.value;
        const count = (text.match(/\\\\[\\\\d+\\\\]/g) || []).length + 1;
        ta.value = text.substring(0, start) + \`[\${count}]\` + text.substring(end);
        ta.focus();
    }

    async function saveEdit(num) {
        const newText = document.getElementById('edit-area-' + num).value;
        await sb.from('user_edits').upsert({ user_id: user.id, book_id: book, hadith_number: num, edited_matn: newText });
        showToast('تم حفظ المسودة بنجاح');
        applySandbox();
    }

    async function applySandbox() {
        if (!user || !book) return;
        const { data } = await sb.from('user_edits').select('*').eq('user_id', user.id).eq('book_id', book);
        data?.forEach(e => {
            const el = document.getElementById('htext-' + e.hadith_number);
            if (el) {
                el.innerHTML = e.edited_matn;
                const card = document.getElementById('h-' + e.hadith_number);
                if (card) card.querySelector('.sandbox-ind').style.display = 'block';
            }
        });
    }

    async function loadPosts() {
        const { data } = await sb.from('posts').select('*, profiles(full_name)').order('created_at', { ascending: false });
        document.getElementById('posts-list').innerHTML = data.map(p => \`
            <div class="post-card">
                <div class="fw-bold mb-1">\${p.profiles?.full_name || 'باحث'}</div>
                <div>\${p.content}</div>
            </div>
        \`).join('');
    }

    async function publishPost() {
        const c = document.getElementById('post-content').value;
        if (!c) return;
        await sb.from('posts').insert({ author_id: user.id, content: c });
        document.getElementById('post-content').value = '';
        loadPosts();
        showToast('تم النشر');
    }

    function showToast(m) {
        const t = document.getElementById('toast');
        if(t) {
            t.textContent = m; t.style.display = 'block';
            setTimeout(() => t.style.display = 'none', 2000);
        }
    }

    function checkEmail() {
        const email = document.getElementById('auth-email').value;
        if(!email.includes('@')) return alert('يرجى إدخال بريد إلكتروني صحيح');
        document.getElementById('auth-step-1').style.display='none';
        document.getElementById('auth-step-2').style.display='block';
    }

    function showPhoneStep() {
        document.getElementById('auth-step-2').style.display='none';
        document.getElementById('auth-step-phone').style.display='block';
    }

    function showStep2() {
        document.getElementById('auth-step-phone').style.display='none';
        document.getElementById('auth-step-2').style.display='block';
    }

    function resetAuth() {
        document.getElementById('auth-step-2').style.display='none';
        document.getElementById('auth-step-1').style.display='block';
    }

    function showQuickGuest() {
        document.getElementById('auth-page').style.display='none';
        document.getElementById('app').style.display='block';
        document.getElementById('username').textContent = 'زائر (معاينة)';
        renderBooks();
        loadPosts();
    }

    async function login(type) {
        const email = document.getElementById('auth-email').value;
        const phone = document.getElementById('auth-phone').value;
        if(!email) return alert('يرجى إدخال البريد');

        showToast('جاري إرسال الطلب...');
        const { error } = await sb.auth.signInWithOtp({
            email,
            options: {
                emailRedirectTo: window.location.origin,
                data: { account_type: type, phone: phone }
            }
        });

        if (error) {
            alert('خطأ: ' + error.message);
        } else {
            alert('تم إرسال رابط الدخول إلى بريدك الإلكتروني. يرجى الضغط عليه للدخول.');
        }
    }

    async function logout() { await sb.auth.signOut(); location.reload(); }

    async function showProfile() {
        switchView('profile');
        if(!user) {
            document.getElementById('profile-name').textContent = 'زائر (معاينة)';
            document.getElementById('profile-content-list').innerHTML = '<div class="text-muted">هذا الحساب للمعاينة فقط. سجل دخولك لإنشاء تحقيقات حقيقية.</div>';
            return;
        }
        const { data: prof } = await sb.from('profiles').select('*').eq('id', user.id).single();
        document.getElementById('profile-name').textContent = prof?.full_name || 'باحث';
        showProfileEdits();
    }

    async function showProfileEdits() {
        const list = document.getElementById('profile-content-list');
        list.innerHTML = 'جاري تحميل التحقيقات...';
        const { data } = await sb.from('user_edits').select('*').eq('user_id', user.id);
        if(!data || data.length === 0) {
            list.innerHTML = '<div class="text-muted">لا توجد تحقيقات بعد. ابدأ بالتحقيق من المكتبة!</div>';
            return;
        }
        list.innerHTML = data.map(e => \`
            <div class="card p-3 mb-2">
                <div class="d-flex justify-content-between align-items-center">
                    <h6>كتاب: \${e.book_id} (حديث \${e.hadith_number})</h6>
                    <span class="badge bg-warning text-dark">قيد الانتظار</span>
                </div>
                <div class="small text-muted text-truncate">\${e.edited_matn}</div>
            </div>
        \`).join('');
    }

    async function showProfilePosts() {
        const list = document.getElementById('profile-content-list');
        list.innerHTML = 'جاري تحميل المنشورات...';
        const { data } = await sb.from('posts').select('*').eq('author_id', user.id);
        list.innerHTML = (data||[]).map(p => \`
            <div class="card p-3 mb-2">
                <div>\${p.content}</div>
                <div class="small text-muted mt-1">\${new Date(p.created_at).toLocaleString('ar-EG')}</div>
            </div>
        \`).join('');
    }

    async function showChain(hNum) {
        const pane = document.getElementById('pane-c');
        pane.classList.add('open');
        pane.innerHTML = \`<div class="p-3"><h6>⛓️ سلسلة الإسناد: حديث \${hNum}</h6><p style="font-size:12px; color:gray;">جاري استخراج السلسلة آلياً...</p></div>\`;
    }

    async function startTakhrij(hNum) {
        const matn = document.getElementById('htext-' + hNum).innerText.substring(0, 50);
        const intel = document.getElementById('intel-content');
        intel.innerHTML = '<div class="spinner-border spinner-border-sm text-gold"></div> جاري التخريج والبحث...';

        try {
            const { data } = await sb.from('hadiths').select('*, book_id').ilike('text', '%' + matn + '%').limit(3);
            if(!data || data.length === 0) {
                intel.innerHTML = '<div class="text-muted small">لم يتم العثور على شواهد مطابقة بدقة في الكتب المتاحة.</div>';
                return;
            }

            intel.innerHTML = '<h6>🔗 شواهد مقترحة:</h6>' + data.map(h => \`
                <div class="card p-2 mb-2 bg-white" style="font-size:12px;">
                    <div class="fw-bold text-success">\${h.book_id} (\${h.hadithnumber})</div>
                    <div class="text-truncate">\${h.text}</div>
                    <div class="mt-1 d-flex gap-1">
                        <button class="btn btn-xs btn-outline-primary" onclick="cite('\${hNum}', '\${h.book_id}', '\${h.hadithnumber}', 'short')">عزو مختصر</button>
                        <button class="btn btn-xs btn-outline-info" onclick="cite('\${hNum}', '\${h.book_id}', '\${h.hadithnumber}', 'full')">عزو موسع</button>
                    </div>
                </div>
            \`).join('');
        } catch(e) { intel.innerHTML = 'خطأ في التخريج: ' + e.message; }
    }

    window.cite = function(targetNum, book, hNum, type) {
        const ta = document.getElementById('edit-area-' + targetNum);
        let citation = '';
        if(type === 'short') {
            citation = \`\\n[أخرجه \${book} (\${hNum})]\`;
        } else {
            citation = \`\\n[أخرجه \${book} في صحيحه حديث رقم (\${hNum})، وانظر المجلد (1) صفحة (150)]\`;
        }
        ta.value += citation;
        showToast('تم إضافة العزو للمسودة');
    }

    init();
`;

const bodyEnd = '<\/script>\n<\/body>\n<\/html>';
html = html.substring(0, html.indexOf('<script>') + 8) + scriptContent + bodyEnd;

fs.writeFileSync('index.html', html);
