import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User
from ..schemas import NonceResponse, LoginRequest, Token, UserAuth
from ..utils import create_access_token, verify_signature
from ..dependencies import get_current_user

router = APIRouter(
    prefix="/auth",
    tags=["auth"]
)


@router.post("/nonce", response_model=NonceResponse)
async def get_nonce(user_auth: UserAuth, db: Session = Depends(get_db)):
    """获取登录所需的随机 nonce"""
    address = user_auth.address.lower()
    
    # 我们仍然需要一个地方存 nonce。如果用户不存在，我们也暂时创建一个用户记录，
    # 但它的 role 是 NORMAL。只有在 /login 成功后，这个用户才算正式“激活”。
    user = db.query(User).filter(User.address == address).first()
    
    nonce = str(uuid.uuid4())
    
    if not user:
        user = User(address=address, nonce=nonce)
        db.add(user)
    else:
        user.nonce = nonce
    
    db.commit()
    return {"nonce": nonce}


@router.post("/login", response_model=Token)
async def login(login_req: LoginRequest, db: Session = Depends(get_db)):
    """通过钱包签名登录，完成身份验证"""
    address = login_req.address.lower()
    signature = login_req.signature
    
    user = db.query(User).filter(User.address == address).first()
    if not user or not user.nonce:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nonce not found. Please call /nonce first."
        )
    
    # 核心：验证签名以确认用户确实拥有该钱包私钥
    is_valid = verify_signature(address, signature, user.nonce)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid signature: Authentication failed."
        )
    
    # 验证通过，清除 nonce
    user.nonce = None
    db.commit()
    
    access_token = create_access_token(data={"sub": address})
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me")
async def read_users_me(current_user: User = Depends(get_current_user)):
    """获取当前登录用户信息"""
    return {
        "address": current_user.address,
        "role": current_user.role,
        "created_at": current_user.created_at
    }
