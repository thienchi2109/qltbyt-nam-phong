import re
import unicodedata


_NON_WORD_RE = re.compile(r"[^a-z0-9]+")
_SPACE_RE = re.compile(r"\s+")


def normalize_text(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value)
    without_marks = "".join(
        char for char in decomposed if not unicodedata.combining(char)
    )
    lowered = without_marks.lower()
    words_only = _NON_WORD_RE.sub(" ", lowered)
    return _SPACE_RE.sub(" ", words_only).strip()
