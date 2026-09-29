#!/usr/bin/env python3
import argparse,json,re,subprocess,statistics
from pathlib import Path

def page_score(s):
    chars=[c for c in s if c.strip()]
    ar=sum(('\u0600'<=c<='\u06ff') for c in chars)
    return ar/max(1,len(chars))

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--text",required=True); ap.add_argument("--pdf-dir",required=True); ap.add_argument("--report",required=True)
    a=ap.parse_args()
    pages=Path(a.text).read_text(encoding="utf-8",errors="replace").split("\f")
    nonempty=[p for p in pages if len(p.strip())>50]
    sample=[]
    if nonempty:
        idx=[round(i*(len(nonempty)-1)/9) for i in range(10)]
        sample=[{"index":i,"chars":len(nonempty[i]),"arabic_ratio":page_score(nonempty[i])} for i in idx]
    avg=statistics.mean(x["arabic_ratio"] for x in sample) if sample else 0
    report={"pages":len(nonempty),"sample_10_pages":sample,"mean_arabic_ratio":avg,
            "decision":"text_layer" if avg>=0.35 else "ocr_required"}
    if avg<0.35:
        # OCR the ten sampled pages; this is a diagnostic, not silent replacement.
        report["ocr_test"]="not_run_in_parser_image_mode"
        raise SystemExit("OCR_REQUIRED: extracted text quality below threshold")
    Path(a.report).write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps(report,ensure_ascii=False))
if __name__=="__main__": main()
