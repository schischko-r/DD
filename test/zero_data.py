#!/usr/bin/env python3
"""Replace all numeric data values in the _ALL_DATA JSON with 0."""

import json
import sys
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Default input/output (can be overridden via CLI args)
INPUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(SCRIPT_DIR, "Воронка_2ГИС_2026-07-31.html")
OUTPUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(
    os.path.dirname(INPUT),
    os.path.splitext(os.path.basename(INPUT))[0] + "_zeroed" + os.path.splitext(os.path.basename(INPUT))[1]
)

with open(INPUT, "r", encoding="utf-8") as f:
    html = f.read()

# Locate the JSON start — support both `var _ALL_DATA` and `window._ALL_DATA`
marker = "window._ALL_DATA = " if "window._ALL_DATA = " in html else "var _ALL_DATA = "
idx_start = html.index(marker) + len(marker)

# Walk forward counting braces to find the matching closing brace
depth = 0
in_string = False
escape = False
json_end = -1

for i, ch in enumerate(html[idx_start:], start=idx_start):
    if escape:
        escape = False
        continue
    if ch == "\\" and in_string:
        escape = True
        continue
    if ch == '"' and not escape:
        in_string = not in_string
        continue
    if not in_string:
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                json_end = i + 1
                break

if json_end == -1:
    print("ERROR: Could not find end of _ALL_DATA JSON", file=sys.stderr)
    sys.exit(1)

raw_json = html[idx_start:json_end]
data = json.loads(raw_json)


def zero_numbers(obj):
    """Zero all numeric values."""
    if isinstance(obj, dict):
        return {k: zero_numbers(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [zero_numbers(v) for v in obj]
    elif isinstance(obj, (int, float)):
        return 0
    else:
        return obj


def replace_event_actions(obj):
    """Replace event_actions arrays with ['x']."""
    if isinstance(obj, dict):
        return {k: ["x"] if k == "event_actions" else replace_event_actions(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [replace_event_actions(v) for v in obj]
    else:
        return obj


# Zero all numbers in the entire data structure
data = zero_numbers(data)
# Replace event_actions strings with "x"
data = replace_event_actions(data)

# Serialize back (no extra whitespace, matching original style)
new_json = json.dumps(data, ensure_ascii=False, indent=None, separators=(",", ":"))

# Replace just the JSON portion in the HTML
new_html = html[:idx_start] + new_json + html[json_end:]

with open(OUTPUT, "w", encoding="utf-8") as f:
    f.write(new_html)

print(f"Done. Input:  {INPUT}")
print(f"Output: {OUTPUT}")
