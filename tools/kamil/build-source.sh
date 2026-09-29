#!/usr/bin/env bash
set -euo pipefail
mkdir -p build/kamil/source build/kamil/text
URL="https://saaid.org/book/downloadurl.php?id=11865&type=rar"
curl -L --fail --retry 3 --retry-delay 2 "$URL" -o build/kamil/source/kamil.rar
sha256sum build/kamil/source/kamil.rar | tee build/kamil/source/SHA256.txt
sudo apt-get update -qq
sudo apt-get install -y -qq p7zip-full poppler-utils tesseract-ocr tesseract-ocr-ara
7z x -y build/kamil/source/kamil.rar -obuild/kamil/source/extracted
mapfile -t pdfs < <(find build/kamil/source/extracted -type f -iname '*.pdf' | sort)
if [ "${#pdfs[@]}" -eq 0 ]; then echo "No PDF found in source archive"; exit 2; fi
: > build/kamil/text/book.txt
for pdf in "${pdfs[@]}"; do
  base=$(basename "$pdf" .pdf)
  pdftotext -layout "$pdf" "build/kamil/text/$base.txt" || true
  cat "build/kamil/text/$base.txt" >> build/kamil/text/book.txt
  printf '\f\n' >> build/kamil/text/book.txt
done
python3 tools/kamil/quality.py --text build/kamil/text/book.txt --pdf-dir build/kamil/source/extracted --report build/kamil/source/quality.json
