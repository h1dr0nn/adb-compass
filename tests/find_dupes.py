import re

with open(r'd:\Projects\Projects\adb-compass\src\translations.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

en_start = -1
vi_start = -1
for i, line in enumerate(lines):
    if 'en: {' in line:
        en_start = i
    if 'vi: {' in line:
        vi_start = i

def find_dupes(start_line, end_line, label):
    seen = {}
    for i in range(start_line + 1, end_line):
        line = lines[i]
        match = re.search(r'^\s+([a-zA-Z0-9_]+):', line)
        if match:
            key = match.group(1)
            if key in seen:
                print(f"Duplicate key found in '{label}': {key} at line {i+1} (previously at line {seen[key]+1})")
            seen[key] = i

find_dupes(en_start, vi_start, 'en')
find_dupes(vi_start, len(lines), 'vi')
