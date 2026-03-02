"""
Export/Import quiz questions in CSV, XML (Moodle), and GIFT formats.
"""
import csv
import io
import re
import xml.etree.ElementTree as ET
from xml.dom import minidom


def questions_to_dict_list(questions):
    """Convert Question queryset to list of dicts for export."""
    result = []
    for q in questions:
        choices = list(q.choices.all().order_by('order'))
        opts = [c.choice_text for c in choices]
        correct_idx = next((i for i, c in enumerate(choices) if c.is_correct), 0)
        result.append({
            'statement': q.question_text,
            'options': opts,
            'correct_index': correct_idx,
            'explanation': q.explanation or '',
            'hint': q.hint or '',
            'marks': q.points,
            'difficulty': q.difficulty or 'medium',
            'taxonomy': q.taxonomy or 'understand',
        })
    return result



def export_csv(questions):
    """Export questions to CSV format."""
    rows = questions_to_dict_list(questions)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['statement', 'option1', 'option2', 'option3', 'option4', 'correct_index', 'explanation', 'hint', 'marks', 'difficulty', 'taxonomy'])
    for r in rows:
        opts = r['options'] + [''] * (4 - len(r['options']))
        writer.writerow([
            r['statement'],
            opts[0] if len(opts) > 0 else '',
            opts[1] if len(opts) > 1 else '',
            opts[2] if len(opts) > 2 else '',
            opts[3] if len(opts) > 3 else '',
            r['correct_index'],
            r['explanation'],
            r['hint'],
            r['marks'],
            r['difficulty'],
            r['taxonomy'],
        ])
    return output.getvalue()


def _gift_escape(s):
    """Escape GIFT special chars in option text."""
    return (s or '').replace('\\', '\\\\').replace('~', '\\~').replace('=', '\\=').replace('#', '\\#')


def export_gift(questions):
    lines = []
    for q in questions:
        d = questions_to_dict_list([q])[0]
        opts = d['options']
        correct_idx = d['correct_index']
        parts = []
        for i, opt in enumerate(opts):
            prefix = '=' if i == correct_idx else '~'
            parts.append(f"{prefix}{_gift_escape(opt)}")
        stmt = d['statement'].replace('{', '\\{').replace('}', '\\}').replace('~', '\\~').replace('=', '\\=')
        line = f"{stmt}{{{' '.join(parts)}}}"
        # Write hint first, explanation second — parser reads them in this order
        line += f"#{_gift_escape(d['hint']) if d['hint'] else ''}"
        line += f"#{_gift_escape(d['explanation']) if d['explanation'] else ''}"
        lines.append(line)
    return '\n\n'.join(lines)

def _xml_escape(s):
    """Escape XML special characters."""
    if not s:
        return ''
    return str(s).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;').replace("'", '&apos;')


def export_xml(questions, quiz_title='Quiz'):
    quiz = ET.Element('quiz')
    for i, q in enumerate(questions):
        d = questions_to_dict_list([q])[0]
        quest = ET.SubElement(quiz, 'question', type='multichoice')
        name = ET.SubElement(quest, 'name')
        ET.SubElement(name, 'text').text = _xml_escape(f"Q{i+1}")
        qtext = ET.SubElement(quest, 'questiontext', format='html')
        ET.SubElement(qtext, 'text').text = _xml_escape(d['statement'])
        ET.SubElement(quest, 'defaultgrade').text = str(d['marks'])
        ET.SubElement(quest, 'difficulty').text = d['difficulty']
        ET.SubElement(quest, 'taxonomy').text = d['taxonomy']
        for j, opt in enumerate(d['options']):
            ans = ET.SubElement(quest, 'answer', fraction='100' if j == d['correct_index'] else '0', format='plain_text')
            ET.SubElement(ans, 'text').text = _xml_escape(opt)
        if d['explanation']:
            fb = ET.SubElement(quest, 'generalfeedback', format='html')
            ET.SubElement(fb, 'text').text = _xml_escape(d['explanation'])
        if d['hint']:
            hint_el = ET.SubElement(quest, 'hint', format='html')
            ET.SubElement(hint_el, 'text').text = _xml_escape(d['hint'])
    rough = ET.tostring(quiz, encoding='unicode')
    return minidom.parseString(f'<?xml version="1.0" encoding="UTF-8"?>{rough}').toprettyxml(indent="  ")


def parse_xml(content):
    root = ET.fromstring(content)
    questions = []
    for quest in root.findall('.//question[@type="multichoice"]'):
        qtext_el = quest.find('questiontext/text')
        if qtext_el is None or not (qtext_el.text or '').strip():
            continue
        stmt = (qtext_el.text or '').strip()
        opts = []
        correct_idx = 0
        for i, ans in enumerate(quest.findall('answer')):
            text_el = ans.find('text')
            if text_el is not None and (text_el.text or '').strip():
                opts.append((text_el.text or '').strip())
                if ans.get('fraction') == '100':
                    correct_idx = len(opts) - 1
        if len(opts) < 2:
            continue
        fb_el = quest.find('generalfeedback/text')
        explanation = (fb_el.text or '').strip() if fb_el is not None else ''
        hint_el = quest.find('hint/text')
        hint = (hint_el.text or '').strip() if hint_el is not None else ''
        grade_el = quest.find('defaultgrade')
        marks = int(grade_el.text) if grade_el is not None and grade_el.text else 1
        difficulty_el = quest.find('difficulty')
        difficulty = (difficulty_el.text or 'medium').strip() if difficulty_el is not None else 'medium'
        taxonomy_el = quest.find('taxonomy')
        taxonomy = (taxonomy_el.text or 'understand').strip() if taxonomy_el is not None else 'understand'
        questions.append({
            'statement': stmt,
            'options': opts,
            'correct_index': min(correct_idx, len(opts) - 1),
            'explanation': explanation,
            'hint': hint,
            'marks': max(1, marks),
            'difficulty': difficulty,
            'taxonomy': taxonomy,
        })
    return questions

def parse_csv(content):
    """Parse CSV content into list of question dicts."""
    reader = csv.DictReader(io.StringIO(content))
    questions = []
    for row in reader:
        opts = [row.get('option1', ''), row.get('option2', ''), row.get('option3', ''), row.get('option4', '')]
        opts = [o.strip() for o in opts if o and str(o).strip()]
        if len(opts) < 2:
            continue
        correct_idx = int(row.get('correct_index', 0))
        questions.append({
            'statement': (row.get('statement') or '').strip(),
            'options': opts,
            'correct_index': min(correct_idx, len(opts) - 1),
            'explanation': (row.get('explanation') or '').strip(),
            'hint': (row.get('hint') or '').strip(),
            'marks': max(1, int(row.get('marks', 1) or 1)),
            'difficulty': row.get('difficulty') or 'medium',
            'taxonomy': row.get('taxonomy') or 'understand',
        })
    return questions


def parse_gift(content):
    questions = []
    blocks = re.split(r'\n\s*\n', content)
    for block in blocks:
        block = block.strip()
        if not block or block.startswith('//'):
            continue
        m = re.match(r'^(.+?)\{(.+?)\}#?([^#]*)#?(.*)$', block, re.DOTALL)
        if not m:
            continue
        stmt, opts_str, hint, explanation = m.groups()
        stmt = stmt.strip().replace('\\{', '{').replace('\\}', '}').replace('\\~', '~').replace('\\=', '=')
        opts = []
        correct_idx = 0
        for part in re.split(r'(?=[~=])', opts_str):
            part = part.strip()
            if not part:
                continue
            if part.startswith('='):
                correct_idx = len(opts)
                opts.append(part[1:].strip())
            elif part.startswith('~'):
                opts.append(part[1:].strip())
        if len(opts) < 2:
            continue
        questions.append({
            'statement': stmt,
            'options': opts,
            'correct_index': correct_idx,
            'explanation': explanation.strip(),
            'hint': hint.strip(),
            'marks': 1,
            'difficulty': 'medium',
            'taxonomy': 'understand',
        })
    return questions


# def parse_xml(content):
#     """Parse Moodle XML content into list of question dicts."""
#     root = ET.fromstring(content)
#     questions = []
#     for quest in root.findall('.//question[@type="multichoice"]'):
#         qtext_el = quest.find('questiontext/text')
#         if qtext_el is None or not (qtext_el.text or '').strip():
#             continue
#         stmt = (qtext_el.text or '').strip()
#         opts = []
#         correct_idx = 0
#         for i, ans in enumerate(quest.findall('answer')):
#             text_el = ans.find('text')
#             if text_el is not None and (text_el.text or '').strip():
#                 opts.append((text_el.text or '').strip())
#                 if ans.get('fraction') == '100':
#                     correct_idx = len(opts) - 1
#         if len(opts) < 2:
#             continue
#         fb_el = quest.find('generalfeedback/text')
#         explanation = (fb_el.text or '').strip() if fb_el is not None else ''
#         grade_el = quest.find('defaultgrade')
#         marks = int(grade_el.text) if grade_el is not None and grade_el.text else 1
#         questions.append({
#             'statement': stmt,
#             'options': opts,
#             'correct_index': min(correct_idx, len(opts) - 1),
#             'explanation': explanation,
#             'hint': '',
#             'marks': max(1, marks),
#             'difficulty': 'medium',
#             'taxonomy': 'understand',
#         })
#     return questions


def parse_import_file(content, format_type):
    """Parse imported file content by format. Returns list of question dicts."""
    format_type = (format_type or '').lower().strip()
    if format_type == 'csv':
        return parse_csv(content)
    if format_type == 'gift':
        return parse_gift(content)
    if format_type in ('xml', 'moodle'):
        return parse_xml(content)
    raise ValueError(f"Unsupported format: {format_type}")
