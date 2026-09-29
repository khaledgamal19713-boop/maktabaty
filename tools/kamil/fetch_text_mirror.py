#!/usr/bin/env python3
import argparse, concurrent.futures, json, re, time
from pathlib import Path
import requests
from bs4 import BeautifulSoup

MARK_RE = re.compile(r"الصفحة\s+(\d+)\s+من\s+9714")
STOP_RE = re.compile(r"(?:حقوق النشر|جميع الحقوق محفوظة|©)")

def extract(html, page):
    soup=BeautifulSoup(html,"html.parser")
    for x in soup(["script","style","noscript","svg","nav","header","footer"]):
        x.decompose()
    text=soup.get_text("\n", strip=True)
    marker=f"الصفحة {page} من 9714"
    pos=text.find(marker)
    if pos < 0:
        m=MARK_RE.search(text)
        if not m or int(m.group(1)) != page:
            raise ValueError(f"page marker not found: {page}")
        pos=m.start()
        marker=m.group(0)
    body=text[pos+len(marker):].strip()
    stop=STOP_RE.search(body)
    if stop:
        body=body[:stop.start()].rstrip()
    if len(body)<20:
        raise ValueError(f"page content too short: {page}")
    return body

def fetch(session,url,page,retries=4):
    last=None
    for attempt in range(retries):
        try:
            r=session.get(url,timeout=30,headers={"User-Agent":"Maktabaty-Kamil-Builder/1.0"})
            r.raise_for_status()
            return page,extract(r.text,page)
        except Exception as e:
            last=e
            time.sleep(1.5*(attempt+1))
    raise RuntimeError(f"page {page}: {last}")

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--base-url",required=True)
    ap.add_argument("--start",type=int,required=True)
    ap.add_argument("--end",type=int,required=True)
    ap.add_argument("--out-dir",required=True)
    ap.add_argument("--manifest",required=True)
    ap.add_argument("--workers",type=int,default=32)
    a=ap.parse_args()
    out=Path(a.out_dir); out.mkdir(parents=True,exist_ok=True)
    pages=list(range(a.start,a.end+1))
    todo=[p for p in pages if not (out/f"{p:05d}.txt").exists()]
    results={"start":a.start,"end":a.end,"pages":len(pages),"fetched":0,"resumed":len(pages)-len(todo),"failed":[]}
    session=requests.Session()
    def one(p): return fetch(session,a.base_url+str(p),p)
    with concurrent.futures.ThreadPoolExecutor(max_workers=a.workers) as ex:
        futures={ex.submit(one,p):p for p in todo}
        for n,f in enumerate(concurrent.futures.as_completed(futures),1):
            p=futures[f]
            try:
                page,text=f.result()
                (out/f"{page:05d}.txt").write_text(text,encoding="utf-8")
                results["fetched"]+=1
                if n % 100 == 0 or n == len(todo):
                    print(json.dumps({"completed":n,"total_new":len(todo),"page":page},ensure_ascii=False),flush=True)
            except Exception as e:
                results["failed"].append({"page":p,"error":str(e)})
    Path(a.manifest).write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding="utf-8")
    if results["failed"]:
        raise SystemExit(f"{len(results['failed'])} pages failed; see {a.manifest}")

if __name__=="__main__":
    main()
