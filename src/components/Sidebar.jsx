import React from 'react';
import { 
  LayoutDashboard, 
  UploadCloud, 
  Files, 
  Search, 
  History, 
  Settings, 
  Database,
  Cpu,
  ShieldCheck,
  Cloud
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, storageStats, isCloudActive }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'upload', label: 'Upload Documents', icon: UploadCloud },
    { id: 'documents', label: 'All Documents', icon: Files },
    { id: 'search', label: 'Search Documents', icon: Search },
    { id: 'history', label: 'Search History', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 text-slate-300 flex flex-col shrink-0 select-none">
      {/* Brand Logo & Name */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800/80 gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
          <Search className="w-5 h-5" />
        </div>
        <div>
          <span className="font-bold text-white text-base tracking-tight flex items-center gap-1.5">
            DocuSearch
            <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
              isCloudActive
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
            }`}>
              {isCloudActive ? 'Cloud' : 'Local'}
            </span>
          </span>
          <p className="text-[11px] text-slate-400">
            {isCloudActive ? 'Multi-Device Live Sync' : 'Client-Side PDF Engine'}
          </p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Main Menu
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Storage and System Info at bottom */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 space-y-3">
        {/* Storage Usage indicator */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="flex items-center gap-1 text-slate-400">
              <Database className="w-3.5 h-3.5 text-indigo-400" />
              {isCloudActive ? 'Cloud Storage' : 'Storage Budget'}
            </span>
            <span className="font-mono text-slate-300 text-[11px]">
              {storageStats?.formattedUsage || '0 MB'} / {storageStats?.formattedQuota || '2 GB'}
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-1.5 rounded-full transition-all duration-300 ${
                storageStats?.isStorageCritical
                  ? 'bg-rose-500'
                  : storageStats?.isStorageWarning
                  ? 'bg-amber-500'
                  : 'bg-indigo-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(2, storageStats?.usagePercent || 2))}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1 font-mono">
            <span>{storageStats?.formattedAvailable || '2 GB'} free</span>
            <span>{storageStats?.remainingDocCapacity ?? 500} docs left</span>
          </div>
        </div>

        {/* Security / Multi-Device Badge */}
        <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-950/30 border border-emerald-800/40 text-[11px] text-emerald-300">
          <Cloud className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="leading-tight">
            {isCloudActive 
              ? 'Multi-Device Public Cloud. Access from any computer.' 
              : 'Local IndexedDB. Client-side storage.'}
          </span>
        </div>
      </div>
    </aside>
  );
}
