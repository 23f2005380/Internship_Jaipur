from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Field, SQLModel, Session, create_engine, select
from typing import Optional, List
import uuid
from passlib.context import CryptContext
from pydantic import BaseModel
import requests
import os
from dotenv import load_dotenv

load_dotenv()

AUTH0_DOMAIN = os.getenv("AUTH0_DOMAIN")
AUTH0_AUDIENCE = os.getenv("AUTH0_AUDIENCE")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./backen.db")
engine = create_engine(DATABASE_URL, echo=False)


class User(SQLModel, table=True):
    id: Optional[str] = Field(default=None, primary_key=True)
    email: str
    hashed_password: str
    name: str


class SessionRow(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str
    token: str
    device_info: Optional[str] = None


def init_db():
    SQLModel.metadata.create_all(engine)


app = FastAPI(title="Auth Backend with SQLite + Auth0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SignupIn(BaseModel):
    email: str
    password: str
    name: Optional[str] = ""


class LoginIn(BaseModel):
    email: str
    password: str


class LoginOut(BaseModel):
    token: str
    user: dict


class TokenIn(BaseModel):
    token: str


def verify_auth0_jwt(token: str) -> Optional[dict]:
    """
    Verify Auth0 JWT using JWKS and return the decoded claims on success.
    Expects AUTH0_DOMAIN and AUTH0_AUDIENCE to be set.
    """
    if not AUTH0_DOMAIN or not AUTH0_AUDIENCE:
        return None
    try:
        jwks_url = f"https://{AUTH0_DOMAIN}/.well-known/jwks.json"
        jwks = requests.get(jwks_url, timeout=5).json()
        from jose import jwt
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")
        key = None
        for jwk in jwks.get("keys", []):
            if jwk.get("kid") == kid:
                key = jwk
                break
        if not key:
            return None
        # decode and verify
        issuer = f"https://{AUTH0_DOMAIN}/"
        claims = jwt.decode(token, key, algorithms=[key.get("alg", "RS256")], audience=AUTH0_AUDIENCE, issuer=issuer)
        return claims
    except Exception:
        return None


@app.on_event("startup")
def on_startup():
    init_db()


@app.post("/signup")
def signup(payload: SignupIn):
    with Session(engine) as db:
        statement = select(User).where(User.email == payload.email)
        exists = db.exec(statement).first()
        if exists:
            raise HTTPException(status_code=400, detail="Email already exists")
        new_id = f"user_{uuid.uuid4().hex[:8]}"
        hashed = pwd_context.hash(payload.password)
        user = User(id=new_id, email=payload.email, hashed_password=hashed, name=payload.name or payload.email.split("@")[0])
        db.add(user)
        db.commit()
        # do not create a session here; client should call /login to obtain a session token
        return {"id": new_id, "email": payload.email, "name": user.name}


@app.post("/login", response_model=LoginOut)
def login(payload: LoginIn):
    with Session(engine) as db:
        statement = select(User).where(User.email == payload.email)
        user = db.exec(statement).first()
        if not user or not pwd_context.verify(payload.password, user.hashed_password):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        token = uuid.uuid4().hex
        s = SessionRow(user_id=user.id, token=token)
        db.add(s)
        db.commit()
        return {"token": token, "user": {"id": user.id, "email": user.email, "name": user.name}}


@app.post("/login_with_auth0")
def login_with_auth0(payload: TokenIn):
    token = payload.token
    info = verify_auth0_jwt(token)
    if not info:
        raise HTTPException(status_code=401, detail="Invalid Auth0 token")
    email = info.get("email")
    name = info.get("name") or info.get("nickname") or None

    # If email is missing from the JWT claims, try the /userinfo endpoint
    if not email:
        try:
            userinfo_url = f"https://{AUTH0_DOMAIN}/userinfo"
            resp = requests.get(userinfo_url, headers={"Authorization": f"Bearer {token}"}, timeout=5)
            if resp.ok:
                ui = resp.json()
                email = ui.get("email") or email
                if not name:
                    name = ui.get("name") or ui.get("nickname")
        except Exception:
            # ignore userinfo errors and fall back
            pass

    # Final fallback: generated placeholder email to satisfy NOT NULL constraint
    if not email:
        gen_id = uuid.uuid4().hex[:8]
        email = f"user_{gen_id}@noemail.local"
        if not name:
            name = f"user_{gen_id}"
    with Session(engine) as db:
        statement = select(User).where(User.email == email)
        user = db.exec(statement).first()
        if not user:
            # create user record
            new_id = f"user_{uuid.uuid4().hex[:8]}"
            user = User(id=new_id, email=email, hashed_password="", name=name)
            db.add(user)
            db.commit()
        token_val = uuid.uuid4().hex
        s = SessionRow(user_id=user.id, token=token_val)
        db.add(s)
        db.commit()
        return {"token": token_val, "user": {"id": user.id, "email": user.email, "name": user.name}}


@app.post("/logout")
async def logout(request: Request):
    try:
        data = await request.json()
        token = data.get("token")
    except Exception:
        token = None
    if not token:
        raise HTTPException(status_code=400, detail="Missing token")
    with Session(engine) as db:
        statement = select(SessionRow).where(SessionRow.token == token)
        row = db.exec(statement).first()
        if row:
            db.delete(row)
            db.commit()
    return {"ok": True}


@app.get("/sessions/{user_id}")
def get_sessions(user_id: str):
    with Session(engine) as db:
        statement = select(SessionRow).where(SessionRow.user_id == user_id)
        rows = db.exec(statement).all()
        return {"count": len(rows), "tokens": [r.token for r in rows]}


class ForceLogoutIn(BaseModel):
    user_id: str


@app.post("/force_logout")
async def force_logout(request: Request):
    try:
        data = await request.json()
        user_id = data.get("user_id")
    except Exception:
        user_id = None
    if not user_id:
        raise HTTPException(status_code=400, detail="Missing user_id")
    with Session(engine) as db:
        statement = select(SessionRow).where(SessionRow.user_id == user_id)
        rows = db.exec(statement).all()
        if not rows:
            return {"count": 0}
        # keep the first (oldest) session, remove others
        keep = rows[:1]
        remove = rows[1:]
        for r in remove:
            db.delete(r)
        db.commit()
        return {"count": len(keep)}


@app.get("/users")
def list_users():
    with Session(engine) as db:
        statement = select(User)
        rows = db.exec(statement).all()
        return [{"id": u.id, "email": u.email, "name": u.name} for u in rows]


@app.get("/debug/sessions")
def debug_sessions():
    with Session(engine) as db:
        statement = select(SessionRow)
        rows = db.exec(statement).all()
        return [{"id": r.id, "user_id": r.user_id, "token": r.token} for r in rows]


@app.post("/debug/clear_user_sessions")
def clear_user_sessions(payload: ForceLogoutIn):
    user_id = payload.user_id
    with Session(engine) as db:
        statement = select(SessionRow).where(SessionRow.user_id == user_id)
        rows = db.exec(statement).all()
        for r in rows:
            db.delete(r)
        db.commit()
    return {"ok": True, "cleared": len(rows)}


@app.post("/debug/clear_all_sessions")
def clear_all_sessions():
    with Session(engine) as db:
        statement = select(SessionRow)
        rows = db.exec(statement).all()
        count = 0
        for r in rows:
            db.delete(r)
            count += 1
        db.commit()
    return {"ok": True, "cleared": count}

