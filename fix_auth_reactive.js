const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// 1. Reactive Auth Listener
const reactiveAuth = `
    async function init() {
        sb.auth.onAuthStateChange(async (event, session) => {
            if (session) {
                user = session.user;
                document.getElementById('auth-page').style.display = 'none';
                document.getElementById('app').style.display = 'block';

                const { data: prof } = await sb.from('profiles').select('full_name').eq('id', user.id).single();
                document.getElementById('username').textContent = prof?.full_name || 'باحث';

                // Ensure profile exists
                if(!prof) {
                    await sb.from('profiles').upsert({ id: user.id, full_name: 'باحث جديد' });
                }

                loadPosts();
                renderBooks();
            } else {
                document.getElementById('app').style.display = 'none';
                document.getElementById('auth-page').style.display = 'block';
            }
        });
    }
`;

html = html.replace(/async function init\(\) \{[\s\S]*?\n\s+\}/, reactiveAuth);

// 2. Direct Login (No more confusing alerts, just Supabase standard)
const directLogin = `
    async function login(type) {
        const email = document.getElementById('auth-email').value;
        const phone = document.getElementById('auth-phone').value;
        if(!email) return alert('يرجى إدخال البريد');

        showToast('جاري إرسال الطلب...');
        const { error } = await sb.auth.signInWithOtp({
            email,
            options: {
                data: { account_type: type, phone: phone }
            }
        });

        if (error) {
            alert('خطأ: ' + error.message);
        } else {
            alert('تم إرسال رابط الدخول إلى بريدك الإلكتروني. يرجى الضغط عليه للدخول.');
        }
    }
`;
html = html.replace(/async function login\(type\) \{[\s\S]*?\n\s+\}/, directLogin);

fs.writeFileSync('index.html', html);
