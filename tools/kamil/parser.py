#!/usr/bin/env python3
import argparse, json, re, hashlib, unicodedata
from difflib import SequenceMatcher
from pathlib import Path

ARABIC_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")
NUM_RE = re.compile(r"^\s*(?:\[\s*)?(\d{1,5})(?:\s*\])?\s*(?:[-–—.]\s*)?(.+?)\s*$")
HEADING_RE = re.compile(r"^\s*\[\s*(\d{1,4})\s*\]\s*(.+?)\s*$")
NUMBERED_RE = re.compile(r"^\s*(?:\[\s*)?(\d{1,5})(?:\s*\])?\s*(?:[-–—.]\s*)?(.+?)\s*$")
FOOTNOTE_RE = re.compile(r"^\s*\(?\d{1,4}\)?\s*[-–—.]\s*(?:ينظر|انظر|راجع)\b")
CRITIC_HINTS = (
    "قال ", "وقال ", "سمعت ", "سألت ", "سئل ", "ذكر ", "يقول ",
    "ليس بثقة", "ليس بالقوي", "ضعيف", "منكر الحديث", "متروك", "كذاب",
    "لا بأس به", "ثقة", "صالح الحديث", "صدوق", "لا يساوي", "يحدث عنه"
)
MARFU_HINTS = ("قال رسول الله", "قال النبي", "عن النبي", "سمعت رسول الله", "صلى الله عليه وسلم")
MAWQUF_HINTS = ("عن أبي بكر", "عن عمر", "عن عثمان", "عن علي", "عن ابن عباس", "عن ابن عمر", "عن عائشة", "عن أبي هريرة", "قال الصحابي")
TAABI_HINTS = ("قال سعيد", "قال مجاهد", "قال قتادة", "قال الزهري", "قال الحسن", "قال الشعبي", "قال ابن سيرين", "عن التابعي")

def normalize_text(s):
    s = unicodedata.normalize("NFKC", s)
    s = re.sub(r"[\u064B-\u065F\u0670\u06D6-\u06ED]", "", s)
    s = s.replace("أ","ا").replace("إ","ا").replace("آ","ا")
    s = s.replace("ى","ي").replace("ؤ","و").replace("ئ","ي")
    s = re.sub(r"\s+", " ", s)
    return s.strip()

def sha(s):
    return hashlib.sha256(s.encode("utf-8")).hexdigest()

def read_pages(path):
    raw = Path(path).read_text(encoding="utf-8", errors="replace")
    return raw.split("\f")

def is_probable_translation_heading(line, current_no):
    m = HEADING_RE.match(line)
    if not m:
        return None
    n = int(m.group(1))
    title = m.group(2).strip()
    # Translation numbers are monotone and substantially smaller than hadith numbering.
    if n < 2 or n > 3000 or len(title) < 3:
        return None
    if re.search(r"[؛،,:]$", title):
        return None
    # A translation title normally begins with an Arabic name and not an isnad verb.
    if re.match(r"^(حدثنا|حدثني|أخبرنا|أخبرني|عن|سمعت|قال|وقال)\b", title):
        return None
    if current_no is not None and n <= current_no:
        return None
    return n, title

def split_numbered_blocks(lines):
    blocks=[]
    cur=None
    for line in lines:
        m=NUMBERED_RE.match(line)
        if m:
            if cur:
                blocks.append(cur)
            cur={"number":int(m.group(1)), "text":m.group(2).strip(), "lines":[line]}
        elif cur:
            cur["text"] += "\n" + line
            cur["lines"].append(line)
    if cur:
        blocks.append(cur)
    return blocks

def classify_block(text):
    t=normalize_text(text)
    # Classification uses multiple signals; uncertainty is retained.
    marfu=sum(h in t for h in MARFU_HINTS)
    maw=sum(h in t for h in MAWQUF_HINTS)
    taa=sum(h in t for h in TAABI_HINTS)
    has_isnad=bool(re.search(r"\b(?:حدثنا|حدثني|أخبرنا|أخبرني|عن|قال)\b", t))
    critic=sum(h in t for h in CRITIC_HINTS)
    if marfu and has_isnad:
        return "مرفوع", 0.98
    if maw and has_isnad and not marfu:
        return "موقوف", 0.90
    if taa and has_isnad and not marfu and not maw:
        return "مقطوع", 0.82
    if critic:
        return "critic", 0.78
    return "unknown", 0.25

def group_hadiths(items, overrides):
    out=[]
    low=[]
    used=set()
    # Explicit overrides have precedence and are visible.
    override_groups={tuple(sorted(g.get("items",[]))):g for g in overrides.get("groups",[])}
    for i,item in enumerate(items):
        if i in used: continue
        key=(item["number"],)
        matched=None
        for gkey,g in override_groups.items():
            if item["number"] in gkey:
                matched=g
                break
        if matched:
            nums=list(matched["items"])
            members=[x for x in items if x["number"] in nums]
            used.update(items.index(x) for x in members)
            out.append({"type":members[0]["type"],"items":members,
                        "grouping_reason":matched.get("grouping_reason","same_matn"),
                        "grouping_confidence":1.0,
                        "numbers":nums})
            continue
        base=normalize_text(item["text"])
        members=[item]
        used.add(i)
        for j,cand in enumerate(items):
            if j in used: continue
            if cand["type"] != item["type"]: continue
            a=base; b=normalize_text(cand["text"])
            ratio=SequenceMatcher(None,a,b).ratio()
            if ratio >= 0.92:
                members.append(cand); used.add(j)
        conf=1.0 if len(members)==1 else 0.96
        reason="single" if len(members)==1 else "same_matn"
        out.append({"type":item["type"],"items":members,
                    "grouping_reason":reason,"grouping_confidence":conf,
                    "numbers":[x["number"] for x in members]})
    return out,low

def parse(raw_pages, overrides):
    translations=[]
    current=None
    current_no=None
    for page_no,page in enumerate(raw_pages,1):
        lines=page.splitlines()
        for line in lines:
            h=is_probable_translation_heading(line,current_no)
            if h:
                if current:
                    translations.append(current)
                n,title=h
                current_no=n
                current={"id":f"tr-{n:04d}","order":n,"name":title,
                         "source_pages":[page_no],"raw_lines":[line],
                         "intro_lines":[],"numbered":[]}
                continue
            if not current:
                continue
            current["source_pages"].append(page_no)
            current["raw_lines"].append(line)
        # Keep parsing by page; numbered blocks are extracted after boundaries below.
    if current:
        translations.append(current)

    # Rebuild content inside each detected boundary using the page ranges.
    for idx,tr in enumerate(translations):
        start=min(tr["source_pages"]); end=max(tr["source_pages"])
        body=[]
        for p in range(start,end+1):
            body.extend(raw_pages[p-1].splitlines())
        # locate heading occurrence, then next translation boundary if present
        hidx=next((i for i,l in enumerate(body) if tr["name"] in l and re.search(rf"\[?{tr['order']}\]?",l)),0)
        body=body[hidx+1:]
        nxt=translations[idx+1]["name"] if idx+1<len(translations) else None
        if nxt:
            for i,l in enumerate(body):
                if nxt in l and re.match(r"^\s*\[?\d+\]?",l):
                    body=body[:i]; break
        blocks=split_numbered_blocks(body)
        intro=[]
        if blocks:
            first_pos=next((i for i,l in enumerate(body) if NUMBERED_RE.match(l)),len(body))
            intro=body[:first_pos]
        else:
            intro=body
        tr["intro"]="\n".join(x for x in intro if x.strip()).strip()
        classified=[]
        critics=[]
        had=[]
        for b in blocks:
            typ,conf=classify_block(b["text"])
            b2={"number":b["number"],"text":b["text"],"type":typ,"confidence":conf,
                "source_pages":[start,end]}
            if typ=="critic":
                critics.append(b2)
            elif typ in ("مرفوع","موقوف","مقطوع"):
                had.append(b2)
            else:
                # Preserve ambiguous material in critics but report it.
                b2["type"]="unknown"
                critics.append(b2)
        groups,_=group_hadiths(had,overrides)
        tr["critics"]=critics
        tr["hadith_groups"]=groups
        tr["footnotes"]=[]
        tr["raw_sha256"]=sha("\n".join(tr["raw_lines"]))
        del tr["raw_lines"]
        del tr["source_pages"]
    return translations

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--input",required=True)
    ap.add_argument("--output",required=True)
    ap.add_argument("--overrides",default="tools/kamil/overrides.json")
    args=ap.parse_args()
    pages=read_pages(args.input)
    overrides=json.loads(Path(args.overrides).read_text(encoding="utf-8"))
    data=parse(pages,overrides)
    Path(args.output).parent.mkdir(parents=True,exist_ok=True)
    Path(args.output).write_text(json.dumps({
        "schema_version":1,
        "source":{"title":"الكامل في ضعفاء الرجال","edition":"مكتبة الرشد، تحقيق مازن محمد السرساوي","volumes":11},
        "translations":data
    },ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps({"translations":len(data)},ensure_ascii=False))

if __name__=="__main__":
    main()
