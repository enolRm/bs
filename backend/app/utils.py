import hashlib

def calc_knowledge_hash(title: str, source: str, content: str) -> str:
    combined_string = f"{title}|{source}|{content}"
    return hashlib.sha256(combined_string.encode("utf-8")).hexdigest()
