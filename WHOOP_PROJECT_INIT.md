# Whoop AI Jump Training Platform — Architecture & Status

> This document used to be a pre-implementation build plan (Phase 0–5 scaffolding
> steps). All of that has been superseded by real code. It's now a living
> description of what's actually built, the AI-pipeline decisions behind the
> jump-analysis feature, and what's still open. Update it when the pipeline
> changes — don't let it drift back into fiction.

## Project Overview

An AI-enhanced fitness platform with two halves:

1. **Whoop dashboard** — a redesigned web UI for a user's Whoop health data:
   dashboard, sleep, recovery, and strain detail pages, each with trend charts
   and range selectors, backed by the Whoop Developer API v2 (OAuth 2.0).
2. **AI Jump Trainer** — upload a vertical or broad jump video + your height,
   get back measured jump height/distance, a 6-stage keyframe breakdown with
   coaching feedback per stage, and camera-setup warnings when the recording
   is unlikely to produce a trustworthy measurement.

**Status:** Both halves are implemented and working locally. The jump-analysis
backend just went through a significant upgrade (see "Jump Analysis AI
Pipeline" below) adding 3D-aware measurement, real per-stage coaching
feedback, and optional cloud persistence. Cloud deployment (Cloud Run /
Vercel) has not happened yet — everything currently runs local-only.

**Tech Stack (as actually built):**
- **Frontend:** Next.js 16 (App Router, TypeScript), Tailwind CSS v4, shadcn/ui
  (Base UI primitives), Recharts, Canvas 2D for interactive backgrounds.
- **Backend:** Python 3.11 + FastAPI, Pydantic v2.
- **Computer vision:** MediaPipe PoseLandmarker (Tasks API), OpenCV for frame
  extraction. Both 2D image-normalized and 3D metric-scale (world) landmarks
  are used — see below.
- **Coaching feedback:** a small, self-hosted, free open-weight LLM
  (`llama-cpp-python` + Llama 3.2 3B Instruct GGUF) that paraphrases
  deterministic rule-based facts into short natural-language sentences.
- **Whoop integration:** Whoop Developer API v2, OAuth 2.0.
- **Persistence:** Firestore + Cloud Storage, feature-flagged and optional —
  disabled and fully ephemeral until GCP credentials are configured.
- **Deployment target (not yet live):** Next.js on Vercel, FastAPI on Google
  Cloud Run.

---

## Architecture

```
┌──────────────────────────────────┐
│      Whoop Developer API         │
│      (OAuth 2.0, v2)             │
└────────────┬─────────────────────┘
             │ health metrics (no per-minute time series — see note below)
             ▼
┌──────────────────────────────────┐
│   Next.js Web App                │
│  • Dashboard/sleep/recovery/      │
│    strain pages                  │
│  • Jump video upload UI          │
│  • Results & coaching display    │
└────────────┬─────────────────────┘
             │ POST /analyze-jump (multipart: video + form fields)
             ▼
┌──────────────────────────────────┐
│ Python Backend (FastAPI)         │
│  • OpenCV frame extraction       │
│  • MediaPipe PoseLandmarker      │
│    (2D + 3D world landmarks)     │
│  • biomechanics.py (rule-based   │
│    joint-angle facts/concerns)   │
│  • coaching_llm.py (local LLM    │
│    paraphrases the facts)        │
└────────────┬─────────────────────┘
             │ optional, feature-flagged
             ▼
┌──────────────────────────────────┐
│ Firestore + Cloud Storage         │
│ (keyframe stills only, never the  │
│  full video; off unless GCP env   │
│  vars are set)                    │
└──────────────────────────────────┘
```

**Whoop API limitation (confirmed against official docs, not reverse-engineered
ones):** the public API does not expose per-minute time-series data for sleep
or workouts — only aggregate summaries (plus `zone_durations` on workouts).
This shaped the dashboard/sleep/recovery/strain pages, which show
aggregates + multi-day trends rather than intra-session graphs.

---

## Jump Analysis AI Pipeline

### Pipeline decision record

The original MediaPipe-only approach had three real gaps: no adjustment for
camera distance/height, no handling of non-vertical ("running") jumps, and
likely perspective error on broad-jump distance. Feedback generation also
needed some form of reasoning, not just raw numbers.

Options considered, and the reasoning behind what was picked:

| # | Option | Verdict |
|---|--------|---------|
| A1 | MediaPipe **world landmarks** (3D, metric-scale) for measurement + explicit camera-setup validation | **Chosen.** Free, CPU-only, no new model — the Tasks API already returns this, it was just unused. |
| A2 | Heavier 3D mesh/pose models | Rejected — not worth the compute cost for the accuracy gained here. |
| B1 | Pure rule-based feedback (no LLM) | Rejected — technically simplest, but produces stilted, repetitive prose. |
| B2 | Rule-based facts → small self-hosted open-weight LLM for natural prose | **Chosen.** Zero monetary cost (self-hosted, open-weight), and the LLM never has to reason about biomechanics — it only paraphrases pre-computed facts/flags, so a small 3B model is plenty. |
| B3 | A real vision-language model reasoning directly over pixels | **Not implemented, intentionally documented for later.** This is a plausible quality upgrade once cloud spend is on the table — "cents/month isn't realistically something to sacrifice major quality over" once real GCP infra exists. Needs a GPU-backed Cloud Run service or equivalent; revisit after C is validated in production. |
| C | Firestore (structured records) + Cloud Storage (**keyframe stills only, never full video**) | **Chosen.** Feature-flagged via `GCP_PROJECT_ID`/`STORAGE_BUCKET_NAME`; no-ops when unset, so local dev and tests need zero GCP setup. |

The constraint driving all of this: **zero monetary cost** today (not zero
compute — a Cloud Run GPU billed by the second at "cents/month" is acceptable
later, just not the starting point).

### A1 — 3D-aware biomechanics + camera-setup validation

`backend/app/services/pose_analyzer.py` extracts both the 2D
image-normalized `pose_landmarks` and the 3D metric-scale, hip-centered
`pose_world_landmarks` MediaPipe's PoseLandmarker Tasks API already provides.

**Important correction, found via real-footage testing (not caught by the
original synthetic test suite):** MediaPipe's `pose_world_landmarks` are
defined relative to the hip center, and that origin moves *with* the body
every frame. During a real vertical jump the hip and ankle translate upward
*together*, so the ankle's position relative to the hip barely changes —
world landmarks structurally cannot see whole-body translation through
space. The first version of this pipeline preferred world landmarks for
height/distance measurement and it came back as an exact `0.0cm` on a real
jump the 2D path measured correctly. **Height/distance measurement now
always uses the 2D pixel-calibration path** (anchored to a fixed point in
the camera frame, so it *can* see translation); the world-landmark number is
still computed and exposed in debug output
(`jump_height_cm_world_landmarks_comparison`) purely as a labeled comparison
value, never as the primary estimate. World landmarks remain the right tool
for joint-angle biomechanics (knee flexion, valgus, torso lean) — those are
relative, translation-invariant measurements, exactly what a hip-centered
coordinate system is good for.

- **Keyframe timing**: peak/touchdown use the original, well-tested 2D
  ankle-y signal (unchanged — two documented historical regression bugs live
  here, caught by tests, so this logic wasn't touched). **Takeoff** is found
  by scanning backward from the peak for the last frame still near standing
  height (mirrors the touchdown logic, applied in reverse) — a knee-extension
  heuristic was tried first but can fire well into the airborne phase, not
  necessarily at the instant of leaving the ground (confirmed against real
  footage where it put "takeoff" 9 frames after the athlete was already
  visibly mid-flight). **Max anticipation** uses knee-flexion angle (deepest
  bend) in a bounded window before takeoff — ankle-y can't localize a crouch
  at all, since the ankle stays roughly planted while only the knee/hip
  bend; searching ankle-y across the whole pre-jump clip picked up
  meaningless jitter on real footage. **Max absorption** uses knee-flexion
  angle (deepest bend) in a bounded window after touchdown.
- A single low-confidence ankle reading (MediaPipe visibility score below
  `ANKLE_VISIBILITY_MIN = 0.5`) is interpolated over before smoothing/peak
  detection, so one blurry/occluded frame can't be mistaken for the jump
  apex or contaminate its smoothed neighbors.
- **Camera-setup validation** (`_check_camera_setup`) flags conditions likely
  to produce a bad estimate instead of silently returning a wrong number:
  camera tilt (`CAMERA_TILT_WARNING_DEG = 8.0`, from the shoulder-line angle
  — catches sideways roll); camera pitch (`EXPECTED_HIP_ANKLE_TO_SHOULDER_HIP_RATIO_MIN/MAX`,
  from the ratio of hip-to-ankle vs. shoulder-to-hip pixel span during
  standing — catches the camera being angled up/down rather than level,
  which tilt alone can't see, based on the fact that typical adult body
  proportions put that ratio at roughly 1.7); and for vertical jumps,
  horizontal drift (`VERTICAL_JUMP_DRIFT_WARNING_CM = 40.0`) — this is what
  catches a "running" vertical jump instead of one done in place. Surfaced
  to the frontend as `camera_warnings` on the response and rendered as a
  warning banner on the results page.

### Biomechanics / rule-based knowledge layer

`backend/app/services/biomechanics.py` is pure joint-angle geometry — the
deterministic "knowledge base" the coaching LLM paraphrases and never
overrides. Computes, per keyframe: knee flexion angle (hip-knee-ankle),
knee valgus/varus (lateral knee deviation from the hip-ankle line, normalized
to leg length), and torso lean (shoulder-hip vector vs. vertical). Fixed
thresholds turn these into concern flags (`knee_valgus`,
`shallow_counter_movement`, `incomplete_leg_extension`, `stiff_landing`, etc.).

**These thresholds (`KNEE_VALGUS_CONCERN_NORM`, `TORSO_LEAN_CONCERN_DEG`, etc.)
are first-pass estimates from general strength-and-conditioning knowledge,
not validated against real jump footage or expert-provided ranges.** This is
the one place real coaching expertise would concretely help: reviewing
recorded jumps against these specific numeric thresholds and adjusting them,
rather than anything the LLM needs — it only ever restates precomputed facts.

### B2 — Local coaching LLM

`backend/app/services/coaching_llm.py`. Model: **Llama 3.2 3B Instruct,
Q4_K_M GGUF quantization** (`bartowski/Llama-3.2-3B-Instruct-GGUF` on Hugging
Face, ~2.02GB), run via `llama-cpp-python` (chat-completion API, so the
model's instruct template is used correctly). Loaded once per process as a
lazy singleton; if the model file isn't present or fails to load for any
reason, `generate_stage_feedback()` falls back to a templated plain-English
sentence built from the same concern flags — the pipeline degrades gracefully
rather than ever failing a request over this.

The model is **not downloaded automatically** — `scripts/download_coaching_model.py`
exists but has to be run explicitly. It has been run locally
(`backend/models/coaching_llm.gguf`, ~2GB, gitignored) and verified: loads in
~3s, generates a real coaching sentence in ~2-5s on CPU. The Dockerfile has a
commented-out `RUN` line to bake it into the image at build time — still an
open decision for the deployed environment (see "Open items" below).

`llama-cpp-python` install note: pin `0.3.34` and always install with
`--extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cpu` (see
`requirements.txt`/`Dockerfile`) — older versions force a from-source CMake
build that fails on Windows + Python 3.13.

### C — Optional cloud persistence

`backend/app/services/storage.py`. Firestore stores structured jump records
(metrics + feedback per keyframe); Cloud Storage stores the annotated
keyframe **stills only** (never the source video) at
`users/{user_id}/jumps/{record_id}/{stage}.jpg`. Fully feature-flagged: with
`GCP_PROJECT_ID`/`STORAGE_BUCKET_NAME` unset (today's default), or no
`user_id` on the request, it no-ops — jump results stay exactly as ephemeral
as before. All Firestore/Storage calls are wrapped so a persistence failure
never breaks the actual analysis response.

`google-cloud-firestore`/`google-cloud-storage` are optional extras, **not**
in the default `requirements.txt`.

---

## Local Development

```bash
# Backend (port 8000)
cd backend
python -m venv .venv
.venv/Scripts/activate      # or `source .venv/bin/activate` on macOS/Linux
pip install -r requirements.txt --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cpu
python main.py

# Frontend (port 3000 — fixed, it's baked into the Whoop OAuth redirect URI)
cd frontend
npm install
npm run dev
```

`.claude/launch.json` has both as named configurations (`frontend`, `backend`)
for the preview tooling. Run `pytest` from `backend/` for the test suite
(`pytest.ini` + `tests/`) — it's a real, meaningful suite (not smoke tests),
including two documented historical regression cases in
`pose_analyzer.py`'s keyframe-timing logic, so changes there should be made
incrementally and re-verified against it rather than rewritten wholesale.

---

## Deployment (planned, not yet done)

- **Backend → Google Cloud Run.** `backend/Dockerfile` builds the FastAPI app;
  `scripts/download_model.py` always runs at build time (bakes in the
  MediaPipe pose bundle); `scripts/download_coaching_model.py` is commented
  out (optional ~2GB addition, bake it in once the coaching LLM is confirmed
  worth shipping that way vs. fetching at cold-start).
- **Frontend → Vercel**, as originally planned. Not yet deployed.
- Whichever GCP project backs Cloud Run also needs Firestore + a Cloud
  Storage bucket enabled for the C persistence layer to activate (see Open
  items below) — this can be the same project or separate; nothing in the
  code assumes either way.

---

## Open items / requires the user's input

1. **Coaching model download — done locally.** Downloaded and verified
   working (see above). Still open: whether to bake it into the Cloud Run
   image at build time (~2GB larger image, ready on first request) vs.
   fetching at cold-start/leaving it off the deployed environment initially.
2. **GCP project setup for persistence (C).** Needs manual action outside
   this repo: create a GCP project, enable the Firestore + Cloud Storage
   APIs, create a Firestore database and a bucket, `gcloud auth` locally
   or grant the Cloud Run service account the right roles, then set
   `GCP_PROJECT_ID`/`STORAGE_BUCKET_NAME`. Nothing breaks if this is skipped
   — results just stay ephemeral.
3. **Biomechanics threshold validation.** The concern thresholds in
   `biomechanics.py` are first-pass, not validated against real footage.
   Real jump-coaching guidelines (or reviewing enough real recordings against
   the current thresholds) would directly improve this — see that file's
   module docstring for the full list of constants.
4. **B3 (vision-language model) upgrade.** Deliberately not implemented yet.
   Worth revisiting once real Cloud Run infra + spend exists — a small
   monthly GPU cost is acceptable for a real quality jump, per the earlier
   discussion; this is not a "never," just a "later."
