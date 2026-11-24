# DocuSearch – Cloud-Based Multi-Device PDF Document Search Engine

A high-performance, professional **PDF Document Search Engine** that works seamlessly across all your devices (desktop, laptop, mobile, different browsers) with **Supabase Cloud synchronization** and deployable on **Vercel** with HTTPS.

> **Dual-Mode Architecture**:
> 1. **Live Cloud Mode (Multi-Device)**: Powered by **Supabase** (Auth, PostgreSQL Database, Private Cloud Storage, Realtime Pub/Sub). Upload 100s of PDFs on PC 1, search from PC 2 or your laptop, with changes synchronized in real time.
> 2. **Offline Local Fallback**: When unconfigured or offline, seamlessly falls back to browser **IndexedDB (Dexie.js)** with 100% in-browser processing via **PDF.js** and **Tesseract.js OCR**.

---

## 🌟 Key Features

### 1. Multi-Device Synchronization (PC 1 ↔ PC 2 ↔ Laptop)
- **Shared Document Library**: Any PDF uploaded from one computer is immediately stored in private cloud storage and made searchable from all other devices logged into the same account.
- **Supabase Realtime**: Uploads, deletes, and document re-indexing broadcast instantly to all connected browser tabs and devices without needing a page refresh.
- **Persistent Sessions**: User authentication with secure JSON Web Tokens (JWT) and automatic refresh.

### 2. Global PDF Search Engine
- **Search Across Hundreds of PDFs**: Searches the entire collection of uploaded documents simultaneously.
- **Search Anything**: Full names (`Sameed Shaikh`), partial names (`Sameed`), exact phrases (`"Development Agreement"`), numbers (`123456`), addresses (`Ahmedabad`), phone numbers, and reference codes.
- **Multilingual Support**: First-class support for English, **Gujarati (ગુજરાતી, e.g., સમીદ શેખ)**, and **Hindi (हिन्दी, e.g., समीर शेख)** with full Unicode normalization.
- **Search Modes**:
  - Case-insensitive search
  - Exact phrase matching
  - Match all words / match any word
  - Case-sensitive toggle
- **Rich Results**:
  - Highlights matched keywords with contextual before/after snippets.
  - Displays total occurrences in document and per-page breakdown.
  - Relevance ranking based on filename matches, phrase density, and page occurrences.
  - Result pagination.

### 3. PDF Text Extraction & Tesseract.js OCR
- **PDF.js Direct Extraction**: Reads PDFs page-by-page directly in memory, extracting raw text and preserving exact page numbers.
- **Tesseract.js OCR for Scanned Pages**: Automatically detects pages with little or no selectable text (< 25 characters) and runs Tesseract OCR directly on high-resolution canvas renders.
- **Background Processing Queue**: Non-blocking queue processes documents sequentially or in controlled batches (1–2 OCR concurrency) to protect browser memory and prevent UI freezing.

### 4. Integrated PDF Viewer Modal
- **Direct Page Jump**: Clicking any search result opens the PDF directly on the exact matching page.
- **Secure Signed URLs**: Cloud PDFs are streamed securely via short-lived authenticated signed URLs.
- **Visual Keyword Highlights**: Displays an interactive search query banner and canvas overlay over matched terms.
- **Full Viewer Controls**:
  - Previous / Next page navigation and direct page number input
  - Zoom In, Zoom Out, and Zoom percentage indicator (50% to 300%)
  - 90° Clockwise Rotation
  - Download original PDF file
  - Keyboard shortcuts: `ArrowLeft` / `ArrowRight` (page flip), `Escape` (close)

### 5. Upload Capacity & Storage Management
- **Document Collection Limit**: Supports up to **500 PDF documents** initially (configurable to scale up to **1,000–5,000 PDFs**).
- **Individual File Size Guard**: Enforces a maximum individual file size of **25 MB** (configurable to 15, 25, 50, or 100 MB).
- **2 GB Storage Budget with Cloud & Browser Quota Checks**: Evaluates storage against a **2.0 GB target budget**, tracking actual usage.
- **Simultaneous Upload Limit**: Accepts a maximum of **10 simultaneous files** per batch to prevent network or browser throttling.
- **Controlled OCR Processing**: Batches OCR jobs in controlled sets of **1–2 PDFs** with non-blocking event-loop yields between pages.
- **Real-Time Capacity Metrics & Warnings**: Displays used storage, available storage, and remaining document capacity on the dashboard with visual alert banners when approaching limits.
- **Easy Deletion to Free Space**: Instantly delete individual or batch documents to reclaim storage without losing remaining indexes.

### 6. Security & Row Level Security (RLS)
- **Private Storage Bucket**: `pdf-documents` storage bucket is private; files cannot be accessed anonymously.
- **Strict Row Level Security**: Supabase RLS policies enforce that users can only view, query, and modify their own documents, pages, and search history.
- **No Service Keys Exposed**: Frontend code only uses the public Supabase Anon key; elevated operations are governed strictly by Postgres RLS `auth.uid() = user_id`.

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend UI** | **React 18** | UI component architecture and state management |
| **Bundler & Tooling** | **Vite 5** | High-performance ES modules bundler and build system |
| **Styling** | **Tailwind CSS** | Modern, responsive dashboard design |
| **Cloud Authentication** | **Supabase Auth** | Sign In, Sign Up, Password Reset, JWT sessions |
| **Cloud Database** | **PostgreSQL (Supabase)** | Relational metadata, page text storage, GIN trigram indexes |
| **Cloud Storage** | **Supabase Storage** | Private bucket storage for original PDF binary files |
| **Live Sync** | **Supabase Realtime** | Multi-device WebSocket pub/sub for instant sync |
| **PDF Processing** | **PDF.js (`pdfjs-dist`)** | Client-side PDF parsing, text extraction, canvas page rendering |
| **Optical Character Recognition** | **Tesseract.js** | Optical Character Recognition for scanned / image PDF pages |
| **Local Offline Database** | **IndexedDB & Dexie.js** | Browser database fallback when offline or unconfigured |
| **Icons** | **Lucide React** | Sleek UI iconography |
| **Production Hosting** | **Vercel** | Edge network hosting with HTTPS, HTTP/2, and SPA rewrites |

---

## 📁 Project Structure

```
PDFsearch/
├── .env.example                     # Production environment variable template
├── index.html                       # HTML template with responsive viewport
├── package.json                     # Dependencies and scripts
├── tailwind.config.js               # Tailwind CSS theme configuration
├── vercel.json                      # Vercel deployment & security headers config
├── vite.config.js                   # Vite config with vendor chunk splitting
├── public/
│   ├── cmaps/                       # Character maps for non-Latin & Unicode glyphs
│   ├── standard_fonts/              # Standard Liberation fonts for 100% offline rendering
│   └── pdf.worker.min.js            # Local PDF.js Web Worker (no external CDN)
├── sample_test_pdfs/                # Generated real test PDFs
├── supabase/
│   └── schema.sql                   # Complete PostgreSQL schema, RLS policies, & bucket config
├── src/
│   ├── components/
│   │   ├── Auth/
│   │   │   └── AuthView.jsx         # Sign In, Sign Up, Password Reset, and Supabase Connect
│   │   ├── PDFViewer/
│   │   │   └── PDFViewerModal.jsx   # Full-featured integrated PDF viewer (supports signed cloud URLs)
│   │   ├── AllDocumentsView.jsx     # Document library, sorting, and batch management
│   │   ├── DashboardView.jsx        # Metrics, quick upload, and recent activity
│   │   ├── Header.jsx               # Quick search, queue status badge, & user account pill
│   │   ├── SearchHistoryView.jsx    # Search history log and re-search actions
│   │   ├── SearchView.jsx           # Global PDF search engine with snippets & filters
│   │   ├── SettingsView.jsx         # Storage quota monitor, cloud sync settings, & OCR config
│   │   ├── Sidebar.jsx              # Navigation and multi-device cloud sync indicator
│   │   └── UploadView.jsx           # Batch drag & drop upload and queue progress
│   ├── services/
│   │   ├── authService.js           # Supabase Auth client wrapper & session management
│   │   ├── cloudDb.js               # Supabase PostgreSQL, Storage, & Realtime sync layer
│   │   ├── db.js                    # Dexie.js IndexedDB schema and offline fallback
│   │   ├── ocrService.js            # Tesseract.js OCR worker management
│   │   ├── pdfExtractor.js          # Page-by-page PDF.js text extraction & OCR trigger
│   │   ├── pdfWorker.js             # PDF.js worker setup
│   │   ├── queueManager.js          # Dual-mode background processing queue manager
│   │   ├── searchEngine.js          # Dual-mode search engine (Cloud Postgres + Local Dexie)
│   │   ├── sampleDocsGenerator.js   # In-browser test PDF generator (English, Gujarati, Hindi, Scanned)
│   │   └── supabaseClient.js        # Supabase client singleton with runtime config support
│   ├── App.jsx                      # Main application shell with cloud auth and live query bindings
│   ├── index.css                    # Tailwind CSS & highlight mark styling
│   └── main.jsx                     # React entrypoint
├── test_cloud_integration.mjs       # Automated cloud architecture & RLS test suite
├── test_limits_and_capacity.mjs     # Automated upload limits & storage test suite
└── test_search_engine.mjs           # Automated core search & extraction test suite
```

---

## ⚡ Setup & Deployment Guide

### Option 1: Quick Local Run (Offline Mode)
If you just want to run the application locally without Supabase:
```bash
npm install
npm run dev
```
Open **`http://localhost:5173`**. The application runs with IndexedDB local storage.

---

### Option 2: Live Multi-Device Cloud Mode (with Supabase)

#### Step 1: Create a Supabase Project
1. Go to [https://supabase.com](https://supabase.com) and create a free account.
2. Click **New project**, name it `pdf-document-search-engine`, set a database password, and choose your preferred region.

#### Step 2: Apply Database Schema & Policies
1. In your Supabase Dashboard, open the **SQL Editor** from the left navigation.
2. Click **New Query**, copy the entire contents of [`supabase/schema.sql`](file:///s:/Sameed%20Projects/PDFsearch/supabase/schema.sql), and paste it into the editor.
3. Click **Run** (or `Ctrl+Enter`).
4. This script automatically:
   - Creates tables: `public.documents`, `public.document_pages`, `public.search_history`, `public.user_settings`.
   - Creates GIN trigram indexes for high-speed multilingual text search (English, Gujarati, Hindi).
   - Configures strict Row Level Security (RLS) policies.
   - Creates the private `pdf-documents` storage bucket with a 25 MB max file size limit.
   - Adds tables to the `supabase_realtime` publication for instant multi-device syncing.

#### Step 3: Configure Environment Variables
1. In your Supabase Dashboard, navigate to **Project Settings** → **API**.
2. Copy the **Project URL** and the **Project API anon public key**.
3. In your project directory, copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
4. Fill in your credentials:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
   *(Note: You can also connect your Supabase credentials directly through the web UI by clicking the "Connect Cloud Account" button in the application!)*

#### Step 4: Run the Application
```bash
npm run dev
```
Open **`http://localhost:5173`**.

---

### 🌐 Deploying to Production on Vercel

The project includes [`vercel.json`](file:///s:/Sameed%20Projects/PDFsearch/vercel.json) pre-configured with Single Page Application (SPA) routing rewrites and security headers (`X-Frame-Options`, `X-Content-Type-Options`).

#### Deploy via Vercel CLI:
```bash
npm install -g vercel
vercel
```
When prompted for Environment Variables, add:
- `VITE_SUPABASE_URL` = your Supabase Project URL
- `VITE_SUPABASE_ANON_KEY` = your Supabase Anon public key

#### Deploy via GitHub / Vercel Dashboard:
1. Push your repository to GitHub.
2. Log in to [https://vercel.com](https://vercel.com) and click **Add New** → **Project**.
3. Import your repository.
4. Under **Environment Variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Click **Deploy**. Your application will be live with full HTTPS across the globe!

---

## 💻 Multi-Device Access Verification (How to Test)

1. **On Computer 1 (or Browser Window 1):**
   - Open your deployed URL (or `http://localhost:5173`).
   - Click **Sign Up** and create an account (e.g., `sameed@example.com`).
   - Go to **Upload Documents** and upload your PDF files (or click **"Load 5 Test PDFs"**).
   - The PDFs are uploaded to Supabase Storage, and page text is extracted and stored in PostgreSQL.

2. **On Computer 2 (or an Incognito Window / Mobile Device):**
   - Open the same URL.
   - Log in using the same account credentials (`sameed@example.com`).
   - You will immediately see all uploaded PDFs on the Dashboard and All Documents list.
   - Enter **"Sameed Shaikh"** or **"Ahmedabad"** into the search bar.
   - All results, page numbers, occurrence counts, and highlighted snippets appear instantly.
   - Click on any result to open the original PDF directly on that page via signed streaming URLs!

3. **Realtime Sync Test:**
   - Keep Computer 1 and Computer 2 open side-by-side.
   - Delete or upload a PDF on Computer 1.
   - Computer 2 automatically updates its list and dashboard without any manual page refresh!

---

## 🧪 Automated Test Suites

All 3 automated test suites can be executed with 100% pass rate:

```bash
# 1. Cloud Architecture, RLS & Vercel Config Test
node test_cloud_integration.mjs

# 2. Upload Limits (500 docs, 25 MB max, 2 GB budget, concurrency) Test
node test_limits_and_capacity.mjs

# 3. Core Search Engine & Text Extraction (English, Gujarati, Hindi, Scanned OCR) Test
node test_search_engine.mjs
```

---

## 📜 License
Private & Proprietary. Built for high-volume, multi-device PDF document search.
