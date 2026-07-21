import re

def sanitize_index_name(user: str, suffix: str = "-index", max_length: int = 45) -> str:
    """Return a Pinecone-compliant index name derived from `user`.

    Rules:
    - lower-case
    - only a-z, 0-9 and '-'
    - replace invalid chars with '-'
    - collapse multiple '-' and trim leading/trailing '-'
    - truncate to `max_length`
    """
    raw = f"{user}{suffix}"
    name = raw.lower()
    name = re.sub(r"[^a-z0-9-]", "-", name)
    name = re.sub(r"-+", "-", name)
    name = name.strip("-")
    if len(name) > max_length:
        name = name[:max_length].rstrip("-")
    return name
