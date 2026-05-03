"""Build a PDF export of stored AI grading (instructor-facing)."""

from __future__ import annotations

import io
import re
from html import escape
from typing import Any, Dict, List

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, TableStyle
from reportlab.platypus.tables import LongTable


def _clean_for_xml(text: str) -> str:
    """Escape for ReportLab Paragraph XML; preserve intentional line breaks."""
    s = escape(str(text or ""))
    s = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", s)
    return s.replace("\n", "<br/>")


def _p(text: str, style) -> Paragraph:
    if not text:
        return Paragraph("", style)
    return Paragraph(_clean_for_xml(text), style)


def _label_line(label: str, value: str, style) -> Paragraph:
    """Bold label + escaped value (avoid double-escaping HTML)."""
    lb = escape(str(label or ""))
    val = _clean_for_xml(value)
    return Paragraph(f"<b>{lb}:</b> {val}", style)


def _cell_para(text: str, style, bullet: str = "") -> Paragraph:
    raw = f"{bullet}{_clean_for_xml(text)}" if bullet else _clean_for_xml(text)
    return Paragraph(raw, style)


def build_ai_grading_pdf_bytes(submission) -> bytes:
    """Return PDF bytes for submission.ai_grading plus header context."""
    ai: Dict[str, Any] = submission.ai_grading if isinstance(submission.ai_grading, dict) else {}
    assignment = submission.assignment
    student = submission.student

    lm = rm = 0.75 * inch
    tm = bm = 0.75 * inch
    page_w, page_h = letter
    usable_w = page_w - lm - rm

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        rightMargin=rm,
        leftMargin=lm,
        topMargin=tm,
        bottomMargin=bm,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "PdfTitle",
        parent=styles["Heading1"],
        fontSize=16,
        leading=20,
        spaceAfter=14,
        textColor=colors.HexColor("#1a1a2e"),
    )
    h2 = ParagraphStyle(
        "PdfH2",
        parent=styles["Heading2"],
        fontSize=11,
        leading=14,
        spaceBefore=12,
        spaceAfter=8,
        textColor=colors.HexColor("#16213e"),
    )
    body = ParagraphStyle(
        "PdfBody",
        parent=styles["BodyText"],
        fontSize=10,
        leading=14,
        spaceAfter=6,
        wordWrap="LTR",
    )
    meta = ParagraphStyle(
        "PdfMeta",
        parent=body,
        fontSize=9,
        leading=12,
        spaceAfter=4,
        textColor=colors.HexColor("#444444"),
    )
    cell_header = ParagraphStyle(
        "PdfCellHead",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        wordWrap="LTR",
    )
    cell_body = ParagraphStyle(
        "PdfCellBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10,
        wordWrap="LTR",
    )
    cell_num = ParagraphStyle(
        "PdfCellNum",
        parent=cell_body,
        alignment=TA_RIGHT,
    )

    story: List[Any] = []
    story.append(_p("AI grading report", title_style))
    story.append(_label_line("Assignment", assignment.title, meta))
    story.append(_label_line("Course", assignment.course.title, meta))
    name = (
        f"{getattr(student, 'first_name', '')} {getattr(student, 'last_name', '')}".strip()
        or getattr(student, "username", "")
        or "Student"
    )
    story.append(_label_line("Student", name, meta))
    story.append(_label_line("Submission ID", str(submission.id), meta))
    story.append(Spacer(1, 0.12 * inch))

    conf = ai.get("grading_confidence")
    if conf:
        story.append(_label_line("Model confidence", str(conf), meta))
    ss = ai.get("suggested_score")
    if ss is not None and ss != "":
        story.append(
            _label_line(
                "AI suggested score",
                f"{ss} (max {assignment.max_score})",
                meta,
            )
        )
    story.append(Spacer(1, 0.1 * inch))

    expl = str(ai.get("overall_explanation") or "").strip()
    if expl:
        story.append(_p("Overall explanation", h2))
        story.append(_p(expl, body))
        story.append(Spacer(1, 0.08 * inch))

    rubric = ai.get("rubric")
    if isinstance(rubric, list) and rubric:
        story.append(_p("Rubric breakdown", h2))
        # Column widths must sum to ≤ usable width; leave room for grid padding
        w_comment = usable_w - 2.35 * inch - 0.55 * inch - 0.6 * inch
        if w_comment < 1.8 * inch:
            w_comment = 1.8 * inch
        col_w = [2.35 * inch, 0.55 * inch, 0.6 * inch, max(w_comment, 1.5 * inch)]

        header_row: List[Paragraph] = [
            _cell_para("Criterion", cell_header),
            _cell_para("Max", cell_header),
            _cell_para("Awarded", cell_header),
            _cell_para("Comment", cell_header),
        ]
        data: List[List[Paragraph]] = [header_row]
        for row in rubric[:30]:
            if not isinstance(row, dict):
                continue
            crit = str(row.get("criterion", ""))[:2000]
            comm = str(row.get("comment", ""))[:4000]
            data.append(
                [
                    _cell_para(crit, cell_body),
                    _cell_para(str(row.get("max_points", "")), cell_num),
                    _cell_para(str(row.get("awarded_points", "")), cell_num),
                    _cell_para(comm, cell_body),
                ]
            )

        t = LongTable(
            data,
            colWidths=col_w,
            repeatRows=1,
            hAlign="LEFT",
        )
        t.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e8ecf2")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#1a1a2e")),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#c5ccd6")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 5),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
                ]
            )
        )
        story.append(t)
        story.append(Spacer(1, 0.12 * inch))

    strengths = ai.get("strengths") if isinstance(ai.get("strengths"), list) else []
    if strengths:
        story.append(_p("Strengths", h2))
        for item in strengths[:20]:
            story.append(_cell_para(str(item), body, bullet="• "))
        story.append(Spacer(1, 0.06 * inch))

    improvements = ai.get("improvements") if isinstance(ai.get("improvements"), list) else []
    if improvements:
        story.append(_p("Areas for improvement", h2))
        for item in improvements[:20]:
            story.append(_cell_para(str(item), body, bullet="• "))

    if not expl and not rubric and not strengths and not improvements and (ss is None or ss == ""):
        story.append(_p("No structured AI fields were stored on this submission.", body))

    doc.build(story)
    return buf.getvalue()
