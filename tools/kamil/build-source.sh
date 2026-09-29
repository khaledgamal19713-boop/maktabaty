#!/usr/bin/env bash
set -euo pipefail
mkdir -p build/kamil/source build/kamil/text

PDF_URL="https://saaid.org/book/downloadurl.php?id=11865&type=rar"
TEXT_BASE="https://www.islamarchive.cc/ketab_content/16515/p-"

curl -L --fail --retry 3 --retry-delay 2 "$PDF_URL" -o build/kamil/source/kamil.rar
sha256sum build/kamil/source/kamil.rar | tee build/kamil/source/SHA256.txt

sudo apt-get update -qq
sudo apt-get install -y -qq p7zip-full poppler-utils python3-bs4 python3-requests
7z x -y build/kamil/source/kamil.rar -obuild/kamil/source/extracted

mapfile -t pdfs < <(find build/kamil/source/extracted -type f -iname '*.pdf' | sort)
if [ "${#pdfs[@]}" -eq 0 ]; then echo "No PDF found in source archive"; exit 2; fi

# The authoritative extraction path is the text mirror that identifies itself as the
# same Rushd/Sarsawi edition. The PDF remains a page-image/reference source.
python3 tools/kamil/fetch_text_mirror.py \
  --base-url "$TEXT_BASE" \
  --start 1 --end 30 \
  --out-dir build/kamil/text/sample \
  --manifest build/kamil/source/text-sample-manifest.json

python3 tools/kamil/fetch_text_mirror.py \
  --base-url "$TEXT_BASE" \
  --start 1 --end 9714 \
  --out-dir build/kamil/text/pages \
  --manifest build/kamil/source/text-manifest.json

python3 tools/kamil/assemble_text.py \
  --pages-dir build/kamil/text/pages \
  --output build/kamil/text/book.txt

echo "=== SOURCE TEXT SAMPLE ==="
first=$(find build/kamil/text/pages -type f -name "*.txt" | sort | head -1)
echo "FIRST_TEXT=$first"
sed -n '1,100p' "$first" || true

python3 tools/kamil/quality.py \
  --text build/kamil/text/book.txt \
  --pdf-dir build/kamil/source/extracted \
  --report build/kamil/source/quality.json

python3 - <<'PY'
import json,sys
p=json.load(open("build/kamil/source/quality.json",encoding="utf-8"))
if p.get("decision") != "use_existing_text":
    print("ERROR: text mirror did not produce a usable text source")
    sys.exit(3)
PY
