#!/usr/bin/env python3
import importlib.util, json, tempfile
from pathlib import Path

spec=importlib.util.spec_from_file_location("kamil_parser",Path(__file__).with_name("parser.py"))
m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)

def check(cond,msg):
    if not cond: raise AssertionError(msg)

# Source-format boundary tests taken from the public index format:
h=m.is_probable_translation_heading("[2] أحمد بن ميسرة أبو صالح",None)
check(h and h[0]==2 and h[1]=="أحمد بن ميسرة أبو صالح","bracketed biography heading")

# Numbered records occur both as [n] and n - forms.
blocks=m.split_numbered_blocks([
    "[1] قال ابن معين: ليس بشيء.",
    "[2] حدثنا فلان عن فلان قال رسول الله صلى الله عليه وسلم: نص.",
    "تكملة السجل",
    "[3] عن ابن عمر قال: نص."
])
check([x["number"] for x in blocks]==[1,2,3],"numbered records")
check("تكملة السجل" in blocks[1]["text"],"multiline numbered record")

check(m.classify_block(blocks[0]["text"])[0]=="critic","critic classification")
check(m.classify_block(blocks[1]["text"])[0]=="مرفوع","marfu classification")
check(m.classify_block(blocks[2]["text"])[0]=="موقوف","mawquf classification")

print(json.dumps({"passed":4},ensure_ascii=False))
