"""MCQ validation: uniqueness, distractors, leak detection, STEM heuristics, citation faithfulness."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def _tokens(s: str) -> Set[str]:
    return {t for t in re.split(r"[^\w]+", _norm(s)) if len(t) > 1}


def _jaccard(a: Set[str], b: Set[str]) -> float:
    if not a or not b:
        return 0.0
    inter = len(a & b)
    union = len(a | b)
    return inter / union if union else 0.0


def _difficulty_b(diff: str) -> float:
    d = (diff or "medium").lower()
    if d == "easy":
        return -0.8
    if d == "hard":
        return 0.9
    return 0.0


@dataclass
class ValidationResult:
    ok: bool
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    faithfulness: float = 0.0  # 0..1
    stem_flagged: bool = False


def _exactly_one_correct_index(q: Dict[str, Any]) -> Tuple[bool, List[str]]:
    errs: List[str] = []
    opts = q.get("options")
    if not isinstance(opts, list) or len(opts) < 2:
        errs.append("Need at least 2 options")
        return False, errs
    try:
        ci = int(q.get("correct_index", 0)) % len(opts)
    except (TypeError, ValueError):
        errs.append("Invalid correct_index")
        return False, errs
    if ci < 0 or ci >= len(opts):
        errs.append("correct_index out of range")
        return False, errs
    texts = [_norm(str(o)) for o in opts if str(o).strip()]
    if len(set(texts)) != len(texts):
        errs.append("Duplicate option texts")
    return len(errs) == 0, errs


def _distractor_plausibility(q: Dict[str, Any]) -> Tuple[bool, List[str], List[str]]:
    errs: List[str] = []
    warns: List[str] = []
    opts = [str(o).strip() for o in (q.get("options") or []) if str(o).strip()]
    if len(opts) < 2:
        return False, errs, warns
    try:
        ci = int(q.get("correct_index", 0)) % len(opts)
    except (TypeError, ValueError):
        return False, errs, warns
    correct = opts[ci]
    ct = _tokens(correct)
    for j, o in enumerate(opts):
        if j == ci:
            continue
        ot = _tokens(o)
        jac = _jaccard(ct, ot)
        if jac > 0.92:
            errs.append(f"Distractor {j} too similar to correct (Jaccard {jac:.2f})")
        elif jac < 0.08 and len(o) > 4 and len(correct) > 4:
            warns.append(f"Distractor {j} may be unrelated (Jaccard {jac:.2f})")
        if _norm(o) == _norm(correct):
            errs.append("Distractor equals correct text")
    return len(errs) == 0, errs, warns


def _verbatim_leak(q: Dict[str, Any]) -> Tuple[bool, List[str], List[str]]:
    errs: List[str] = []
    warns: List[str] = []
    opts = [str(o).strip() for o in (q.get("options") or [])]
    try:
        ci = int(q.get("correct_index", 0)) % len(opts)
    except (TypeError, ValueError):
        return False, errs, warns
    correct = opts[ci] if opts else ""
    stmt = str(q.get("statement", "") or "")
    hint = str(q.get("hint", "") or "")
    expl = str(q.get("explanation", "") or "")
    cn = _norm(correct)
    if len(cn) >= 12 and cn in _norm(stmt):
        errs.append("Correct option text appears verbatim in statement")
    if len(cn) >= 10 and cn in _norm(hint):
        errs.append("Correct option text appears verbatim in hint")
    if len(cn) >= 14 and cn in _norm(expl):
        warns.append("Correct text may appear in explanation (review)")
    return len(errs) == 0, errs, warns


def _stem_heuristic(q: Dict[str, Any]) -> Tuple[bool, bool, List[str]]:
    """Lightweight STEM checks: unmatched brackets, mixed units hint."""
    warns: List[str] = []
    text = " ".join(
        [str(q.get("statement", ""))]
        + [str(o) for o in (q.get("options") or [])]
        + [str(q.get("explanation", ""))]
    )
    flagged = False
    if text.count("(") != text.count(")"):
        warns.append("Unbalanced parentheses in STEM text")
        flagged = True
    if re.search(r"\d+\s*°\s*[CF]", text) and re.search(r"\d+\s*K\b", text):
        warns.append("Mixed temperature unit families — verify")
        flagged = True
    return True, flagged, warns


def _faithfulness_from_evidence(q: Dict[str, Any], chunk_by_id: Dict[str, str]) -> Tuple[float, List[str]]:
    """
    Score 0..1: fraction of evidence quotes that appear as substrings of cited chunk (normalized whitespace).
    """
    ev = q.get("evidence")
    if not isinstance(ev, list) or not ev:
        return 0.0, ["missing_evidence"]
    ok = 0
    bad: List[str] = []
    for i, row in enumerate(ev):
        if not isinstance(row, dict):
            bad.append(f"evidence[{i}] not object")
            continue
        cid = str(row.get("chunk_id") or "").strip()
        quote = str(row.get("quote") or "").strip()
        if not cid or not quote:
            bad.append(f"evidence[{i}] incomplete")
            continue
        chunk = chunk_by_id.get(cid)
        if not chunk:
            bad.append(f"unknown chunk_id {cid}")
            continue
        cq = re.sub(r"\s+", " ", quote.lower())
        ch = re.sub(r"\s+", " ", chunk.lower())
        if len(cq) >= 8 and cq in ch:
            ok += 1
        else:
            # fuzzy: 80% of quote words in chunk
            qw = _tokens(quote)
            cw = _tokens(chunk)
            if qw and len(qw & cw) / max(1, len(qw)) >= 0.75:
                ok += 1
            else:
                bad.append(f"quote not grounded in chunk {cid}")
    score = ok / max(1, len(ev))
    return score, bad


def validate_mcq_item(
    q: Dict[str, Any],
    chunk_by_id: Optional[Dict[str, str]] = None,
    min_faithfulness: float = 0.45,
) -> ValidationResult:
    use_grounding = bool(chunk_by_id)
    cmap = chunk_by_id or {}
    errors: List[str] = []
    warnings: List[str] = []

    ok1, e1 = _exactly_one_correct_index(q)
    errors.extend(e1)

    ok2, e2, w2 = _distractor_plausibility(q)
    errors.extend(e2)
    warnings.extend(w2)

    ok3, e3, w3 = _verbatim_leak(q)
    errors.extend(e3)
    warnings.extend(w3)

    _ok4, stem_f, w4 = _stem_heuristic(q)
    warnings.extend(w4)

    faith = 0.0
    if use_grounding:
        faith, fe = _faithfulness_from_evidence(q, cmap)
        for msg in fe:
            if msg == "missing_evidence":
                errors.append("missing_evidence")
            elif "unknown" in msg or "not grounded" in msg or "incomplete" in msg:
                errors.append(f"faithfulness:{msg}")
            else:
                warnings.append(msg)
        if faith < min_faithfulness and "missing_evidence" not in errors:
            errors.append("faithfulness_below_threshold")
    else:
        warnings.append("no_chunk_catalog_for_citation_check")

    strict_ok = ok1 and ok2 and ok3 and len(errors) == 0
    return ValidationResult(
        ok=strict_ok,
        errors=errors,
        warnings=warnings,
        faithfulness=faith,
        stem_flagged=stem_f,
    )


def filter_valid_questions(
    questions: List[Dict[str, Any]],
    chunk_by_id: Optional[Dict[str, str]],
    min_faithfulness: float = 0.45,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    kept: List[Dict[str, Any]] = []
    dropped = 0
    faith_scores: List[float] = []
    for q in questions:
        if not isinstance(q, dict):
            dropped += 1
            continue
        vr = validate_mcq_item(q, chunk_by_id, min_faithfulness=min_faithfulness)
        faith_scores.append(vr.faithfulness)
        if vr.ok and vr.faithfulness >= min_faithfulness:
            kept.append(q)
        else:
            dropped += 1
    summary = {
        "input_count": len(questions),
        "kept_count": len(kept),
        "dropped_count": dropped,
        "mean_faithfulness": (sum(faith_scores) / len(faith_scores)) if faith_scores else 0.0,
    }
    return kept, summary
