"""
RAG pipeline + Ollama (Llama3) for generating quiz questions from lecture content.
Chunks PDF text, retrieves relevant context, and uses local LLM with robust JSON parsing.
Uses streaming to avoid hanging and provide real-time progress updates.
"""

import json
import re
import time
import logging
import threading

logger = logging.getLogger(__name__)


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
def _call_ollama_streaming(client, model, messages, options, timeout_seconds=240):
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
def generate_questions_from_content(lecture_contents, num_questions=5, chunk_size=1500):
    """
    RAG pipeline: chunk lecture content, build context, call Ollama Llama3.
    lecture_contents: list of dicts with 'title' and 'text'
    num_questions: target number of questions to generate
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
        available = [
            m.get("name") if isinstance(m, dict) else getattr(m, "name", str(m))
            for m in (models.get("models") if isinstance(models, dict) else getattr(models, "models", []))
        ]
        print(f"[LLM] Ollama is running. Available models: {available}")
        if not any("llama3" in str(m) for m in available):
            raise ValueError(f"llama3 model not found in Ollama. Available: {available}. Run: ollama pull llama3")
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

    num_questions = max(1, min(15, int(num_questions)))

    user_prompt = """Generate exactly __NUM__ multiple-choice questions from this lecture content.

LECTURE CONTENT:
__CONTEXT__

RULES:
1. Output ONLY a valid JSON array. No other text.
2. Each object: "statement", "options" (array of 4 strings, correct first), "correct_index" (0-3), "explanation", "hint", "marks" (1-5), "difficulty" (easy/medium/hard), "taxonomy" (remember/understand/apply/analyze/evaluate/create).
3. Distractors must be plausible. Do not repeat lecture titles in statements.
4. Vary difficulty and taxonomy.

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
    user_prompt = user_prompt.replace("__CONTEXT__", context)

    max_retries = 3
    raw = None

    for attempt in range(max_retries):
        logger.info("[LLM] Ollama attempt %d/%d", attempt + 1, max_retries)
        print(f"\n[LLM] Ollama attempt {attempt + 1}/{max_retries}")
        try:
            content = _call_ollama_streaming(
                client=client,
                model="llama3.2:3b",
                messages=[{"role": "user", "content": user_prompt}],
                options={"temperature": 0.5, "num_predict": 1500},
                timeout_seconds=240
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
        raise ValueError("Llama3 did not return valid JSON after retries.")

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
        correct_idx = int(q.get("correct_index", 0)) % len(opts)
        questions.append({
            "statement": str(q.get("statement", "")).strip() or f"Question {i+1}",
            "options": opts,
            "correct_index": correct_idx,
            "explanation": str(q.get("explanation", "")).strip(),
            "hint": str(q.get("hint", "")).strip(),
            "marks": max(1, min(5, int(q.get("marks", 1)))),
            "difficulty": q.get("difficulty") if q.get("difficulty") in ("easy", "medium", "hard") else "medium",
            "taxonomy": q.get("taxonomy") if q.get("taxonomy") in ("remember", "understand", "apply", "analyze", "evaluate", "create") else "understand",
        })

    print(f"[LLM] Successfully built {len(questions)} questions.")
    return questions[:num_questions]


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