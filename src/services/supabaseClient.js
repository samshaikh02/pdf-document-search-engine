import { createClient } from '@supabase/supabase-js';

/**
 * Normalizes and sanitizes a Supabase Project URL.
 * Automatically strips accidental suffixes like `/rest/v1`, `/auth/v1`,
 * trailing slashes, or browser dashboard URLs.
 */
export function normalizeSupabaseUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let cleaned = rawUrl.trim();

  // If user copied the dashboard browser address: https://supabase.com/dashboard/project/<ref>/...
  const dashboardMatch = cleaned.match(/(?:supabase\.com|supabase\.io)\/dashboard\/project\/([a-zA-Z0-9_-]+)/i);
  if (dashboardMatch && dashboardMatch[1]) {
    return `https://${dashboardMatch[1]}.supabase.co`;
  }

  // Ensure protocol
  if (!/^https?:\/\//i.test(cleaned)) {
    cleaned = `https://${cleaned}`;
  }

  try {
    const parsed = new URL(cleaned);
    // If hostname is standard Supabase cloud: <project-ref>.supabase.co
    if (parsed.hostname.endsWith('.supabase.co')) {
      return parsed.origin;
    }

    // For custom domains or self-hosted Kong instances:
    // Strip trailing endpoints like /rest/v1, /auth/v1, /storage/v1
    const pathname = parsed.pathname
      .replace(/\/rest\/v1\/?$/i, '')
      .replace(/\/auth\/v1\/?$/i, '')
      .replace(/\/storage\/v1\/?$/i, '')
      .replace(/\/+$/, '');

    return `${parsed.origin}${pathname}`;
  } catch {
    return cleaned
      .replace(/\/rest\/v1\/?$/i, '')
      .replace(/\/auth\/v1\/?$/i, '')
      .replace(/\/storage\/v1\/?$/i, '')
      .replace(/\/+$/, '');
  }
}

/**
 * Sanitizes and validates Supabase credentials, detecting swapped URL/key.
 */
export function sanitizeSupabaseCredentials(rawUrl, rawKey) {
  let url = (rawUrl || '').trim();
  let anonKey = (rawKey || '').trim();

  // Check if user accidentally swapped URL and Anon Key
  if (anonKey.startsWith('http://') || anonKey.startsWith('https://') || anonKey.includes('.supabase.co')) {
    if (url.startsWith('eyJ') || url.length > 50) {
      const temp = url;
      url = anonKey;
      anonKey = temp;
    }
  }

  url = normalizeSupabaseUrl(url);

  return { url, anonKey };
}

// Retrieve credentials from Vite environment variables or local storage configuration
export function getStoredSupabaseConfig() {
  if (typeof window === 'undefined') return { url: '', anonKey: '' };

  const envUrl = import.meta.env?.VITE_SUPABASE_URL || '';
  const envKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || '';

  const localUrl = localStorage.getItem('docusearch_supabase_url') || '';
  const localKey = localStorage.getItem('docusearch_supabase_anon_key') || '';

  const rawUrl = envUrl || localUrl;
  const rawKey = envKey || localKey;

  const { url, anonKey } = sanitizeSupabaseCredentials(rawUrl, rawKey);

  // If localStorage contained an un-sanitized URL (e.g. with /rest/v1), automatically heal it
  if (localUrl && localUrl !== url) {
    localStorage.setItem('docusearch_supabase_url', url);
  }

  return { url, anonKey };
}

let supabaseInstance = null;
let currentConfig = { url: '', anonKey: '' };

/**
 * Returns whether Supabase is configured with valid URL & Key
 */
export function isSupabaseConfigured() {
  const { url, anonKey } = getStoredSupabaseConfig();
  return Boolean(url && anonKey && url.startsWith('http'));
}

/**
 * Get or create Supabase client instance
 */
export function getSupabase() {
  const { url, anonKey } = getStoredSupabaseConfig();

  if (!url || !anonKey || !url.startsWith('http')) {
    return null;
  }

  // Re-instantiate if config changed
  if (!supabaseInstance || currentConfig.url !== url || currentConfig.anonKey !== anonKey) {
    supabaseInstance = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    });
    currentConfig = { url, anonKey };
  }

  return supabaseInstance;
}

/**
 * Save Supabase config manually in browser
 */
export function setSupabaseConfig(rawUrl, rawKey) {
  if (typeof window !== 'undefined') {
    const { url, anonKey } = sanitizeSupabaseCredentials(rawUrl, rawKey);
    localStorage.setItem('docusearch_supabase_url', url);
    localStorage.setItem('docusearch_supabase_anon_key', anonKey);
    supabaseInstance = null; // force re-instantiation
  }
}

/**
 * Clear configured Supabase credentials
 */
export function clearSupabaseConfig() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('docusearch_supabase_url');
    localStorage.removeItem('docusearch_supabase_anon_key');
    supabaseInstance = null;
  }
}

/**
 * Tests connectivity to Supabase project
 */
export async function testSupabaseConnection(customUrl, customKey) {
  try {
    const { url, anonKey } = sanitizeSupabaseCredentials(
      customUrl || getStoredSupabaseConfig().url,
      customKey || getStoredSupabaseConfig().anonKey
    );

    if (!url || !anonKey) {
      return { success: false, message: 'Both Supabase URL and Anon Key are required.' };
    }

    // Ping the Supabase auth health endpoint
    const response = await fetch(`${url}/auth/v1/health`, {
      method: 'GET',
      headers: {
        'apikey': anonKey
      }
    });

    if (response.ok) {
      return { success: true, message: 'Successfully connected to Supabase Cloud!' };
    }

    // Secondary check: test root REST endpoint
    const restRes = await fetch(`${url}/rest/v1/`, {
      method: 'GET',
      headers: {
        'apikey': anonKey
      }
    });

    if (restRes.ok || restRes.status === 200 || restRes.status === 300) {
      return { success: true, message: 'Successfully connected to Supabase Cloud!' };
    }

    return { 
      success: false, 
      message: `Server returned HTTP ${response.status}. Please verify your Project URL and Anon Public Key.` 
    };
  } catch (err) {
    return { 
      success: false, 
      message: `Failed to reach Supabase: ${err.message}. Ensure your Project URL is strictly formatted as https://<project-ref>.supabase.co.` 
    };
  }
}
