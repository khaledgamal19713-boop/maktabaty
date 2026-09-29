#!/usr/bin/env python3
import argparse,json,re,subprocess,statistics,tempfile,os
from pathlib import Path

def page_score(s):
    chars=[c for c in s if c.strip()]
    ar=sum('\u0600'<=c<='\u06ff' for c in chars)
    return ar/max(1,len(chars))

def pdf_pages(pdf):
    p=subprocess.run(["pdfinfo",str(pdf)],capture_output=True,text=True,check=True)
    m=re.search(r"^Pages:\s*(\d+)",p.stdout,re.M)
    return int(m.group(1)) if m else 0

def ocr_page(pdf,page):
    with tempfile.TemporaryDirectory() as td:
        stem=Path(td)/"page"
        subprocess.run(["pdftoppm","-f",str(page),"-l",str(page),"-singlefile","-jpeg","-r","150",str(pdf),str(stem)],
                       stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,check=True)
        img=str(stem)+".jpg"
        p=subprocess.run(["tesseract",img,"stdout","-l","ara","--psm","6"],capture_output=True,text=True,check=True)
        return p.stdout

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--text",required=True); ap.add_argument("--pdf-dir",required=True); ap.add_argument("--report",required=True)
    a=ap.parse_args()
    extracted=Path(a.text).read_text(encoding="utf-8",errors="replace").split("\f")
    nonempty=[p for p in extracted if len(p.strip())>50]
    extracted_sample=[]
    if nonempty:
        idx=[round(i*(len(nonempty)-1)/9) for i in range(10)]
        extracted_sample=[{"index":i,"chars":len(nonempty[i]),"arabic_ratio":page_score(nonempty[i])} for i in idx]
    avg=statistics.mean([x["arabic_ratio"] for x in extracted_sample]) if extracted_sample else 0

    pdfs=sorted(Path(a.pdf_dir).rglob("*.pdf"))
    ocr_sample=[]
    for pdf in pdfs:
        n=pdf_pages(pdf)
        if not n: continue
        page=max(1,n//2)
        try:
            txt=ocr_page(pdf,page)
            ocr_sample.append({"pdf":pdf.name,"page":page,"chars":len(txt),"arabic_ratio":page_score(txt)})
        except Exception as e:
            ocr_sample.append({"pdf":pdf.name,"page":page,"error":str(e),"chars":0,"arabic_ratio":0})
    ocr_avg=statistics.mean([x["arabic_ratio"] for x in ocr_sample]) if ocr_sample else 0

    report={
      "extracted_text":{"sample_10_pages":extracted_sample,"mean_arabic_ratio":avg},
      "ocr_sample_10_volumes":ocr_sample,
      "ocr_mean_arabic_ratio":ocr_avg,
      "decision":"use_existing_text" if avg>=0.35 else ("ocr_full" if ocr_avg>=0.35 else "ocr_or_source_review"),
      "threshold":0.35
    }
    Path(a.report).write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps(report,ensure_ascii=False))
    if report["decision"]!="use_existing_text":
        raise SystemExit("OCR_FULL_REQUIRED" if report["decision"]=="ocr_full" else "SOURCE_REVIEW_REQUIRED")

if __name__=="__main__":
    main()
