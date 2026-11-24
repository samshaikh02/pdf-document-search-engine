import React, { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getStorageStats } from './services/db';
import { queueManager } from './services/queueManager';

// Cloud Services
import { 
  fetchCloudDocuments, 
  fetchCloudSearchHistory, 
  getCloudStorageStats, 
  subscribeToCloudDocuments 
} from './services/cloudDb';
import { isSupabaseConfigured } from './services/supabaseClient';

// Components
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardView from './components/DashboardView';
import UploadView from './components/UploadView';
import AllDocumentsView from './components/AllDocumentsView';
import SearchView from './components/SearchView';
import SearchHistoryView from './components/SearchHistoryView';
import SettingsView from './components/SettingsView';
import PDFViewerModal from './components/PDFViewer/PDFViewerModal';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [queueState, setQueueState] = useState(queueManager.getState());

  // Cloud State
  const [cloudDocs, setCloudDocs] = useState([]);
  const [cloudHistory, setCloudHistory] = useState([]);
  const [cloudStats, setCloudStats] = useState(null);

  // Local Storage State fallback
  const [localStorageStats, setLocalStorageStats] = useState({
    usage: 0,
    quota: 0,
    usagePercent: 0,
    formattedUsage: '0 MB',
    formattedQuota: 'Unknown'
  });

  // Viewer Modal State
  const [viewerState, setViewerState] = useState({
    isOpen: false,
    docId: null,
    page: 1,
    highlight: '',
    storagePath: null,
    docName: null
  });

  // Reactive IndexedDB data for local mode
  const localDocuments = useLiveQuery(() => db.documents.toArray()) || [];
  const localSearchHistory = useLiveQuery(() => 
    db.searchHistory.orderBy('timestamp').reverse().limit(50).toArray()
  ) || [];

  // Active documents & history (Cloud or Local Fallback)
  const isCloudActive = Boolean(isSupabaseConfigured());
  const activeDocuments = isCloudActive ? cloudDocs : localDocuments;
  const activeHistory = isCloudActive ? cloudHistory : localSearchHistory;
  const activeStorageStats = isCloudActive ? (cloudStats || localStorageStats) : localStorageStats;

  // Refresh Cloud Data (Documents, Search History, Storage Usage)
  const refreshCloudData = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    try {
      const [docs, history, stats] = await Promise.all([
        fetchCloudDocuments(),
        fetchCloudSearchHistory(),
        getCloudStorageStats()
      ]);
      setCloudDocs(docs);
      setCloudHistory(history);
      setCloudStats(stats);
    } catch (err) {
      console.warn('Error refreshing cloud data:', err);
    }
  }, []);

  // Refresh Local Storage stats
  const updateLocalStorage = useCallback(async () => {
    const stats = await getStorageStats();
    setLocalStorageStats(stats);
  }, []);

  // Cloud Realtime Subscription: listens to changes from any computer
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    refreshCloudData();

    // Subscribe to realtime database changes (inserts, updates, deletes across all devices)
    const unsubscribeRealtime = subscribeToCloudDocuments(() => {
      refreshCloudData();
    });

    return () => {
      unsubscribeRealtime();
    };
  }, [refreshCloudData]);

  // Listen to queue changes & update storage
  useEffect(() => {
    if (isCloudActive) {
      refreshCloudData();
    } else {
      updateLocalStorage();
    }

    const unsubscribeQueue = queueManager.subscribe(() => {
      setQueueState(queueManager.getState());
      if (isCloudActive) {
        refreshCloudData();
      } else {
        updateLocalStorage();
      }
    });

    return unsubscribeQueue;
  }, [isCloudActive, refreshCloudData, updateLocalStorage]);

  // Quick search handler from header or dashboard
  const handlePerformSearch = (query) => {
    setSearchQuery(query);
    setActiveTab('search');
  };

  // Open PDF viewer modal directly on target page with optional highlights and cloud storage path
  const handleOpenViewer = (docId, pageNumber = 1, highlightQuery = '', storagePath = null, docName = null) => {
    setViewerState({
      isOpen: true,
      docId,
      page: pageNumber,
      highlight: highlightQuery,
      storagePath,
      docName
    });
  };

  const handleCloseViewer = () => {
    setViewerState(prev => ({ ...prev, isOpen: false }));
  };

  // Tab Title helper
  const getTabTitle = () => {
    switch (activeTab) {
      case 'dashboard': return 'Dashboard Overview';
      case 'upload': return 'Upload & Cloud Batch Indexing';
      case 'documents': return 'Document Library';
      case 'search': return 'Global PDF Search Engine';
      case 'history': return 'Search History';
      case 'settings': return 'System Settings';
      default: return 'DocuSearch Engine';
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        storageStats={activeStorageStats}
        isCloudActive={isCloudActive}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <Header
          activeTabTitle={getTabTitle()}
          queueState={queueState}
          isCloudActive={isCloudActive}
          onQuickSearch={handlePerformSearch}
          onQuickUpload={() => setActiveTab('upload')}
        />

        {/* Dynamic View Scrollable Container */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {activeTab === 'dashboard' && (
            <DashboardView
              documents={activeDocuments}
              searchHistory={activeHistory}
              storageStats={activeStorageStats}
              isCloudActive={isCloudActive}
              onNavigate={setActiveTab}
              onOpenViewer={handleOpenViewer}
              onPerformSearch={handlePerformSearch}
            />
          )}

          {activeTab === 'upload' && (
            <UploadView
              onOpenViewer={handleOpenViewer}
              storageStats={activeStorageStats}
              isCloudActive={isCloudActive}
              onStorageUpdate={isCloudActive ? refreshCloudData : updateLocalStorage}
              onNavigate={setActiveTab}
            />
          )}

          {activeTab === 'documents' && (
            <AllDocumentsView
              documents={activeDocuments}
              isCloudActive={isCloudActive}
              onOpenViewer={handleOpenViewer}
              onNavigate={setActiveTab}
            />
          )}

          {activeTab === 'search' && (
            <SearchView
              initialQuery={searchQuery}
              isCloudActive={isCloudActive}
              onOpenViewer={handleOpenViewer}
            />
          )}

          {activeTab === 'history' && (
            <SearchHistoryView
              searchHistory={activeHistory}
              isCloudActive={isCloudActive}
              onRepeatSearch={handlePerformSearch}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              storageStats={activeStorageStats}
              isCloudActive={isCloudActive}
              onStorageUpdate={isCloudActive ? refreshCloudData : updateLocalStorage}
            />
          )}
        </main>
      </div>

      {/* Integrated PDF Viewer Modal */}
      {viewerState.isOpen && (
        <PDFViewerModal
          docId={viewerState.docId}
          initialPage={viewerState.page}
          highlightQuery={viewerState.highlight}
          storagePath={viewerState.storagePath}
          docName={viewerState.docName}
          onClose={handleCloseViewer}
        />
      )}
    </div>
  );
}
