#!/usr/bin/env python3
import argparse,json,re,hashlib,random
from pathlib import Path

def norm(s):
    import unicodedata
    s=unicodedata.normalize("NFKC",s)
    s=re.sub(r"[\u064B-\u065F\u0670\u06D6-\u06ED]","",s)
    s=re.sub(r"\s+"," ",s)
    return s.strip()

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--book",required=True); ap.add_argument("--gold",required=True)
    ap.add_argument("--report",required=True)
    args=ap.parse_args()
    book=json.loads(Path(args.book).read_text(encoding="utf-8"))
    gold=json.loads(Path(args.gold).read_text(encoding="utf-8"))
    trs=book.get("translations",[])
    failures=[]; ambiguous=[]
    orders=[x.get("order") for x in trs]
    if len(trs)!=len(set(orders)): failures.append("duplicate_translation_order")
    if any(x is None for x in orders): failures.append("translation_without_order")
    for tr in trs:
        if not tr.get("name"): failures.append(f"translation_without_name:{tr.get('id')}")
        for c in tr.get("critics",[]):
            if c.get("type")=="unknown" or c.get("confidence",1)<0.8:
                ambiguous.append({"translation":tr["id"],"number":c.get("number"),"kind":"classification","confidence":c.get("confidence")})
        for g in tr.get("hadith_groups",[]):
            if g.get("grouping_confidence",1)<0.8:
                ambiguous.append({"translation":tr["id"],"numbers":g.get("numbers"),"kind":"grouping","confidence":g.get("grouping_confidence")})
    gold_ok=False
    if gold.get("status")=="READY":
        if len(gold.get("records",[]))<20: failures.append("gold_has_less_than_20_records")
        else:
            by={r["order"]:r for r in gold["records"]}
            gold_ok=True
            for tr in trs:
                if tr["order"] in by:
                    g=by[tr["order"]]
                    if norm(tr.get("name",""))!=norm(g.get("name","")): failures.append(f"gold_name:{tr['order']}")
                    if norm(tr.get("intro",""))!=norm(g.get("intro","")): failures.append(f"gold_intro:{tr['order']}"); gold_ok=False
                    if json.dumps(tr.get("critics",[]),ensure_ascii=False,sort_keys=True)!=json.dumps(g.get("critics",[]),ensure_ascii=False,sort_keys=True):
                        # Gold records may use exact block text but parser metadata can evolve; compare text payloads.
                        gt=[x.get("text","") for x in g.get("critics",[])]
                        bt=[x.get("text","") for x in tr.get("critics",[])]
                        if gt!=bt: failures.append(f"gold_critics:{tr['order']}"); gold_ok=False
            if not gold_ok: failures.append("gold_mismatch")
    else:
        failures.append("gold_pending_human_audit")
    report={"translations":len(trs),"ambiguous":ambiguous,"failures":failures,
            "gates":{"A_source":True,"B":not failures,"C":False,"D":False}}
    Path(args.report).write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps(report,ensure_ascii=False))
    raise SystemExit(1 if failures else 0)

if __name__=="__main__":
    main()
