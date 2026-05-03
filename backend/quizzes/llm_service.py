"""
RAG pipeline for generating quiz questions from lecture content.
Provider order (low latency first): Groq → Google Gemini → local Ollama.
Chunks PDF text, retrieves relevant context, with robust JSON parsing.
Ollama uses streaming to avoid hanging and provide real-time progress updates.
"""

import json
import math
import os
import re
import time
import logging
import threading
import warnings
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


def _safe_int(raw: Any, default: int) -> int:
    """Coerce LLM JSON numbers; ``null`` / invalid → default (avoids int(None) TypeError)."""
    if raw is None:
        return default
    try:
        return int(raw)
    except (TypeError, ValueError):
        try:
            v = float(raw)
            if not math.isfinite(v):
                return default
            return int(v)
        except (TypeError, ValueError):
            return default


def _coerce_correct_index(raw: Any, nopts: int) -> int:
    if nopts <= 0:
        return 0
    return _safe_int(raw, 0) % nopts


# Appended to all MCQ generation prompts (cloud + local).
MCQ_QUALITY_RULES = """
CONTENT QUALITY (strict — follow every line):
5. Test substantive concepts from the lecture body: definitions used correctly, comparisons, procedures, cause-effect, small scenarios, or quantitative reasoning when the material supports it. Distractors must reflect common misconceptions from the domain.
6. NEVER ask: the instructor's name; course or university branding; the document/PDF/book title or filename; authors' names unless the lecture explicitly teaches about that person as core content; page numbers; "what is the name of the …" for peripheral metadata; or anything answerable without understanding the technical ideas.
7. Avoid lazy meta-questions ("according to the lecture", "what does the syllabus say"). Each statement should remain meaningful if section headings were stripped.
8. If the excerpt is thin, output fewer strong questions in valid JSON rather than filler trivia.
"""

EVIDENCE_SCHEMA_RULES = """
9. Include "evidence": an array of 1-3 objects {{"chunk_id": "<id from CHUNK MANIFEST>", "quote": "<verbatim excerpt from that chunk, ≤320 characters>"}}.
10. Each quote MUST appear verbatim (aside from whitespace) inside the referenced chunk text. The explanation must be consistent with the evidence.
"""


def get_groq_api_key() -> str:
    """Resolve Groq API key from Django settings (.env via decouple) or os.environ."""
    try:
        from django.conf import settings

        k = getattr(settings, "GROQ_API_KEY", None) or ""
        k = str(k).strip()
        if k:
            return k
    except Exception:
        pass
    return (os.environ.get("GROQ_API_KEY") or "").strip()


def get_groq_model() -> str:
    try:
        from django.conf import settings

        m = getattr(settings, "GROQ_MODEL", None) or ""
        m = str(m).strip()
        if m:
            return m
    except Exception:
        pass
    return (os.environ.get("GROQ_MODEL") or "llama-3.1-8b-instant").strip()


def call_groq_text(
    user_prompt: str,
    log_label: str = "Groq",
    *,
    max_tokens: int = 8192,
) -> Optional[str]:
    """
    Single-turn chat completion via Groq (OpenAI-compatible HTTP API).
    Returns plain text or None if unavailable / failed / empty.

    ``max_tokens`` counts toward Groq TPM / request-size limits; use a lower
    value for very large prompts (e.g. adaptive banks with chunk manifests).
    """
    api_key = get_groq_api_key()
    if not api_key:
        logger.info("[%s] Skipped: no GROQ_API_KEY", log_label)
        print(f"[{log_label}] No GROQ_API_KEY — skipping Groq.")
        return None
    try:
        from openai import OpenAI
    except ImportError as e:
        logger.warning("[%s] openai package not available: %s", log_label, e)
        print(f"[{log_label}] Install openai for Groq: pip install openai")
        return None

    model = get_groq_model()
    try:
        logger.info("[%s] Calling Groq model=%s", log_label, model)
        print(f"[{log_label}] Trying Groq model={model} …")
        client = OpenAI(api_key=api_key, base_url="https://api.groq.com/openai/v1")
        mt = max(256, min(8192, int(max_tokens)))
        resp = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": user_prompt}],
            temperature=0.35,
            max_tokens=mt,
        )
        choice = resp.choices[0] if getattr(resp, "choices", None) else None
        msg = getattr(choice, "message", None) if choice else None
        text = (getattr(msg, "content", None) or "").strip() if msg else ""
        if text:
            print(f"[{log_label}] Success ({len(text)} chars)")
            return text
        logger.warning("[%s] Empty Groq response", log_label)
    except Exception as e:
        logger.warning("[%s] Groq failed: %s", log_label, e)
        print(f"[{log_label}] Groq failed: {e}")
    return None


def get_gemini_api_key() -> str:
    """
    Resolve Gemini API key: Django settings first (from backend/.env via decouple),
    then os.environ. Decouple's config() does not populate os.environ, so only
    checking os.environ misses keys that live solely in .env.
    """
    try:
        from django.conf import settings

        k = getattr(settings, "GEMINI_API_KEY", None) or ""
        k = str(k).strip()
        if k:
            return k
    except Exception:
        pass
    return (os.environ.get("GEMINI_API_KEY") or "").strip()


def _gemini_normalize_model_id(mid: str) -> str:
    """Accept ``gemini-2.0-flash`` or full resource name ``models/gemini-2.0-flash``."""
    s = (mid or "").strip()
    if s.startswith("models/"):
        return s.split("/", 1)[1].strip()
    return s


def _gemini_user_configured_model() -> str:
    """
    Model id from .env / environment first, then Django settings (decouple loads .env into settings).
    This id is always tried before other Gemini candidates when Groq is skipped or fails.
    """
    v = _gemini_normalize_model_id(os.environ.get("GEMINI_MODEL") or "")
    if v:
        return v
    try:
        from django.conf import settings

        return _gemini_normalize_model_id(str(getattr(settings, "GEMINI_MODEL", None) or ""))
    except Exception:
        return ""


def _gemini_discover_model_ids(genai) -> List[str]:
    """Use ListModels so we only call generateContent on IDs the API actually exposes."""
    found: List[str] = []
    try:
        for m in genai.list_models():
            methods = list(getattr(m, "supported_generation_methods", []) or [])
            if "generateContent" not in methods:
                continue
            raw = (getattr(m, "name", None) or "").strip()
            if not raw:
                continue
            short = raw.split("/")[-1] if "/" in raw else raw
            if short.lower().startswith("gemini"):
                found.append(short)
    except Exception as e:
        logger.info("Gemini list_models unavailable: %s", e)

    def sort_key(n: str) -> tuple:
        u = n.lower()
        gen = 0 if any(x in u for x in ("2.5", "2.0", "exp")) else 1
        role = 0 if "flash" in u else 1
        return (gen, role, n)

    found.sort(key=sort_key)
    return found


def _gemini_static_fallback_ids() -> List[str]:
    """Versioned / preview IDs for when list_models is empty or outdated."""
    return [
        "gemini-2.5-flash",
        "gemini-2.5-flash-preview-05-20",
        "gemini-2.0-flash",
        "gemini-2.0-flash-001",
        "gemini-1.5-flash-002",
        "gemini-1.5-flash-latest",
        "gemini-1.5-pro-002",
        "gemini-1.5-pro-latest",
        # Bare 1.5 names often 404 on v1beta; try last
        "gemini-1.5-flash",
        "gemini-1.5-pro",
    ]


def _gemini_build_candidate_list(genai) -> List[str]:
    """
    Ordered Gemini candidates for fallback chain:

    1. ``GEMINI_MODEL`` from environment (``.env`` → often exported) or Django settings
    2. Other ids from ListModels (API discovery)
    3. Static fallbacks

    The configured model stays first; legacy bare 1.5 ids are deprioritized only among the tail.
    """
    seen = set()
    out: List[str] = []

    def push(mid: Optional[str]) -> None:
        s = _gemini_normalize_model_id(str(mid or ""))
        if s and s not in seen:
            seen.add(s)
            out.append(s)

    preferred = _gemini_user_configured_model()
    if preferred:
        push(preferred)

    for mid in _gemini_discover_model_ids(genai):
        push(mid)

    for mid in _gemini_static_fallback_ids():
        push(mid)

    if preferred and preferred in out:
        tail = _gemini_deprioritize_legacy_ids([x for x in out if x != preferred])
        return [preferred] + tail
    return _gemini_deprioritize_legacy_ids(out)


def _gemini_deprioritize_legacy_ids(candidates: List[str]) -> List[str]:
    """
    Bare ``gemini-1.5-flash`` / ``gemini-1.5-pro`` often 404 on current v1beta; try
    versioned IDs (from discovery / static list) first.
    """
    legacy = {"gemini-1.5-flash", "gemini-1.5-pro"}
    head = [c for c in candidates if c not in legacy]
    tail = [c for c in candidates if c in legacy]
    return head + tail


def _ollama_parse_model_ids(models_response) -> List[str]:
    rows = (
        models_response.get("models")
        if isinstance(models_response, dict)
        else getattr(models_response, "models", None) or []
    )
    names: List[str] = []
    for item in rows:
        if isinstance(item, dict):
            nid = item.get("model") or item.get("name")
        else:
            nid = getattr(item, "model", None) or getattr(item, "name", None)
        if nid:
            names.append(str(nid))
    return names


def choose_ollama_model(model_ids: List[str]) -> str:
    """Pick OLLAMA_MODEL from env/settings if installed, else first llama3* tag."""
    pref = (os.environ.get("OLLAMA_MODEL") or "").strip()
    try:
        from django.conf import settings

        pref = pref or (getattr(settings, "OLLAMA_MODEL", None) or "").strip()
    except Exception:
        pass
    if pref and pref in model_ids:
        return pref
    for n in model_ids:
        if "llama3" in n.lower():
            return n
    if model_ids:
        return model_ids[0]
    raise ValueError("No Ollama models reported by server")


def call_gemini_text(user_prompt: str, log_label: str = "Gemini") -> Optional[str]:
    """
    Run a single user-style prompt on Gemini. Returns plain text or None if
    unavailable / all models failed / empty response.

    Model order (after Groq is skipped or fails elsewhere): ``GEMINI_MODEL`` from
    ``.env``/environment or Django settings → other ListModels ids → static fallbacks.
    """
    api_key = get_gemini_api_key()
    if not api_key:
        logger.info("[%s] Skipped: no GEMINI_API_KEY in Django settings or environment", log_label)
        print(f"[{log_label}] No API key — add GEMINI_API_KEY to backend/.env (see lms_project/settings.py). Using Ollama fallback if configured.")
        return None

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", FutureWarning)
            import google.generativeai as genai
    except ImportError as e:
        logger.warning("[%s] google-generativeai not installed: %s", log_label, e)
        print(f"[{log_label}] Install: pip install google-generativeai")
        return None

    genai.configure(api_key=api_key)
    candidates = _gemini_build_candidate_list(genai)
    pref = _gemini_user_configured_model()
    if candidates:
        head = f"(configured GEMINI_MODEL first: {pref}) " if pref else ""
        print(
            f"[{log_label}] Gemini order {head}— {len(candidates)} candidates: "
            f"{', '.join(candidates[:8])}{'…' if len(candidates) > 8 else ''}"
        )

    last_err: Optional[Exception] = None
    for model_name in candidates:
        for attempt in (0, 1):
            try:
                logger.info("[%s] Calling model=%s attempt=%s", log_label, model_name, attempt)
                print(f"[{log_label}] Trying Google Gemini model={model_name} …")
                model = genai.GenerativeModel(model_name)
                resp = model.generate_content(user_prompt)
                fb = getattr(resp, "prompt_feedback", None)
                if fb and getattr(fb, "block_reason", None):
                    logger.warning("[%s] Blocked by safety filters: %s", log_label, fb.block_reason)
                    last_err = RuntimeError(f"blocked: {fb.block_reason}")
                    break
                text = getattr(resp, "text", None)
                if not text and getattr(resp, "candidates", None):
                    try:
                        text = resp.candidates[0].content.parts[0].text
                    except Exception:
                        text = ""
                text = (text or "").strip()
                if text:
                    print(f"[{log_label}] Success with model={model_name} ({len(text)} chars)")
                    return text
                last_err = RuntimeError("empty response text")
                break
            except Exception as e:
                last_err = e
                err_s = str(e).lower()
                is_rate = "429" in str(e) or "resource exhausted" in err_s or "quota" in err_s
                if attempt == 0 and is_rate:
                    wait_s = 4.0
                    m = re.search(r"retry in ([\d.]+)\s*s", err_s)
                    if m:
                        try:
                            wait_s = min(35.0, float(m.group(1)) + 1.0)
                        except ValueError:
                            pass
                    logger.warning("[%s] Rate limited on %s; retry in %.1fs", log_label, model_name, wait_s)
                    print(f"[{log_label}] Rate limited ({model_name}); waiting {wait_s:.0f}s once…")
                    time.sleep(wait_s)
                    continue
                logger.warning("[%s] Model %s failed: %s", log_label, model_name, e)
                print(f"[{log_label}] Model {model_name} failed: {e}")
                break

    if last_err:
        logger.warning("[%s] All Gemini models failed; last error: %s", log_label, last_err)
        print(f"[{log_label}] All Gemini attempts failed ({last_err}). Falling back to Ollama if applicable.")
    return None


# ---------------------------------------------------------
# PDF TEXT EXTRACTION
# ---------------------------------------------------------
def extract_text_from_pdf(file_path):
    """Extract text from a PDF file."""
    logger.info("[LLM] extract_text_from_pdf: %s", file_path)
    print(f"[LLM] extract_text_from_pdf: {file_path}")
    try:
        from pypdf import PdfReader
        reader = PdfReader(file_path)
        text_parts = []
        for page in reader.pages:
            t = page.extract_text()
            if t:
                text_parts.append(t)
        result = "\n\n".join(text_parts) if text_parts else ""
        logger.info("[LLM] Extracted %d chars from PDF", len(result))
        print(f"[LLM] Extracted {len(result)} chars from PDF")
        return result
    except Exception as e:
        logger.exception("[LLM] PDF extraction error: %s", e)
        print(f"[LLM] PDF extraction error: {e}")
        return f"[Could not extract PDF text: {e}]"


# ---------------------------------------------------------
# RAG: CHUNKING & RETRIEVAL
# ---------------------------------------------------------
def chunk_text(text, chunk_size=1500, overlap=200):
    """Split text into overlapping chunks for RAG context."""
    if not text or not text.strip():
        return []
    text = text.strip()
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        if chunk.strip():
            chunks.append(chunk.strip())
        start = end - overlap if end < len(text) else len(text)
    return chunks


def build_rag_context(lecture_contents, max_chars=8000):
    """
    Build RAG context from lecture contents.
    Takes chunks from each lecture up to max_chars total.
    """
    all_chunks = []
    for lc in lecture_contents:
        title = lc.get('title', 'Lecture')
        text = lc.get('text', '')
        if not text.strip():
            continue
        chunks = chunk_text(text)
        for c in chunks:
            all_chunks.append(f"[{title}]\n{c}")
    combined = "\n\n---\n\n".join(all_chunks)
    if len(combined) > max_chars:
        combined = combined[:max_chars] + "\n\n[...truncated]"
    return combined


def generate_chat_reply_with_fallback(message, lecture_contents=None):
    """
    Chat with optional context extracted from uploaded files.
    Tries Groq first (low latency), then Gemini, then local Ollama streaming.
    """
    lecture_contents = lecture_contents or []
    context = build_rag_context(lecture_contents, max_chars=8000)

    prompt = f"""You are a helpful course assistant.

CONTEXT (from user uploaded files, may be empty):
{context}

USER MESSAGE:
{message}

Answer clearly and concisely. If the context is insufficient, say what is missing."""
    groq_text = call_groq_text(prompt, log_label="Groq:Chat")
    if groq_text:
        return groq_text
    gemini_text = call_gemini_text(prompt, log_label="Gemini:Chat")
    if gemini_text:
        return gemini_text

    # Fallback: local Ollama
    try:
        import ollama
        client = ollama.Client(host="http://localhost:11434")
        _names = _ollama_parse_model_ids(client.list())
        ollama_model = choose_ollama_model(_names)
        print(f"[LLM] Chat fallback Ollama model: {ollama_model}")
    except Exception as e:
        raise ValueError(f"Neither Groq, Gemini, nor Ollama is available. Ollama error: {e}")

    system_prompt = "You are a helpful course assistant. Use the provided context when relevant."
    user_prompt = f"""CONTEXT:
{context}

USER MESSAGE:
{message}
"""
    return _call_ollama_streaming(
        client=client,
        model=ollama_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        options={"temperature": 0.3, "num_predict": 800},
        timeout_seconds=300,
    ).strip()


# ---------------------------------------------------------
# SAFE JSON PARSING
# ---------------------------------------------------------
def safe_json_load(text):
    """Extract and parse JSON from model output with multiple fallbacks."""
    if not text or not isinstance(text, str):
        return None
    text = text.strip()
    # Remove markdown code blocks
    for pattern in [r'```(?:json)?\s*([\s\S]*?)\s*```', r'```\s*([\s\S]*?)\s*```']:
        m = re.search(pattern, text)
        if m:
            text = m.group(1).strip()
    # Try direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Try to extract [ ... ] array
    arr_match = re.search(r'\[\s*\{[\s\S]*\}\s*\]', text)
    if arr_match:
        try:
            raw = arr_match.group(0)
            return json.loads(raw)
        except json.JSONDecodeError:
            pass
    # Try to find and fix common issues
    text = re.sub(r',\s*}', '}', text)
    text = re.sub(r',\s*]', ']', text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    return None


# ---------------------------------------------------------
# OLLAMA STREAMING CALL WITH TIMEOUT WATCHDOG
# ---------------------------------------------------------
def _call_ollama_streaming(client, model, messages, options, timeout_seconds=300):
    """
    Call ollama with streaming so we get real-time token output.
    A watchdog thread prints status and raises an error if no tokens arrive
    within timeout_seconds.
    Returns the full response content string.
    """
    result = {"content": "", "error": None, "done": False}
    last_token_time = [time.time()]

    def watchdog():
        while not result["done"]:
            time.sleep(5)
            if result["done"]:
                return
            elapsed = time.time() - last_token_time[0]
            if elapsed > timeout_seconds:
                result["error"] = f"Timeout: no response from Ollama after {timeout_seconds}s"
                result["done"] = True
                print(f"\n[LLM] TIMEOUT — no tokens received for {timeout_seconds}s. Aborting.")
                return
            elif elapsed > 10:
                print(f"[LLM] Still waiting... ({int(elapsed)}s since last token, {len(result['content'])} chars received so far)")

    wd = threading.Thread(target=watchdog, daemon=True)
    wd.start()

    try:
        print("[LLM] Sending request to Ollama (streaming mode)...")
        stream = client.chat(
            model=model,
            messages=messages,
            options=options,
            stream=True
        )

        token_count = 0
        print("[LLM] Receiving response: ", end="", flush=True)

        for chunk in stream:
            if result.get("error"):
                break

            last_token_time[0] = time.time()

            msg = chunk.get("message") if isinstance(chunk, dict) else getattr(chunk, "message", None)
            token = ""
            if isinstance(msg, dict):
                token = msg.get("content", "") or ""
            elif msg is not None:
                token = getattr(msg, "content", "") or ""

            if token:
                result["content"] += token
                token_count += 1
                # Print a dot every 20 tokens so user sees live progress
                if token_count % 20 == 0:
                    print(".", end="", flush=True)

            # Check if stream signals completion
            done = chunk.get("done") if isinstance(chunk, dict) else getattr(chunk, "done", False)
            if done:
                break

        print(f" done! (total: {len(result['content'])} chars, {token_count} tokens)")

    except Exception as e:
        result["error"] = str(e)
        print(f"\n[LLM] Streaming error: {e}")
    finally:
        result["done"] = True

    if result["error"]:
        raise ValueError(result["error"])

    return result["content"]


# ---------------------------------------------------------
# OLLAMA LLM - RAG-BASED QUESTION GENERATION
# ---------------------------------------------------------
def generate_questions_from_content(
    lecture_contents,
    num_questions=5,
    chunk_size=1500,
    manifest_block: str = "",
    require_evidence_rules: bool = False,
):
    """
    RAG pipeline: chunk lecture content, build context, call Ollama Llama3.
    lecture_contents: list of dicts with 'title' and 'text'
    num_questions: target number of questions to generate
    Optional manifest_block: CHUNK MANIFEST text for grounded evidence fields.
    Returns list of question dicts.
    """
    logger.info("[LLM] generate_questions_from_content: %d lectures, num_questions=%s", len(lecture_contents), num_questions)
    print(f"[LLM] generate_questions_from_content lectures={len(lecture_contents)} num_questions={num_questions}")

    try:
        import ollama
        logger.info("[LLM] ollama module imported")
        print("[LLM] ollama module imported")
    except ImportError as e:
        logger.error("[LLM] ollama not installed: %s", e)
        print(f"[LLM] ollama not installed: {e}")
        raise ValueError("ollama package not installed. Run: pip install ollama")

    # Check Ollama is reachable before trying to generate
    print("[LLM] Checking Ollama connection...")
    try:
        import ollama
        client = ollama.Client(host="http://localhost:11434")
        models = client.list()
        available = _ollama_parse_model_ids(models)
        print(f"[LLM] Ollama is running. Available models: {available}")
        ollama_model = choose_ollama_model(available)
        print(f"[LLM] Using Ollama model: {ollama_model}")
    except ValueError:
        raise
    except Exception as e:
        raise ValueError(f"Cannot connect to Ollama at localhost:11434. Is it running? Start it with: ollama serve\nError: {e}")

    context = build_rag_context(lecture_contents, max_chars=8000)
    logger.info("[LLM] RAG context length: %d chars", len(context or ''))
    print(f"[LLM] RAG context length: {len(context or '')} chars")
    if not context.strip():
        logger.warning("[LLM] No lecture content in context")
        raise ValueError("No lecture content provided")

    num_questions = max(1, min(45, int(num_questions)))

    extra_ev = EVIDENCE_SCHEMA_RULES if require_evidence_rules else ""

    user_prompt = """Generate exactly __NUM__ multiple-choice questions from this lecture content.

LECTURE CONTENT:
__CONTEXT__

RULES:
1. Output ONLY a valid JSON array. No other text.
2. Each object: "statement", "options" (array of 4 strings, correct first), "correct_index" (0-3), "explanation", "hint", "marks" (1-5), "difficulty" (easy/medium/hard), "taxonomy" (remember/understand/apply/analyze/evaluate/create).
3. Distractors must be plausible. Do not repeat lecture titles in statements.
4. Vary difficulty and taxonomy.
""" + MCQ_QUALITY_RULES + extra_ev + """

Example format:
[{{"statement":"What is X?","options":["A","B","C","D"],"correct_index":0,"explanation":"Because...","hint":"Consider...","marks":1,"difficulty":"medium","taxonomy":"understand"}}]

Examples:
[
  {
    "statement": "Which of the following best explains why overfitting occurs in machine learning models?",
    "options": [
      "The model learns noise and specific patterns in the training data that do not generalize to new data.",
      "The model has too few parameters to capture the underlying data distribution.",
      "The training dataset is perfectly representative of real-world data.",
      "The optimization algorithm converges too quickly."
    ],
    "correct_index": 0,
    "explanation": "Overfitting occurs when a model captures noise and idiosyncratic patterns from training data, leading to poor generalization on unseen data.",
    "hint": "Think about what happens when a model memorizes rather than generalizes.",
    "marks": 2,
    "difficulty": "medium",
    "taxonomy": "understand"
  }
]

[
  {
    "statement": "A dataset has 10,000 samples and 5 features. A linear regression model performs poorly on unseen data but has near-zero training error. Which action would most effectively reduce the problem?",
    "options": [
      "Apply regularization such as Ridge or Lasso regression.",
      "Increase the learning rate of the optimizer.",
      "Remove all training samples with low variance.",
      "Reduce the dataset size to 1,000 samples."
    ],
    "correct_index": 0,
    "explanation": "The model is likely overfitting. Regularization penalizes large coefficients, reducing variance and improving generalization.",
    "hint": "Consider techniques that reduce model complexity.",
    "marks": 3,
    "difficulty": "medium",
    "taxonomy": "apply"
  }
]

[
  {
    "statement": "Two classification models achieve 95% accuracy. Model A has high precision but low recall, while Model B has balanced precision and recall. In a medical diagnosis context, which model is generally preferable and why?",
    "options": [
      "Model B, because balanced precision and recall reduce the risk of missing true positive cases.",
      "Model A, because high precision ensures fewer false positives.",
      "Model A, because accuracy is the only metric that matters.",
      "Both are equivalent since they have identical accuracy."
    ],
    "correct_index": 0,
    "explanation": "In medical diagnosis, false negatives can be critical. A balanced recall reduces the likelihood of missing actual positive cases.",
    "hint": "Consider the cost of false negatives in healthcare.",
    "marks": 4,
    "difficulty": "hard",
    "taxonomy": "analyze"
  }
]
"""

    user_prompt = user_prompt.replace("__NUM__", str(num_questions))
    ctx_block = context
    if manifest_block and str(manifest_block).strip():
        ctx_block = context + "\n\n--- CHUNK MANIFEST (IDs for evidence.chunk_id) ---\n" + str(manifest_block).strip()
    user_prompt = user_prompt.replace("__CONTEXT__", ctx_block)

    max_retries = 3
    raw = None

    for attempt in range(max_retries):
        logger.info("[LLM] Ollama attempt %d/%d", attempt + 1, max_retries)
        print(f"\n[LLM] Ollama attempt {attempt + 1}/{max_retries}")
        try:
            content = _call_ollama_streaming(
                client=client,
                model=ollama_model,
                messages=[{"role": "user", "content": user_prompt}],
                options={"temperature": 0.5, "num_predict": 1500},
                timeout_seconds=300
            )
            logger.info("[LLM] Response content length: %d, preview: %s", len(content), content[:200])
            print(f"[LLM] Response preview: {content[:300]}")

            if not content.strip():
                raise ValueError("Empty response from Llama3")

        except Exception as e:
            logger.exception("[LLM] Ollama chat error: %s", e)
            print(f"[LLM] Ollama chat error: {e}")
            if attempt == max_retries - 1:
                raise ValueError(f"Ollama failed after {max_retries} attempts: {e}")
            wait = 3 * (attempt + 1)
            print(f"[LLM] Waiting {wait}s before retry...")
            time.sleep(wait)
            continue

        raw = safe_json_load(content)
        logger.info("[LLM] Parsed JSON ok=%s len=%s", raw is not None, len(raw) if isinstance(raw, list) else 0)
        print(f"[LLM] Parsed JSON ok={raw is not None} len={len(raw) if isinstance(raw, list) else 'n/a'}")

        if raw is not None and isinstance(raw, list) and len(raw) > 0:
            break

        if attempt < max_retries - 1:
            print("[LLM] Response was not valid JSON, retrying with stricter prompt...")
            user_prompt += "\n\nYour previous response was not valid JSON. Output ONLY a JSON array, nothing else."
    else:
        logger.error("[LLM] No valid JSON after %d retries", max_retries)
        print(f"[LLM] No valid JSON after {max_retries} retries")
        # Graceful fallback: return no questions instead of raising,
        # so API callers can handle this as "no results" rather than a server error.
        return []

    questions = []
    for i, q in enumerate(raw):
        if not isinstance(q, dict):
            continue
        opts = q.get("options", [])
        if not isinstance(opts, list) or len(opts) < 2:
            continue
        opts = [str(o).strip() for o in opts if str(o).strip()]
        if len(opts) > 4:
            opts = opts[:4]
        if not opts:
            continue
        marks_val = _safe_int(q.get("marks"), 1)
        correct_idx = _coerce_correct_index(q.get("correct_index"), len(opts))
        row: Dict[str, Any] = {
            "statement": str(q.get("statement", "")).strip() or f"Question {i+1}",
            "options": opts,
            "correct_index": correct_idx,
            "explanation": str(q.get("explanation", "")).strip(),
            "hint": str(q.get("hint", "")).strip(),
            "marks": max(1, min(5, marks_val)),
            "difficulty": q.get("difficulty") if q.get("difficulty") in ("easy", "medium", "hard") else "medium",
            "taxonomy": q.get("taxonomy") if q.get("taxonomy") in ("remember", "understand", "apply", "analyze", "evaluate", "create") else "understand",
        }
        ev = q.get("evidence")
        if isinstance(ev, list) and ev:
            row["evidence"] = ev
        questions.append(row)

    print(f"[LLM] Successfully built {len(questions)} questions.")
    return questions[:num_questions]


def _parse_mc_questions_from_llm_text(text: Optional[str], num_questions: int, max_items: int = 15) -> List[dict]:
    """Parse JSON array of MCQ objects from a single model response string."""
    if not text or not isinstance(text, str):
        return []
    text = text.strip()
    lb = text.find("[")
    if lb > 0:
        text = text[lb:]
    raw = safe_json_load(text)
    if not raw or not isinstance(raw, list):
        return []
    num_questions = max(1, min(max_items, int(num_questions)))
    questions = []
    for i, q in enumerate(raw):
        if not isinstance(q, dict):
            continue
        opts = q.get("options", [])
        if not isinstance(opts, list) or len(opts) < 2:
            continue
        opts = [str(o).strip() for o in opts if str(o).strip()]
        if len(opts) > 4:
            opts = opts[:4]
        if not opts:
            continue
        marks_val = _safe_int(q.get("marks"), 1)
        correct_idx = _coerce_correct_index(q.get("correct_index"), len(opts))
        row: Dict[str, Any] = {
            "statement": str(q.get("statement", "")).strip() or f"Question {i+1}",
            "options": opts,
            "correct_index": correct_idx,
            "explanation": str(q.get("explanation", "")).strip(),
            "hint": str(q.get("hint", "")).strip(),
            "marks": max(1, min(5, marks_val)),
            "difficulty": q.get("difficulty") if q.get("difficulty") in ("easy", "medium", "hard") else "medium",
            "taxonomy": q.get("taxonomy") if q.get("taxonomy") in ("remember", "understand", "apply", "analyze", "evaluate", "create") else "understand",
        }
        ev = q.get("evidence")
        if isinstance(ev, list) and ev:
            row["evidence"] = ev
        questions.append(row)
    return questions[:num_questions]


def generate_adaptive_question_bank(
    lecture_contents: List[Dict[str, Any]],
    bank_size: int,
    chunk_size: int = 1200,
    learner_context: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Grounded MCQ bank with validation metrics for adaptive practice.
    Returns {questions, quality_report, chunk_catalog_ids}.

    ``learner_context`` optional text (theta, topic stats, prior sessions) appended to the prompt
    so the next bank can target weak areas across practice sets.
    """
    from quizzes.chunk_catalog import build_chunk_catalog, catalog_chunk_map, format_catalog_for_prompt
    from quizzes.mcq_validation import filter_valid_questions
    from quizzes.adaptive_practice import TAXONOMIES

    t0 = time.monotonic()
    catalog = build_chunk_catalog(lecture_contents, chunk_size=chunk_size, overlap=180)
    chunk_map = catalog_chunk_map(catalog)
    # Keep prompt compact: Groq free tier TPM rejects ~9k+ token requests on 8b instant.
    manifest = format_catalog_for_prompt(catalog, max_chars=5200)
    context = build_rag_context(lecture_contents, max_chars=2800)

    n = max(1, min(45, int(bank_size)))
    gen_n = min(45, n + 6)

    prompt = f"""Generate exactly {gen_n} multiple-choice questions from this lecture material.

A CHUNK MANIFEST with stable IDs is provided. Each question MUST include grounded evidence citing chunk IDs from the manifest.

CHUNK MANIFEST:
{manifest}

SUPPORTING CONTEXT (may overlap the manifest):
{context}
{f"LEARNER PROGRESS (same course — weight generation toward weak Bloom levels / difficulties; avoid repeating only mastered topics):{chr(10)}{learner_context.strip()}{chr(10)}" if (learner_context and str(learner_context).strip()) else ""}
RULES:
1. Output ONLY a valid JSON array.
2. Each object: "statement", "options" (array of 4 strings; place the correct answer first in the array), "correct_index" (0-3 matching that order), "explanation", "hint", "marks" (1-5), "difficulty" (easy/medium/hard), "taxonomy" (remember/understand/apply/analyze/evaluate/create), and "evidence" (array of 1-3 objects with "chunk_id" and "quote").
3. Distractors must be plausible domain misconceptions, not joke answers.
4. Vary difficulty and taxonomy across the set.
{MCQ_QUALITY_RULES}
{EVIDENCE_SCHEMA_RULES}
"""

    used_provider = "none"
    raw: List[dict] = []
    gem_text: Optional[str] = None
    logger.info(
        "[AdaptiveBank] start bank_size=%s gen_n=%s catalog_entries=%s manifest_chars=%s context_chars=%s",
        bank_size,
        gen_n,
        len(catalog),
        len(manifest),
        len(context),
    )
    print(
        f"[AdaptiveBank] start bank_size={bank_size} gen_n={gen_n} "
        f"catalog={len(catalog)} manifest_chars={len(manifest)} context_chars={len(context)}"
    )

    groq_text = call_groq_text(prompt, log_label="Groq:AdaptiveBank", max_tokens=8192)
    if groq_text:
        used_provider = "groq"
        raw = _parse_mc_questions_from_llm_text(groq_text, gen_n, max_items=45)
        logger.info(
            "[AdaptiveBank] after Groq: text_chars=%s parsed_items=%s",
            len(groq_text),
            len(raw),
        )
        print(f"[AdaptiveBank] after Groq: text_chars={len(groq_text)} parsed_items={len(raw)}")

    # Gemini only when Groq did not return a body (HTTP/empty). If Groq returned
    # text but JSON failed to parse, fall through to Ollama — do not call Gemini.
    if not raw and not groq_text:
        gem_text = call_gemini_text(prompt, log_label="Gemini:AdaptiveBank")
        if gem_text:
            used_provider = "gemini"
            raw = _parse_mc_questions_from_llm_text(gem_text, gen_n, max_items=45)
            logger.info(
                "[AdaptiveBank] after Gemini: text_chars=%s parsed_items=%s",
                len(gem_text),
                len(raw),
            )
            print(f"[AdaptiveBank] after Gemini: text_chars={len(gem_text)} parsed_items={len(raw)}")

    # Ollama only when no cloud body implied a successful *response*: if Gemini returned text but
    # JSON parse yielded nothing, do not call local LLM (same policy as Groq→Gemini).
    if not raw:
        if gem_text:
            logger.error(
                "[AdaptiveBank] Gemini returned %s chars but parser produced 0 items; skipping Ollama",
                len(gem_text),
            )
            print(
                f"[AdaptiveBank] ERROR Gemini body present ({len(gem_text)} chars) but 0 parsed MCQs — "
                "not calling Ollama."
            )
            raise ValueError(
                "Adaptive bank: Gemini returned a response but no multiple-choice items could be parsed "
                "(output may be prose, malformed JSON, or truncated). Try lowering bank_multiplier / "
                "num_questions, or adjust GEMINI_MODEL."
            )
        used_provider = "ollama" if used_provider == "none" else used_provider
        reason = "Groq had no body" if not groq_text else "Groq body present but 0 parsed items"
        logger.info(
            "[AdaptiveBank] invoking Ollama (%s); used_provider=%s",
            reason,
            used_provider,
        )
        print(f"[AdaptiveBank] invoking Ollama ({reason}) used_provider={used_provider}")
        ollama_raw = generate_questions_from_content(
            lecture_contents,
            num_questions=gen_n,
            chunk_size=chunk_size,
            manifest_block=manifest,
            require_evidence_rules=True,
        )
        if ollama_raw:
            used_provider = "ollama"
            raw = ollama_raw
        logger.info("[AdaptiveBank] after Ollama: parsed_items=%s", len(raw))
        print(f"[AdaptiveBank] after Ollama: parsed_items={len(raw)}")

    if not raw:
        raise ValueError(
            "Adaptive bank: no multiple-choice items could be parsed from any provider. "
            "If Groq returned text but JSON failed, Ollama was tried next; if Groq had no body and Gemini "
            "was skipped or failed, ensure Ollama is running or fix API keys. "
            "You can also lower bank_multiplier / num_questions."
        )

    kept, summ = filter_valid_questions(raw, chunk_map, min_faithfulness=0.45)
    logger.info(
        "[AdaptiveBank] validation strict: kept=%s dropped=%s mean_faith=%s",
        summ.get("kept_count"),
        summ.get("dropped_count"),
        round(float(summ.get("mean_faithfulness") or 0.0), 4),
    )
    print(
        f"[AdaptiveBank] validation strict: kept={summ.get('kept_count')} "
        f"dropped={summ.get('dropped_count')} mean_faith={summ.get('mean_faithfulness')}"
    )
    if len(kept) < max(4, n // 2):
        kept2, summ2 = filter_valid_questions(raw, None, min_faithfulness=0.0)
        if len(kept2) > len(kept):
            kept, summ = kept2, summ2
            summ["relaxed_citations"] = True
            logger.info(
                "[AdaptiveBank] validation relaxed citations: kept=%s dropped=%s",
                summ.get("kept_count"),
                summ.get("dropped_count"),
            )
            print(
                f"[AdaptiveBank] validation relaxed: kept={summ.get('kept_count')} "
                f"dropped={summ.get('dropped_count')}"
            )

    if not kept:
        logger.error(
            "[AdaptiveBank] all items dropped after validation raw_input=%s chunk_ids=%s",
            len(raw),
            len(chunk_map),
        )
        print(f"[AdaptiveBank] ERROR all items dropped raw_input={len(raw)} chunk_map={len(chunk_map)}")
        raise ValueError("Validation removed all generated questions; try different PDFs or a larger bank_size.")

    kept = kept[:n]

    t1 = time.monotonic()
    latency_ms = int((t1 - t0) * 1000)
    prompt_chars = len(prompt)
    try:
        raw_chars = len(json.dumps(raw, allow_nan=False)) if raw else 0
    except (TypeError, ValueError):
        raw_chars = 0
    tokens_est = int(prompt_chars / 4 + raw_chars / 4)

    cov = {tx: 0 for tx in TAXONOMIES}
    for q in kept:
        tx = q.get("taxonomy")
        if tx in cov:
            cov[tx] += 1
    covered = sum(1 for tx in TAXONOMIES if cov.get(tx, 0) > 0)
    coverage_pct = round(100.0 * covered / len(TAXONOMIES), 1)

    faith_vals: List[float] = []
    for q in kept:
        from quizzes.mcq_validation import validate_mcq_item

        vr = validate_mcq_item(q, chunk_map, min_faithfulness=0.0)
        fv = float(vr.faithfulness)
        faith_vals.append(fv if math.isfinite(fv) else 0.0)
    faith_mean = round(sum(faith_vals) / max(1, len(faith_vals)), 3)
    if not math.isfinite(faith_mean):
        faith_mean = 0.0

    report = {
        "latency_ms": latency_ms,
        "provider": used_provider,
        "tokens_estimated": tokens_est,
        "tokens_per_item_est": round(tokens_est / max(1, len(kept)), 1),
        "validation_summary": summ,
        "faithfulness_mean": faith_mean,
        "faithfulness_pct_display": round(100.0 * faith_mean, 1) if math.isfinite(faith_mean) else 0.0,
        "coverage_blueprint_pct": coverage_pct,
        "taxonomy_counts": cov,
        "p_value_note": "Empirical difficulty (p-value) updates as learners respond; see stratum_accuracy in your policy state.",
        "discrimination_note": "Point-biserial is computed when enough attempts exist per stratum (dashboard aggregates).",
        "human_review_sample_pct": None,
        "adaptive_engine": "hybrid_tabular_q_ucb_linear_td_with_theta_topic_balance",
    }
    out = {
        "questions": kept,
        "quality_report": report,
        "chunk_catalog_ids": [c.get("id") for c in catalog if c.get("id")],
    }
    logger.info(
        "[AdaptiveBank] done provider=%s final_kept=%s coverage_pct=%s faith_mean=%s",
        used_provider,
        len(kept),
        coverage_pct,
        faith_mean,
    )
    print(
        f"[AdaptiveBank] done provider={used_provider} final_kept={len(kept)} "
        f"coverage_pct={coverage_pct} faith_mean={faith_mean}"
    )
    return out


def generate_questions_with_fallback(lecture_contents, num_questions=5, chunk_size=1500):
    """
    Try Groq first (low latency), then Gemini, then local Ollama.
    """
    num_questions = max(1, min(15, int(num_questions)))

    context = build_rag_context(lecture_contents, max_chars=8000)
    if not context.strip():
        raise ValueError("No lecture content provided")

    prompt = f"""Generate exactly {num_questions} multiple-choice questions from this lecture content.

LECTURE CONTENT:
{context}

RULES:
1. Output ONLY a valid JSON array. No other text.
2. Each object: "statement", "options" (array of 4 strings, correct first), "correct_index" (0-3), "explanation", "hint", "marks" (1-5), "difficulty" (easy/medium/hard), "taxonomy" (remember/understand/apply/analyze/evaluate/create).
3. Distractors must be plausible. Do not repeat lecture titles in statements.
4. Vary difficulty and taxonomy.
{MCQ_QUALITY_RULES}
"""
    groq_q = _parse_mc_questions_from_llm_text(call_groq_text(prompt, log_label="Groq:Questions"), num_questions)
    if groq_q:
        logger.info("[LLM] Parsed %d questions from Groq", len(groq_q))
        return groq_q

    gem_q = _parse_mc_questions_from_llm_text(call_gemini_text(prompt, log_label="Gemini:Questions"), num_questions)
    if gem_q:
        logger.info("[LLM] Parsed %d questions from Gemini", len(gem_q))
        return gem_q

    logger.warning("[LLM] Groq + Gemini failed or invalid JSON; falling back to Ollama")
    return generate_questions_from_content(lecture_contents, num_questions=num_questions, chunk_size=chunk_size)


# # -------------------------------
# # Example Usage
# # -------------------------------
# if __name__ == "__main__":

#     # Replace with your actual PDF path, e.g.:
#     # pdf_path = r"D:\Workspace\FYP\EduAgent standalone\LMS-eduAgent\backend\media\course_lectures\Lecture_02_Compiler_Vs_Interpreter.pdf"
#     pdf_path = "D:\Workspace\FYP\EduAgent standalone\LMS-eduAgent\backend\quizzes\A1 solution.pdf"

#     print(f"Extracting text from: {pdf_path}")
#     pdf_text = extract_text_from_pdf(pdf_path)

#     if not pdf_text.strip() or pdf_text.startswith("[Could not"):
#         print("PDF extraction failed, using fallback sample text...")
#         pdf_text = """
#         A compiler translates the entire source code into machine code before execution.
#         Examples include GCC for C/C++. The compiled output is a standalone executable.

#         An interpreter executes source code line by line without prior full translation.
#         Examples include Python and JavaScript interpreters.

#         Key differences:
#         - Compilers are faster at runtime since translation is done beforehand.
#         - Interpreters are easier to debug since errors are caught line by line.
#         - Compilers produce platform-specific binaries.
#         - Interpreters are generally more portable across platforms.

#         Some languages use a hybrid approach, compiling to bytecode first (e.g. Java),
#         which is then interpreted by a virtual machine (JVM).
#         """

#     lecture_data = [{"title": "Sample Lecture", "text": pdf_text}]

#     print("\nGenerating questions...")
#     questions = generate_questions_from_content(lecture_data, num_questions=3)

#     print(f"\n{'='*50}")
#     print(f"Generated {len(questions)} questions:")
#     print('='*50)
#     print(json.dumps(questions, indent=2))