import re


EMAIL_RE = re.compile(r"\b[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}\b")
PHONE_RE = re.compile(r"\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b")
SCRIPT_RE = re.compile(r"<\s*script", re.IGNORECASE)


def validate_text(field: str, value: str | None) -> None:
    if value is None:
        return
    if SCRIPT_RE.search(value):
        raise ValueError(f"{field} contains disallowed script content")
    if EMAIL_RE.search(value) or PHONE_RE.search(value):
        raise ValueError(f"{field} contains possible PII")
