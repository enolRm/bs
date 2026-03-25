import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from eth_account.messages import encode_defunct
from web3 import Web3

from .config import settings


def calc_knowledge_hash(title: str, source: str, content: str) -> str:
    combined_string = f"{title}|{source}|{content}"
    return hashlib.sha256(combined_string.encode("utf-8")).hexdigest()


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def verify_signature(address: str, signature: str, nonce: str) -> bool:
    """验证以太坊签名"""
    message = settings.SIGNATURE_MESSAGE_TEMPLATE.format(nonce=nonce)
    message_hash = encode_defunct(text=message)
    try:
        w3 = Web3()
        recovered_address = w3.eth.account.recover_message(message_hash, signature=signature)
        return recovered_address.lower() == address.lower()
    except Exception:
        return False
