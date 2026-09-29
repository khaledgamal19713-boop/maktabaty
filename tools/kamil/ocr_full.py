#!/usr/bin/env python3
import argparse, subprocess, tempfile, os, json
from concurrent.futures import ThreadPoolExecutor
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
    args=ap.parse_args()
    pdfs=sorted(Path(args.pdf_dir).rglob("*.pdf"),key=lambda p:int(p.stem) if p.stem.isdigit() else p.name)
    out=Path(args.out_dir); out.mkdir(parents=True,exist_ok=True)
    manifest=[]
    for vi,pdf in enumerate(pdfs,1):
        n=pages(str(pdf))
        vol=vi
        voldir=out/f"v{vol:02d}"; voldir.mkdir(exist_ok=True)
        page_files=[]
        for page in range(1,n+1):
            pf=voldir/f"{page:04d}.txt"
            if not pf.exists():
                ocr_one(str(pdf),page,str(pf))
            page_files.append(pf)
        book=out/f"volume-{vol:02d}.txt"
        with book.open("w",encoding="utf-8") as w:
            for page,pf in enumerate(page_files,1):
                w.write(f"@@SOURCE volume={vol} pdf_page={page}@@
")
                w.write(pf.read_text(encoding="utf-8",errors="replace"))
                w.write("
\f
")
        manifest.append({"volume":vol,"pdf":pdf.name,"pages":n,"text":str(book)})
    Path(args.manifest).write_text(json.dumps({"volumes":manifest},ensure_ascii=False,indent=2),encoding="utf-8")
    with (out/"book.txt").open("w",encoding="utf-8") as w:
        for item in manifest:
            w.write(Path(item["text"]).read_text(encoding="utf-8"))
    print(json.dumps({"volumes":len(manifest),"pages":sum(x["pages"] for x in manifest)},ensure_ascii=False))

if __name__=="__main__":
    main()
