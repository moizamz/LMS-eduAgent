"""Build stable chunk IDs for RAG-grounded MCQ validation and citations."""

from __future__ import annotations

from typing import Any, Dict, List


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
