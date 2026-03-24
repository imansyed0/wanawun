#!/usr/bin/env python3
"""
Parse the Kashmiri glossary PDF (extracted text) into structured JSON.

Source: Braj B. Kachru - An Introduction to Spoken Kashmiri (1973)
Input:  /tmp/glossary_full.txt (full text extraction from PDF)
Output: /Users/imans/wanawun/data/glossary.json

Parsing strategy:
The PDF extraction preserves blank lines between K-word and its E-meaning,
but NOT between E-meaning and the next K-word. Using blank-line groups:
- 2-line groups: [E-meaning-of-prev, K-word-of-next]
- 1-line groups: either standalone E or standalone K (context dependent)
- 3+ line groups: multi-line entry with POS continuation or text wrap
"""

import json
import re
import uuid
from pathlib import Path
from collections import Counter

INPUT_PATH = Path("/tmp/glossary_full.txt")
OUTPUT_PATH = Path("/Users/imans/wanawun/data/glossary.json")

# ---------------------------------------------------------------------------
# Header / boilerplate patterns
# ---------------------------------------------------------------------------
SKIP_PATTERNS = [
    re.compile(r"^\s*An Introduction to Spoken Kashmiri", re.IGNORECASE),
    re.compile(r"^\s*by Braj B\. Kachru", re.IGNORECASE),
    re.compile(r"^\s*Kashmir News Network", re.IGNORECASE),
    re.compile(r"^\s*http://koshur\.org", re.IGNORECASE),
    re.compile(r"^\s*--- Page \d+ ---\s*$"),
    re.compile(r"^\s*\d+-\d+\s*$"),
]

POS_RE = re.compile(r"\(([^)]*)\)")


def has_kashmiri_markers(t: str) -> bool:
    """Check if text contains Kashmiri transliteration markers."""
    if ";" in t:
        return True
    if "?" in t and t.strip() != "?":
        return True
    if re.search(r"\w:\w", t):
        return True
    if re.search(r"[a-z]0[a-z]", t, re.I):
        return True
    return False


# ---------------------------------------------------------------------------
# Category rules
# ---------------------------------------------------------------------------
CATEGORY_RULES = [
    ("family", re.compile(
        r"\b(mother|father|brother|sister|son|daughter|wife|husband|uncle|aunt|"
        r"nephew|niece|cousin|grandfather|grandmother|child|children|"
        r"baby|girl|boy|man|woman|family|relative|parent|person|people|friend|"
        r"guest|neighbour|neighbor|elder|bride|groom|wedding|married|"
        r"widow|orphan)\b", re.I)),
    ("body", re.compile(
        r"\b(head|hair|eye|ear|nose|mouth|lip|tongue|tooth|teeth|face|neck|"
        r"shoulder|arm|hand|finger|thumb|nail|chest|stomach|back|leg|foot|feet|"
        r"knee|toe|skin|bone|blood|heart|brain|body|beard|moustache|forehead)\b", re.I)),
    ("food", re.compile(
        r"\b(food|eat|drink|rice|bread|meat|fish|milk|water|tea|sugar|salt|"
        r"butter|oil|fruit|vegetable|apple|mango|grape|onion|potato|tomato|"
        r"egg|chicken|lamb|cook|meal|breakfast|lunch|dinner|hungry|thirsty|"
        r"yogurt|cheese|flour|spice|cardamom|saffron|sweet|bitter|sour|"
        r"pear|plum|walnut|almond|chestnut|turnip|spinach|radish|lotus|"
        r"cream|ghee|cake|biscuit|jam|snack|samosa|ginger|pepper|candy)\b", re.I)),
    ("nature", re.compile(
        r"\b(sun|moon|star|sky|cloud|rain|snow|wind|storm|river|lake|"
        r"mountain|hill|valley|forest|tree|flower|leaf|grass|garden|field|"
        r"earth|soil|stone|rock|sea|ocean|spring|summer|winter|autumn|"
        r"weather|cold|hot|warm|cool|ice|fire|light|dark|shadow|season|"
        r"animal|bird|horse|cow|sheep|goat|dog|cat|deer|bear|snake|"
        r"insect|bee|butterfly|crow|sparrow|pigeon|parrot|peacock|rooster|"
        r"hen|chick|ox|bull|donkey|camel|lion|tiger|wolf|fox|rabbit|mouse|"
        r"frog|ant|fly|mosquito|worm|oriole|nightingale|waterfall|"
        r"charcoal|firewood)\b", re.I)),
    ("places", re.compile(
        r"\b(place|city|town|village|country|house|home|room|door|window|"
        r"wall|roof|floor|road|street|bridge|market|shop|school|college|"
        r"university|hospital|temple|mosque|church|office|station|airport|"
        r"garden|park|Kashmir|Srinagar|India|Delhi|America|England|"
        r"Anantnag|Tangmarg|Achabal|Gulmarg|Pahalgam|Islamabad|"
        r"Dal|Nagin|Nishat|Shalimar|Wular|Pirpanchal|Amarnath|"
        r"Amirakadal|prison|hotel|restaurant|cave|region|area|"
        r"Sopore|Pampur|Bandipora)\b", re.I)),
    ("numbers", re.compile(
        r"\b(one|two|three|four|five|six|seven|eight|nine|ten|"
        r"eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|"
        r"eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|"
        r"eighty|ninety|hundred|thousand|million|first|second|third|"
        r"fourth|fifth|half|quarter|dozen|pair)\b", re.I)),
    ("time", re.compile(
        r"\b(time|day|night|morning|evening|afternoon|hour|minute|"
        r"week|month|year|today|tomorrow|yesterday|now|then|soon|later|"
        r"always|never|often|sometimes|early|late|before|after|clock|"
        r"Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|"
        r"January|February|March|April|June|July|August|September|"
        r"October|November|December|dawn|dusk|midnight|noon|"
        r"lunar|calendar|birthday|holiday|festival)\b", re.I)),
    ("household", re.compile(
        r"\b(book|pen|paper|table|chair|bed|blanket|pillow|cloth|clothes|"
        r"shirt|shoe|hat|cap|bag|box|pot|cup|glass|plate|spoon|knife|"
        r"key|lock|lamp|candle|mirror|comb|soap|towel|basket|carpet|"
        r"umbrella|fan|needle|thread|rope|stick|wood|coal|"
        r"newspaper|letter|money|coin|price|ring|watch|spectacles|"
        r"telephone|radio|television|camera|bicycle|car|bus|train|"
        r"boat|ship|airplane|medicine|broom|bucket|barge|pebble|"
        r"staircase|step|ladder|volume|utensil)\b", re.I)),
    ("actions", re.compile(
        r"\b(to )\b", re.I)),
    ("descriptions", re.compile(
        r"\b(big|small|long|short|tall|wide|narrow|thick|thin|heavy|"
        r"fast|slow|new|old|young|good|bad|beautiful|ugly|"
        r"clean|dirty|wet|dry|hard|soft|sharp|dull|strong|weak|"
        r"rich|poor|happy|sad|angry|afraid|brave|kind|cruel|wise|"
        r"foolish|clever|stupid|true|false|right|wrong|same|different|"
        r"full|empty|whole|broken|near|far|deep|shallow|"
        r"high|low|loud|quiet|round|straight|flat|smooth|rough|"
        r"red|blue|green|yellow|white|black|brown|pink|purple|orange|"
        r"handsome|pretty|lovely|forceful|powerful|"
        r"famous|alone|blind|deaf|dumb|lame|sick|healthy|fat|"
        r"ready|sure|able|certain|lucky|important|free|"
        r"abundant|auspicious|complete|enough|much|more|less|"
        r"inside|outside|above|below|actual|real|"
        r"separate|difficult|favourite|dear|necessary|"
        r"illiterate|immortal|sufficient|easy|sacred|"
        r"sky.blue|golden|bright|dark|entire|"
        r"there|here|every|which|when|how)\b", re.I)),
    ("greetings", re.compile(
        r"\b(hello|goodbye|please|thank|sorry|welcome|greet|"
        r"congratulat|bless|prayer|pray)\b", re.I)),
    ("clothing", re.compile(
        r"\b(wear|dress|sari|shawl|turban|pheran|coat|jacket|trousers|"
        r"socks|boots|sandal|silk|cotton|wool|embroider|pashmina|"
        r"ringshawl)\b", re.I)),
    ("education", re.compile(
        r"\b(school|study|exam|class|student|teacher|lesson|"
        r"language|English|Hindi|Urdu|Sanskrit|Kashmiri|Persian|"
        r"Dogri|education|poetry|poet|literature)\b", re.I)),
]


def assign_category(english: str) -> str:
    for cat, pattern in CATEGORY_RULES:
        if pattern.search(english):
            return cat
    return "other"


def assign_difficulty(english: str, kashmiri: str, pos: str, is_phrase: bool) -> int:
    if is_phrase:
        return 3
    if pos in ("verb", "adjective", "adverb"):
        return 2
    abstract_markers = re.compile(
        r"\b(ness$|tion$|ment$|ity$|ance$|ence$|dom$|ship$|ism$|hood$|"
        r"acquaintance|darkness|life|death|need|necessity|"
        r"strength|weakness|beauty|wisdom|knowledge|truth|freedom|"
        r"peace|war|love|hate|fear|hope|faith|trust|doubt|"
        r"power|force|energy|age|reason|purpose|cause|"
        r"permission|direction|condition|situation|longing|"
        r"craftsmanship|conversation|incarnation|climate|"
        r"excellence|prejudice|punishment|influence|application)\b", re.I)
    if abstract_markers.search(english):
        return 3
    return 1


def normalize_pos(raw: str) -> tuple:
    raw_lower = raw.lower().strip()
    tokens = [t.strip().rstrip(".") for t in raw_lower.split(",")]
    gender = None
    number = None
    pos = "noun"
    for t in tokens:
        t = t.strip()
        if t in ("f", "fem", "feminine"):
            gender = "f"
        elif t in ("m", "masc", "masculine"):
            gender = "m"
        elif t in ("sing", "singular"):
            number = "singular"
        elif t in ("plu", "plural"):
            number = "plural"
        elif t in ("adj", "adjective"):
            pos = "adjective"
        elif t in ("adv", "adverb"):
            pos = "adverb"
        elif t in ("v", "verb"):
            pos = "verb"
        elif t in ("pro", "pronoun"):
            pos = "pronoun"
        elif t in ("conj", "conjunction"):
            pos = "conjunction"
        elif t in ("inter", "interrogative"):
            pos = "interrogative"
        elif t in ("emph", "emphatic"):
            pos = "emphatic"
        elif t in ("inf", "infinitive"):
            pos = "verb"
        elif t in ("part", "participle"):
            pos = "verb"
        elif t in ("hon", "honorific"):
            pos = "honorific"
        elif t in ("n", "noun"):
            pos = "noun"
    return pos, gender, number


def should_skip(line: str) -> bool:
    stripped = line.strip()
    if not stripped:
        return False  # Keep blank lines for grouping!
    for pat in SKIP_PATTERNS:
        if pat.match(stripped):
            return True
    return False


def is_header_line(line: str) -> bool:
    """Check if line is a header/boilerplate (but not blank)."""
    stripped = line.strip()
    if not stripped:
        return False
    for pat in SKIP_PATTERNS:
        if pat.match(stripped):
            return True
    if re.match(r"^\d+$", stripped):
        return True
    return False


def is_alphabet_divider(line: str) -> bool:
    s = line.strip()
    if s == "?":
        return True
    if len(s) == 1 and s.isalpha():
        return True
    return False


def is_pos_line(line: str) -> bool:
    """Check if line is a standalone POS like (m., sing.)."""
    s = line.strip()
    if s.startswith("(") and s.endswith(")"):
        inner = s[1:-1].lower()
        pos_tokens = {"f", "m", "sing", "plu", "adj", "adv", "v", "n",
                      "hon", "pro", "conj", "emph", "inter", "inf", "part"}
        parts = [p.strip().rstrip(".") for p in inner.split(",")]
        if all(p in pos_tokens for p in parts):
            return True
    return False


def extract_sections(text: str):
    lines = text.split("\n")
    sec1_start = sec2_start = sec3_start = sec4_start = None
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped == "1.0" and sec1_start is None:
            for j in range(i + 1, min(i + 5, len(lines))):
                if "KASHMIRI-ENGLISH" in lines[j]:
                    sec1_start = j + 1
                    break
        elif stripped == "2.0" and sec2_start is None:
            for j in range(i + 1, min(i + 5, len(lines))):
                if "ENGLISH-KASHMIRI" in lines[j]:
                    sec2_start = j + 1
                    break
        elif stripped == "3.0" and sec3_start is None:
            for j in range(i + 1, min(i + 5, len(lines))):
                if "LOAN WORDS" in lines[j].upper():
                    sec3_start = j + 1
                    break
        elif stripped == "4.0" and sec4_start is None:
            sec4_start = i
    return (
        lines[sec1_start:sec2_start] if sec1_start and sec2_start else [],
        lines[sec2_start:sec3_start] if sec2_start and sec3_start else [],
        lines[sec3_start:sec4_start] if sec3_start and sec4_start else [],
    )


def clean_and_group(raw_lines: list) -> list:
    """
    Remove headers/page markers but preserve blank lines for grouping.
    Then group consecutive non-blank lines separated by blank(s).
    Returns list of groups, where each group is a list of lines.
    """
    # Remove header lines but keep blanks
    cleaned = []
    for line in raw_lines:
        stripped = line.strip()
        if is_header_line(line):
            continue
        if is_alphabet_divider(stripped):
            continue
        cleaned.append(stripped)

    # Handle POS continuation lines: merge with previous non-blank
    processed = []
    for line in cleaned:
        if is_pos_line(line) and processed and processed[-1] != "":
            processed[-1] = processed[-1] + " " + line
        else:
            processed.append(line)

    # Merge lines with unmatched parentheses (across blanks too)
    merged = []
    i = 0
    while i < len(processed):
        line = processed[i]
        if line != "":
            opens = line.count("(")
            closes = line.count(")")
            if opens > closes:
                # Look ahead for the closing line (skip blanks)
                j = i + 1
                while j < len(processed) and processed[j] == "":
                    j += 1
                if j < len(processed):
                    combined = line + " " + processed[j]
                    if combined.count("(") <= combined.count(")"):
                        merged.append(combined)
                        i = j + 1
                        continue
        merged.append(line)
        i += 1

    # Merge text within groups: handle cases where a line ending with
    # an incomplete quote is followed by a continuation in the same group.
    # This happens when both lines are consecutive non-blank.
    merged2 = []
    i = 0
    while i < len(merged):
        line = merged[i]
        if line != "" and i + 1 < len(merged) and merged[i + 1] != "":
            # Consecutive non-blank lines: check for text continuation
            next_line = merged[i + 1]
            if ((line.endswith("'to") or line.endswith("\u2018to") or
                 line.endswith("'of") or line.endswith("\u2018of")) and
                    len(next_line) < 25 and not has_kashmiri_markers(next_line)):
                merged2.append(line + " " + next_line)
                i += 2
                continue
            # Fragment ending with ) without opening (
            if (next_line.endswith(")") and "(" not in next_line and
                    len(next_line) < 20 and not has_kashmiri_markers(next_line)):
                merged2.append(line + " " + next_line)
                i += 2
                continue
        merged2.append(line)
        i += 1

    # Group by blank lines
    groups = []
    current = []
    for line in merged2:
        if line == "":
            if current:
                groups.append(current)
                current = []
        else:
            current.append(line)
    if current:
        groups.append(current)

    return groups


def parse_section1_groups(groups: list) -> list:
    """
    Parse Kashmiri-English section using blank-line groups.

    Pattern: groups alternate. For 2-line groups [E_prev, K_next]:
    - First line = English meaning of previous K word
    - Second line = Next Kashmiri word

    For 1-line groups: either standalone E (after prev K) or standalone K (before next E).
    The trick: the FIRST group's first line is always K (first Kashmiri word).
    After that, every group's first line is E and optional second line is K.

    So we build a chain: K1, [E1, K2], [E2, K3], [E3, K4], ...
    """
    entries = []
    pending_k = None  # The current Kashmiri word waiting for its English meaning

    for gi, group in enumerate(groups):
        if gi == 0:
            # First group: all lines are K words (usually just 1)
            # Only the last line matters as the first K entry
            pending_k = group[-1]
            continue

        # In Section 1 (K-E), each group after the first has:
        # - Line 0: English meaning of pending_k
        # - Line 1 (if present): Next Kashmiri word
        # - Lines 2+ (if present): Additional content (rare, usually
        #   multi-line entries or text wrap)

        if pending_k is not None:
            if len(group) == 1:
                # Just English, no next K
                entries.append((pending_k, group[0]))
                pending_k = None
            elif len(group) == 2:
                # Normal case: [English, next_K]
                entries.append((pending_k, group[0]))
                pending_k = group[1]
            elif len(group) == 3:
                # Could be: [E, K, continuation_of_K]
                # or: [E_line1, E_line2_continuation, K]
                # Heuristic: if line 2 looks like it continues line 1 (text wrap),
                # merge lines 0-1 as E, line 2 is K
                entries.append((pending_k, group[0]))
                # Line 1 is next K, line 2 might continue it or be separate
                pending_k = group[1]
                # If group[2] looks like part of the K (POS or modifier)
                if group[2].startswith("(") or has_kashmiri_markers(group[2]):
                    pending_k = pending_k + " " + group[2]
                else:
                    # It's a separate E for this K
                    entries.append((pending_k, group[2]))
                    pending_k = None
            elif len(group) >= 4:
                # Process pairs: E, K, E, K, ...
                entries.append((pending_k, group[0]))
                pending_k = group[1]
                # Process remaining as pairs
                for idx in range(2, len(group), 2):
                    if idx + 1 < len(group):
                        entries.append((pending_k, group[idx]))
                        pending_k = group[idx + 1]
                    else:
                        entries.append((pending_k, group[idx]))
                        pending_k = None

        elif len(group) == 1:
            # No pending K and 1-line group: this is a new K word
            pending_k = group[0]
        elif len(group) >= 2:
            # No pending K, multi-line group: first is K, rest are E,K,...
            pending_k = group[0]
            for idx in range(1, len(group), 2):
                if idx < len(group):
                    entries.append((pending_k, group[idx]))
                    pending_k = group[idx + 1] if idx + 1 < len(group) else None

    return entries


def parse_section2_groups(groups: list) -> list:
    """
    Parse English-Kashmiri section using blank-line groups.

    Structure: E1, [K1, E2], [K2, E3], ...
    Group 0 = [E1], Group n = [K_prev, E_next]
    For 1-line groups: standalone K (translation for pending E) or standalone E.
    For 3+ line groups: may have multi-entry content.
    """
    entries = []
    pending_e = None

    for gi, group in enumerate(groups):
        if gi == 0:
            # First group is the first English word
            pending_e = " ".join(group)
            continue

        if pending_e is not None:
            # First line(s) of this group = Kashmiri translation of pending_e
            kashmiri = group[0]
            e_next = None

            # Handle multi-line groups
            if len(group) == 1:
                # Just K, no next E
                entries.append((kashmiri, pending_e))
                pending_e = None
            elif len(group) == 2:
                # Normal: [K, E_next]
                e_next = group[1]
                entries.append((kashmiri, pending_e))
                pending_e = e_next
            elif len(group) >= 3:
                # Multiple entries within one group
                # Pattern: K1, E_extra1, K2?, E_next?
                # Handle as pairs
                e_lines = []
                k_found = False
                remaining_lines = group[1:]

                # Try to pair them up
                i = 0
                while i < len(remaining_lines):
                    line = remaining_lines[i]
                    if has_kashmiri_markers(line) and not k_found:
                        # This K might be for an intermediate E
                        if e_lines:
                            # Previous K's English, now a new K
                            entries.append((kashmiri, pending_e))
                            pending_e = " ".join(e_lines)
                            kashmiri = line
                            e_lines = []
                        else:
                            # Additional K line - merge
                            kashmiri = kashmiri + " " + line
                    else:
                        e_lines.append(line)
                    i += 1

                entries.append((kashmiri, pending_e))
                if e_lines:
                    pending_e = " ".join(e_lines)
                else:
                    pending_e = None
        elif len(group) == 1:
            # No pending E, 1-line group - this becomes new pending_e
            pending_e = group[0]
        elif len(group) >= 2:
            # No pending E, multi-line group
            pending_e = group[0]
            kashmiri = group[1]
            e_next = group[2] if len(group) > 2 else None
            entries.append((kashmiri, pending_e))
            pending_e = e_next

    return entries


def fix_swapped_entries(entries: list) -> list:
    """
    Post-process entries to fix swapped K/E pairs.
    If K has Kashmiri markers -> keep as is.
    If K has no markers and E has markers -> swap them.
    """
    fixed = []
    for k, e in entries:
        k_has_markers = has_kashmiri_markers(k)
        e_has_markers = has_kashmiri_markers(e)

        if not k_has_markers and e_has_markers:
            # Likely swapped - swap back
            fixed.append((e, k))
        else:
            fixed.append((k, e))
    return fixed


def parse_loan_groups(groups: list) -> tuple:
    """Parse Section 3 - same structure as Section 2."""
    entries = parse_section2_groups(groups)
    loan_set = set()
    for kashmiri, english in entries:
        base = re.sub(r"\([^)]*\)", "", kashmiri).strip()
        for part in base.split(","):
            part = part.strip()
            if part:
                loan_set.add(part.lower())
    return loan_set, entries


def extract_pos_from_text(text: str):
    """Extract POS info. Returns (cleaned_text, pos, gender, number)."""
    matches = list(POS_RE.finditer(text))
    if not matches:
        return text.strip(), None, None, None

    pos = gender = number = None
    to_remove = []

    for m in matches:
        raw = m.group(1).lower().strip()
        skip_words = ["place name", "abstract noun", "also", "hindi", "urdu",
                      "lit", "cream", "emphatic", "e.g.", "measure", "men",
                      "es", "kind", "surface", "classifier", "superior",
                      "hindu", "muslim", "persian", "of ", "in ", "to ",
                      "someone", "sense", "s ing", "0"]
        if any(kw in raw for kw in skip_words):
            continue
        parts = [p.strip().rstrip(".") for p in raw.split(",")]
        pos_tokens = {"f", "m", "sing", "plu", "adj", "adv", "v", "n",
                      "hon", "pro", "conj", "emph", "inter", "inf", "part"}
        if any(p in pos_tokens for p in parts):
            p, g, num = normalize_pos(m.group(1))
            if p:
                pos = p
            if g:
                gender = g
            if num:
                number = num
            to_remove.append(m)

    clean = text
    for m in reversed(to_remove):
        clean = clean[:m.start()] + clean[m.end():]
    clean = re.sub(r"\s+", " ", clean).strip()
    clean = re.sub(r"^\s*,\s*", "", clean).strip()
    clean = re.sub(r"\s*,\s*$", "", clean).strip()

    return clean, pos, gender, number


def build_word_entry(kashmiri: str, english: str, pos: str, gender: str,
                     number: str, is_loan: bool) -> dict:
    is_phrase = " " in kashmiri and len(kashmiri.split()) > 1
    if pos is None:
        if english.lower().startswith("to "):
            pos = "verb"
        elif is_phrase:
            pos = "phrase"
        else:
            pos = "noun"

    category = assign_category(english)
    difficulty = assign_difficulty(english, kashmiri, pos, is_phrase)

    return {
        "id": str(uuid.uuid4()),
        "kashmiri": kashmiri,
        "english": english,
        "part_of_speech": pos,
        "gender": gender,
        "number": number,
        "category": category,
        "difficulty": difficulty,
        "is_loan_word": is_loan,
        "is_phrase": is_phrase,
    }


def main():
    text = INPUT_PATH.read_text(encoding="utf-8")
    sec1_lines, sec2_lines, sec3_lines = extract_sections(text)

    print(f"Section 1 (Kashmiri-English): {len(sec1_lines)} raw lines")
    print(f"Section 2 (English-Kashmiri): {len(sec2_lines)} raw lines")
    print(f"Section 3 (Loan Words): {len(sec3_lines)} raw lines")

    # Group by blank lines
    sec1_groups = clean_and_group(sec1_lines)
    sec2_groups = clean_and_group(sec2_lines)
    sec3_groups = clean_and_group(sec3_lines)

    print(f"Section 1 groups: {len(sec1_groups)}")
    print(f"Section 2 groups: {len(sec2_groups)}")
    print(f"Section 3 groups: {len(sec3_groups)}")

    # Parse sections
    sec1_entries = fix_swapped_entries(parse_section1_groups(sec1_groups))
    sec2_entries = parse_section2_groups(sec2_groups)
    loan_set, sec3_entries = parse_loan_groups(sec3_groups)

    print(f"\nSection 1 entries: {len(sec1_entries)}")
    print(f"Section 2 entries: {len(sec2_entries)}")
    print(f"Section 3 entries: {len(sec3_entries)}")
    print(f"Loan words: {len(loan_set)}")

    # Debug
    print("\n--- Section 1 first 15 entries ---")
    for k, e in sec1_entries[:15]:
        print(f"  K: {k[:50]:50s}  E: {e[:40]}")

    print("\n--- Section 2 first 10 entries ---")
    for k, e in sec2_entries[:10]:
        print(f"  K: {k[:50]:50s}  E: {e[:40]}")

    # Build word dict
    words = {}

    # Process Section 1
    for kashmiri_raw, english_raw in sec1_entries:
        if not kashmiri_raw or not english_raw:
            continue
        kashmiri_clean, pos, gender, number = extract_pos_from_text(kashmiri_raw)
        english_clean = english_raw.strip()

        if pos is None or gender is None:
            _, pos2, gender2, number2 = extract_pos_from_text(english_raw)
            if pos is None and pos2:
                pos = pos2
            if gender is None and gender2:
                gender = gender2
            if number is None and number2:
                number = number2

        base = re.sub(r"\([^)]*\)", "", kashmiri_clean).strip().split(",")[0].strip()
        is_loan = base.lower() in loan_set

        key = kashmiri_clean.lower().strip()
        if key and len(key) >= 2 and key not in words:
            words[key] = build_word_entry(
                kashmiri_clean, english_clean, pos, gender, number, is_loan
            )

    # Process Section 2
    for kashmiri_raw, english_raw in sec2_entries:
        if not kashmiri_raw or not english_raw:
            continue
        english_clean, pos_e, gender_e, number_e = extract_pos_from_text(english_raw)
        kashmiri_clean, pos_k, gender_k, number_k = extract_pos_from_text(kashmiri_raw)
        pos = pos_e or pos_k
        gender = gender_k or gender_e
        number = number_k or number_e

        for kw in kashmiri_clean.split(","):
            kw_clean = re.sub(r"\([^)]*\)", "", kw).strip()
            if not kw_clean or len(kw_clean) < 2:
                continue
            is_loan = kw_clean.lower() in loan_set
            key = kw_clean.lower().strip()
            if key and key not in words:
                words[key] = build_word_entry(
                    kw_clean, english_clean.strip(), pos, gender, number, is_loan
                )

    # Process Section 3
    for kashmiri_raw, english_raw in sec3_entries:
        kashmiri_clean, pos, gender, number = extract_pos_from_text(kashmiri_raw)
        for kw in kashmiri_clean.split(","):
            kw_clean = re.sub(r"\([^)]*\)", "", kw).strip()
            if not kw_clean or len(kw_clean) < 2:
                continue
            key = kw_clean.lower().strip()
            if key and key not in words:
                words[key] = build_word_entry(
                    kw_clean, english_raw.strip(), pos, gender, number, True
                )

    # Filter bad entries
    final_words = []
    for entry in words.values():
        k = entry["kashmiri"]
        e = entry["english"]
        if len(k) < 2 or len(e) < 2:
            continue
        if re.match(r"^\d+\.\d+$", k):
            continue
        if re.match(r"^\d+-\d+$", k):
            continue
        if k.isupper() and len(k) > 10:
            continue
        # Skip entries where kashmiri is a parenthetical fragment
        if k.startswith("(also") or k.startswith("(lit"):
            continue
        # Skip entries where kashmiri is just punctuation
        if re.match(r"^[\(\)\',\.\s]+$", k):
            continue
        final_words.append(entry)

    final_words.sort(key=lambda w: w["kashmiri"].lower())

    # Metadata
    cat_counts = Counter(w["category"] for w in final_words)
    diff_counts = Counter(w["difficulty"] for w in final_words)
    pos_counts = Counter(w["part_of_speech"] for w in final_words)
    loan_count = sum(1 for w in final_words if w["is_loan_word"])
    phrase_count = sum(1 for w in final_words if w["is_phrase"])

    output = {
        "words": final_words,
        "metadata": {
            "total_words": len(final_words),
            "categories": dict(sorted(cat_counts.items())),
            "difficulty_distribution": dict(sorted(diff_counts.items())),
            "part_of_speech_distribution": dict(sorted(pos_counts.items())),
            "loan_words": loan_count,
            "phrases": phrase_count,
            "source": "Braj B. Kachru - An Introduction to Spoken Kashmiri (1973)",
        },
    }

    OUTPUT_PATH.write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8")

    # Summary
    print(f"\n{'='*60}")
    print("GLOSSARY PARSING COMPLETE")
    print(f"{'='*60}")
    print(f"Total entries: {len(final_words)}")
    print(f"\nCategory distribution:")
    for cat, count in sorted(cat_counts.items(), key=lambda x: -x[1]):
        print(f"  {cat:20s}: {count:4d}")
    print(f"\nDifficulty distribution:")
    for diff, count in sorted(diff_counts.items()):
        print(f"  Level {diff}: {count:4d}")
    print(f"\nPart of speech distribution:")
    for pos, count in sorted(pos_counts.items(), key=lambda x: -x[1]):
        print(f"  {pos:20s}: {count:4d}")
    print(f"\nLoan words: {loan_count}")
    print(f"Phrases: {phrase_count}")

    # Validation
    swapped = 0
    for w in final_words:
        k, e = w["kashmiri"], w["english"]
        if has_kashmiri_markers(e) and not has_kashmiri_markers(k):
            swapped += 1
    print(f"\nValidation - likely swapped entries: {swapped}")

    # Sample entries
    print(f"\n{'='*60}")
    print("SAMPLE ENTRIES:")
    print(f"{'='*60}")
    import random
    random.seed(42)
    samples = random.sample(final_words, min(25, len(final_words)))
    for entry in sorted(samples, key=lambda w: w["kashmiri"]):
        print(f"  {entry['kashmiri']:30s} -> {entry['english']:35s} "
              f"[{entry['category']}, diff={entry['difficulty']}, "
              f"pos={entry['part_of_speech']}, g={entry['gender']}]")

    print(f"\nOutput written to: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
