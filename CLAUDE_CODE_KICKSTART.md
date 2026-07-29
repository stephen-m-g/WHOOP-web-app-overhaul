# Claude Code Kickstart Prompt

**Copy and paste this entire section into Claude Code to kickstart the project.**

---

## Whoop AI Jump Training Platform — Development Initialization

I'm building an **AI-enhanced fitness platform** with two main components:

### 1. Whoop Web App Redesign
- Modernized Next.js interface for Whoop health data (recovery, sleep, workouts)
- OAuth 2.0 integration with Whoop Developer API v2
- Dashboard showing physiological metrics
- Dark mode, responsive design

### 2. AI-Powered Jump Training Feature
- Users upload videos of vertical or broad jumps
- System analyzes video using computer vision (MediaPipe Pose + OpenCV)
- Returns: jump height/distance, key movement frames, personalized coaching feedback
- Calibrates measurements using user biometric data (height, leg measurements)

### Technology Stack

**Frontend:**
- Next.js 14+ (TypeScript)
- shadcn/ui + Tailwind CSS
- Vercel deployment

**Backend:**
- Python 3.11+ with FastAPI
- MediaPipe Pose (pose detection)
- OpenCV (video processing)
- Google Cloud Run deployment (or local + ngrok for dev)

**APIs:**
- Whoop Developer API v2 (OAuth 2.0)

### Architecture Overview

```
Next.js Frontend (Vercel)
    ↓ HTTP API
Python Backend (Cloud Run/ngrok)
    • MediaPipe pose detection
    • OpenCV video processing
    • Jump metrics analysis
    ↓ files
Temp Video Storage
```

### Design System
- Whoop brand aesthetics (colors, typography)
- Modern UI refresh while maintaining brand identity
- Figma → Claude Code workflow

---

## Phase 1: Backend Setup

I need to create the Python FastAPI backend for video processing and jump analysis.

**Immediate task: Set up the backend project structure and skeleton.**

Please create:

1. `backend/main.py` — FastAPI app with CORS, environment loading, health check endpoint
2. `backend/requirements.txt` — Python dependencies (FastAPI, uvicorn, opencv-python, mediapipe, numpy, python-dotenv, etc.)
3. `backend/.env.example` — Template for environment variables
4. `backend/app/routes/jump_analysis.py` — Route for `POST /analyze-jump` endpoint
5. `backend/app/services/pose_analyzer.py` — MediaPipe Pose skeleton (frame-by-frame analysis)
6. `backend/app/services/video_processor.py` — OpenCV video utilities (load, extract frames, save)
7. `backend/Dockerfile` — For Cloud Run deployment

### Expected Output from Backend

`POST /analyze-jump` request:
```json
{
  "video": "<binary MP4 file>",
  "user_height_cm": 180
}
```

Expected response:
```json
{
  "jump_height_cm": 42.5,
  "jump_distance_cm": 150.0,
  "keyframes": [
    { "frame": 10, "type": "loading", "timestamp_ms": 167 },
    { "frame": 15, "type": "penultimate_step", "timestamp_ms": 250 },
    { "frame": 20, "type": "landing", "timestamp_ms": 333 }
  ],
  "coaching_feedback": "Good knee bend on takeoff. Try to achieve more height by extending through your hips.",
  "analysis_confidence": 0.87,
  "processing_time_ms": 2340
}
```

### Key Requirements

- **CORS:** Allow requests from `http://localhost:3000` (dev) and production Vercel domain
- **Error handling:** Return 400 for invalid input, 500 for processing errors, clear error messages
- **Video validation:** Check file size (<500MB), duration (>1 sec), format (MP4, MOV)
- **Local development:** Should run on `http://localhost:8000`
- **Production-ready:** Dockerfile for Cloud Run deployment

### Notes

- Use MediaPipe Pose for body landmark detection (33 keypoints per frame)
- Detect keyframes by analyzing pose velocity/changes between frames
- Jump height estimate: Use ankle/foot displacement relative to user height calibration
- Coaching feedback: AI-powered suggestions based on jump mechanics analysis

**Use the design and implementation best practices from industry standards. Make code clean, well-documented, and production-ready.**

---

## Phase 2: Frontend Setup (Next.js)

Once backend is complete, I'll need the Next.js frontend scaffold with:

1. Project structure for pages, components, API routes
2. Whoop OAuth 2.0 integration
3. Dashboard page (displays Whoop metrics)
4. Jump trainer page (video upload, results display)
5. Environment setup (.env.local template)
6. Basic styling with Tailwind CSS (ready for shadcn/ui components)

I'll design UI in Figma first, then you'll help build it using the `/ui-styling` skill with shadcn/ui components.

---

## Design System & Skills

For UI implementation, use the following skills:
- `/ui-styling` — Build accessible components with shadcn/ui + Tailwind CSS
- `/design-system` — Establish token architecture (colors, spacing, typography)
- `/power-design` — Generate brand-native pages/presentations
- `/brand` — Maintain visual identity consistency

---

## Now: Start with Phase 1

Create the backend project structure and implement the FastAPI app, routes, and MediaPipe skeleton. Make it production-ready with proper error handling, validation, and documentation.

Please proceed with creating the files listed above.

---

## Additional Context

- **Status:** Architecture finalized; ready for code
- **Deployment:** Cloud Run (prod), local + ngrok (dev)
- **Timeline:** Aim for modular phases—backend first, then frontend, then integration
- **AI Model:** MediaPipe Pose (free, open-source)
- **No external paid APIs** except Google Cloud for hosting

Let me know if you need clarification on requirements or if you'd like to start with a different phase.
