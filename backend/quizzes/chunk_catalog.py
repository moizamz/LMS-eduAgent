"""Build stable chunk IDs for RAG-grounded MCQ validation and citations."""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

_CHUNK_LECTURE_IDX = re.compile(r"^L(\d+)_", re.IGNORECASE)


def build_chunk_catalog(lecture_contents: List[Dict[str, Any]], chunk_size: int = 1200, overlap: int = 180) -> List[Dict[str, Any]]:
    from quizzes.llm_service import chunk_text
    """
    Flatten lectures into ordered chunks with IDs like L0_C0, L1_C2.
    Each dict: id, source_title, text
    """
    out: List[Dict[str, Any]] = []
    for li, lc in enumerate(lecture_contents or []):
        title = (lc.get("title") or "Lecture").strip()
        text = (lc.get("text") or "").strip()
        if not text:
            continue
        parts = chunk_text(text, chunk_size=chunk_size, overlap=overlap)
        for ci, chunk in enumerate(parts):
            cid = f"L{li}_C{ci}"
            out.append({"id": cid, "source_title": title, "text": chunk})
    return out


def catalog_chunk_map(catalog: List[Dict[str, Any]]) -> Dict[str, str]:
    return {c["id"]: c["text"] for c in catalog if c.get("id") and c.get("text")}


def format_catalog_for_prompt(catalog: List[Dict[str, Any]], max_chars: int = 12000) -> str:
    """Compact listing of chunk IDs and text for LLM (truncated globally)."""
    lines: List[str] = []
    total = 0
    for c in catalog:
        header = f"[CHUNK id={c['id']} source={c.get('source_title', '')}]\n"
        body = (c.get("text") or "")[:2000]
        block = header + body + "\n---\n"
        if total + len(block) > max_chars:
            lines.append(f"... ({len(catalog) - len(lines)} more chunks omitted for length)\n")
            break
        lines.append(block)
        total += len(block)
    return "".join(lines)


def infer_lecture_title_for_question(
    q: Dict[str, Any],
    catalog: List[Dict[str, Any]],
    lecture_contents: Optional[List[Dict[str, Any]]] = None,
) -> str:
    """
    Resolve a stable lecture display name for adaptive topic keys and prompts.

    Order: (1) model ``lecture_title`` / ``lecture`` if it matches a manifest ``source_title``;
    (2) first ``evidence`` ``chunk_id`` mapped through the catalog; (3) ``L{n}_`` index into
    ``lecture_contents`` titles.
    """
    id_to_title: Dict[str, str] = {}
    titles_order: List[str] = []
    for c in catalog or []:
        cid = c.get("id")
        st = (c.get("source_title") or "").strip()
        if cid and st:
            id_to_title[str(cid)] = st
        if st and st not in titles_order:
            titles_order.append(st)
    title_by_cf = {t.casefold(): t for t in titles_order}

    raw_lt = (q.get("lecture_title") or q.get("lecture") or "").strip()
    if raw_lt:
        canon = title_by_cf.get(raw_lt.casefold())
        if canon:
            return canon[:240]

    ev = q.get("evidence")
    if isinstance(ev, list):
        for cell in ev:
            if not isinstance(cell, dict):
                continue
            cid = str(cell.get("chunk_id") or "").strip()
            if not cid:
                continue
            if cid in id_to_title:
                return id_to_title[cid][:240]
            m = _CHUNK_LECTURE_IDX.match(cid)
            if m and lecture_contents:
                idx = int(m.group(1))
                if 0 <= idx < len(lecture_contents):
                    t = (lecture_contents[idx].get("title") or "").strip() or f"Lecture {idx + 1}"
                    return t[:240]

    return ""
