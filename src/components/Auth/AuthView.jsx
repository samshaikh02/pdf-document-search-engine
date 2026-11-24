import React, { useState } from 'react';
import { 
  Lock, 
  Mail, 
  Key, 
  ArrowRight, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Cloud, 
  ShieldCheck, 
  Database,
  HelpCircle,
  Activity,
  Wand2
} from 'lucide-react';
import { signUpUser, signInUser, resetUserPassword } from '../../services/authService';
import { 
  isSupabaseConfigured, 
  setSupabaseConfig, 
  getStoredSupabaseConfig,
  normalizeSupabaseUrl,
  sanitizeSupabaseCredentials,
  testSupabaseConnection
} from '../../services/supabaseClient';

export default function AuthView({ onAuthSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'forgot' | 'setup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Setup mode fields (in case .env is not yet configured)
  const storedConfig = getStoredSupabaseConfig();
  const [supabaseUrl, setSupabaseUrl] = useState(storedConfig.url || '');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(storedConfig.anonKey || '');

  const hasConfig = isSupabaseConfigured();

  // Normalized preview
  const normalizedUrlPreview = supabaseUrl.trim() ? normalizeSupabaseUrl(supabaseUrl) : '';
  const urlNeedsFix = normalizedUrlPreview && normalizedUrlPreview !== supabaseUrl.trim();

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!hasConfig) {
      setMode('setup');
      return;
    }

    if (!email.trim() || (!password && mode !== 'forgot')) {
      setErrorMsg('Please complete all required fields.');
      return;
    }

    if (mode === 'register' && password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    if (mode === 'register' && password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'login') {
        const data = await signInUser(email.trim(), password);
        if (data?.user) {
          onAuthSuccess(data.user);
        }
      } else if (mode === 'register') {
        const data = await signUpUser(email.trim(), password);
        if (data?.session) {
          onAuthSuccess(data.user);
        } else {
          setSuccessMsg('Registration successful! Please check your email inbox to confirm your account, then sign in.');
          setMode('login');
        }
      } else if (mode === 'forgot') {
        await resetUserPassword(email.trim());
        setSuccessMsg('Password reset instructions have been dispatched to your email.');
      }
    } catch (err) {
      console.error('Auth error:', err);
      const msg = err.message || '';
      if (msg.includes('Invalid path specified in request URL') || msg.includes('PGRST125')) {
        setErrorMsg('Invalid Supabase Project URL: The URL configured has an extra sub-path (such as /rest/v1 or /dashboard). Please click "Cloud Settings" below to auto-correct it to strictly https://<project-id>.supabase.co.');
      } else if (msg.includes('Failed to fetch')) {
        setErrorMsg('Unable to reach Supabase server. Please verify your Project URL under Cloud Settings.');
      } else {
        setErrorMsg(msg || 'Authentication failed. Please verify credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await testSupabaseConnection(supabaseUrl, supabaseAnonKey);
      if (res.success) {
        setSuccessMsg(res.message);
      } else {
        setErrorMsg(res.message);
      }
    } catch (err) {
      setErrorMsg(`Connection test error: ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  const handleSaveSetup = (e) => {
    e.preventDefault();
    if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
      setErrorMsg('Both Supabase URL and Anon Key are required.');
      return;
    }

    const { url: cleanUrl, anonKey: cleanKey } = sanitizeSupabaseCredentials(supabaseUrl, supabaseAnonKey);

    if (!cleanUrl || !cleanUrl.startsWith('http')) {
      setErrorMsg('Please enter a valid HTTP/HTTPS URL (e.g. https://xyz.supabase.co).');
      return;
    }

    setSupabaseConfig(cleanUrl, cleanKey);
    setSupabaseUrl(cleanUrl);
    setSupabaseAnonKey(cleanKey);
    setSuccessMsg('Supabase cloud credentials normalized & saved successfully!');
    setErrorMsg('');
    setMode('login');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 selection:bg-indigo-500 selection:text-white">
      {/* Background Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-400 text-white shadow-xl shadow-indigo-500/25 mb-4">
            <Cloud className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            DocuSearch Cloud
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Live Synchronized PDF Search Engine across all your devices
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6">
          {/* Mode Switcher Tabs */}
          {mode !== 'setup' && (
            <div className="flex rounded-xl bg-slate-950/60 p-1 border border-slate-800">
              <button
                type="button"
                onClick={() => { setMode('login'); setErrorMsg(''); setSuccessMsg(''); }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  mode === 'login'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setMode('register'); setErrorMsg(''); setSuccessMsg(''); }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  mode === 'register'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Create Account
              </button>
            </div>
          )}

          {/* Setup Header if in Setup Mode */}
          {mode === 'setup' && (
            <div className="text-center space-y-1">
              <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 w-fit mx-auto mb-2">
                <Database className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Connect Supabase Project</h3>
              <p className="text-xs text-slate-400">
                Enter your Supabase URL & Anon Key to enable multi-device sync
              </p>
            </div>
          )}

          {/* Feedback Alerts */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-800/80 text-rose-300 text-xs flex items-start gap-2.5 animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-800/80 text-emerald-300 text-xs flex items-start gap-2.5 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Supabase Setup Form */}
          {mode === 'setup' ? (
            <form onSubmit={handleSaveSetup} className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Supabase Project URL
                  </label>
                  <span className="text-[10px] text-slate-500">
                    Format: https://&lt;id&gt;.supabase.co
                  </span>
                </div>
                <input
                  type="text"
                  placeholder="https://xyzcompany.supabase.co"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                />
                {urlNeedsFix && (
                  <div className="flex items-center gap-1.5 p-2 rounded-lg bg-indigo-950/60 border border-indigo-800 text-[11px] text-indigo-300 animate-fade-in">
                    <Wand2 className="w-3.5 h-3.5 shrink-0 text-indigo-400" />
                    <span>Auto-corrects to: <strong className="font-mono text-white">{normalizedUrlPreview}</strong></span>
                  </div>
                )}
                <p className="text-[11px] text-slate-400 leading-tight">
                  Found in Supabase Dashboard → <strong>Project Settings → API → Project URL</strong>. (Do not append <code className="text-rose-400">/rest/v1</code> or use the browser address bar).
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 block">
                  Supabase Anon / Public Key
                </label>
                <textarea
                  rows={3}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={supabaseAnonKey}
                  onChange={(e) => setSupabaseAnonKey(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                />
                <p className="text-[11px] text-slate-400 leading-tight">
                  Found under <strong>Project Settings → API → Project API keys → 'anon' 'public'</strong>.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testing || !supabaseUrl.trim() || !supabaseAnonKey.trim()}
                  className="px-3.5 py-2.5 rounded-xl border border-slate-700 hover:border-slate-600 bg-slate-800/60 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  {testing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Testing...</span>
                    </>
                  ) : (
                    <>
                      <Activity className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Test Connection</span>
                    </>
                  )}
                </button>

                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition"
                >
                  Save & Connect Cloud
                </button>

                {hasConfig && (
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="px-3 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-white text-xs transition"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          ) : (
            /* Auth Login / Register Form */
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 block">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {mode !== 'forgot' && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300">
                      Password
                    </label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => { setMode('forgot'); setErrorMsg(''); setSuccessMsg(''); }}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 transition"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Key className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}

              {mode === 'register' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Key className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition flex items-center justify-center gap-2 mt-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <span>
                      {mode === 'login'
                        ? 'Sign In to Cloud'
                        : mode === 'register'
                        ? 'Create Cloud Account'
                        : 'Send Password Reset Email'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {mode === 'forgot' && (
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setErrorMsg(''); setSuccessMsg(''); }}
                    className="text-xs text-slate-400 hover:text-white transition"
                  >
                    Back to Sign In
                  </button>
                </div>
              )}
            </form>
          )}

          {/* Cloud Security Guarantee Strip */}
          <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5 text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Private RLS Protected
            </span>

            <button
              type="button"
              onClick={() => { setMode('setup'); setErrorMsg(''); setSuccessMsg(''); }}
              className="text-slate-400 hover:text-indigo-400 transition underline underline-offset-2"
            >
              {hasConfig ? 'Cloud Settings' : 'Configure Supabase'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
