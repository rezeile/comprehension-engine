### OAuth Frontend/Backend Login Diagnosis

This document captures a point‑in‑time investigation of why the "Continue with Google" flow does not advance past the login page and why subsequent calls to `GET /api/auth/me` return 401.

---

### Observed Symptoms

- Clicking "Continue with Google" reloads the page and the UI remains on the login screen.
- Backend logs consistently show:
  - 302 for `GET /api/auth/login` (redirect to Google)
  - Successful callback processing: access token retrieved from Google (`Got token: dict_keys([... 'access_token', 'id_token', ...])`), followed by "Getting user info..."
  - 307 redirect issued from `/api/auth/callback` back to the frontend (expected for navigation)
  - Repeated `GET /api/auth/me` → 401 Unauthorized
- Frontend localStorage does not contain `access_token` or `refresh_token`.

---

### Current Flow (as implemented)

1. Frontend sends the user to `GET /api/auth/login`.
2. Backend redirects to Google (`authorize_url`).
3. Backend `GET /api/auth/callback`:
   - Exchanges code → token OK
   - Fetches userinfo OK
   - Issues a redirect to the frontend (307), and sets cookies (recent change) with `ce_access_token` and `ce_refresh_token` on the backend origin (`localhost:8000`).
4. Frontend loads and calls `GET /api/auth/me` to establish session.

---

### Key Evidence From Code

1) The dependency guarding `/api/auth/me` uses `HTTPBearer()` which requires an Authorization header and will reject requests before our cookie fallback runs:

```20:26:/Users/eliezerabate/comprehension-engine/backend/auth/dependencies.py
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# HTTP Bearer token security scheme
security = HTTPBearer()
```

```20:33:/Users/eliezerabate/comprehension-engine/backend/auth/dependencies.py
async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    ...
    # Prefer Authorization header; otherwise, use httpOnly cookie
    token = credentials.credentials if credentials else None
    if not token:
        token = request.cookies.get("ce_access_token")
```

Because `security = HTTPBearer()` has `auto_error=True` by default, requests without an Authorization header never reach our function body (FastAPI raises before `get_current_user` executes). This explains consistent 401s even when cookies exist.

2) Backend callback sets cookies on `localhost:8000` and redirects to `http://localhost:3000/`. This is valid, because cookies are scoped to the backend origin and will be sent later when the frontend makes `fetch('http://localhost:8000/...', { credentials: 'include' })`. The 401s indicate the backend still isn’t accepting cookie‑only requests due to the point above.

3) Frontend attempts to read tokens from URL and then falls back to sending `credentials: 'include'` for `/api/auth/me`. That should work if the backend accepts cookies.

---

### Likely Root Cause

The auth dependency enforces Bearer tokens strictly. Since we switched to httpOnly cookie‑based auth for the browser, requests without an `Authorization: Bearer ...` header are rejected by the `HTTPBearer` security scheme before our cookie fallback logic is reached.

Concretely:

- `security = HTTPBearer()` (default `auto_error=True`) → raises when header missing
- Our intent: Allow either Authorization header or cookie.
- Outcome: Requests carrying only cookies are 401.

---

### Secondary Causes / Considerations

- Cookies are issued for the backend origin (`localhost:8000`) with `SameSite=Lax`, `HttpOnly`. That’s correct for auth APIs called from the frontend using `credentials: 'include'`.
- CORS: For credentialed requests, backend must have `allow_credentials=True` and an explicit `allow_origins` list including `http://localhost:3000`. This appears to be configured earlier, but should be re‑verified.
- 307 redirects from the callback are expected: Starlette’s `RedirectResponse` defaults to 307. This is not an error.

---

### Minimal Remediation Plan

1) Make the bearer dependency permissive and truly cookie‑aware:
   - Change `security = HTTPBearer()` to `security = HTTPBearer(auto_error=False)`.
   - Keep `request: Request` param and read `request.cookies["ce_access_token"]` when no Authorization header is present.
   - If both are missing or invalid → 401.

2) Ensure CORS settings support credentialed requests:
   - `allow_credentials=True`
   - `allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", ...]`
   - `allow_headers` includes `Authorization, Content-Type`

3) Frontend:
   - Always call auth endpoints with `credentials: 'include'`.
   - Do not require reading tokens from `localStorage` if cookie mode is active.

4) Validation steps (in order):
   - After successful Google login, in the browser Application tab, verify cookies exist for `localhost:8000` with names `ce_access_token`, `ce_refresh_token`.
   - From the frontend page, run: `fetch('http://localhost:8000/api/auth/me', { credentials: 'include' }).then(r => r.json()).then(console.log)` → should return user JSON.
   - If still 401, hit the endpoint directly with cookies to isolate the browser: `curl -i --cookie "ce_access_token=<value>" http://localhost:8000/api/auth/me`.

---

### Proposed Code Changes (summarized)

Backend `auth/dependencies.py`:

```diff
- security = HTTPBearer()
+ security = HTTPBearer(auto_error=False)

async def get_current_user(request: Request, credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)) -> User:
    token = credentials.credentials if credentials else None
    if not token:
        token = request.cookies.get("ce_access_token")
    # verify_token(token, expected_type="access") etc.
```

Backend CORS in `main.py` (re‑check):

```diff
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", ...],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["Authorization", "Content-Type", "accept", "origin"],
)
```

Frontend calls to backend:

```diff
- fetch(url, { headers: { Authorization: `Bearer ${token}` } })
+ fetch(url, { credentials: 'include' })
```

---

### Why This Fix Addresses The Issue

The system is now consistent about cookie‑based authentication for browser requests:

- Backend accepts either Bearer header or cookies (so SPA can use httpOnly cookies safely).
- Frontend includes credentials so the browser automatically attaches cookies to backend requests.
- No reliance on URL token parsing or localStorage is required for browser sign‑in.

---

### Nice‑To‑Have Hardening (later)

- Use `secure=True` cookies when served over HTTPS (prod).
- Set short‑lived access token cookie and rotate refresh token.
- Consider CSRF protection for non‑idempotent endpoints if you switch to cookie‑only without Bearer headers.
- Add `/api/auth/session` to surface simple session diagnostics (whoami, cookie presence, expiry timestamps).

---

### Conclusion

The authentication handshake with Google succeeds, but the authorization check for `/api/auth/me` is failing because the dependency expects an Authorization header and rejects cookie‑only requests. Making `HTTPBearer` non‑fatal and reading the access token from httpOnly cookies resolves the 401s and lets the SPA advance past the login page.


