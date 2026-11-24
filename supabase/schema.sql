-- ==============================================================
-- Supabase Database Schema & Storage Configuration (Public Multi-Device Mode)
-- DocuSearch Public Multi-Device PDF Document Search Engine
-- ==============================================================

-- 1. Enable UUID Extension & Trigram Extension for Fast Multilingual & Substring Search
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 2. Documents Metadata Table (Publicly shared across devices)
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT DEFAULT 'public',
    name TEXT NOT NULL,
    size BIGINT NOT NULL,
    type TEXT DEFAULT 'application/pdf',
    page_count INTEGER DEFAULT 0,
    storage_path TEXT NOT NULL,
    upload_date TIMESTAMPTZ DEFAULT NOW(),
    index_status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'indexed', 'failed', 'ocr_processing'
    ocr_applied BOOLEAN DEFAULT FALSE,
    ocr_page_count INTEGER DEFAULT 0,
    extracted_words_count INTEGER DEFAULT 0,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- If upgrading from previous authenticated schema, relax constraints:
DO $$
BEGIN
    ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_user_id_fkey;
    ALTER TABLE public.documents ALTER COLUMN user_id DROP NOT NULL;
    ALTER TABLE public.documents ALTER COLUMN user_id TYPE TEXT;
    ALTER TABLE public.documents ALTER COLUMN user_id SET DEFAULT 'public';
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- 3. Document Pages Extracted Text Table (Page-by-Page)
CREATE TABLE IF NOT EXISTS public.document_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT DEFAULT 'public',
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
    page_number INTEGER NOT NULL,
    text TEXT NOT NULL,
    word_count INTEGER DEFAULT 0,
    has_ocr BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (document_id, page_number)
);

DO $$
BEGIN
    ALTER TABLE public.document_pages DROP CONSTRAINT IF EXISTS document_pages_user_id_fkey;
    ALTER TABLE public.document_pages ALTER COLUMN user_id DROP NOT NULL;
    ALTER TABLE public.document_pages ALTER COLUMN user_id TYPE TEXT;
    ALTER TABLE public.document_pages ALTER COLUMN user_id SET DEFAULT 'public';
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- 4. Search History Table
CREATE TABLE IF NOT EXISTS public.search_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT DEFAULT 'public',
    query TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    match_count INTEGER DEFAULT 0,
    doc_count INTEGER DEFAULT 0
);

DO $$
BEGIN
    ALTER TABLE public.search_history DROP CONSTRAINT IF EXISTS search_history_user_id_fkey;
    ALTER TABLE public.search_history ALTER COLUMN user_id DROP NOT NULL;
    ALTER TABLE public.search_history ALTER COLUMN user_id TYPE TEXT;
    ALTER TABLE public.search_history ALTER COLUMN user_id SET DEFAULT 'public';
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- 5. User Settings Table
CREATE TABLE IF NOT EXISTS public.user_settings (
    key TEXT PRIMARY KEY,
    user_id TEXT DEFAULT 'public',
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
    ALTER TABLE public.user_settings DROP CONSTRAINT IF EXISTS user_settings_user_id_fkey;
    ALTER TABLE public.user_settings ALTER COLUMN user_id DROP NOT NULL;
    ALTER TABLE public.user_settings ALTER COLUMN user_id TYPE TEXT;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- ==============================================================
-- Indexes for High Performance Search Across Thousands of PDFs
-- ==============================================================
CREATE INDEX IF NOT EXISTS idx_documents_status ON public.documents(index_status);
CREATE INDEX IF NOT EXISTS idx_documents_created ON public.documents(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_document_pages_doc_id ON public.document_pages(document_id);
CREATE INDEX IF NOT EXISTS idx_document_pages_page_no ON public.document_pages(document_id, page_number);

-- Trigram indexes for fast partial, names, numbers & exact phrase substring searches (supporting English, Gujarati & Hindi)
CREATE INDEX IF NOT EXISTS idx_document_pages_text_trgm ON public.document_pages USING gin (text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_documents_name_trgm ON public.documents USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_search_history_timestamp ON public.search_history(timestamp DESC);

-- ==============================================================
-- Row Level Security (RLS) Policies for Public Multi-Device Access
-- Allows all users (anon and authenticated) with the web URL to access documents
-- ==============================================================
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Clean existing policies
DROP POLICY IF EXISTS "Users can view own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can insert own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can delete own documents" ON public.documents;
DROP POLICY IF EXISTS "Public full access on documents" ON public.documents;

DROP POLICY IF EXISTS "Users can view own document pages" ON public.document_pages;
DROP POLICY IF EXISTS "Users can insert own document pages" ON public.document_pages;
DROP POLICY IF EXISTS "Users can update own document pages" ON public.document_pages;
DROP POLICY IF EXISTS "Users can delete own document pages" ON public.document_pages;
DROP POLICY IF EXISTS "Public full access on document pages" ON public.document_pages;

DROP POLICY IF EXISTS "Users can view own search history" ON public.search_history;
DROP POLICY IF EXISTS "Users can insert search history" ON public.search_history;
DROP POLICY IF EXISTS "Users can delete own search history" ON public.search_history;
DROP POLICY IF EXISTS "Public full access on search history" ON public.search_history;

DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can upsert own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Public full access on user settings" ON public.user_settings;

-- Public Access Policies: Any visitor with the application URL can read, upload, index and delete
CREATE POLICY "Public full access on documents" 
    ON public.documents FOR ALL 
    TO anon, authenticated
    USING (true) 
    WITH CHECK (true);

CREATE POLICY "Public full access on document pages" 
    ON public.document_pages FOR ALL 
    TO anon, authenticated
    USING (true) 
    WITH CHECK (true);

CREATE POLICY "Public full access on search history" 
    ON public.search_history FOR ALL 
    TO anon, authenticated
    USING (true) 
    WITH CHECK (true);

CREATE POLICY "Public full access on user settings" 
    ON public.user_settings FOR ALL 
    TO anon, authenticated
    USING (true) 
    WITH CHECK (true);

-- ==============================================================
-- Storage Bucket Configuration: pdf-documents
-- ==============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'pdf-documents',
    'pdf-documents',
    true, -- Public access enabled so documents can stream to viewer across computers
    26214400, -- 25 MB max individual file size
    ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE SET 
    public = true,
    file_size_limit = 26214400,
    allowed_mime_types = ARRAY['application/pdf'];

-- Clean existing storage policies
DROP POLICY IF EXISTS "Users can view own pdf files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own pdf files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own pdf files" ON storage.objects;
DROP POLICY IF EXISTS "Public can view pdf files" ON storage.objects;
DROP POLICY IF EXISTS "Public can upload pdf files" ON storage.objects;
DROP POLICY IF EXISTS "Public can delete pdf files" ON storage.objects;

-- Public Storage Policies
CREATE POLICY "Public can view pdf files" 
    ON storage.objects FOR SELECT 
    TO anon, authenticated
    USING (bucket_id = 'pdf-documents');

CREATE POLICY "Public can upload pdf files" 
    ON storage.objects FOR INSERT 
    TO anon, authenticated
    WITH CHECK (bucket_id = 'pdf-documents');

CREATE POLICY "Public can delete pdf files" 
    ON storage.objects FOR DELETE 
    TO anon, authenticated
    USING (bucket_id = 'pdf-documents');

-- ==============================================================
-- Realtime Synchronization Publication
-- Broadcasts inserts, updates, and deletes across all connected computers
-- ==============================================================
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.document_pages;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
