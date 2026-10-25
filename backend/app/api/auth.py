from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import User, UserProfile
from app.schemas import (
    UserRegister,
    UserLogin,
    TokenResponse,
    UserProfileResponse,
)
from app.security import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(user_in: UserRegister, db: AsyncSession = Depends(get_db)):
    """FR-01: User Registration endpoint."""
    stmt_email = select(User).where(User.email == user_in.email)
    res_email = await db.execute(stmt_email)
    if res_email.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This email address is already in use."
        )

    stmt_user = select(User).where(User.username == user_in.username)
    res_user = await db.execute(stmt_user)
    if res_user.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This username is already taken."
        )

    hashed_pwd = hash_password(user_in.password)
    new_user = User(
        email=user_in.email,
        username=user_in.username,
        password_hash=hashed_pwd
    )
    db.add(new_user)
    await db.flush()

    new_profile = UserProfile(user_id=new_user.id)
    db.add(new_profile)

    await db.commit()

    access_token = create_access_token(data={"sub": str(new_user.id)})
    return TokenResponse(access_token=access_token)


@router.post("/login", response_model=TokenResponse)
async def login(user_in: UserLogin, db: AsyncSession = Depends(get_db)):
    """FR-02: User Login endpoint."""
    stmt = select(User).where(User.email == user_in.email)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user or not verify_password(user_in.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"sub": str(user.id)})
    return TokenResponse(access_token=access_token)


@router.get("/me", response_model=UserProfileResponse)
async def get_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """FR-04: Get current user profile details."""
    stmt = select(UserProfile).where(UserProfile.user_id == current_user.id)
    res = await db.execute(stmt)
    profile = res.scalar_one_or_none()

    return UserProfileResponse(
        id=current_user.id,
        email=current_user.email,
        username=current_user.username,
        preferred_language=profile.preferred_language if profile else "Python",
        total_sessions=profile.total_sessions if profile else 0,
    )