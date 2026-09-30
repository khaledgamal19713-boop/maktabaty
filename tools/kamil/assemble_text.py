#!/usr/bin/env python3
import argparse
from pathlib import Path

ap=argparse.ArgumentParser()
ap.add_argument("--pages-dir",required=True)
ap.add_argument("--output",required=True)
a=ap.parse_args()
pages=sorted(Path(a.pages_dir).rglob("*.txt"))
if not pages:
    raise SystemExit("No text pages found")
with open(a.output,"w",encoding="utf-8") as out:
    for p in pages:
        out.write(p.read_text(encoding="utf-8",errors="replace"))
        out.write("\n\f\n")
print(f"assembled {len(pages)} pages")
