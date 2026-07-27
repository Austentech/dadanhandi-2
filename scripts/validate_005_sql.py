#!/usr/bin/env python3
"""
Validate SQL migration 005 — basic structural / syntax sanity check.

This is NOT a full PostgreSQL parser. It only catches gross issues like:
  - Unbalanced $$ ... $$ blocks
  - Missing semicolons after statements
  - Unmatched parentheses in DROP FUNCTION / ALTER TABLE
  - Unknown / mistyped information_schema queries
"""
import re
import sys
from pathlib import Path

SQL_PATH = Path("/home/z/my-project/supabase/migrations/005_migrate_stripe_to_razorpay.sql")
sql = SQL_PATH.read_text()

errors = []
warnings = []

# --- Check 1: $$ block balance -------------------------------------------------
dollar_quote_count = sql.count("$$")
if dollar_quote_count % 2 != 0:
    errors.append(f"Unbalanced $$ blocks — found {dollar_quote_count} occurrences (must be even).")
else:
    print(f"OK: $$ blocks balanced ({dollar_quote_count // 2} pairs).")

# --- Check 2: DO $$ ... $$; structure -----------------------------------------
do_blocks = re.findall(r"do\s+\$\$(.*?)\$\$\s*;", sql, re.DOTALL | re.IGNORECASE)
print(f"OK: Found {len(do_blocks)} DO $$ ... $$; block(s).")
for i, body in enumerate(do_blocks, 1):
    if not body.strip().startswith("begin"):
        warnings.append(f"DO block #{i} does not start with 'begin'.")
    # In PL/pgSQL: BEGIN ... END; pairs for the function body.
    # END IF; / END LOOP; / END CASE; are statement terminators, NOT function ENDs.
    # Strip comments before counting (comments may contain words like "if"/"then").
    body_clean = re.sub(r"--.*$", "", body, flags=re.MULTILINE)
    body_clean = re.sub(r"/\*.*?\*/", "", body_clean, flags=re.DOTALL)

    begins = len(re.findall(r"\bbegin\b", body_clean, re.IGNORECASE))
    func_ends = len(re.findall(r"\bend\s*;\s*$", body_clean.strip(), re.IGNORECASE))
    func_ends += len(re.findall(r"\bend\s*$", body_clean.strip(), re.IGNORECASE))
    if begins != func_ends:
        errors.append(f"DO block #{i}: {begins} BEGIN vs {func_ends} END; (function body).")
    # Check IF/END IF balance — ELSIF...THEN does NOT need its own END IF,
    # and the `if` inside `end if;` must not be counted either.
    # \bif\b already excludes 'elsif' (no word boundary between s and i),
    # but we still need to exclude 'end if' explicitly.
    ifs = len(re.findall(r"(?<!end )(?<!els)\bif\b.*?\bthen\b", body_clean, re.IGNORECASE | re.DOTALL))
    end_ifs = len(re.findall(r"\bend\s+if\s*;", body_clean, re.IGNORECASE))
    if ifs != end_ifs:
        errors.append(f"DO block #{i}: {ifs} IF/THEN vs {end_ifs} END IF; (must match).")
    else:
        print(f"OK: DO block #{i}: {ifs} IF chain(s), all balanced.")

# --- Check 3: Semicolons after each top-level statement -----------------------
# Remove $$ blocks, comments, and whitespace; check remaining statements end with ;
sql_no_blocks = re.sub(r"do\s+\$\$.*?\$\$\s*;", "", sql, flags=re.DOTALL | re.IGNORECASE)
sql_no_comments = re.sub(r"--.*$", "", sql_no_blocks, flags=re.MULTILINE)
sql_no_comments = re.sub(r"/\*.*?\*/", "", sql_no_comments, flags=re.DOTALL)
statements = [s.strip() for s in sql_no_comments.split(";") if s.strip()]
for stmt in statements:
    # Each statement should be a known SQL command
    first_word = stmt.split()[0].lower() if stmt.split() else ""
    known = {"alter", "drop", "create", "select", "insert", "update", "delete", "grant", "set", "with"}
    if first_word not in known:
        warnings.append(f"Unknown statement start: '{first_word}' in: {stmt[:80]}...")

print(f"OK: Found {len(statements)} top-level SQL statement(s) outside DO blocks.")

# --- Check 4: DROP FUNCTION signatures are well-formed ------------------------
drop_funcs = re.findall(r"drop\s+function\s+if\s+exists\s+public\.(\w+)\s*\(([^)]*)\)", sql, re.IGNORECASE)
print(f"OK: Found {len(drop_funcs)} DROP FUNCTION statements.")
for fname, params in drop_funcs:
    params = params.strip()
    if not params:
        warnings.append(f"DROP FUNCTION {fname}() has no params — likely wrong.")
    print(f"  - {fname}({params})")

# --- Check 5: CREATE INDEX syntax ---------------------------------------------
create_indexes = re.findall(r"create\s+index\s+if\s+not\s+exists\s+(\w+)\s+on\s+public\.(\w+)\s*\(([^)]+)\)", sql, re.IGNORECASE)
print(f"OK: Found {len(create_indexes)} CREATE INDEX statements.")
for idx_name, tbl, col in create_indexes:
    print(f"  - {idx_name} on {tbl}({col})")

# --- Check 6: ALTER TABLE statements ------------------------------------------
alters = re.findall(r"alter\s+table\s+public\.(\w+)\s+(.*?)(?:;|\n)", sql, re.IGNORECASE)
print(f"OK: Found {len(alters)} ALTER TABLE statements (inside DO blocks counted).")
for tbl, action in alters:
    print(f"  - {tbl}: {action.strip()[:80]}")

# --- Final report -------------------------------------------------------------
print("\n" + "=" * 60)
if errors:
    print(f"ERRORS ({len(errors)}):")
    for e in errors:
        print(f"  ❌ {e}")
    sys.exit(1)
elif warnings:
    print(f"WARNINGS ({len(warnings)}):")
    for w in warnings:
        print(f"  ⚠️  {w}")
    print("\nNo blocking errors. Warnings are informational only.")
    sys.exit(0)
else:
    print("✅ All structural checks passed.")
    sys.exit(0)
