const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// Add the button
html = html.replace('<button class="mark-btn shahid" onclick="insertMark(\'shahid\')">شاهد</button>',
                   '<button class="mark-btn shahid" onclick="insertMark(\'shahid\')">شاهد</button>\n                <button class="btn btn-sm btn-outline-primary" style="font-size:11px; margin-right:5px; border:1px solid var(--border); border-radius:4px" onclick="runSmartTakhrij()">🔍 تخريج ذكي</button>');

// Add the logic functions at the end of script
const logic = `
async function runSmartTakhrij() {
    const editor = document.getElementById('editor-content');
    const text = editor.innerText.substring(0, 60).trim();
    if(!text) return toast('المحرر فارغ');
    toast('جاري البحث في المكتبة...');
    try {
        const { data, error } = await sb.from('hadiths').select('*, book_id').ilike('text', '%' + text + '%').limit(5);
        if(error) throw error;
        if(!data || data.length === 0) return toast('لم يتم العثور على شواهد مطابقة');
        let msg = '📚 شواهد مقترحة:\\n' + data.map(h => \`- \${h.book_id} (\${h.hadithnumber})\`).join('\\n');
        if(confirm(msg + '\\n\\nهل تريد إدراج العزو المختصر؟')) {
            editor.focus();
            document.execCommand('insertText', false, '\\n[أخرجه ' + data[0].book_id + ' (' + data[0].hadithnumber + ')]');
        }
    } catch(e) { toast('خطأ في التخريج: ' + e.message); }
}

function reIndexFootnotes() {
    const editor = document.getElementById('editor-content');
    const markers = editor.querySelectorAll('.m-fn-ref');
    markers.forEach((m, i) => {
        m.textContent = (i + 1);
    });
    renderFootnotes();
}

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
    if(!list || !editor) return;
    const markers = editor.querySelectorAll('.m-fn-ref');
    list.innerHTML = markers.length ? Array.from({length: markers.length}).map((_, i) => \`
        <div class="fn-item" id="fn-item-\${i+1}">
            <span class="fn-num">\${i+1}</span>
            <span class="fn-text">\${escHtml(footnotes[i]?.text || '...') }</span>
            <button class="fn-del" onclick="deleteFootnote(\${i})">×</button>
        </div>\`).join('') : '<div style="font-size:12px;color:#bbb;padding:4px 0">لا حواشي شخصية بعد</div>';
};
`;

html = html.replace('</script>', logic + '\n</script>');

fs.writeFileSync('index.html', html);
