# Universal Bridge MVP

Universal Bridge is a Gemini-powered application designed to bridge human intent and complex systems. It takes unstructured, chaotic real-world inputs (text, descriptions of emergencies, etc.) and uses Gemini 3.1 Pro to instantly convert them into structured, verified, and prioritized actions.

## Architecture

This is a **Phase 1 MVP** built on a highly optimized serverless monolith architecture:
- **Framework:** Next.js 16 (App Router)
- **Styling:** Tailwind CSS + Framer Motion
- **AI Engine:** Google Vertex AI / AI Studio (Gemini 3.1 Pro)
- **Database:** Local mock Firestore (ready to be swapped to live Google Cloud Firestore)
- **Deployment:** Dockerized for Google Cloud Run (Scale-to-zero)

## Features

1. **Consumer Submission Portal (`/`)**
   - Clean, highly accessible interface for B2C users to submit unstructured data.
   - Instantly dynamically displays the AI's structured extraction payload for the user to review.
2. **Operator Dispatch Dashboard (`/operator`)**
   - High-density command center view for operator triage.
   - Lists incidents with assigned urgency levels and recommended semantic actions.
   - Built to simulate real-time WebSocket capabilities.

## Getting Started Locally

### 1. Requirements

You must provide an API key to access Google's AI models. 
Create a `.env.local` file in the root of the project:

```bash
cp .env.example .env.local
```

Populate it with your GEMINI API key:
```ini
GEMINI_API_KEY="AIzaSy...your-actual-api-key"
```

### 2. Install Dependencies

```bash
npm install
# or if you face caching issues:
pnpm install
```

### 3. Run the Development Server

```bash
npm run dev
```
- The consumer portal is at [http://localhost:3000](http://localhost:3000)
- The operator dashboard is at [http://localhost:3000/operator](http://localhost:3000/operator)

## Cloud Run Deployment

The project is fully pre-configured to be deployed natively to Google Cloud Run natively.

1. **Optimized Build Process**
   - The `next.config.ts` uses `output: "standalone"` to drastically reduce container size when building.
   - The `Dockerfile` includes a multi-stage Alpine build process natively binding to the `$PORT` variable injected by Cloud Run.

2. **Manual Deployment via GCP Console**
   - Navigate to Google Cloud Console > **Cloud Run**.
   - Create Service > **Continuous Deployment** from your repository.
   - Google Cloud Build will automatically find the `Dockerfile` and compile the optimized image.
   - Ensure you allow **unauthenticated invocations** (so public users can see the consumer form).
   - Under the **Variables & Secrets** deployment tab, inject your `GEMINI_API_KEY`.
