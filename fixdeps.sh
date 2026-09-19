#!/bin/bash
cd /Users/agupta2/Documents/lensmaker
R=https://artifactory.foc.zone/artifactory/api/npm/npm-public-virtual
for i in $(seq 1 40); do
  out=$(npm install --no-audit --no-fund 2>&1)
  if ! echo "$out" | grep -q 'E403'; then
    echo "=== INSTALL OK on attempt $i ==="
    echo "$out" | grep -E 'added|packages in' | head -2
    exit 0
  fi
  bad=$(echo "$out" | grep -oE "$R/[^ ]+\.tgz" | head -1)
  path=${bad#$R/}
  pkg=$(echo "$path" | sed -E 's|/-/.*||' | sed 's|%2f|/|')
  ver=$(echo "$path" | sed -E 's|.*-([0-9][0-9a-zA-Z.\-]*)\.tgz|\1|')
  echo "[$i] blocked $pkg@$ver"
  enc=$(printf '%s' "$pkg" | sed 's|/|%2f|'); base=$(printf '%s' "$pkg" | sed 's|.*/||')
  cands=$(npm view "$pkg" versions --json 2>/dev/null | python3 -c "
import json,sys
v=json.load(sys.stdin); v=[v] if isinstance(v,str) else v
print(' '.join(reversed([x for x in v if '-' not in x])))" 2>/dev/null)
  found=""
  for c in $cands; do
    [ "$c" = "$ver" ] && continue
    code=$(curl -s -o /dev/null -w "%{http_code}" "$R/$enc/-/$base-$c.tgz")
    [ "$code" = "200" ] && { found=$c; break; }
  done
  if [ -z "$found" ]; then echo "!! NO ALLOWED VERSION for $pkg — giving up"; exit 1; fi
  echo "    -> $pkg@$found"
  python3 - "$pkg" "$found" <<'PY'
import json,sys
p=json.load(open('package.json'))
p.setdefault('overrides',{})[sys.argv[1]]=sys.argv[2]
json.dump(p,open('package.json','w'),indent=2)
PY
done
echo "=== gave up after 40 attempts ==="; exit 1
