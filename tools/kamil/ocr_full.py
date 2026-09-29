#!/usr/bin/env python3
import argparse, subprocess, tempfile, os, json
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

def ocr_one(pdf,page,outfile):
    with tempfile.TemporaryDirectory() as td:
        stem=str(Path(td)/"page")
        subprocess.run(["pdftoppm","-f",str(page),"-l",str(page),"-singlefile","-jpeg","-r","150",pdf,stem],
                       stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,check=True)
        img=stem+".jpg"
        p=subprocess.run(["tesseract",img,"stdout","-l","ara","--psm","6"],capture_output=True,text=True,check=True)
        Path(outfile).write_text(p.stdout,encoding="utf-8")

def pages(pdf):
    p=subprocess.run(["pdfinfo",pdf],capture_output=True,text=True,check=True)
    for line in p.stdout.splitlines():
        if line.startswith("Pages:"):
            return int(line.split(":",1)[1].strip())
    raise RuntimeError("PDF page count unavailable: "+pdf)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--pdf-dir",required=True)
    ap.add_argument("--out-dir",required=True)
    ap.add_argument("--manifest",required=True)
    ap.add_argument("--workers",type=int,default=min(4,os.cpu_count() or 1))
    args=ap.parse_args()
    pdfs=sorted(Path(args.pdf_dir).rglob("*.pdf"),key=lambda p:int(p.stem) if p.stem.isdigit() else p.name)
    out=Path(args.out_dir); out.mkdir(parents=True,exist_ok=True)
    manifest=[]
    for vi,pdf in enumerate(pdfs,1):
        n=pages(str(pdf))
        vol=vi
        voldir=out/f"v{vol:02d}"; voldir.mkdir(exist_ok=True)
        tasks=[]
        with ThreadPoolExecutor(max_workers=max(1,args.workers)) as ex:
            for page in range(1,n+1):
                pf=voldir/f"{page:04d}.txt"
                if not pf.exists():
                    tasks.append(ex.submit(ocr_one,str(pdf),page,str(pf)))
            for fut in as_completed(tasks):
                fut.result()
        page_files=[voldir/f"{page:04d}.txt" for page in range(1,n+1)]
        book=out/f"volume-{vol:02d}.txt"
        with book.open("w",encoding="utf-8") as w:
            for page,pf in enumerate(page_files,1):
                if not pf.exists():
                    raise RuntimeError(f"Missing OCR page: volume={vol} page={page}")
                w.write(f"@@SOURCE volume={vol} pdf_page={page}@@\n")
                w.write(pf.read_text(encoding="utf-8",errors="replace"))
                w.write("\n\f\n")
        manifest.append({"volume":vol,"pdf":pdf.name,"pages":n,"text":str(book)})
        print(json.dumps({"volume":vol,"pages":n,"workers":args.workers},ensure_ascii=False),flush=True)
    Path(args.manifest).write_text(json.dumps({"volumes":manifest},ensure_ascii=False,indent=2),encoding="utf-8")
    with (out/"book.txt").open("w",encoding="utf-8") as w:
        for item in manifest:
            w.write(Path(item["text"]).read_text(encoding="utf-8"))
    print(json.dumps({"volumes":len(manifest),"pages":sum(x["pages"] for x in manifest)},ensure_ascii=False))

if __name__=="__main__":
    main()
