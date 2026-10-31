import httpx

from app.services.providers import retry_delay_seconds


def test_retry_delay_reads_retry_after_and_groq_reset_headers():
    assert retry_delay_seconds(httpx.Response(429, headers={"retry-after": "3.5"})) == 3.5
    assert retry_delay_seconds(httpx.Response(429, headers={"x-ratelimit-reset-tokens": "1m2.5s"})) == 62.5
    assert retry_delay_seconds(httpx.Response(429, headers={"x-ratelimit-reset-requests": "7.66s"})) == 7.66
    assert retry_delay_seconds(httpx.Response(429)) is None
