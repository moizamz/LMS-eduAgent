"""Short LLM-generated encouragement; falls back to templates if no API available."""

from __future__ import annotations

import logging
from typing import Any, Dict

logger = logging.getLogger(__name__)


def _template_remark(
    display_name: str,
    course_title: str,
    arm_label: str,
    xp_gain: int,
    total_xp: int,
    level: int,
    streak: int,
    new_badges: list,
) -> str:
    badge_txt = f" You unlocked {new_badges[0]['title']}!" if new_badges else ''
    if arm_label == 'xp_heavy':
        return f"Nice work, {display_name}! +{xp_gain} XP toward level {level} in {course_title}.{badge_txt}"
    if arm_label == 'streak_focus':
        return f"{display_name}, {streak}-day streak — stay consistent in {course_title}! +{xp_gain} XP.{badge_txt}"
    if arm_label == 'challenge':
        return f"You are climbing the ranks in {course_title}, {display_name}. +{xp_gain} XP (total {total_xp}).{badge_txt}"
    return f"Great job in {course_title}, {display_name}! +{xp_gain} XP. Keep the momentum.{badge_txt}"


def generate_personalized_remark(
    display_name: str,
    course_title: str,
    arm_index: int,
    arm_label: str,
    event_type: str,
    xp_gain: int,
    total_xp: int,
    level: int,
    streak: int,
    new_badges: list,
    metadata: Dict[str, Any],
) -> str:
    meta = metadata or {}
    prompt = f"""You write one short encouraging line (max 220 characters) for a learning app like Duolingo.
Student: {display_name}
Course: {course_title}
Event: {event_type}
XP gained this action: {xp_gain}
Total XP: {total_xp}
Level: {level}
Current streak (days): {streak}
Reward style: {arm_label} (balanced / xp_heavy / streak_focus / challenge — match this tone subtly)
Extra context JSON: {meta}
New badges this event: {new_badges}
Output plain text only, no quotes."""

    try:
        from quizzes.llm_service import call_groq_text, call_gemini_text

        text = call_groq_text(prompt, log_label='Groq:Nudge')
        if text and len(text) < 400:
            return text[:350]
        text = call_gemini_text(prompt, log_label='Gemini:Nudge')
        if text and len(text) < 400:
            return text[:350]
    except Exception as e:
        logger.warning('Groq/Gemini nudge failed: %s', e)

    try:
        from quizzes.llm_service import choose_ollama_model, _ollama_parse_model_ids

        import ollama
        client = ollama.Client(host='http://localhost:11434')
        ollama_model = choose_ollama_model(_ollama_parse_model_ids(client.list()))
        content = client.chat(
            model=ollama_model,
            messages=[{'role': 'user', 'content': prompt}],
            options={'temperature': 0.65, 'num_predict': 120},
        )
        msg = content.get('message') if isinstance(content, dict) else getattr(content, 'message', None)
        text = (msg.get('content') if isinstance(msg, dict) else getattr(msg, 'content', '') or '').strip()
        if text and len(text) < 400:
            return text[:350]
    except Exception as e:
        logger.debug('Ollama nudge unavailable: %s', e)

    return _template_remark(
        display_name, course_title, arm_label, xp_gain, total_xp, level, streak, new_badges
    )
