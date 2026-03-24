#!/usr/bin/env python3
"""Clean and fix the parsed glossary data."""
import json
import re
import uuid

KASHMIRI_MARKERS = re.compile(r'[?;:0]|^[a-z]')  # Kashmiri romanization has these

CATEGORY_KEYWORDS = {
    'family': r'father|mother|brother|sister|son|daughter|wife|husband|uncle|aunt|child|boy|girl|grandfather|grandmother|family|parent|relative|cousin|nephew|niece|man|woman|people|person|friend',
    'food': r'food|eat|rice|bread|meat|fruit|apple|cherry|almond|walnut|coconut|milk|tea|water|drink|cook|sugar|salt|spice|butter|cheese|meal|fish|vegetable|bean|cucumber|chilli|cream|curry',
    'nature': r'mountain|river|lake|tree|flower|garden|valley|forest|sky|rain|snow|sun|moon|star|wind|cloud|spring|field|leaf|bird|animal|cow|horse|dog|cat|fish|deer|bear|stone|rock',
    'body': r'body|head|eye|ear|nose|mouth|hand|foot|finger|hair|face|tooth|leg|arm|heart|blood|bone|stomach|back|neck|shoulder|knee|skin|lip',
    'household': r'house|home|room|door|window|table|chair|bed|kitchen|cup|plate|pot|box|cloth|blanket|carpet|basket|book|pen|paper|mirror|lamp|key|shop|office|store',
    'clothing': r'cloth|clothes|shirt|dress|shoe|hat|ring|jewel|silk|cotton|wool|material|thread|gold|embroid',
    'places': r'place|city|village|street|road|market|bridge|temple|mosque|school|college|hospital|hotel|gate|garden|cave|lake|nag$|dal$|kadal|kashmir|india|delhi|srinagar|asia|america|england',
    'time': r'today|tomorrow|yesterday|morning|evening|night|day|week|month|year|hour|minute|time|sunday|monday|tuesday|wednesday|thursday|friday|saturday|season|summer|winter|autumn|spring|noon',
    'numbers': r'^one$|^two$|^three$|^four$|^five$|^six$|^seven$|^eight$|^nine$|^ten$|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|half|first|second|third',
    'descriptions': r'big|small|good|bad|hot|cold|new|old|long|short|tall|high|low|deep|beautiful|ugly|clean|dirty|fast|slow|hard|soft|heavy|light|rich|poor|happy|sad|young|dark|bright|sweet|sour|bitter|thick|thin|narrow|wide|dry|wet|empty|full|easy|difficult|correct|wrong|special|important|separate|different|dangerous|strong|weak',
    'actions': r'^to |walk|run|go|come|eat|drink|sleep|wake|sit|stand|read|write|speak|listen|see|look|hear|give|take|make|do|say|tell|ask|answer|buy|sell|open|close|start|stop|bring|carry|put|throw|catch|cut|break|build|wash|clean|play|sing|dance|laugh|cry|die|live|grow|fall|climb|swim|fly|burn|fight',
    'religion': r'god|temple|mosque|prayer|holy|sacred|hindu|muslim|buddhist|eid|diwali|christmas|festival|worship|pilgrim|saint|heaven|soul|sin',
    'education': r'school|college|university|teacher|student|learn|teach|study|class|exam|degree|language|read|write|education',
    'greetings': r'hello|goodbye|welcome|thank|please|sorry|greeting|salaam',
}

def looks_kashmiri(text: str) -> bool:
    """Heuristic: Kashmiri romanized words contain :, ;, 0, ? and are mostly lowercase."""
    if not text:
        return False
    has_diacritics = bool(re.search(r'[:;?0]', text))
    is_lowercase = text[0].islower() if text else False
    has_no_spaces_or_short = len(text.split()) <= 4
    return (has_diacritics or is_lowercase) and has_no_spaces_or_short

def categorize(english: str) -> str:
    """Assign a category based on English meaning."""
    english_lower = english.lower()
    for cat, pattern in CATEGORY_KEYWORDS.items():
        if re.search(pattern, english_lower):
            return cat
    return 'other'

def assign_difficulty(entry: dict) -> int:
    """Assign difficulty 1-3."""
    if entry.get('is_phrase'):
        return 3
    pos = entry.get('part_of_speech', '')
    if pos in ('verb', 'phrase'):
        return 2
    if pos in ('adjective', 'adverb'):
        return 2
    cat = entry.get('category', 'other')
    if cat == 'numbers':
        return 1
    if cat in ('family', 'food', 'body', 'household', 'nature', 'time', 'places'):
        return 1
    if cat in ('descriptions', 'actions'):
        return 2
    return 2

def main():
    with open('/Users/imans/wanawun/data/glossary.json') as f:
        data = json.load(f)

    cleaned = []
    seen = set()

    for w in data['words']:
        kashmiri = w['kashmiri'].strip()
        english = w['english'].strip()

        # Skip junk entries
        if not kashmiri or not english:
            continue
        if kashmiri.startswith('(') or len(kashmiri) < 2:
            continue
        if kashmiri.startswith('A PARTIAL') or kashmiri.startswith('ENGLISH'):
            continue
        if english.startswith('3.0') or english.startswith('2.0'):
            continue

        # Fix swapped fields (English-Kashmiri section has them reversed)
        if not looks_kashmiri(kashmiri) and looks_kashmiri(english):
            kashmiri, english = english, kashmiri

        # Skip if still looks wrong
        if len(kashmiri) < 2:
            continue

        # Clean up kashmiri field - remove part_of_speech annotations
        kashmiri_clean = re.sub(r'\s*\([^)]*\)\s*', '', kashmiri).strip()
        if not kashmiri_clean:
            continue

        # Deduplicate
        key = kashmiri_clean.lower()
        if key in seen:
            continue
        seen.add(key)

        # Detect part of speech
        pos = w.get('part_of_speech', 'other')
        if pos == 'other':
            if 'to ' in english.lower()[:3]:
                pos = 'verb'
            elif re.search(r'\(m\.\)|\(f\.\)', w['kashmiri']):
                pos = 'noun'

        # Detect gender
        gender = None
        if '(m' in w['kashmiri']:
            gender = 'm'
        elif '(f' in w['kashmiri']:
            gender = 'f'

        # Detect phrases
        is_phrase = ' ' in kashmiri_clean and not kashmiri_clean.startswith('to ')

        # Categorize
        category = categorize(english)

        entry = {
            'id': str(uuid.uuid4()),
            'kashmiri': kashmiri_clean,
            'english': english,
            'part_of_speech': pos,
            'gender': gender,
            'number': None,
            'category': category,
            'difficulty': 1,  # Will be recalculated
            'is_loan_word': w.get('is_loan_word', False),
            'is_phrase': is_phrase,
        }
        entry['difficulty'] = assign_difficulty(entry)
        cleaned.append(entry)

    # Build metadata
    cats = {}
    for w in cleaned:
        cats[w['category']] = cats.get(w['category'], 0) + 1

    output = {
        'words': cleaned,
        'metadata': {
            'total_words': len(cleaned),
            'categories': dict(sorted(cats.items())),
            'source': 'Braj B. Kachru - An Introduction to Spoken Kashmiri (1973)',
        },
    }

    with open('/Users/imans/wanawun/data/glossary.json', 'w') as f:
        json.dump(output, f, indent=2)

    print(f'Cleaned glossary: {len(cleaned)} words')
    print(f'Categories: {json.dumps(cats, indent=2)}')
    print(f'\nSample entries:')
    for w in cleaned[:10]:
        print(f'  {w["kashmiri"]:25s} = {w["english"]:30s} [{w["category"]}, diff:{w["difficulty"]}]')

if __name__ == '__main__':
    main()
