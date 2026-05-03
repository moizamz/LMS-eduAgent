"""LLM-assisted assignment grading (instructor-triggered)."""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, Optional

from django.utils import timezone

_log = logging.getLogger(__name__)


def _read_file_excerpt(path: str, max_chars: int = 14000) -> str:
    if not path:
        return ""
    lower = path.lower()
    if lower.endswith(".pdf"):
        from quizzes.llm_service import extract_text_from_pdf

        t = extract_text_from_pdf(path)
        return (t or "")[:max_chars]
    try:
        with open(path, "rb") as f:
            raw = f.read()
        for enc in ("utf-8", "utf-16", "latin-1"):
            try:
                return raw.decode(enc, errors="ignore")[:max_chars]
            except Exception:
                continue
    except Exception as e:
        _log.warning("[AIGrade] file read failed path=%s err=%s", path, e)
    return ""


def _coerce_grade_payload(data: Any, max_score: float) -> Dict[str, Any]:
    if not isinstance(data, dict):
        return {}
    try:
        sc = float(data.get("suggested_score", 0))
    except (TypeError, ValueError):
        sc = 0.0
    sc = max(0.0, min(float(max_score), sc))
    rubric = data.get("rubric")
    if not isinstance(rubric, list):
        rubric = []
    clean_rubric = []
    for row in rubric[:20]:
        if not isinstance(row, dict):
            continue
        clean_rubric.append(
            {
                "criterion": str(row.get("criterion", ""))[:500],
                "max_points": float(row.get("max_points", 0) or 0),
                "awarded_points": float(row.get("awarded_points", 0) or 0),
                "comment": str(row.get("comment", ""))[:2000],
            }
        )
    out = {
        "suggested_score": round(sc, 2),
        "rubric": clean_rubric,
        "overall_explanation": str(data.get("overall_explanation", ""))[:12000],
        "strengths": [str(x)[:500] for x in data.get("strengths", []) if x][:12],
        "improvements": [str(x)[:500] for x in data.get("improvements", []) if x][:12],
        "grading_confidence": str(data.get("grading_confidence", "medium"))[:32],
    }
    return out


def run_ai_grade_for_submission(submission) -> Dict[str, Any]:
    """
    Build prompt from assignment instructions + student submission, call LLM, return structured dict.
    Does not persist.
    """
    from quizzes.llm_service import call_groq_text, call_gemini_text, safe_json_load

    assignment = submission.assignment
    max_score = float(assignment.max_score or 100)

    inst_parts = [str(assignment.description or "").strip()]
    if assignment.instruction_file:
        try:
            p = assignment.instruction_file.path
            chunk = _read_file_excerpt(p, 16000)
            if chunk.strip():
                inst_parts.append("--- UPLOADED INSTRUCTION FILE (extract) ---\n" + chunk)
        except Exception as e:
            _log.warning("[AIGrade] instruction file path error: %s", e)

    sub_parts = []
    if submission.submission_text and str(submission.submission_text).strip():
        sub_parts.append(str(submission.submission_text).strip()[:12000])
    if submission.submission_file:
        try:
            p = submission.submission_file.path
            chunk = _read_file_excerpt(p, 16000)
            if chunk.strip():
                sub_parts.append("--- UPLOADED SUBMISSION FILE (extract) ---\n" + chunk)
        except Exception as e:
            _log.warning("[AIGrade] submission file path error: %s", e)

    instructions = "\n\n".join(x for x in inst_parts if x).strip()
    student_work = "\n\n".join(sub_parts).strip()
    if not instructions:
        raise ValueError("Assignment has no description or readable instruction file.")
    if not student_work:
        raise ValueError("Submission has no text or readable submission file.")

    prompt = f"""You are an expert grader for a university course assignment.

ASSIGNMENT TITLE: {assignment.title}
MAXIMUM SCORE (numeric): {max_score}

TEACHER INSTRUCTIONS / RUBRIC CONTEXT:
{instructions[:18000]}

STUDENT SUBMISSION:
{student_work[:18000]}

Task:
1. Infer an explicit rubric from the instructions (criteria with max points that sum to roughly {max_score}).
2. Score each criterion and compute suggested_score (0..{max_score}).
3. Write overall_explanation (detailed, for instructor review; may include what the student did well and what to improve).
4. List strengths and improvements as short bullet strings.

Return ONLY valid JSON (no markdown fences) with this exact structure:
{{
  "suggested_score": <number>,
  "rubric": [
    {{"criterion": "<string>", "max_points": <number>, "awarded_points": <number>, "comment": "<string>"}}
  ],
  "overall_explanation": "<string>",
  "strengths": ["<string>", "..."],
  "improvements": ["<string>", "..."],
  "grading_confidence": "low" | "medium" | "high"
}}
"""

    raw_text = call_groq_text(prompt, log_label="Groq:AssignGrade", max_tokens=4096)
    provider = "groq"
    if not (raw_text and raw_text.strip()):
        raw_text = call_gemini_text(prompt, log_label="Gemini:AssignGrade")
        provider = "gemini"
    if not (raw_text and raw_text.strip()):
        raise ValueError("No LLM response from Groq or Gemini. Configure API keys or try again.")

    parsed = safe_json_load(raw_text)
    if parsed is None:
        lb = raw_text.find("{")
        rb = raw_text.rfind("}")
        if lb >= 0 and rb > lb:
            try:
                parsed = json.loads(raw_text[lb : rb + 1])
            except json.JSONDecodeError:
                parsed = None
    if not isinstance(parsed, dict):
        excerpt = re.sub(r"\s+", " ", (raw_text or "")[:400])
        _log.error("[AIGrade] JSON parse failed excerpt=%s", excerpt)
        raise ValueError("Could not parse AI grading JSON from model output.")

    payload = _coerce_grade_payload(parsed, max_score)
    if not payload.get("overall_explanation"):
        payload["overall_explanation"] = "Model returned minimal explanation; review rubric rows and suggested_score."
    payload["provider"] = provider
    payload["generated_at"] = timezone.now().isoformat()
    return payload
