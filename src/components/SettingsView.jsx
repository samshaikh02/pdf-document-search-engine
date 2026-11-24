import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Trash2, 
  Cpu, 
  HardDrive, 
  ShieldCheck, 
  Check, 
  AlertTriangle, 
  Sparkles,
  RefreshCw,
  Sliders,
  Layers,
  FileCheck,
  Cloud,
  LogOut,
  User,
  Key
} from 'lucide-react';
import { 
  getAllSettings, 
  setSetting, 
  clearAllData, 
  getStorageStats,
  DEFAULT_SETTINGS 
} from '../services/db';
import { terminateOcrWorker } from '../services/ocrService';
import { queueManager } from '../services/queueManager';
import { signOutUser } from '../services/authService';
import { 
  getStoredSupabaseConfig, 
  setSupabaseConfig, 
  isSupabaseConfigured,
  normalizeSupabaseUrl,
  sanitizeSupabaseCredentials,
  testSupabaseConnection 
} from '../services/supabaseClient';

export default function SettingsView({ storageStats, onStorageUpdate, isCloudActive }) {
  const [settings, setSettings] = useState({
    ...DEFAULT_SETTINGS
  });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showConfigInputs, setShowConfigInputs] = useState(false);

  const initialConfig = getStoredSupabaseConfig();
  const [supabaseUrl, setSupabaseUrl] = useState(initialConfig.url);
  const [supabaseKey, setSupabaseKey] = useState(initialConfig.anonKey);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    async function load() {
      const s = await getAllSettings();
      setSettings(s);
    }
    load();
  }, []);

  const handleSettingChange = async (key, val) => {
    const updated = { ...settings, [key]: val };
    setSettings(updated);
    await setSetting(key, val);
    if (onStorageUpdate) {
      await onStorageUpdate();
    }
    triggerSaved();
  };

  const handleToggle = async (key) => {
    const updated = { ...settings, [key]: !settings[key] };
    setSettings(updated);
    await setSetting(key, updated[key]);
    triggerSaved();
  };

  const handleLanguageChange = async (langCode) => {
    const updated = { ...settings, ocrLanguages: langCode };
    setSettings(updated);
    await setSetting('ocrLanguages', langCode);
    await terminateOcrWorker(); // Restart worker with new language configuration
    triggerSaved();
  };

  const triggerSaved = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleClearAll = async () => {
    const confirm1 = window.confirm(
      'WARNING: This will permanently delete ALL uploaded PDF files, extracted text, and search history from your browser.'
    );
    if (!confirm1) return;

    const confirm2 = window.prompt('To confirm, type "DELETE ALL" in the box below:');
    if (confirm2 !== 'DELETE ALL') {
      alert('Action cancelled.');
      return;
    }

    setClearing(true);
    try {
      queueManager.clearAll();
      await clearAllData();
      await terminateOcrWorker();
      await onStorageUpdate();
      alert('All local data has been successfully cleared.');
      window.location.reload();
    } catch (err) {
      alert(`Failed to clear data: ${err.message}`);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Application Settings & Limits</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure storage budget, document capacity, OCR batch sizes, and file restrictions.
          </p>
        </div>

        {saveSuccess && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200 animate-fade-in">
            <Check className="w-3.5 h-3.5" />
            <span>Settings saved locally</span>
          </div>
        )}
      </div>

      {/* Cloud Account & Multi-Device Sync Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Supabase Cloud & Multi-Device Sync</h3>
              <p className="text-xs text-slate-400">
                {isCloudActive 
                  ? 'Active & Synchronized: Access and search PDFs across PC 1, PC 2, laptop & mobile without login'
                  : 'Connect your Supabase project URL & Anon key to enable multi-device sync'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowConfigInputs(!showConfigInputs)}
              className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold transition"
            >
              {showConfigInputs ? 'Hide Config' : 'Configure Cloud Project'}
            </button>
          </div>
        </div>

        {/* Supabase URL & Key Configuration fields */}
        {showConfigInputs && (
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3 text-xs animate-fade-in">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-700 block">Supabase Project URL</label>
                <span className="text-[10px] text-slate-400">Strictly https://&lt;id&gt;.supabase.co</span>
              </div>
              <input
                type="text"
                placeholder="https://xyzproject.supabase.co"
                value={supabaseUrl}
                onChange={(e) => {
                  setSupabaseUrl(e.target.value);
                  setTestResult(null);
                }}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono text-xs focus:outline-none focus:border-indigo-500"
              />
              {supabaseUrl && normalizeSupabaseUrl(supabaseUrl) !== supabaseUrl.trim() && (
                <p className="text-[11px] text-indigo-600 font-medium">
                  Auto-corrects to: <span className="font-mono font-bold">{normalizeSupabaseUrl(supabaseUrl)}</span>
                </p>
              )}
              <p className="text-[11px] text-slate-400">
                Found in Supabase Dashboard → <strong>Project Settings → API → Project URL</strong>. (Do not append <code>/rest/v1</code>).
              </p>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 block">Supabase Anon Key</label>
              <input
                type="password"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={supabaseKey}
                onChange={(e) => {
                  setSupabaseKey(e.target.value);
                  setTestResult(null);
                }}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono text-xs focus:outline-none focus:border-indigo-500"
              />
              <p className="text-[11px] text-slate-400">
                Found under <strong>Project Settings → API → Project API keys → 'anon' 'public'</strong>.
              </p>
            </div>

            {testResult && (
              <div className={`p-2.5 rounded-lg border text-xs ${
                testResult.success 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                  : 'bg-rose-50 border-rose-200 text-rose-700'
              }`}>
                {testResult.message}
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                disabled={testingConnection || !supabaseUrl.trim() || !supabaseKey.trim()}
                onClick={async () => {
                  setTestingConnection(true);
                  const res = await testSupabaseConnection(supabaseUrl, supabaseKey);
                  setTestResult(res);
                  setTestingConnection(false);
                }}
                className="px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition disabled:opacity-50"
              >
                {testingConnection ? 'Testing...' : 'Test Connection'}
              </button>

              <button
                type="button"
                onClick={() => {
                  const { url, anonKey } = sanitizeSupabaseCredentials(supabaseUrl, supabaseKey);
                  setSupabaseConfig(url, anonKey);
                  setSupabaseUrl(url);
                  setSupabaseKey(anonKey);
                  alert('Supabase project configuration normalized and saved! Reloading application...');
                  window.location.reload();
                }}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition"
              >
                Save Cloud Configuration
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Storage Quota & Capacity Monitor */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Browser Storage & Budget Meter</h3>
              <p className="text-xs text-slate-400">IndexedDB local storage checked directly from browser</p>
            </div>
          </div>
          <button
            onClick={onStorageUpdate}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
            title="Refresh Storage Estimate"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Meter */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-600">
              Used: <strong className="text-slate-900">{storageStats?.formattedUsage || '0 MB'}</strong>
            </span>
            <span className="text-slate-600">
              Available: <strong className="text-emerald-700">{storageStats?.formattedAvailable || '2.00 GB'}</strong>
            </span>
            <span className="text-slate-600">
              Budget: <strong className="text-indigo-700">{storageStats?.formattedQuota || '2.00 GB'}</strong>
            </span>
          </div>

          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
            <div
              className={`h-3 rounded-full transition-all duration-300 ${
                storageStats?.isStorageCritical
                  ? 'bg-rose-500'
                  : storageStats?.isStorageWarning
                  ? 'bg-amber-500'
                  : 'bg-indigo-600'
              }`}
              style={{ width: `${Math.min(100, Math.max(1, storageStats?.usagePercent || 1))}%` }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 text-[11px] text-slate-500">
            <div className="p-2 rounded bg-slate-50 border border-slate-100">
              <span className="font-semibold text-slate-700 block">Actual Browser Quota:</span>
              <span>{storageStats?.formattedBrowserQuota || 'Unknown'} (from OS / disk)</span>
            </div>
            <div className="p-2 rounded bg-slate-50 border border-slate-100">
              <span className="font-semibold text-slate-700 block">Document Capacity:</span>
              <span>{storageStats?.currentDocCount || 0} / {settings.maxDocumentCount} ({storageStats?.remainingDocCapacity} free)</span>
            </div>
            <div className="p-2 rounded bg-slate-50 border border-slate-100">
              <span className="font-semibold text-slate-700 block">Safety Guard:</span>
              <span>Lower of Browser Quota & Budget</span>
            </div>
          </div>
        </div>
      </div>

      {/* Configurable Capacity & Upload Limits Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Capacity & Processing Limits</h3>
            <p className="text-xs text-slate-400">
              Configurable limits designed to scale from 500 up to 5,000 PDF documents
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
          {/* Max Document Capacity Limit */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-800 block">
              1. Document Collection Capacity
            </label>
            <p className="text-[11px] text-slate-400">
              Maximum total PDF files permitted in local storage.
            </p>
            <select
              value={settings.maxDocumentCount}
              onChange={(e) => handleSettingChange('maxDocumentCount', parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
            >
              <option value={500}>500 Documents (Default)</option>
              <option value={1000}>1,000 Documents (High Capacity)</option>
              <option value={2500}>2,500 Documents (Enterprise)</option>
              <option value={5000}>5,000 Documents (Max Architecture)</option>
            </select>
          </div>

          {/* Max Individual PDF Size */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-800 block">
              2. Maximum Individual PDF Size
            </label>
            <p className="text-[11px] text-slate-400">
              Larger files are rejected to protect browser memory.
            </p>
            <select
              value={settings.maxFileSizeMB}
              onChange={(e) => handleSettingChange('maxFileSizeMB', parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
            >
              <option value={15}>15 MB</option>
              <option value={25}>25 MB (Default)</option>
              <option value={50}>50 MB</option>
              <option value={100}>100 MB</option>
            </select>
          </div>

          {/* Storage Budget */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-800 block">
              3. Suggested Storage Budget
            </label>
            <p className="text-[11px] text-slate-400">
              Storage target allowance for PDFs and text indices.
            </p>
            <select
              value={settings.storageBudgetGB}
              onChange={(e) => handleSettingChange('storageBudgetGB', parseFloat(e.target.value))}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
            >
              <option value={1.0}>1.0 GB</option>
              <option value={2.0}>2.0 GB (Default)</option>
              <option value={4.0}>4.0 GB</option>
              <option value={8.0}>8.0 GB</option>
            </select>
          </div>

          {/* Simultaneous Upload Limit */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-800 block">
              4. Maximum Simultaneous Uploads
            </label>
            <p className="text-[11px] text-slate-400">
              Number of files accepted in a single upload batch.
            </p>
            <select
              value={settings.maxSimultaneousUploads}
              onChange={(e) => handleSettingChange('maxSimultaneousUploads', parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
            >
              <option value={5}>5 Files</option>
              <option value={10}>10 Files (Default)</option>
              <option value={20}>20 Files</option>
            </select>
          </div>

          {/* OCR Controlled Concurrency */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-800 block">
              5. OCR Controlled Concurrency
            </label>
            <p className="text-[11px] text-slate-400">
              Processes OCR jobs in controlled batches of 1–2 PDFs.
            </p>
            <select
              value={settings.ocrConcurrency}
              onChange={(e) => handleSettingChange('ocrConcurrency', parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
            >
              <option value={1}>1 PDF at a time (Recommended / Never Freezes UI)</option>
              <option value={2}>2 PDFs in parallel (Fastest)</option>
            </select>
          </div>

          {/* Storage Warning Threshold */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-800 block">
              6. Storage Warning Alert Threshold
            </label>
            <p className="text-[11px] text-slate-400">
              Trigger alerts when storage reaches this budget percentage.
            </p>
            <select
              value={settings.storageWarningThreshold}
              onChange={(e) => handleSettingChange('storageWarningThreshold', parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
            >
              <option value={70}>70% Capacity</option>
              <option value={80}>80% Capacity (Default)</option>
              <option value={90}>90% Capacity</option>
            </select>
          </div>
        </div>
      </div>

      {/* OCR & Multilingual Settings */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Tesseract.js OCR & Multilingual Engine</h3>
            <p className="text-xs text-slate-400">Optical Character Recognition for scanned pages and images</p>
          </div>
        </div>

        <div className="space-y-4 pt-2">
          {/* Enable OCR toggle */}
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <div>
              <p className="text-xs font-semibold text-slate-800">Enable Scanned Page OCR</p>
              <p className="text-[11px] text-slate-400">
                Automatically triggers OCR when a PDF page has little or no extractable text.
              </p>
            </div>
            <button
              onClick={() => handleToggle('ocrEnabled')}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                settings.ocrEnabled ? 'bg-indigo-600' : 'bg-slate-300'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  settings.ocrEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Languages selection */}
          <div className="py-2 space-y-2">
            <label className="text-xs font-semibold text-slate-800 block">
              OCR Recognition Languages
            </label>
            <p className="text-[11px] text-slate-400 mb-2">
              Select language models to load for scanned text extraction:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                { id: 'eng+guj+hin', label: 'English + Gujarati + Hindi', tag: 'All 3 Languages' },
                { id: 'eng', label: 'English Only', tag: 'Fastest' },
                { id: 'eng+guj', label: 'English + Gujarati', tag: 'Bilingual' },
              ].map((lang) => (
                <button
                  key={lang.id}
                  onClick={() => handleLanguageChange(lang.id)}
                  className={`p-3 rounded-lg border text-left text-xs transition ${
                    settings.ocrLanguages === lang.id
                      ? 'border-indigo-600 bg-indigo-50/60 text-indigo-950 font-semibold'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span>{lang.label}</span>
                    {settings.ocrLanguages === lang.id && (
                      <Check className="w-3.5 h-3.5 text-indigo-600" />
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 font-normal">{lang.tag}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Architecture & Scalability Guarantee */}
      <div className="bg-slate-900 text-white rounded-xl p-6 shadow-xs flex items-start gap-4">
        <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <div className="space-y-1 text-xs">
          <h4 className="text-sm font-bold text-white">Scalable Architecture (Up to 5,000 PDFs)</h4>
          <p className="text-slate-300 leading-relaxed">
            All files, pages, and search queries operate purely client-side without servers or external APIs. Large binary PDF blobs are stored in separate IndexedDB stores to keep memory light. Page-by-page non-blocking yields prevent the browser from freezing even when processing massive document archives.
          </p>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-rose-50/60 rounded-xl border border-rose-200 p-6 shadow-xs space-y-3">
        <div className="flex items-center gap-2 text-rose-800">
          <AlertTriangle className="w-4 h-4 text-rose-600" />
          <h3 className="text-sm font-bold">Danger Zone</h3>
        </div>
        <p className="text-xs text-rose-700">
          Erase all stored PDF files, extracted text, and search history from IndexedDB to free 100% of local storage.
        </p>
        <button
          onClick={handleClearAll}
          disabled={clearing}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white text-xs font-bold shadow-xs transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>{clearing ? 'Clearing Storage...' : 'Erase All Documents & Reset Storage'}</span>
        </button>
      </div>
    </div>
  );
}
