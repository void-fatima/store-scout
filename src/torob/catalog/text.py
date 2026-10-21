"""One normalization policy shared by the importer and query parser."""

import re
import unicodedata

_TRANSLATION = str.maketrans("يىك۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "ییک01234567890123456789")


def normalize_text(value: str) -> str:
    value = unicodedata.normalize("NFKC", value).translate(_TRANSLATION).casefold()
    value = "".join(char for char in value if unicodedata.category(char) != "Mn" and char != "ـ")
    return " ".join(re.findall(r"[^\W_]+", value, flags=re.UNICODE))


def fts_query(value: str) -> str:
    # Only normalized letter/digit tokens reach FTS syntax, never user operators.
    return " AND ".join(f'"{token}"*' for token in normalize_text(value).split())
