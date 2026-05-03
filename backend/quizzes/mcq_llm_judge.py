"""
Second-stage MCQ validation: LLM-as-judge (Groq → Gemini → Ollama).

Runs after deterministic checks in ``mcq_validation``. Only items the judge
approves with ``overall`` >= configured threshold are returned for student-facing flows.
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any, Dict, List, Optional, Tuple

_log = logging.getLogger(__name__)


def _judge_config() -> Dict[str, Any]:
    try:
        from django.conf import settings

        return {
            "enabled": bool(getattr(settings, "MCQ_LLM_JUDGE_ENABLED", True)),
            "min_score": max(1, min(10, int(getattr(settings, "MCQ_LLM_JUDGE_MIN_SCORE", 7)))),
            "batch_size": max(1, min(8, int(getattr(settings, "MCQ_LLM_JUDGE_BATCH_SIZE", 4)))),
            "strict": bool(getattr(settings, "MCQ_LLM_JUDGE_STRICT", False)),
        }
    except Exception:
        return {"enabled": True, "min_score": 7, "batch_size": 4, "strict": False}


def _format_item_for_prompt(
    q: Dict[str, Any],
    local_idx: int,
    chunk_by_id: Optional[Dict[str, str]],
) -> str:
    stmt = str(q.get("statement", ""))[:1400]
    opts = q.get("options") or []
    if not isinstance(opts, list):
        opts = []
    opts = [str(o)[:420] for o in opts[:6]]
    try:
        ci = int(q.get("correct_index", 0)) % max(1, len(opts))
    except (TypeError, ValueError):
        ci = 0
    lines = [f"--- ITEM_INDEX={local_idx} ---", f"STATEMENT: {stmt}", "OPTIONS:"]
    for j, o in enumerate(opts):
        mark = "  [MARKED_CORRECT]" if j == ci else ""
        lines.append(f"  [{j}] {o}{mark}")
    ev = q.get("evidence")
    if isinstance(ev, list) and ev and chunk_by_id:
        lines.append("EVIDENCE:")
        for k, row in enumerate(ev[:3]):
            if not isinstance(row, dict):
                continue
            cid = str(row.get("chunk_id") or "").strip()
            quote = str(row.get("quote") or "")[:360]
            chunk = (chunk_by_id.get(cid) or "")[:900]
            lines.append(f"  chunk_id={cid} quote={quote}")
            if chunk:
                lines.append(f"  SOURCE_CHUNK: {chunk}")
    else:
        lines.append("EVIDENCE: none")
    return "\n".join(lines)


def _parse_judge_payload(data: Any) -> Optional[List[Dict[str, Any]]]:
    if data is None:
        return None
    if isinstance(data, list):
        return [x for x in data if isinstance(x, dict)]
    if isinstance(data, dict):
        for key in ("results", "verdicts", "items", "judgments"):
            if key in data and isinstance(data[key], list):
                return [x for x in data[key] if isinstance(x, dict)]
    return None


def _row_idx(row: Dict[str, Any]) -> Optional[int]:
    for k in ("i", "idx", "index", "item", "item_index"):
        if k in row:
            try:
                return int(row[k])
            except (TypeError, ValueError):
                continue
    return None


def _row_approved(row: Dict[str, Any]) -> bool:
    for k in ("approve", "approved", "pass", "accept", "ok"):
        if k in row:
            v = row[k]
            if isinstance(v, bool):
                return v
            if isinstance(v, (int, float)):
                return bool(v)
            if isinstance(v, str):
                return v.strip().lower() in ("true", "1", "yes", "pass", "approve")
    return False


def _row_overall(row: Dict[str, Any]) -> float:
    for k in ("overall", "overall_score", "score", "quality", "total"):
        if k in row:
            try:
                v = float(row[k])
                return v if v <= 10 else min(10.0, v / 10.0)
            except (TypeError, ValueError):
                continue
    return 0.0


def _row_subscore(row: Dict[str, Any], *keys: str) -> Optional[float]:
    for k in keys:
        if k in row:
            try:
                return float(row[k])
            except (TypeError, ValueError):
                continue
    return None


def _call_judge_llm(prompt: str) -> Tuple[Optional[str], str]:
    """Returns (text, provider_label)."""
    from quizzes.llm_service import call_groq_text, call_gemini_text

    text = call_groq_text(prompt, log_label="Groq:MCQJudge", max_tokens=3072)
    if text and text.strip():
        _log.info("[MCQJudge] LLM provider=groq response_chars=%s", len(text.strip()))
        return text.strip(), "groq"
    text = call_gemini_text(prompt, log_label="Gemini:MCQJudge")
    if text and text.strip():
        _log.info("[MCQJudge] LLM provider=gemini response_chars=%s", len(text.strip()))
        return text.strip(), "gemini"
    # Ollama short path
    try:
        import ollama

        client = ollama.Client(host="http://localhost:11434")
        models = client.list()
        from quizzes.llm_service import _ollama_parse_model_ids, choose_ollama_model, _call_ollama_streaming

        available = _ollama_parse_model_ids(models)
        ollama_model = choose_ollama_model(available)
        content = _call_ollama_streaming(
            client=client,
            model=ollama_model,
            messages=[{"role": "user", "content": prompt}],
            options={"temperature": 0.2, "num_predict": 1200},
            timeout_seconds=120,
        )
        if content and str(content).strip():
            s = str(content).strip()
            _log.info("[MCQJudge] LLM provider=ollama response_chars=%s", len(s))
            return s, "ollama"
    except Exception as e:
        _log.warning("[MCQJudge] Ollama judge failed: %s", e)
    _log.warning("[MCQJudge] LLM provider=none (Groq, Gemini, and Ollama all unavailable or empty)")
    return None, "none"


def _parse_judge_response(text: Optional[str]) -> Optional[List[Dict[str, Any]]]:
    if not text:
        _log.info("[MCQJudge] parse: empty judge response body")
        return None
    from quizzes.llm_service import safe_json_load

    data = safe_json_load(text)
    rows = _parse_judge_payload(data)
    if rows:
        _log.info("[MCQJudge] parse: safe_json_load ok verdict_rows=%s", len(rows))
        return rows
    # Brace slice fallback
    l = text.find("{")
    r = text.rfind("}")
    if l >= 0 and r > l:
        try:
            data = json.loads(text[l : r + 1])
            rows = _parse_judge_payload(data)
            if rows:
                _log.info("[MCQJudge] parse: brace-slice ok verdict_rows=%s", len(rows))
                return rows
        except json.JSONDecodeError as e:
            _log.warning("[MCQJudge] parse: brace-slice JSONDecodeError: %s", e)
    excerpt = (text or "").replace("\r", " ")[:480].replace("\n", "\\n")
    _log.warning("[MCQJudge] parse: failed all paths text_len=%s excerpt=%r", len(text or ""), excerpt)
    return None


def filter_questions_by_llm_judge(
    questions: List[Dict[str, Any]],
    chunk_by_id: Optional[Dict[str, str]] = None,
    context_blurb: str = "",
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Batch LLM judge over ``questions``. Returns (approved_list, report_dict).

    When disabled or on total failure with ``MCQ_LLM_JUDGE_STRICT`` false, returns
    original list with ``degraded: True`` in the report.
    """
    cfg = _judge_config()
    empty_report: Dict[str, Any] = {
        "enabled": False,
        "degraded": False,
        "provider": None,
        "latency_ms_total": 0,
        "input_count": len(questions),
        "approved_count": len(questions),
        "rejected_count": 0,
        "mean_overall_score": None,
        "mean_clarity": None,
        "mean_grounding": None,
        "mean_distractor_quality": None,
        "min_score_threshold": cfg["min_score"],
        "batch_count": 0,
        "notes": "llm_judge_disabled",
    }

    if not cfg["enabled"] or not questions:
        if not cfg["enabled"]:
            return list(questions), {**empty_report, "enabled": False, "notes": "llm_judge_disabled"}
        return [], {**empty_report, "input_count": 0, "approved_count": 0}

    min_score = float(cfg["min_score"])
    batch_size = int(cfg["batch_size"])
    strict = bool(cfg["strict"])

    ctx = (context_blurb or "")[:3200]
    _log.info(
        "[MCQJudge] gate enabled=%s input_n=%s batch_size=%s min_score=%s strict=%s chunk_map_keys=%s ctx_chars=%s",
        cfg["enabled"],
        len(questions),
        batch_size,
        min_score,
        strict,
        len(chunk_by_id or {}),
        len(ctx),
    )
    all_scores: List[float] = []
    clarity_acc: List[float] = []
    ground_acc: List[float] = []
    dist_acc: List[float] = []
    kept: List[Dict[str, Any]] = []
    rejected = 0
    batches = 0
    t_total = 0.0
    last_provider = "none"

    rubric = """You are a strict MCQ quality auditor for a university LMS.

For EACH item, score 1–10 on: clarity (stem unambiguous), grounding (supported by CONTEXT/EVIDENCE), distractor_quality (wrong options plausible, not joke answers).
Set "approve" true only if there is exactly one best answer, no leakage into the stem/hint, pedagogically sound, and overall >= threshold implied by caller.

Output ONLY valid JSON (no markdown): {"results":[{"i":0,"approve":true,"overall":8,"clarity":8,"grounding":7,"distractors":8,"notes":""}, ...]}
Use ITEM_INDEX values exactly as given (0..N-1 per batch)."""

    for start in range(0, len(questions), batch_size):
        batch = questions[start : start + batch_size]
        blocks = [_format_item_for_prompt(q, j, chunk_by_id) for j, q in enumerate(batch)]
        body = "\n\n".join(blocks)
        prompt = f"""{rubric}

MIN_APPROVAL_SCORE (1-10): {int(min_score)}

CONTEXT (course excerpt — use when EVIDENCE is missing or thin):
{ctx}

{body}
"""
        t0 = time.monotonic()
        raw_text, prov = _call_judge_llm(prompt)
        t_total += time.monotonic() - t0
        last_provider = prov
        batches += 1

        rows = _parse_judge_response(raw_text)
        approved_local: Dict[int, bool] = {}
        score_local: Dict[int, float] = {}

        if rows is None:
            excerpt = (raw_text or "")[:560].replace("\n", "\\n")
            _log.warning(
                "[MCQJudge] batch parse_failed start=%s size=%s provider=%s elapsed_ms=%.0f excerpt=%r",
                start,
                len(batch),
                prov,
                (time.monotonic() - t0) * 1000,
                excerpt,
            )
            if strict:
                rejected += len(batch)
                _log.warning("[MCQJudge] strict mode: dropped full batch (%s items)", len(batch))
            else:
                kept.extend(batch)
                _log.warning("[MCQJudge] non-strict: kept full batch (%s items) without judge verdicts", len(batch))
            continue

        for row in rows:
            li = _row_idx(row)
            if li is None or li < 0 or li >= len(batch):
                continue
            ov = _row_overall(row)
            appr = _row_approved(row) and ov >= min_score
            if not _row_approved(row) and "approve" not in row and "approved" not in row:
                appr = ov >= min_score
            approved_local[li] = appr
            score_local[li] = ov
            c = _row_subscore(row, "clarity", "stem_clarity")
            g = _row_subscore(row, "grounding", "grounded", "evidence")
            d = _row_subscore(row, "distractors", "distractor_quality", "distractor")
            if c is not None:
                clarity_acc.append(c)
            if g is not None:
                ground_acc.append(g)
            if d is not None:
                dist_acc.append(d)

        for li, q in enumerate(batch):
            ok = approved_local.get(li, False)
            sc = score_local.get(li, 0.0)
            if ok:
                kept.append(q)
                if sc > 0:
                    all_scores.append(sc)
            else:
                rejected += 1

        batch_kept = sum(1 for li in range(len(batch)) if approved_local.get(li, False))
        _log.info(
            "[MCQJudge] batch done start=%s size=%s provider=%s elapsed_ms=%.0f verdict_rows=%s batch_kept=%s batch_rejected=%s",
            start,
            len(batch),
            prov,
            (time.monotonic() - t0) * 1000,
            len(rows),
            batch_kept,
            len(batch) - batch_kept,
        )

    if not kept and questions:
        if strict:
            return [], {
                "enabled": True,
                "degraded": False,
                "provider": last_provider,
                "latency_ms_total": int(t_total * 1000),
                "input_count": len(questions),
                "approved_count": 0,
                "rejected_count": len(questions),
                "mean_overall_score": None,
                "mean_clarity": None,
                "mean_grounding": None,
                "mean_distractor_quality": None,
                "min_score_threshold": int(min_score),
                "batch_count": batches,
                "notes": "llm_judge_rejected_all_strict",
            }
        _log.warning("[MCQJudge] no approvals — falling back to deterministic list (non-strict)")
        return list(questions), {
            "enabled": True,
            "degraded": True,
            "provider": last_provider,
            "latency_ms_total": int(t_total * 1000),
            "input_count": len(questions),
            "approved_count": len(questions),
            "rejected_count": 0,
            "mean_overall_score": None,
            "mean_clarity": None,
            "mean_grounding": None,
            "mean_distractor_quality": None,
            "min_score_threshold": int(min_score),
            "batch_count": batches,
            "notes": "llm_judge_no_approvals_fallback_deterministic",
        }

    report = {
        "enabled": True,
        "degraded": False,
        "provider": last_provider,
        "latency_ms_total": int(t_total * 1000),
        "input_count": len(questions),
        "approved_count": len(kept),
        "rejected_count": max(0, len(questions) - len(kept)),
        "pass_rate_pct": round(100.0 * len(kept) / max(1, len(questions)), 1),
        "mean_overall_score": round(sum(all_scores) / len(all_scores), 2) if all_scores else None,
        "mean_clarity": round(sum(clarity_acc) / len(clarity_acc), 2) if clarity_acc else None,
        "mean_grounding": round(sum(ground_acc) / len(ground_acc), 2) if ground_acc else None,
        "mean_distractor_quality": round(sum(dist_acc) / len(dist_acc), 2) if dist_acc else None,
        "min_score_threshold": int(min_score),
        "batch_count": batches,
        "validation_pipeline": "deterministic_then_llm_judge",
    }
    _log.info(
        "[MCQJudge] summary input=%s approved=%s rejected=%s pass_rate_pct=%s provider_last=%s batches=%s degraded=%s mean_overall=%s",
        report["input_count"],
        report["approved_count"],
        report["rejected_count"],
        report.get("pass_rate_pct"),
        last_provider,
        batches,
        report.get("degraded", False),
        report.get("mean_overall_score"),
    )
    return kept, report


def apply_student_facing_mcqs_gate(
    raw_questions: List[Dict[str, Any]],
    lecture_contents: List[Dict[str, Any]],
    *,
    chunk_size: int = 1200,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Deterministic validation (with chunk catalog) + LLM judge. Returns (questions, quality_report).
    """
    from quizzes.chunk_catalog import build_chunk_catalog, catalog_chunk_map
    from quizzes.llm_service import build_rag_context
    from quizzes.mcq_validation import filter_valid_questions

    catalog = build_chunk_catalog(lecture_contents or [], chunk_size=chunk_size, overlap=180)
    chunk_map = catalog_chunk_map(catalog)

    kept, summ = filter_valid_questions(raw_questions or [], chunk_map, min_faithfulness=0.45)
    if len(kept) < max(2, len(raw_questions or []) // 3 or 1):
        kept2, summ2 = filter_valid_questions(raw_questions or [], None, min_faithfulness=0.0)
        if len(kept2) > len(kept):
            kept, summ = kept2, summ2
            summ["relaxed_citations"] = True

    ctx = build_rag_context(lecture_contents or [], max_chars=4000)
    _log.info(
        "[MCQJudge] student_gate deterministic_kept=%s raw_in=%s catalog_chunks=%s",
        len(kept),
        len(raw_questions or []),
        len(catalog),
    )
    judged, jrep = filter_questions_by_llm_judge(kept, chunk_map if chunk_map else None, context_blurb=ctx)
    _log.info("[MCQJudge] student_gate after_judge kept=%s judge_notes=%s", len(judged), (jrep or {}).get("notes"))

    quality = {
        "validation_summary": summ,
        "faithfulness_mean": summ.get("mean_faithfulness"),
        "llm_judge": jrep,
        "adaptive_engine": "student_gate_deterministic_plus_llm_judge",
    }
    return judged, quality
