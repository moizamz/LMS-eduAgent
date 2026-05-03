"""Build a PDF export of stored AI grading (instructor-facing)."""

from __future__ import annotations

import io
from html import escape
from typing import Any, Dict, List

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def _p(text: str, style) -> Paragraph:
    if not text:
        return Paragraph("", style)
    safe = escape(str(text)).replace("\n", "<br/>")
    return Paragraph(safe, style)


def build_ai_grading_pdf_bytes(submission) -> bytes:
    """Return PDF bytes for submission.ai_grading plus header context."""
    ai: Dict[str, Any] = submission.ai_grading if isinstance(submission.ai_grading, dict) else {}
    assignment = submission.assignment
    student = submission.student

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        rightMargin=0.75 * inch,
        leftMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "TitleCustom",
        parent=styles["Heading1"],
        fontSize=16,
        spaceAfter=12,
    )
    h2 = ParagraphStyle("H2", parent=styles["Heading2"], fontSize=12, spaceBefore=10, spaceAfter=6)
    body = styles["BodyText"]
    body.fontSize = 10

    story: List[Any] = []
    story.append(_p("AI grading report", title_style))
    story.append(_p(f"<b>Assignment:</b> {escape(assignment.title)}", body))
    story.append(_p(f"<b>Course:</b> {escape(assignment.course.title)}", body))
    name = (
        f"{getattr(student, 'first_name', '')} {getattr(student, 'last_name', '')}".strip()
        or getattr(student, "username", "")
        or "Student"
    )
    story.append(_p(f"<b>Student:</b> {escape(name)}", body))
    story.append(_p(f"<b>Submission ID:</b> {submission.id}", body))
    story.append(Spacer(1, 0.15 * inch))

    conf = ai.get("grading_confidence")
    if conf:
        story.append(_p(f"<b>Model confidence:</b> {escape(str(conf))}", body))
    ss = ai.get("suggested_score")
    if ss is not None and ss != "":
        story.append(_p(f"<b>AI suggested score:</b> {escape(str(ss))} (max {assignment.max_score})", body))
    story.append(Spacer(1, 0.12 * inch))

    expl = str(ai.get("overall_explanation") or "").strip()
    if expl:
        story.append(_p("Overall explanation", h2))
        story.append(_p(expl, body))
        story.append(Spacer(1, 0.1 * inch))

    rubric = ai.get("rubric")
    if isinstance(rubric, list) and rubric:
        story.append(_p("Rubric breakdown", h2))
        data = [["Criterion", "Max", "Awarded", "Comment"]]
        for row in rubric[:25]:
            if not isinstance(row, dict):
                continue
            data.append(
                [
                    str(row.get("criterion", ""))[:400],
                    str(row.get("max_points", "")),
                    str(row.get("awarded_points", "")),
                    str(row.get("comment", ""))[:800],
                ]
            )
        t = Table(data, colWidths=[2.2 * inch, 0.55 * inch, 0.65 * inch, 2.85 * inch])
        t.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e3e8ef")),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f7f9fc")]),
                ]
            )
        )
        story.append(t)
        story.append(Spacer(1, 0.12 * inch))

    strengths = ai.get("strengths") if isinstance(ai.get("strengths"), list) else []
    if strengths:
        story.append(_p("Strengths", h2))
        for item in strengths[:20]:
            story.append(_p(f"• {escape(str(item))}", body))
        story.append(Spacer(1, 0.08 * inch))

    improvements = ai.get("improvements") if isinstance(ai.get("improvements"), list) else []
    if improvements:
        story.append(_p("Areas for improvement", h2))
        for item in improvements[:20]:
            story.append(_p(f"• {escape(str(item))}", body))

    if not expl and not rubric and not strengths and not improvements and (ss is None or ss == ""):
        story.append(_p("<i>No structured AI fields were stored on this submission.</i>", body))

    doc.build(story)
    return buf.getvalue()
