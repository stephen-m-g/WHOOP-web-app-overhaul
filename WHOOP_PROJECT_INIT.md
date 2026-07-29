# Whoop AI Jump Training Platform — Project Initialization

## Project Overview

You are building an **AI-enhanced fitness platform** consisting of:

1. **Whoop Web App Redesign** — A modernized web interface for accessing personal Whoop health data (recovery, sleep, workouts, physiological cycles)
2. **AI-Powered Jump Training Feature** — A computer vision analysis system that ingests user biometric data + jump videos and returns personalized coaching feedback

**Tech Stack:**
- **Frontend:** Next.js (TypeScript, Vercel deployment)
- **Backend:** Python + FastAPI (Google Cloud Run or local+ngrok for dev)
- **Computer Vision:** MediaPipe Pose + OpenCV (open-source, free)
- **Whoop Integration:** Whoop Developer API v2 (OAuth 2.0)
- **Design Workflow:** Figma → Claude Code → production

**Status:** Architecture finalized; ready for implementation.

---

## Architecture

### High-Level System Flow

```
┌──────────────────────────────────┐
│      Whoop Developer API         │
│      (OAuth 2.0, v2)             │
└────────────┬─────────────────────┘
             │ (health metrics)
             ▼
┌──────────────────────────────────┐
│   Next.js Web App (Vercel)       │
│  • Whoop data visualization      │
│  • Jump video upload UI          │
│  • Results & coaching display    │
└────────────┬─────────────────────┘
             │ HTTP API calls
             ▼
┌──────────────────────────────────┐
│ Python Backend (Cloud Run/ngrok) │
│  • MediaPipe pose detection      │
│  • OpenCV video processing       │
│  • AI jump analysis              │
│  • FastAPI service               │
└────────────┬─────────────────────┘
             │ (file storage)
             ▼
┌──────────────────────────────────┐
│   Temporary Video Storage        │
│   (local /tmp or cloud bucket)   │
└──────────────────────────────────┘
```

### Key APIs

**Frontend → Backend:**
- `POST /analyze-jump` — upload video + user height → returns JSON with jump metrics, keyframes, coaching feedback

**Frontend → Whoop API:**
- OAuth 2.0 flow for user auth
- GET endpoints for recovery, sleep, workouts, etc.

---

## Phase 0: Setup & Skills Installation

### 0.1 — Create Directory Structure

```bash
.claude/
├── skills/
│   ├── banner-design/SKILL.md
│   ├── brand/SKILL.md
│   ├── design/SKILL.md
│   ├── design-extraction/SKILL.md
│   ├── design-system/SKILL.md
│   ├── power-design/SKILL.md
│   └── ui-styling/SKILL.md
├── config.md
└── project-notes.md
```

### 0.2 — Install Skills

Each `.claude/skills/<skill-name>/SKILL.md` file defines a reusable design/UI skill. These power your Figma→Code workflow and ensure consistent, design-system-driven development.

**Skills included:**
- **ui-styling** — shadcn/ui + Tailwind CSS component building
- **design** — Brand identity, logos, visual design
- **power-design** — Brand-native HTML generation (slides/web)
- **design-system** — Token architecture, component specs
- **brand** — Voice, visual identity, messaging frameworks
- **design-extraction** — Reverse-engineer design systems from URLs
- **banner-design** — Social/ad/web banner creation

### 0.3 — Initialize Project Config

Create `.claude/config.md`:

```markdown
# Project Configuration

## Project: Whoop AI Jump Training Platform

### Key Decisions
- **Design system:** Whoop brand aesthetics + modern refresh
- **Figma→Code:** Design in Figma, export to Claude Code
- **Backend:** FastAPI + MediaPipe (Python)
- **Deployment:** Next.js on Vercel, Python on Google Cloud Run
- **AI Model:** MediaPipe Pose (open-source, free)
- **Video Processing:** OpenCV
- **Whoop Integration:** OAuth 2.0, REST API v2

### Tools & Resources
- Whoop Developer API: https://developer.whoop.com
- MediaPipe Pose: https://mediapipe.dev
- FastAPI Docs: https://fastapi.tiangolo.com
- Next.js Docs: https://nextjs.org
- Google Cloud Run: https://cloud.google.com/run

### Deployment Targets
- **Frontend:** Vercel (Next.js)
- **Backend (Production):** Google Cloud Run (Python 3.11+)
- **Backend (Development):** Local + ngrok tunnel
```

---

## Phase 1: Backend Foundation (Python + FastAPI)

### 1.1 — Project Structure

```
backend/
├── main.py                    # FastAPI app entry point
├── requirements.txt           # Python dependencies
├── .env.example              # Environment template
├── Dockerfile                # For Cloud Run deployment
├── app/
│   ├── __init__.py
│   ├── routes/
│   │   └── jump_analysis.py  # /analyze-jump endpoint
│   ├── services/
│   │   ├── video_processor.py
│   │   ├── pose_analyzer.py
│   │   └── coaching_engine.py
│   └── utils/
│       └── validators.py
└── tests/
    └── test_jump_analysis.py
```

### 1.2 — Dependencies (requirements.txt)

```
fastapi==0.104.1
uvicorn==0.24.0
python-multipart==0.0.6
opencv-python==4.8.1.78
mediapipe==0.10.8
numpy==1.24.3
pillow==10.0.0
python-dotenv==1.0.0
```

### 1.3 — FastAPI Scaffold

**main.py** — Minimal setup:

```python
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI(title="Whoop Jump Analysis API")

# CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://yourdomain.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/analyze-jump")
async def analyze_jump(
    video: UploadFile = File(...),
    user_height_cm: float = Form(...)
):
    """
    Analyze a jump video and return metrics.
    
    Args:
        video: MP4 video file of the jump
        user_height_cm: User's height in centimeters (for calibration)
    
    Returns:
        {
            "jump_height_cm": float,
            "jump_distance_cm": float,
            "keyframes": [
                {"frame": int, "type": "loading|penultimate_step|landing", "timestamp_ms": int}
            ],
            "coaching_feedback": str,
            "analysis_confidence": float
        }
    """
    # TODO: Implement with MediaPipe + OpenCV
    pass

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

### 1.4 — MediaPipe Proof-of-Concept

**app/services/pose_analyzer.py** — Skeleton:

```python
import cv2
import mediapipe as mp
import numpy as np

class PoseAnalyzer:
    def __init__(self):
        self.mp_pose = mp.solutions.pose
        self.pose = self.mp_pose.Pose(
            static_image_mode=False,
            model_complexity=1,  # 0=light, 1=full
            smooth_landmarks=True
        )
    
    def analyze_video(self, video_path: str, user_height_cm: float):
        """
        Process video frame-by-frame, detect pose landmarks.
        
        Returns:
            {
                "frames": [frame_data],
                "jump_height_estimate": float,
                "keyframes": [keyframe_indices],
                "landmarks_trace": [landmarks_per_frame]
            }
        """
        cap = cv2.VideoCapture(video_path)
        frames_data = []
        
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            
            # Convert BGR to RGB
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # Detect pose
            results = self.pose.process(rgb_frame)
            
            if results.pose_landmarks:
                # Extract landmarks (33 keypoints)
                landmarks = [
                    (lm.x, lm.y, lm.z, lm.visibility)
                    for lm in results.pose_landmarks.landmark
                ]
                frames_data.append(landmarks)
        
        cap.release()
        
        # TODO: Extract jump height, keyframes, etc.
        return {
            "jump_height_estimate": 42.5,  # cm
            "keyframes": [],
            "confidence": 0.87
        }
```

### 1.5 — Local Development + ngrok

**For dev/testing:**

```bash
# Terminal 1: Run FastAPI locally
cd backend
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
python main.py
# Server runs on http://localhost:8000

# Terminal 2: Expose via ngrok
ngrok http 8000
# Gives you a public URL like https://xxxx-xx-xxx-x.ngrok.io
```

**Next.js will call:** `https://xxxx-xx-xxx-x.ngrok.io/analyze-jump`

---

## Phase 2: Frontend Foundation (Next.js + Whoop API)

### 2.1 — Project Structure

```
frontend/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                # Home page
│   ├── dashboard/
│   │   └── page.tsx            # Whoop data dashboard
│   ├── jump-trainer/
│   │   └── page.tsx            # Jump analysis UI
│   └── api/
│       ├── auth/route.ts       # Whoop OAuth callback
│       └── upload-jump/route.ts # Proxy to Python backend
├── components/
│   ├── ui/                     # shadcn/ui + custom components
│   ├── whoop/
│   │   ├── DataCards.tsx
│   │   └── MetricsChart.tsx
│   └── jump-trainer/
│       ├── VideoUpload.tsx
│       └── ResultsDisplay.tsx
├── lib/
│   ├── whoop.ts                # Whoop API client
│   ├── api.ts                  # Backend API client
│   └── auth.ts                 # OAuth flow
├── .env.local                  # Local secrets
└── next.config.js
```

### 2.2 — Key Environment Variables

**.env.local:**

```
# Whoop OAuth
NEXT_PUBLIC_WHOOP_CLIENT_ID=your_client_id
WHOOP_CLIENT_SECRET=your_client_secret
WHOOP_REDIRECT_URI=http://localhost:3000/api/auth/callback

# Backend API
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000  # dev
# or for ngrok: https://xxxx-xx-xxx-x.ngrok.io

# Deployment
VERCEL_URL=https://yourdomain.com
```

### 2.3 — Whoop OAuth Integration

**lib/whoop.ts** — OAuth client skeleton:

```typescript
import { NextResponse } from 'next/server';

const WHOOP_AUTH_URL = 'https://api.whoop.com/oauth/oauth/authorize';
const WHOOP_TOKEN_URL = 'https://api.whoop.com/oauth/oauth/token';

export async function getWhoopAuthUrl() {
  const params = new URLSearchParams({
    client_id: process.env.NEXT_PUBLIC_WHOOP_CLIENT_ID!,
    redirect_uri: process.env.WHOOP_REDIRECT_URI!,
    response_type: 'code',
    scope: 'offline',  // Required for token refresh
  });
  
  return `${WHOOP_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string) {
  const response = await fetch(WHOOP_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_WHOOP_CLIENT_ID!,
      client_secret: process.env.WHOOP_CLIENT_SECRET!,
      code,
      grant_type: 'authorization_code',
      redirect_uri: process.env.WHOOP_REDIRECT_URI!,
    }).toString(),
  });
  
  return response.json();
}

export async function fetchWhoopData(endpoint: string, accessToken: string) {
  const response = await fetch(`https://api.whoop.com/developer/v2/${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  
  return response.json();
}
```

### 2.4 — Next.js API Route: Upload Jump Video

**app/api/upload-jump/route.ts** — Proxy to Python backend:

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  
  const video = formData.get('video') as File;
  const userHeight = formData.get('userHeight') as string;
  
  if (!video || !userHeight) {
    return NextResponse.json(
      { error: 'Missing video or userHeight' },
      { status: 400 }
    );
  }
  
  // Forward to Python backend
  const backendFormData = new FormData();
  backendFormData.append('video', video);
  backendFormData.append('user_height_cm', parseFloat(userHeight));
  
  try {
    const backendResponse = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze-jump`,
      {
        method: 'POST',
        body: backendFormData,
      }
    );
    
    const result = await backendResponse.json();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: 'Backend analysis failed' },
      { status: 500 }
    );
  }
}
```

---

## Phase 3: UI/Design System (Figma → Claude Code)

### 3.1 — Design Workflow

1. **Design in Figma** (Whoop brand reference):
   - Color palette (Whoop blacks, whites, accent colors)
   - Typography (existing Whoop typeface or modern alternative)
   - Component library (buttons, cards, forms)
   - Two main screens:
     - Dashboard (Whoop metrics display)
     - Jump Trainer (video upload → results)

2. **Export to Claude Code**:
   - Use `/ui-styling` skill to build components
   - Use shadcn/ui for accessibility + consistency
   - Reference design tokens from Figma (colors, spacing, type scale)

3. **Component Hierarchy**:
   ```
   App
   ├── Header (logo, nav, auth status)
   ├── Layout (sidebar or top nav)
   └── Pages
       ├── Dashboard
       │   ├── MetricsGrid (recovery, sleep, workouts)
       │   └── ChartsSection
       └── JumpTrainer
           ├── BioDataForm (height, leg measurements)
           ├── VideoUploadZone
           ├── AnalysisSpinner
           └── ResultsPanel (metrics, keyframes, feedback)
   ```

### 3.2 — shadcn/ui Component Setup

```bash
# Install CLI and core components
npx shadcn@latest init -d

# Add components as needed
npx shadcn@latest add button card form input select dialog
npx shadcn@latest add tabs alert progress spinner
```

### 3.3 — Design Tokens (CSS Variables)

**styles/globals.css** (or tokens.css):

```css
@layer base {
  :root {
    /* Whoop Brand Colors */
    --color-bg: #FFFFFF;
    --color-fg: #000000;
    --color-accent: #00B4E8;  /* Whoop blue */
    --color-secondary: #FF6B6B;
    --color-muted: #F5F5F5;
    --color-border: #E0E0E0;
    
    /* Spacing */
    --space-xs: 0.25rem;   /* 4px */
    --space-sm: 0.5rem;    /* 8px */
    --space-md: 1rem;      /* 16px */
    --space-lg: 1.5rem;    /* 24px */
    --space-xl: 2rem;      /* 32px */
    --space-2xl: 3rem;     /* 48px */
    
    /* Typography */
    --font-sans: 'Inter', system-ui, sans-serif;
    --font-mono: 'Fira Code', monospace;
    --text-xs: 0.75rem;
    --text-sm: 0.875rem;
    --text-base: 1rem;
    --text-lg: 1.125rem;
    --text-xl: 1.25rem;
    --text-2xl: 1.5rem;
  }
  
  @media (prefers-color-scheme: dark) {
    :root {
      --color-bg: #1A1A1A;
      --color-fg: #FFFFFF;
    }
  }
}
```

---

## Phase 4: Integration & Testing

### 4.1 — End-to-End Flow Testing

1. **Manual Testing Checklist**:
   - [ ] Whoop OAuth flow: login → token retrieval → refresh
   - [ ] Dashboard loads Whoop data (recovery, sleep metrics)
   - [ ] Jump trainer: upload video (test with sample video)
   - [ ] Backend processes video → returns metrics
   - [ ] Frontend displays results with confidence score
   - [ ] Dark mode toggle works
   - [ ] Mobile responsiveness (375px, 768px, 1024px)

2. **Backend Test Script**:

```python
# tests/test_jump_analysis.py
import requests
import json

BACKEND_URL = "http://localhost:8000"  # or ngrok URL

def test_analyze_jump():
    with open("sample_jump.mp4", "rb") as f:
        files = {
            "video": f,
            "user_height_cm": (None, "180")
        }
        response = requests.post(f"{BACKEND_URL}/analyze-jump", files=files)
    
    print(json.dumps(response.json(), indent=2))
    assert response.status_code == 200
    assert "jump_height_cm" in response.json()

if __name__ == "__main__":
    test_analyze_jump()
```

### 4.2 — Error Handling & Validation

**Frontend validation:**
- Video file size limit (suggest <100MB)
- Supported formats (MP4, MOV)
- User height input (realistic range: 140–220cm)

**Backend validation:**
- Reject videos >500MB
- Reject videos <2 seconds duration
- Return error if pose detection confidence <0.5

---

## Phase 5: Deployment

### 5.1 — Google Cloud Run Setup (Backend)

```bash
# 1. Create GCP project & enable Cloud Run API
gcloud projects create whoop-jump-trainer
gcloud config set project whoop-jump-trainer

# 2. Build and push Docker image
gcloud builds submit --tag gcr.io/whoop-jump-trainer/jump-api

# 3. Deploy to Cloud Run
gcloud run deploy jump-api \
  --image gcr.io/whoop-jump-trainer/jump-api \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated

# 4. Set environment variables
gcloud run services update jump-api \
  --update-env-vars BACKEND_URL=https://your-cloud-run-url.run.app
```

**Dockerfile:**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

### 5.2 — Vercel Deployment (Frontend)

```bash
# 1. Connect GitHub repo to Vercel
# 2. Set environment variables in Vercel dashboard:
#    - NEXT_PUBLIC_WHOOP_CLIENT_ID
#    - WHOOP_CLIENT_SECRET
#    - NEXT_PUBLIC_BACKEND_URL (Cloud Run URL)
#    - WHOOP_REDIRECT_URI

# 3. Deploy
vercel deploy --prod
```

### 5.3 — Post-Deployment Checklist

- [ ] Frontend accessible at production domain
- [ ] Whoop OAuth flow works with production redirect URI
- [ ] Backend health check: `curl https://your-cloud-run-url.run.app/docs`
- [ ] Jump analysis returns results
- [ ] CORS configured for production domain
- [ ] Environment variables set in production (no secrets in code)
- [ ] Monitoring: Cloud Run logs, Vercel analytics
- [ ] Rate limiting configured (if needed)

---

## Development Workflow

### Quick Start (Local Development)

```bash
# Terminal 1: Backend
cd backend
source venv/bin/activate
python main.py

# Terminal 2: ngrok tunnel (optional for testing from mobile)
ngrok http 8000

# Terminal 3: Frontend
cd frontend
npm run dev
# Visit http://localhost:3000
```

### Iteration Loop

1. **Design in Figma** → Export design spec
2. **Claude Code** (`/ui-styling` skill) → Build component
3. **Test in browser** → Mobile + desktop
4. **Backend enhancement** → Add MediaPipe logic, improve keyframe detection
5. **Integrate** → Wire frontend to API
6. **Deploy** → Vercel (frontend) + Cloud Run (backend)

---

## Key Milestones

- **Week 1:** Backend foundation + MediaPipe PoC
- **Week 2:** Frontend scaffold + Whoop OAuth
- **Week 3:** UI design system + component build
- **Week 4:** Jump trainer feature + integration
- **Week 5:** Testing + refinement
- **Week 6:** Deployment + launch

---

## Resources & Docs

- **Whoop API:** https://developer.whoop.com/docs
- **MediaPipe Pose:** https://mediapipe.dev/solutions/pose
- **FastAPI:** https://fastapi.tiangolo.com/docs
- **Next.js:** https://nextjs.org/docs
- **shadcn/ui:** https://ui.shadcn.com
- **Tailwind CSS:** https://tailwindcss.com/docs
- **Google Cloud Run:** https://cloud.google.com/run/docs

---

## Next Steps

1. **Set up .claude/skills/** directory with all SKILL.md files
2. **Create backend/ and frontend/ directories**
3. **Phase 1:** Implement FastAPI + MediaPipe skeleton
4. **Phase 2:** Build Next.js + OAuth integration
5. **Phase 3:** Design system + UI components (via Claude Code + `/ui-styling` skill)
6. **Phase 4:** Integration testing
7. **Phase 5:** Deploy to production

**Ready to begin Phase 1? Start with backend/main.py and requirements.txt setup in Claude Code.**
