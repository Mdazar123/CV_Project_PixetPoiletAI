import asyncio
import logging
import time

import httpx

from app.core.config import settings
from app.core.errors import InferenceFailure, ModelUnavailable, ProviderRateLimited, ProviderTimeout

logger = logging.getLogger("pixelpilot.provider")

_RATE_LIMIT_ATTEMPTS = 2
_MAX_RATE_LIMIT_WAIT = 12.0


def provider_configured() -> bool:
    return bool(settings.openai_api_key.strip())


def normalize_content(content) -> str:
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                text = item.get("text") or item.get("content") or ""
                if text:
                    parts.append(str(text))
        return "\n".join(parts).strip()
    return ""


def retry_delay_seconds(response: httpx.Response) -> float | None:
    header = response.headers.get("retry-after")
    if header:
        try:
            return max(0.0, float(header))
        except ValueError:
            parsed = _parse_duration(header)
            if parsed is not None:
                return parsed
    for name in ("x-ratelimit-reset-tokens", "x-ratelimit-reset-requests"):
        parsed = _parse_duration(response.headers.get(name, ""))
        if parsed is not None:
            return parsed
    return None


def _parse_duration(value: str) -> float | None:
    text = value.strip().lower()
    if not text:
        return None
    total = 0.0
    found = False
    number = ""
    for char in text:
        if char.isdigit() or char == ".":
            number += char
            continue
        if char in "ms" and number:
            try:
                amount = float(number)
            except ValueError:
                return None
            total += amount * (60.0 if char == "m" else 1.0)
            number = ""
            found = True
            continue
        if char.isspace():
            continue
        return None
    if number:
        try:
            total += float(number)
        except ValueError:
            return None
        found = True
    return total if found else None


def _rate_limit_message(response: httpx.Response) -> str:
    delay = retry_delay_seconds(response)
    if delay is not None and delay >= 1:
        seconds = max(1, int(round(delay)))
        return (
            f"The free Groq plan is limiting this model. Wait about {seconds} seconds and ask again. "
            "No generated text was returned."
        )
    return (
        "The free Groq plan is limiting this model. Wait a few seconds and ask again. "
        "No generated text was returned."
    )


async def chat_completion(
    messages: list[dict],
    model: str,
    missing_message: str,
    max_tokens: int = 700,
) -> tuple[str, float]:
    if not provider_configured():
        raise ModelUnavailable(missing_message)
    payload = {
        "model": model,
        "temperature": 0,
        "messages": messages,
        "max_tokens": max_tokens,
    }
    timeout = httpx.Timeout(settings.provider_timeout_seconds)
    started = time.perf_counter()
    response: httpx.Response | None = None
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            for attempt in range(_RATE_LIMIT_ATTEMPTS):
                response = await client.post(
                    settings.openai_base_url.rstrip("/") + "/chat/completions",
                    headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                    json=payload,
                )
                if response.status_code != 429 or attempt + 1 >= _RATE_LIMIT_ATTEMPTS:
                    break
                delay = retry_delay_seconds(response)
                if delay is None or delay <= 0 or delay > _MAX_RATE_LIMIT_WAIT:
                    break
                logger.info("provider rate limited, retrying in %.1fs", delay)
                await asyncio.sleep(delay)
    except httpx.TimeoutException as exc:
        raise ProviderTimeout("The model provider timed out. No generated text was returned.") from exc
    except httpx.HTTPError as exc:
        raise InferenceFailure("The model provider could not be reached. No generated text was returned.") from exc
    elapsed = (time.perf_counter() - started) * 1000
    if response is None:
        raise InferenceFailure("The model provider could not be reached. No generated text was returned.")
    if response.status_code == 429:
        raise ProviderRateLimited(_rate_limit_message(response))
    if response.status_code >= 400:
        logger.info("provider status %s", response.status_code)
        raise InferenceFailure("The model provider rejected the request. No generated text was returned.")
    try:
        body = response.json()
        content = body["choices"][0]["message"]["content"]
    except (ValueError, KeyError, IndexError, TypeError) as exc:
        raise InferenceFailure("The provider response did not contain an answer. No generated text was returned.") from exc
    text = normalize_content(content)
    if not text:
        raise InferenceFailure("The provider response did not contain an answer. No generated text was returned.")
    return text, elapsed
