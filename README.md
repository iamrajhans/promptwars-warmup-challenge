# Universal Bridge

Universal Bridge is a Gemini-powered application designed to bridge human intent and complex systems. It takes unstructured, chaotic real-world inputs (text, descriptions of emergencies, etc.) and uses Gemini 3.1 Pro to instantly convert them into structured, verified, and prioritized actions.

## Architecture & Phase 2 Hardening

This application has been upgraded to a **Phase 2 Production Structure** built on a highly optimized serverless monolith architecture:
- **Framework:** Next.js 16 (App Router)
- **Styling:** Tailwind CSS + Framer Motion
- **AI Engine:** Google Vertex AI / AI Studio (Gemini 3.1 Pro)
- **Storage:** Google Cloud Storage (GCS) with local base64 fallback architecture for rapid local development
- **Security:** In-memory Sliding Window Rate Limiting, Advanced Body Sanitization, Content Type sniffing mitigation
- **Accessibility:** Built entirely to WCAG 2.1 AA Standards (Aria-live bindings, Semantic HTML focus-management)
- **Deployment:** Dockerized for Google Cloud Run (Scale-to-zero)

## Features

1. **Consumer Submission Portal (`/`)**
   - Implements Multi-Modal forms: Text input, Voice Input (MediaRecorder APIs), Image Object analysis (Drag & Drop zones).
   - Instantly dynamically displays the AI's structured extraction payload for the user to review.
   - Built to WCAG standards (Keyboard accessible, screen reader validated).

2. **Operator Dispatch Dashboard (`/operator`)**
   - High-density command center view for operator triage.
   - Lists incidents with assigned urgency levels, metadata tags referencing attachments, and semantic actions.

## Local Development

### 1. Requirements

You must provide a Gemini API key. GCS is optional but recommended.
Create a `.env.local` file in the root of the project:

```bash
cp .env.example .env.local
```

Populate it with your GEMINI API key and (optionally) your GCS bindings:
```ini
GEMINI_API_KEY="AIzaSy...your-actual-api-key"

# Optional Cloud Storage integration
GCS_BUCKET_NAME="my-bucket-name"
GOOGLE_APPLICATION_CREDENTIALS="/absolute/path/to/key.json"
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

## Testing Pipeline

This codebase maintains stringent test coverage metrics.
- **Backend Services:** `vitest` (100% Branch Coverage on `src/lib/` utilities).
- **Frontend E2E:** `playwright` simulating true DOM browser interactions.

Run Unit Testing and Coverage:
```bash
npm run test
npx vitest run --coverage
```

Run Playwright E2E Tests:
```bash
npm run test:e2e
```

## Cloud Run Deployment

The project is fully pre-configured to be deployed natively to Google Cloud Run.

1. **Optimized Build Process**
   - The `next.config.ts` uses `output: "standalone"` to drastically reduce container size when building.
   - The `Dockerfile` includes a multi-stage Alpine build process natively binding to the `$PORT` variable injected by Cloud Run.

2. **Manual Deployment via GCP Console**
   - Navigate to Google Cloud Console > **Cloud Run**.
   - Create Service > **Continuous Deployment** from your repository.
   - Google Cloud Build will automatically find the `Dockerfile` and compile the optimized image.
   - Ensure you allow **unauthenticated invocations**.
   - Under the **Variables & Secrets** deployment tab, inject your `GEMINI_API_KEY` and `GCS_BUCKET_NAME`.
