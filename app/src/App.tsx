import React, { useState, useEffect, useRef } from 'react';
import { t, Language } from './i18n';
import PdfViewer from './PdfViewer';
import {
  ArrowLeft, ArrowRight, RotateCw, Home, Plus,
  Lock, X, Square, Search, Star, Bookmark, Menu, History, ZoomIn, FileCode, Printer, LogOut, Info, Download, Folder, Settings, ChevronUp, ChevronDown, EyeOff, Eye, Shield, BookOpen, Volume2, VolumeX, Globe, BookPlus, PictureInPicture, Share2, MessageSquare, Music, MessageCircle, Library, Columns, PanelRight, Copy, Pin, FolderPlus, FolderMinus, Trash2, Moon, Pause, Play, CheckCircle2, AlertCircle, FileText, SlidersHorizontal, ShieldCheck
} from 'lucide-react';

interface DownloadItem {
  id: string;
  fileName: string;
  state: 'progressing' | 'completed' | 'cancelled' | 'interrupted' | 'paused';
  receivedBytes: number;
  totalBytes: number;
  savePath: string;
}

type UpdateState = {
  state: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
  version?: string | null;
  percent?: number;
  error?: string | null;
};

interface PermissionDecision {
  allowed: boolean;
  updatedAt: number;
  expiresAt: number | null;
}

type PermissionStore = Record<string, Record<string, PermissionDecision>>;

type ExtensionRecord = {
  id: string;
  path: string;
  name: string;
  version: string;
  manifestVersion: number;
  permissions: string[];
  hostPermissions: string[];
  description: string;
  enabled: boolean;
  loaded: boolean;
};

type PluginRecord = {
  id: string;
  type: 'command' | 'panel';
  name: string;
  url: string;
  action: string | null;
  enabled: boolean;
};

interface Tab {
  id: string;
  url: string;
  title: string;
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  isSecure: boolean;
  zoomLevel: number;
  webContentsId?: number;
  blockedCount: number;
  blockedByCategory?: Record<string, number>;
  isPrivate?: boolean;
  crashed?: boolean;
  loadError?: {
    code: number;
    description: string;
    url: string;
  };
  isPdf?: boolean;
  suspended?: boolean;
  hasLoaded?: boolean;
  lastActiveAt?: number;
  isPinned?: boolean;
  isAudible?: boolean;
  isMuted?: boolean;
  favicon?: string;
  workspaceId?: string;
  groupId?: string;
}

const DEFAULT_URL = 'https://www.google.com';

function formatDownloadBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, unitIndex);
  return `${value >= 100 || unitIndex === 0 ? Math.round(value) : value.toFixed(1)} ${units[unitIndex]}`;
}

function downloadProgress(item: DownloadItem): number {
  if (item.totalBytes <= 0) return 0;
  return Math.min(100, Math.max(0, (item.receivedBytes / item.totalBytes) * 100));
}

function downloadStatusLabel(item: DownloadItem): string {
  switch (item.state) {
    case 'progressing': return 'Downloading';
    case 'paused': return 'Paused';
    case 'completed': return 'Completed';
    case 'cancelled': return 'Cancelled';
    case 'interrupted': return 'Interrupted';
    default: return item.state;
  }
}

declare global {
  interface Window {
    electronAPI: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      onNewTab: (callback: () => void) => void;
      onNewPrivateTab: (callback: () => void) => void;
      onNewWindow?: (callback: () => void) => void;
      onCloseTab: (callback: () => void) => void;
      onDownloadUpdate: (callback: (item: DownloadItem) => void) => void;
      openFile: (path: string) => void;
      showInFolder: (path: string) => void;
      onOpenLinkNewTab: (callback: (url: string) => void) => void;
      showContextMenu: (params: { x: number, y: number, linkURL: string, hasImageContents?: boolean, srcURL?: string, selectionText?: string, pageURL?: string, searchEngine?: string }) => void;
      onContextMenuAction: (callback: (action: string, x?: number, y?: number) => void) => void;
      onFind: (callback: () => void) => void;
      onCycleTabPrev: (callback: () => void) => void;
      onCycleTabNext: (callback: () => void) => void;
      onJumpTab: (callback: (index: number) => void) => void;
      onFocusAddress: (callback: () => void) => void;
      onReload?: (callback: () => void) => void;
      onDevTools?: (callback: () => void) => void;
      onOpenHistory?: (callback: () => void) => void;
      onOpenDownloads?: (callback: () => void) => void;
      onOpenBookmarks?: (callback: () => void) => void;
      onZoomIn?: (callback: () => void) => void;
      onZoomOut?: (callback: () => void) => void;
      onZoomReset?: (callback: () => void) => void;
      onCommandPalette?: (callback: () => void) => void;
      onRestoreTab?: (callback: () => void) => void;
      onToggleBookmarksBar?: (callback: () => void) => void;
      onOpenSettings?: (callback: () => void) => void;
      onViewSource?: (callback: () => void) => void;
      onPrint?: (callback: () => void) => void;
      onAddBookmark?: (callback: () => void) => void;
      onAppCommand?: (callback: (cmd: string) => void) => void;
      saveAsPdf?: () => void;
      onTriggerSaveAsPdf?: (callback: () => void) => void;
      executeSavePdf?: (data: ArrayBuffer) => void;
      fetchSuggestions?: (query: string) => Promise<string[]>;
      setAdBlocker: (enabled: boolean) => void;
      updateSettings?: (settings: any) => void;
      onAdBlocked: (callback: (webContentsId: number, category?: string) => void) => void;
      onTabCrashed: (callback: (webContentsId: number, reason: string) => void) => void;
      onOpenPdfViewer: (callback: (url: string, webContentsId?: number) => void) => void;
      clearCache?: () => void;
      getPermissions?: () => Promise<PermissionStore>;
      deletePermission?: (origin: string, permission: string) => void;
      clearPermissions?: () => void;
      cancelDownload?: (id: string) => void;
      pauseDownload?: (id: string) => void;
      resumeDownload?: (id: string) => void;
      openPrivateWindow?: () => void;
      openNewWindow?: () => void;
      loadExtension?: () => Promise<ExtensionRecord | { error: string } | null>;
      getExtensions?: () => Promise<ExtensionRecord[]>;
      setExtensionEnabled?: (id: string, enabled: boolean) => Promise<ExtensionRecord | { error: string } | null>;
      removeExtension?: (id: string) => Promise<boolean>;
      getPlugins?: () => Promise<PluginRecord[]>;
      registerPlugin?: (plugin: Partial<PluginRecord>) => Promise<PluginRecord | { error: string }>;
      setPluginEnabled?: (id: string, enabled: boolean) => Promise<PluginRecord | { error: string } | null>;
      removePlugin?: (id: string) => Promise<boolean>;
      getPassword?: (origin: string) => Promise<any>;
      getAllPasswords?: () => Promise<any>;
      savePassword?: (origin: string, creds: any) => void;
      deletePassword?: (origin: string) => void;
      getUpdateStatus?: () => Promise<UpdateState>;
      checkForUpdates?: () => Promise<UpdateState>;
      downloadUpdate?: () => Promise<UpdateState>;
      installUpdate?: () => Promise<UpdateState>;
      onUpdateStatus?: (callback: (status: UpdateState) => void) => void;
    };
  }
}

function App() {
  const isPrivateWindow = window.location.search.includes('private=true');
  const [showSettings, setShowSettings] = useState(false);
  const [showFind, setShowFind] = useState(false);
  const [findText, setFindText] = useState('');
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [findResult, setFindResult] = useState({ activeMatchOrdinal: 0, matches: 0 });
  const [tabContextMenu, setTabContextMenu] = useState<{tabId: string, x: number, y: number} | null>(null);
  const findInputRef = useRef<HTMLInputElement>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const settingsRef = useRef<any>(null);
  const [settings, setSettings] = useState(() => {
    if (isPrivateWindow) {
      return {
        defaultSearchEngine: 'Google',
        homepageUrl: 'probaho://newtab',
        theme: 'dark',
        adBlockerEnabled: true,
        language: 'en' as Language,
        newTabBackgroundUrl: '',
        verticalTabs: false,
        showBookmarksBar: false,
        accentColor: '#7b2cbf',
        doNotTrack: false,
        askDownloadLocation: false,
        lazyLoadTabs: true,
        suspendInactiveTabs: true,
        suspensionTimeoutMinutes: 5,
        trackerProtectionEnabled: true,
        trackerExceptions: []
      };
    }
    try {
      const saved = localStorage.getItem('probaho-settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        const def = {
          defaultSearchEngine: 'Google',
          homepageUrl: 'probaho://newtab',
          theme: 'dark',
          adBlockerEnabled: true,
          language: 'en' as Language,
          newTabBackgroundUrl: '',
          verticalTabs: false,
          showBookmarksBar: false,
          accentColor: '#7b2cbf',
          doNotTrack: false,
          askDownloadLocation: false,
          lazyLoadTabs: true,
          suspendInactiveTabs: true,
          suspensionTimeoutMinutes: 5
        };
        const merged = { ...def, ...parsed };
        settingsRef.current = merged;
        return merged;
      }
    } catch (e) {}
    const def = {
      defaultSearchEngine: 'Google',
      homepageUrl: 'probaho://newtab',
      theme: 'dark',
      adBlockerEnabled: true,
      language: 'en' as Language,
      newTabBackgroundUrl: '',
      verticalTabs: false,
      showBookmarksBar: false,
      accentColor: '#7b2cbf',
      doNotTrack: false,
      askDownloadLocation: false,
      lazyLoadTabs: true,
      suspendInactiveTabs: true,
      suspensionTimeoutMinutes: 5
    };
    settingsRef.current = def;
    return def;
  });

  const [webPanels] = useState([
    { id: 'chatgpt', title: 'ChatGPT', url: 'https://chat.openai.com', icon: MessageSquare },
    { id: 'spotify', title: 'Spotify', url: 'https://open.spotify.com', icon: Music },
    { id: 'whatsapp', title: 'WhatsApp', url: 'https://web.whatsapp.com', icon: MessageCircle },
    { id: 'wikipedia', title: 'Wikipedia', url: 'https://wikipedia.org', icon: Library }
  ]);
  const [activePanelId, setActivePanelId] = useState<string | null>(null);

  const [workspaces, setWorkspaces] = useState<{id: string, name: string}[]>(() => {
    if (isPrivateWindow) return [{id: 'default', name: 'Private'}];
    const saved = localStorage.getItem('workspaces');
    return saved ? JSON.parse(saved) : [{id: 'default', name: 'Personal'}];
  });
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(() => {
    if (isPrivateWindow) return 'default';
    return localStorage.getItem('activeWorkspaceId') || 'default';
  });

  const [tabGroups, setTabGroups] = useState<{id: string, name: string, color: string}[]>(() => {
    if (isPrivateWindow) return [];
    const saved = localStorage.getItem('tabGroups');
    return saved ? JSON.parse(saved) : [];
  });

  const [splitTabId, setSplitTabId] = useState<string | null>(null);
  const [focusedPane, setFocusedPane] = useState<'main' | 'split'>('main');

  const [tabs, setTabs] = useState<Tab[]>(() => {
    if (isPrivateWindow) {
      return [{
        id: crypto.randomUUID(),
        url: settingsRef.current?.homepageUrl || 'probaho://newtab',
        title: t('newPrivateTab', settingsRef.current?.language || 'en'),
        loading: false,
        canGoBack: false,
        canGoForward: false,
        isSecure: true,
        zoomLevel: 1,
        blockedCount: 0,
        isPrivate: true,
        suspended: false,
        hasLoaded: false,
        lastActiveAt: Date.now()
      }];
    }

    try {
      const saved = localStorage.getItem('savedTabs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(t => ({
            ...t,
            loading: false,
            canGoBack: false,
            canGoForward: false,
            blockedCount: 0,
            suspended: false,
            hasLoaded: false,
            lastActiveAt: Number.isFinite(t.lastActiveAt) ? t.lastActiveAt : Date.now()
          }));
        }
      }
    } catch (e) {}
    let initialUrl = settingsRef.current?.homepageUrl || 'https://www.google.com';
    return [{
      id: crypto.randomUUID(),
      url: initialUrl,
      title: t('newTab', settingsRef.current?.language || 'en'),
      loading: false,
      canGoBack: false,
      canGoForward: false,
      isSecure: true,
      zoomLevel: 1,
      blockedCount: 0,
      isPrivate: false,
      suspended: false,
      hasLoaded: false,
      lastActiveAt: Date.now()
    }];
  });

  const [activeTabId, setActiveTabId] = useState<string>(() => {
    if (isPrivateWindow) {
      return tabs[0].id;
    }
    try {
      const savedId = localStorage.getItem('activeTabId');
      if (savedId) return savedId;
    } catch (e) {}
    return ''; // Will be fixed by useEffect
  });

  // Ensure valid activeTabId
  useEffect(() => {
    if (!tabs.find(t => t.id === activeTabId)) {
      setActiveTabId(tabs[0].id);
    }
  }, [tabs, activeTabId]);
  const [inputUrl, setInputUrl] = useState(DEFAULT_URL);
  const [bookmarks, setBookmarks] = useState<{title: string, url: string}[]>(() => {
    if (isPrivateWindow) return [];
    const saved = localStorage.getItem('bookmarks');
    return saved ? JSON.parse(saved) : [];
  });
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [readingList, setReadingList] = useState<{title: string, url: string, content: string, savedAt: string}[]>(() => {
    if (isPrivateWindow) return [];
    const saved = localStorage.getItem('readingList');
    return saved ? JSON.parse(saved) : [];
  });
  const [showReadingList, setShowReadingList] = useState(false);
  const [history, setHistory] = useState<{title: string, url: string, time: string}[]>(() => {
    if (isPrivateWindow) return [];
    const saved = localStorage.getItem('history');
    return saved ? JSON.parse(saved) : [];
  });
  const [showHistory, setShowHistory] = useState(false);
  const [historyQuery, setHistoryQuery] = useState('');
  const [showDownloads, setShowDownloads] = useState(false);
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [downloadFilter, setDownloadFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [downloadQuery, setDownloadQuery] = useState('');
  const [permissions, setPermissions] = useState<PermissionStore>({});
  const [extensions, setExtensions] = useState<ExtensionRecord[]>([]);
  const [plugins, setPlugins] = useState<PluginRecord[]>([]);
  const [extensionError, setExtensionError] = useState<string | null>(null);
  const [pluginDraft, setPluginDraft] = useState('{"id":"my-panel","type":"panel","name":"My Panel","url":"https://example.com"}');
  const [passwordsStore, setPasswordsStore] = useState<Record<string, any>>({});
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [showMenu, setShowMenu] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [showShields, setShowShields] = useState(false);
  const [showMediaControls, setShowMediaControls] = useState(false);
  const [showSiteInfo, setShowSiteInfo] = useState(false);
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<{title: string, url: string}[]>([]);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fetchAbortControllerRef = useRef<AbortController | null>(null);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [commandSelectionIndex, setCommandSelectionIndex] = useState(0);
  const [recentlyClosed, setRecentlyClosed] = useState<{title: string, url: string}[]>([]);
  const [updateStatus, setUpdateStatus] = useState<UpdateState>({ state: 'idle', percent: 0, error: null });
  const [updateActionBusy, setUpdateActionBusy] = useState(false);

  useEffect(() => {
    if (window.electronAPI?.getUpdateStatus) {
      window.electronAPI.getUpdateStatus().then(setUpdateStatus).catch(() => {});
    }
    window.electronAPI?.onUpdateStatus?.(setUpdateStatus);
  }, []);

  useEffect(() => {
    if (isPrivateWindow) return;
    Promise.all([
      window.electronAPI?.getExtensions?.(),
      window.electronAPI?.getPlugins?.()
    ]).then(([loadedExtensions, registeredPlugins]) => {
      if (loadedExtensions) setExtensions(loadedExtensions);
      if (registeredPlugins) setPlugins(registeredPlugins);
    }).catch(() => setExtensionError('Unable to load extension metadata'));
  }, [isPrivateWindow]);

  useEffect(() => {
    if (isPrivateWindow) return;
    localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
  }, [bookmarks, isPrivateWindow]);

  useEffect(() => {
    if (isPrivateWindow) return;
    localStorage.setItem('readingList', JSON.stringify(readingList));
  }, [readingList, isPrivateWindow]);

  useEffect(() => {
    if (isPrivateWindow) return;
    localStorage.setItem('history', JSON.stringify(history));
  }, [history, isPrivateWindow]);

  useEffect(() => {
    settingsRef.current = settings;
    if (!isPrivateWindow) {
      localStorage.setItem('probaho-settings', JSON.stringify(settings));
    }
    document.body.className = settings.theme === 'light' ? 'theme-light' : '';

    // Apply custom accent color
    if (settings.accentColor) {
      document.documentElement.style.setProperty('--primary-color', settings.accentColor);
    } else {
      document.documentElement.style.setProperty('--primary-color', '#7b2cbf');
    }

    if (window.electronAPI?.setAdBlocker) {
      window.electronAPI.setAdBlocker(settings.adBlockerEnabled !== false);
    }

    if (window.electronAPI?.updateSettings) {
      window.electronAPI.updateSettings(settings);
    }
  }, [settings]);

  useEffect(() => {
    if (window.electronAPI?.onAdBlocked) {
      window.electronAPI.onAdBlocked((webContentsId, category = 'other') => {
        setTabs(prev => prev.map(t => {
          if (t.webContentsId === webContentsId) {
            return {
              ...t,
              blockedCount: t.blockedCount + 1,
              blockedByCategory: {
                ...(t.blockedByCategory || {}),
                [category]: (t.blockedByCategory?.[category] || 0) + 1
              }
            };
          }
          return t;
        }));
      });
    }


    if (window.electronAPI?.onCycleTabNext) {
      window.electronAPI.onCycleTabNext(() => {
        setTabs(prev => {
          const idx = prev.findIndex(t => t.id === activeTabIdRef.current);
          if (idx !== -1) {
            const nextIdx = (idx + 1) % prev.length;
            setTimeout(() => setActiveTabId(prev[nextIdx].id), 0);
          }
          return prev;
        });
      });
    }

    if (window.electronAPI?.onCycleTabPrev) {
      window.electronAPI.onCycleTabPrev(() => {
        setTabs(prev => {
          const idx = prev.findIndex(t => t.id === activeTabIdRef.current);
          if (idx !== -1) {
            const prevIdx = (idx - 1 + prev.length) % prev.length;
            setTimeout(() => setActiveTabId(prev[prevIdx].id), 0);
          }
          return prev;
        });
      });
    }

    if (window.electronAPI?.onJumpTab) {
      window.electronAPI.onJumpTab((index) => {
        setTabs(prev => {
          // If index is 9, usually it jumps to the last tab. Otherwise jump to index - 1
          if (index === 9) {
            setTimeout(() => setActiveTabId(prev[prev.length - 1].id), 0);
          } else if (index <= prev.length) {
            setTimeout(() => setActiveTabId(prev[index - 1].id), 0);
          }
          return prev;
        });
      });
    }

    if (window.electronAPI?.onFocusAddress) {
      window.electronAPI.onFocusAddress(() => {
        if (addressInputRef.current) {
          addressInputRef.current.focus();
          addressInputRef.current.select();
        }
      });
    }


    if (window.electronAPI?.onTabCrashed) {
      window.electronAPI.onTabCrashed((webContentsId, reason) => {
        console.error('Tab crashed:', webContentsId, reason);
        setTabs(prev => prev.map(t => t.webContentsId === webContentsId ? { ...t, crashed: true, loading: false, loadError: undefined } : t));
      });
    }

    if (window.electronAPI?.onFind) {
      window.electronAPI.onFind(() => {
        setShowFind(true);
        setTimeout(() => {
          if (findInputRef.current) {
            findInputRef.current.focus();
            findInputRef.current.select();
          }
        }, 100);
      });
    }

    if (window.electronAPI?.onDownloadUpdate) {
      window.electronAPI.onDownloadUpdate((item) => {
        setDownloads(prev => {
          const exists = prev.find(d => d.id === item.id);
          if (exists) {
            return prev.map(d => d.id === item.id ? item : d);
          } else {
            return [item, ...prev];
          }
        });
      });
    }

    if (window.electronAPI?.onReload) {
      window.electronAPI.onReload(() => {
        const wv = webviewRefs.current[activeTabIdRef.current];
        if (wv) wv.reload();
      });
    }
    if (window.electronAPI?.onDevTools) {
      window.electronAPI.onDevTools(() => {
        const wv = webviewRefs.current[activeTabIdRef.current];
        if (wv) wv.openDevTools();
      });
    }
    if (window.electronAPI?.onOpenHistory) {
      window.electronAPI.onOpenHistory(() => {
        setShowMenu(false); setShowDownloads(false); setShowBookmarks(false); setShowReadingList(false);
        setShowHistory(prev => !prev);
      });
    }
    if (window.electronAPI?.onOpenDownloads) {
      window.electronAPI.onOpenDownloads(() => {
        setShowMenu(false); setShowHistory(false); setShowBookmarks(false); setShowReadingList(false);
        setShowDownloads(prev => !prev);
      });
    }
    if (window.electronAPI?.onOpenBookmarks) {
      window.electronAPI.onOpenBookmarks(() => {
        setShowMenu(false); setShowHistory(false); setShowDownloads(false); setShowReadingList(false);
        setShowBookmarks(prev => !prev);
      });
    }
    if (window.electronAPI?.onZoomIn) {
      window.electronAPI.onZoomIn(() => {
        setTabs(prev => {
           const idx = prev.findIndex(t => t.id === activeTabIdRef.current);
           if (idx !== -1) {
              const currentZoom = prev[idx].zoomLevel || 1;
              const newZoom = Math.min(5, currentZoom + 0.1);
              const wv = webviewRefs.current[activeTabIdRef.current];
              if (wv) wv.setZoomFactor(newZoom);
              return prev.map(t => t.id === activeTabIdRef.current ? { ...t, zoomLevel: newZoom } : t);
           }
           return prev;
        });
      });
    }
    if (window.electronAPI?.onZoomOut) {
      window.electronAPI.onZoomOut(() => {
        setTabs(prev => {
           const idx = prev.findIndex(t => t.id === activeTabIdRef.current);
           if (idx !== -1) {
              const currentZoom = prev[idx].zoomLevel || 1;
              const newZoom = Math.max(0.25, currentZoom - 0.1);
              const wv = webviewRefs.current[activeTabIdRef.current];
              if (wv) wv.setZoomFactor(newZoom);
              return prev.map(t => t.id === activeTabIdRef.current ? { ...t, zoomLevel: newZoom } : t);
           }
           return prev;
        });
      });
    }
    if (window.electronAPI?.onZoomReset) {
      window.electronAPI.onZoomReset(() => {
        setTabs(prev => {
           const idx = prev.findIndex(t => t.id === activeTabIdRef.current);
           if (idx !== -1) {
              const wv = webviewRefs.current[activeTabIdRef.current];
              if (wv) wv.setZoomFactor(1);
              return prev.map(t => t.id === activeTabIdRef.current ? { ...t, zoomLevel: 1 } : t);
           }
           return prev;
        });
      });
    }

    if (window.electronAPI?.onCommandPalette) {
      window.electronAPI.onCommandPalette(() => {
        setShowCommandPalette(prev => !prev);
        setCommandQuery('');
        setCommandSelectionIndex(0);
      });
    }

    if (window.electronAPI?.onRestoreTab) {
      window.electronAPI.onRestoreTab(() => {
        restoreTab();
      });
    }

    if (window.electronAPI?.onToggleBookmarksBar) {
      window.electronAPI.onToggleBookmarksBar(() => {
        setSettings((prev: any) => ({ ...prev, showBookmarksBar: !prev.showBookmarksBar }));
      });
    }

    if (window.electronAPI?.onOpenSettings) {
      window.electronAPI.onOpenSettings(() => {
        setShowMenu(false);
        setShowSettings(true);
        if (!isPrivateWindow && window.electronAPI?.getPermissions) {
          window.electronAPI.getPermissions().then(setPermissions);
        }
        if (!isPrivateWindow && window.electronAPI?.getAllPasswords) {
          window.electronAPI.getAllPasswords().then(setPasswordsStore);
        }
      });
    }

    if (window.electronAPI?.onViewSource) {
      window.electronAPI.onViewSource(() => {
        const wv = webviewRefs.current[activeTabIdRef.current];
        if (wv) {
           const currentUrl = wv.getURL();
           if (currentUrl && currentUrl !== 'about:blank' && !currentUrl.startsWith('probaho://')) {
              navigate('view-source:' + currentUrl);
           }
        }
      });
    }

    if (window.electronAPI?.onPrint) {
      window.electronAPI.onPrint(() => {
        const wv = webviewRefs.current[activeTabIdRef.current];
        if (wv) {
          wv.print();
        }
      });
    }

    if (window.electronAPI?.onAddBookmark) {
      window.electronAPI.onAddBookmark(() => {
        setTabs(currentTabs => {
          const activeTab = currentTabs.find(t => t.id === activeTabIdRef.current);
          if (activeTab) {
            setBookmarks(prev => {
              const isBookmarked = prev.some(b => b.url === activeTab.url);
              if (isBookmarked) {
                return prev.filter(b => b.url !== activeTab.url);
              } else {
                return [...prev, { title: activeTab.title, url: activeTab.url }];
              }
            });
          }
          return currentTabs;
        });
      });
    }

    if (window.electronAPI?.onTriggerSaveAsPdf) {
      window.electronAPI.onTriggerSaveAsPdf(() => {
        const wv = webviewRefs.current[activeTabIdRef.current];
        if (wv) {
           wv.printToPDF({}).then((data: ArrayBuffer) => {
             window.electronAPI?.executeSavePdf?.(data);
           }).catch((err: any) => console.error(err));
        }
      });

    if (window.electronAPI?.onNewWindow) {
      window.electronAPI.onNewWindow(() => {
        window.electronAPI?.openNewWindow?.();
      });
    }

    if (window.electronAPI?.onAppCommand) {
      window.electronAPI.onAppCommand((cmd) => {
        const wv = webviewRefs.current[activeTabIdRef.current];
        if (wv) {
          if (cmd === "browser-backward" && wv.canGoBack()) {
            wv.goBack();
          } else if (cmd === "browser-forward" && wv.canGoForward()) {
            wv.goForward();
          }
        }
      });
    }
    }
  }, []);

  useEffect(() => {
    if (isPrivateWindow) return; // Do not save state in private windows

    const publicTabs = tabs.filter(t => !t.isPrivate);
    localStorage.setItem('savedTabs', JSON.stringify(publicTabs.length > 0 ? publicTabs : [{
      id: crypto.randomUUID(),
      url: settingsRef.current?.homepageUrl || 'probaho://newtab',
      title: t('newTab', settingsRef.current?.language || 'en'),
      loading: false,
      canGoBack: false,
      canGoForward: false,
      isSecure: true,
      zoomLevel: 1,
      blockedCount: 0,
      isPrivate: false
    }]));

    // If active tab is private, fallback the saved active tab to a public one
    const activeIsPrivate = tabs.find(t => t.id === activeTabId)?.isPrivate;
    localStorage.setItem('activeTabId', activeIsPrivate ? (publicTabs[0]?.id || '') : activeTabId);
  }, [tabs, activeTabId, isPrivateWindow]);

  useEffect(() => {
    if (isPrivateWindow) return;
    localStorage.setItem('workspaces', JSON.stringify(workspaces));
  }, [workspaces, isPrivateWindow]);

  useEffect(() => {
    if (isPrivateWindow) return;
    localStorage.setItem('activeWorkspaceId', activeWorkspaceId);
  }, [activeWorkspaceId, isPrivateWindow]);

  useEffect(() => {
    if (isPrivateWindow) return;
    localStorage.setItem('tabGroups', JSON.stringify(tabGroups));
  }, [tabGroups, isPrivateWindow]);

  const targetedTabId = focusedPane === 'split' && splitTabId ? splitTabId : activeTabId;

  // Keep a ref of the active tab id to avoid stale closures in event listeners
  const activeTabIdRef = useRef<string>(activeTabId);
  useEffect(() => {
    activeTabIdRef.current = targetedTabId;
  }, [targetedTabId]);

  const activeDownloads = downloads.filter(d => d.state === 'progressing' || d.state === 'paused');
  const hasActiveDownloads = activeDownloads.some(d => d.state === 'progressing');
  const completedDownloads = downloads.filter(d => d.state === 'completed');
  const filteredDownloads = downloads.filter(item => {
    const query = downloadQuery.trim().toLowerCase();
    const matchesQuery = !query || item.fileName.toLowerCase().includes(query);
    const matchesFilter = downloadFilter === 'all'
      || (downloadFilter === 'active' && (item.state === 'progressing' || item.state === 'paused'))
      || (downloadFilter === 'completed' && item.state === 'completed');
    return matchesQuery && matchesFilter;
  });
  let totalDownloadProgress = 0;
  if (hasActiveDownloads) {
    const totalBytes = activeDownloads.reduce((acc, curr) => acc + curr.totalBytes, 0);
    const receivedBytes = activeDownloads.reduce((acc, curr) => acc + curr.receivedBytes, 0);
    totalDownloadProgress = totalBytes > 0 ? (receivedBytes / totalBytes) * 100 : 0;
  }

  const webviewRefs = useRef<{ [key: string]: any }>({});
  const loadTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const scheduleLoadTimeout = (id: string, el: any, fallbackUrl: string) => {
    const existing = loadTimeoutsRef.current[id];
    if (existing) clearTimeout(existing);
    loadTimeoutsRef.current[id] = setTimeout(() => {
      const currentUrl = (() => {
        try { return el.getURL(); } catch { return fallbackUrl; }
      })();
      const errorUrl = currentUrl && currentUrl !== 'about:blank' ? currentUrl : fallbackUrl;
      setTabLoadError(id, errorUrl, 'The page took too long to respond. Check your connection and try again.', -7);
    }, 10000);
  };

  useEffect(() => {
    const handleNewTab = () => {
      const newTab = {
        id: crypto.randomUUID(),
        url: settingsRef.current?.homepageUrl || 'probaho://newtab',
        title: t('newTab', settingsRef.current?.language || 'en'),
        loading: false,
        canGoBack: false,
        canGoForward: false,
        isSecure: true,
        zoomLevel: 1,
        blockedCount: 0,
        isPrivate: false
      };
      setTabs(prev => [...prev, newTab]);
      // Note: We need a slight timeout to let React render the new tab to DOM, or use ref
      setTimeout(() => setActiveTabId(newTab.id), 0);
    };

    if (window.electronAPI?.onNewTab) {
      window.electronAPI.onNewTab(handleNewTab);
    }
    if (window.electronAPI?.onNewPrivateTab) {
      window.electronAPI.onNewPrivateTab(() => {
        window.electronAPI?.openPrivateWindow?.();
      });
    }

    if (window.electronAPI?.onContextMenuAction) {
      window.electronAPI.onContextMenuAction((action, x, y) => {
        const wv = webviewRefs.current[activeTabIdRef.current];
        if (!wv) return;

        switch (action) {
          case 'back':
            if (wv.canGoBack()) wv.goBack();
            break;
          case 'forward':
            if (wv.canGoForward()) wv.goForward();
            break;
          case 'reload':
            wv.reload();
            break;
          case 'inspect':
            if (x !== undefined && y !== undefined) {
              wv.inspectElement(x, y);
            }
            break;
          case 'copy-image':
            if (x !== undefined && y !== undefined) {
              wv.copyImageAt(x, y);
            }
            break;
        }
      });
    }

    if (window.electronAPI?.onOpenLinkNewTab) {
      window.electronAPI.onOpenLinkNewTab((url) => {
        const newTab = {
          id: crypto.randomUUID(),
          url: url,
          title: t('newTab', settingsRef.current?.language || 'en'),
          loading: false,
          canGoBack: false,
          canGoForward: false,
          isSecure: url.startsWith('https'),
          zoomLevel: 1,
          blockedCount: 0,
          isPrivate: isPrivateWindow
        };
        setTabs(prev => [...prev, newTab]);
        setTimeout(() => setActiveTabId(newTab.id), 0);
      });
    }

    const handleCloseTab = () => {
      const idToClose = activeTabIdRef.current;
      setTabs(prev => {
        if (prev.length === 1) {
          window.electronAPI?.close();
          return prev;
        }
        const newTabs = prev.filter(t => t.id !== idToClose);
        setTimeout(() => setActiveTabId(newTabs[newTabs.length - 1].id), 0);
        return newTabs;
      });
      delete webviewRefs.current[idToClose];
    };


    if (window.electronAPI?.onOpenPdfViewer) {
      window.electronAPI.onOpenPdfViewer((url: string, webContentsId?: number) => {
        setTabs(prev => prev.map(t => {
          const isTargetTab = webContentsId ? t.webContentsId === webContentsId : t.id === activeTabIdRef.current;
          if (isTargetTab) {
             if (t.id === activeTabIdRef.current) {
               setInputUrl(url);
             }
             return { ...t, url, isPdf: true, title: url.split('/').pop() || 'PDF Document' };
          }
          return t;
        }));
      });
    }

    if (window.electronAPI?.onCloseTab) {
      window.electronAPI.onCloseTab(handleCloseTab);
    }
  }, []);


  const activeTab = tabs.find(t => t.id === activeTabId);

  // Mark the selected tab as recently active and wake it if it was suspended.
  useEffect(() => {
    if (!activeTabId) return;
    const now = Date.now();
    setTabs(prev => prev.map(tab => tab.id === activeTabId
      ? { ...tab, suspended: false, lastActiveAt: now }
      : tab
    ));
  }, [activeTabId]);

  // Periodically discard inactive webviews to reduce renderer memory usage.
  useEffect(() => {
    if (!settings.suspendInactiveTabs) {
      setTabs(prev => prev.some(tab => tab.suspended)
        ? prev.map(tab => tab.suspended ? { ...tab, suspended: false } : tab)
        : prev
      );
      return;
    }
    const timeoutMs = Math.max(1, Number(settings.suspensionTimeoutMinutes) || 5) * 60 * 1000;
    const interval = window.setInterval(() => {
      const cutoff = Date.now() - timeoutMs;
      setTabs(prev => {
        let changed = false;
        const next = prev.map(tab => {
          const isVisible = tab.id === activeTabId || tab.id === splitTabId;
          const keepAwake = isVisible || tab.url === 'probaho://newtab' || tab.isPdf || tab.isPinned || tab.isAudible || tab.loading || Boolean(tab.loadError) || Boolean(tab.crashed) || tab.suspended || !tab.hasLoaded;
          if (keepAwake) return tab;
          if (!tab.lastActiveAt || tab.lastActiveAt > cutoff) return tab;
          changed = true;
          return { ...tab, suspended: true, loading: false };
        });
        return changed ? next : prev;
      });
    }, 15_000);
    return () => window.clearInterval(interval);
  }, [settings.suspendInactiveTabs, settings.suspensionTimeoutMinutes, activeTabId, splitTabId]);

  useEffect(() => {
    if (targetedTab) {
      setInputUrl(targetedTab.url === 'probaho://newtab' ? '' : targetedTab.url);
    }
    // Hide find bar when switching tabs
    if (showFind) {
      const wv = webviewRefs.current[activeTabIdRef.current];
      if (wv) wv.stopFindInPage('clearSelection');
      setShowFind(false);
      setFindText('');
      setFindResult({ activeMatchOrdinal: 0, matches: 0 });
    }
  }, [targetedTabId]);

  const createTab = (isPrivate = isPrivateWindow) => {
    const newTab: Tab = {
      id: crypto.randomUUID(),
      url: settingsRef.current?.homepageUrl || 'https://www.google.com',
      title: isPrivate ? t('newPrivateTab', settings.language) : t('newTab', settings.language),
      loading: false,
      canGoBack: false,
      canGoForward: false,
      isSecure: true,
      zoomLevel: 1,
      blockedCount: 0,
      isPrivate: isPrivate,
      workspaceId: activeWorkspaceId,
      suspended: false,
      hasLoaded: false,
      lastActiveAt: Date.now()
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  };

  const closeTabId = (id: string) => {
    const tabToClose = tabs.find(t => t.id === id);
    if (tabToClose && tabToClose.url !== 'probaho://newtab' && tabToClose.url !== 'about:blank') {
      setRecentlyClosed(rc => [{title: tabToClose.title, url: tabToClose.url}, ...rc].slice(0, 10));
    }
    setTabs(prev => {
      if (prev.length === 1) {
        window.electronAPI?.close();
        return prev;
      }
      const newTabs = prev.filter(t => t.id !== id);
      if (activeTabIdRef.current === id) {
        setActiveTabId(newTabs[newTabs.length - 1].id);
      }
      return newTabs;
    });
    delete webviewRefs.current[id];
  };

  const restoreTab = () => {
    setRecentlyClosed(prev => {
       if (prev.length > 0) {
         const toRestore = prev[0];
         const newTab: Tab = {
            id: crypto.randomUUID(),
            url: toRestore.url,
            title: toRestore.title,
            loading: false,
            canGoBack: false,
            canGoForward: false,
            isSecure: toRestore.url.startsWith('https'),
            zoomLevel: 1,
            blockedCount: 0,
            isPrivate: isPrivateWindow,
            suspended: false,
            hasLoaded: false,
            lastActiveAt: Date.now()
          };
          setTabs(currentTabs => [...currentTabs, newTab]);
          setTimeout(() => setActiveTabId(newTab.id), 0);
          return prev.slice(1);
       }
       return prev;
    });
  };

  const closeTab = (e: React.MouseEvent | null, id: string) => {
    if (e) e.stopPropagation();
    closeTabId(id);
  };

  const updateTab = (id: string, updates: Partial<Tab>) => {
    setTabs(prev => prev.map(tab => tab.id === id ? { ...tab, ...updates } : tab));
  };

  const setTabLoadError = (id: string, url: string, description = 'The page could not be loaded.', code = -1) => {
    if (!url || url === 'about:blank' || url.startsWith('probaho://')) return;
    updateTab(id, {
      loading: false,
      loadError: {
        code: Number.isFinite(code) ? code : -1,
        description,
        url
      }
    });
  };

  const handleWebviewRef = (id: string, el: any, initialUrl: string) => {
    // Handle React unmount / StrictMode double-mount: clean up old ref
    if (!el) {
      delete webviewRefs.current[id];
      const existingTimeout = loadTimeoutsRef.current[id];
      if (existingTimeout) clearTimeout(existingTimeout);
      delete loadTimeoutsRef.current[id];
      return;
    }

    // Always update ref to latest element (handles StrictMode re-mount)
    webviewRefs.current[id] = el;

    // Wait for the webview to fully attach to the Electron process
    const loadWhenReady = (url: string) => {
      const tryLoad = () => {
        try {
          if (el.getURL() === 'about:blank' || !el.getURL()) {
            updateTab(id, { hasLoaded: true, suspended: false, lastActiveAt: Date.now() });
            scheduleLoadTimeout(id, el, url);
            Promise.resolve(el.loadURL(url)).catch((error: any) => {
              setTabLoadError(id, url, error?.message || 'The page could not be loaded.', Number(error?.errno ?? error?.code));
            });
            const savedZoom = getSavedZoom(url);
            try { el.setZoomFactor(savedZoom); } catch {}
          }
        } catch (err) {
          console.error('loadURL error:', err);
        }
      };

      // If already attached, load immediately; otherwise wait for did-attach
      try {
        el.getWebContentsId(); // throws if not attached yet
        tryLoad();
      } catch {
        el.addEventListener('did-attach', () => tryLoad(), { once: true });
      }
    };

    // Initial load (skip internal New Tab Page)
    if (initialUrl && initialUrl !== 'probaho://newtab') {
      scheduleLoadTimeout(id, el, initialUrl);
      loadWhenReady(initialUrl);
    }

    // Event: loading started
    el.addEventListener('did-start-loading', () => {
      updateTab(id, { loading: true, crashed: false, loadError: undefined });
      const activeUrl = (() => { try { return el.getURL() || initialUrl; } catch { return initialUrl; } })();
      scheduleLoadTimeout(id, el, activeUrl);
    });

    // Event: loading stopped
    el.addEventListener('did-stop-loading', () => {
      updateTab(id, { loading: false });
    });

    // Event: console-message
    el.addEventListener('console-message', (e: any) => {
      if (e.message && typeof e.message === 'string' && e.message.startsWith('SAVE_PWD:')) {
        const parts = e.message.split('|');
        if (parts.length >= 4) {
          const origin = parts[1];
          const user = parts[2];
          const pass = parts[3];
          if (!isPrivateWindow && confirm('Save password for ' + origin + '?')) {
            window.electronAPI?.savePassword?.(origin, { username: user, password: pass });
          }
        }
      }
    });

    // Event: DOM ready
    el.addEventListener('dom-ready', () => {
      try {
        const wcId = el.getWebContentsId();
        updateTab(id, { webContentsId: wcId });

        // Handle Autofill
        const currentUrl = el.getURL();
        if (!isPrivateWindow && currentUrl && currentUrl.startsWith('http')) {
          const origin = new URL(currentUrl).origin;
          window.electronAPI?.getPassword?.(origin).then(creds => {
            if (creds && creds.password) {
              const script = `
                const p = document.querySelector('input[type="password"]');
                if (p) {
                  p.value = ${JSON.stringify(creds.password)};
                  const text = document.querySelector('input[type="text"], input[type="email"]');
                  if (text && ${JSON.stringify(creds.username)}) {
                    text.value = ${JSON.stringify(creds.username)};
                  }
                }
              `;
              el.executeJavaScript(script).catch(() => {});
            }
          }).catch(() => {});
        }
      } catch (err) {}
    });

    // Event: main frame navigation
    el.addEventListener('did-navigate', (e: any) => {
      // Ignore the placeholder navigation emitted before a lazy tab loads its real URL.
      if (e.url === 'about:blank' && initialUrl !== 'about:blank') return;

      // Inject password capture script
      if (e.url && e.url.startsWith('http')) {
        const script = `
          window.addEventListener('submit', (e) => {
            const p = e.target.querySelector('input[type="password"]');
            if (p) {
              const text = e.target.querySelector('input[type="text"], input[type="email"]');
              console.log('SAVE_PWD:' + location.origin + '|' + (text ? text.value : '') + '|' + p.value);
            }
          });
        `;
        el.executeJavaScript(script).catch(() => {});
      }

      const savedZoom = getSavedZoom(e.url);
      try {
        el.setZoomFactor(savedZoom);
      } catch (err) {}

      updateTab(id, {
        url: e.url,
        isSecure: e.url.startsWith('https'),
        blockedCount: 0,
        zoomLevel: savedZoom
      });
      if (activeTabIdRef.current === id) {
        setInputUrl(e.url);
      }
      setTabs(prev => {
        const tab = prev.find(t => t.id === id);
        if (tab && !tab.isPrivate) {
          setHistory(hPrev => [{ title: e.url, url: e.url, time: new Date().toLocaleString() }, ...hPrev].slice(0, 500));
        }
        return prev;
      });
    });

    // Event: in-page navigation (hash changes, history.pushState)
    el.addEventListener('did-navigate-in-page', (e: any) => {
      updateTab(id, {
        url: e.url,
        isSecure: e.url.startsWith('https')
      });
      if (activeTabIdRef.current === id) {
        setInputUrl(e.url);
      }
    });

    // Event: page title updated
    el.addEventListener('page-title-updated', (e: any) => {
      updateTab(id, { title: e.title });
      setTabs(tPrev => {
        const tab = tPrev.find(t => t.id === id);
        if (tab && !tab.isPrivate) {
          setHistory(prev => {
            if (prev.length > 0 && prev[0].url === el.getURL()) {
              const updated = [...prev];
              updated[0] = { ...updated[0], title: e.title };
              return updated.slice(0, 500);
            }
            return prev.slice(0, 500);
          });
        }
        return tPrev;
      });
    });

    // Event: navigation capability update
    el.addEventListener('update-target-url', () => {
      updateTab(id, {
        canGoBack: el.canGoBack(),
        canGoForward: el.canGoForward()
      });
    });

    // Event: page fully loaded
    el.addEventListener('did-finish-load', () => {
      let finishedUrl = '';
      try { finishedUrl = el.getURL(); } catch {}
      if (finishedUrl === 'about:blank' && initialUrl !== 'about:blank') return;
      const existingTimeout = loadTimeoutsRef.current[id];
      if (existingTimeout) clearTimeout(existingTimeout);
      delete loadTimeoutsRef.current[id];
      updateTab(id, {
        loading: false,
        crashed: false,
        canGoBack: el.canGoBack(),
        canGoForward: el.canGoForward()
      });
    });

    // Event: navigation failed. Keep the original tab title and expose a recoverable error state.
    el.addEventListener('did-fail-load', (e: any) => {
      const failedUrl = typeof e.validatedURL === 'string' ? e.validatedURL : el.getURL();
      if (e.isMainFrame !== false && e.errorCode !== -3 && failedUrl && !failedUrl.startsWith('probaho://') && failedUrl !== 'about:blank') {
        const existingTimeout = loadTimeoutsRef.current[id];
        if (existingTimeout) clearTimeout(existingTimeout);
        delete loadTimeoutsRef.current[id];
        console.error('Navigation failed:', e.errorCode, e.errorDescription, failedUrl);
        setTabLoadError(id, failedUrl, e.errorDescription || 'The page could not be loaded.', e.errorCode);
      }
    });

    // Event: context menu
    el.addEventListener('context-menu', (e: any) => {
      window.electronAPI?.showContextMenu({
        x: e.params.x,
        y: e.params.y,
        linkURL: e.params.linkURL,
        hasImageContents: e.params.hasImageContents,
        srcURL: e.params.srcURL,
        selectionText: e.params.selectionText,
        pageURL: e.params.pageURL,
        searchEngine: settingsRef.current?.defaultSearchEngine || 'Google'
      });
    });

    // Event: find in page
    el.addEventListener('found-in-page', (e: any) => {
      setFindResult({
        activeMatchOrdinal: e.result.activeMatchOrdinal,
        matches: e.result.matches
      });
    });

    // Event: media playback started
    el.addEventListener('media-started-playing', () => {
      updateTab(id, { isAudible: true });
    });

    // Event: media playback paused
    el.addEventListener('media-paused', () => {
      updateTab(id, { isAudible: false });
    });

    // Event: page favicon updated
    el.addEventListener('page-favicon-updated', (e: any) => {
      if (e.favicons && e.favicons.length > 0) {
        updateTab(id, { favicon: e.favicons[0] });
      }
    });

    // Event: new window requested (NEW - Bug 7 fix)
    el.addEventListener('new-window', (e: any) => {
      const newTab: Tab = { // @ts-ignore
        id: crypto.randomUUID(),
        url: e.url,
        title: 'New Tab',
        loading: false,
        canGoBack: false,
        canGoForward: false,
        isSecure: e.url.startsWith('https'),
        zoomLevel: 1,
          blockedCount: 0,
          isPrivate: isPrivateWindow
      };
      setTabs(prev => [...prev, newTab]);
      setTimeout(() => setActiveTabId(newTab.id), 0);
    });
  };

  const handleFind = (text: string, forward: boolean = true, findNext: boolean = false) => {
    setFindText(text);
    const wv = webviewRefs.current[activeTabIdRef.current];
    if (!wv) return;

    if (text) {
      wv.findInPage(text, { forward, findNext });
    } else {
      wv.stopFindInPage('clearSelection');
      setFindResult({ activeMatchOrdinal: 0, matches: 0 });
    }
  };

  const closeFind = () => {
    setShowFind(false);
    setFindText('');
    setFindResult({ activeMatchOrdinal: 0, matches: 0 });
    const wv = webviewRefs.current[activeTabIdRef.current];
    if (wv) wv.stopFindInPage('clearSelection');
  };

  const handleFindKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleFind(findText, !e.shiftKey, true);
    } else if (e.key === 'Escape') {
      closeFind();
    }
  };

  const navigate = (url: string) => {
    if (!url) return;
    console.log('navigate called with', url);
    let finalUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('file://') && !url.startsWith('view-source:')) {
      if (url.includes('.') && !url.includes(' ') && !url.startsWith('localhost')) {
        finalUrl = `https://${url}`;
      } else {
        if (settings.defaultSearchEngine === 'Bing') {
          finalUrl = `https://www.bing.com/search?q=${encodeURIComponent(url)}`;
        } else if (settings.defaultSearchEngine === 'DuckDuckGo') {
          finalUrl = `https://duckduckgo.com/?q=${encodeURIComponent(url)}`;
        } else if (settings.defaultSearchEngine === 'Yahoo') {
          finalUrl = `https://search.yahoo.com/search?p=${encodeURIComponent(url)}`;
        } else if (settings.defaultSearchEngine === 'Ecosia') {
          finalUrl = `https://www.ecosia.org/search?q=${encodeURIComponent(url)}`;
        } else {
          finalUrl = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
        }
      }
    }

    updateTab(targetedTabId, { url: finalUrl, isPdf: false, loading: true, crashed: false, loadError: undefined });

    if (finalUrl.toLowerCase().endsWith('.pdf')) {
      updateTab(targetedTabId, { url: finalUrl, isPdf: true, title: finalUrl.split('/').pop() || 'PDF Document' });
      setInputUrl(finalUrl);
      return;
    }

    const wv = webviewRefs.current[targetedTabId];
    if (wv) {
      try {
        scheduleLoadTimeout(targetedTabId, wv, finalUrl);
        Promise.resolve(wv.loadURL(finalUrl)).catch((error: any) => {
          setTabLoadError(targetedTabId, finalUrl, error?.message || 'The page could not be loaded.', Number(error?.errno ?? error?.code));
        });
      } catch (e: any) {
        console.error('Error in wv.loadURL:', e);
        setTabLoadError(targetedTabId, finalUrl, e?.message || 'The page could not be loaded.', Number(e?.errno ?? e?.code));
      }
    }
    setInputUrl(finalUrl);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(inputUrl);
  };

  const goBack = () => {
    const wv = webviewRefs.current[targetedTabId];
    if (wv && wv.canGoBack()) wv.goBack();
  };

  const goForward = () => {
    const wv = webviewRefs.current[targetedTabId];
    if (wv && wv.canGoForward()) wv.goForward();
  };

  const reload = () => {
    const wv = webviewRefs.current[targetedTabId];
    if (wv) wv.reload();
  };

  const goHome = () => {
    navigate(settings.homepageUrl);
  };
  const retryTab = (tab: Tab) => {
    updateTab(tab.id, { loading: true, crashed: false, loadError: undefined });
    const wv = webviewRefs.current[tab.id];
    if (wv) {
      try { wv.reload(); } catch { try { wv.loadURL(tab.url); } catch {} }
    }
  };
  const recoverTabHome = (tab: Tab) => {
    const homeUrl = settingsRef.current?.homepageUrl || 'probaho://newtab';
    updateTab(tab.id, { url: homeUrl, title: t('newTab', settingsRef.current?.language || 'en'), loading: true, crashed: false, loadError: undefined });
    const wv = webviewRefs.current[tab.id];
    if (wv && homeUrl !== 'probaho://newtab') {
      try { wv.loadURL(homeUrl); } catch {}
    }
  };

  const runUpdateAction = async (action?: () => Promise<UpdateState>) => {
    if (!action || updateActionBusy) return;
    setUpdateActionBusy(true);
    try {
      const nextStatus = await action();
      if (nextStatus) setUpdateStatus(nextStatus);
    } catch (error: any) {
      setUpdateStatus({ state: 'error', error: error?.message || 'Update action failed' });
    } finally {
      setUpdateActionBusy(false);
    }
  };

  const toggleBookmark = () => {
    const tab = tabs.find(t => t.id === targetedTabId);
    if (!tab) return;
    const isBookmarked = bookmarks.some(b => b.url === tab.url);
    if (isBookmarked) {
      setBookmarks(prev => prev.filter(b => b.url !== tab.url));
    } else {
      setBookmarks(prev => [...prev, { title: tab.title, url: tab.url }]);
    }
  };

  const targetedTab = tabs.find(t => t.id === targetedTabId);
  const isCurrentBookmarked = targetedTab ? bookmarks.some(b => b.url === targetedTab.url) : false;
  const currentSiteOrigin = (() => {
    try {
      const origin = new URL(targetedTab?.url || '').origin;
      return origin === 'null' ? null : origin;
    } catch {
      return null;
    }
  })();
  const isCurrentSiteExcepted = Boolean(currentSiteOrigin && (settings.trackerExceptions || []).includes(currentSiteOrigin));

  const getDomainFromUrl = (url: string) => {
    try {
      if (url.startsWith('probaho://')) return url;
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };

  const getSavedZoom = (url: string) => {
    if (isPrivateWindow) return 1;
    try {
      const domain = getDomainFromUrl(url);
      const saved = localStorage.getItem('zoom_levels');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed[domain]) return parsed[domain];
      }
    } catch {}
    return 1;
  };

  const saveZoom = (url: string, zoomLevel: number) => {
    if (isPrivateWindow) return;
    try {
      const domain = getDomainFromUrl(url);
      const saved = localStorage.getItem('zoom_levels');
      let parsed = saved ? JSON.parse(saved) : {};
      parsed[domain] = zoomLevel;
      localStorage.setItem('zoom_levels', JSON.stringify(parsed));
    } catch {}
  };

  const handleZoom = (delta: number) => {
    const currentZoom = targetedTab?.zoomLevel || 1;
    const newZoom = Math.max(0.25, Math.min(5, delta === (1 - currentZoom) ? 1 : currentZoom + delta));

    updateTab(targetedTabId, { zoomLevel: newZoom });
    if (targetedTab) {
      saveZoom(targetedTab.url, newZoom);
    }
    const wv = webviewRefs.current[targetedTabId];
    if (wv) wv.setZoomFactor(newZoom);
  };

  const handlePrint = () => {
    const wv = webviewRefs.current[targetedTabId];
    if (wv) wv.print();
    setShowMenu(false);
  };

  const toggleDevTools = () => {
    const wv = webviewRefs.current[targetedTabId];
    if (wv) wv.openDevTools();
    setShowMenu(false);
  };

  useEffect(() => {
    const handleGlobalClick = () => {
      if (tabContextMenu) setTabContextMenu(null);
      if (showShields) setShowShields(false);
      if (showMediaControls) setShowMediaControls(false);
      if (showSiteInfo) setShowSiteInfo(false);
    };
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, [tabContextMenu, showShields, showMediaControls, showSiteInfo]);

  return (
    <div className="browser-container" data-testid="browser-shell">
      {tabContextMenu && (
        <div className="menu-panel tab-context-menu" role="menu" aria-label="Tab actions" style={{ position: 'fixed', left: tabContextMenu.x, top: tabContextMenu.y, zIndex: 9999 }}>
          <div className="context-menu-header">
            <span className="context-menu-kicker">Tab actions</span>
            <span className="context-menu-title">{tabs.find(t => t.id === tabContextMenu.tabId)?.title || 'Current tab'}</span>
          </div>
          <div className="menu-item" role="menuitem" tabIndex={0} onClick={() => {
            const tab = tabs.find(t => t.id === tabContextMenu.tabId);
            if (tab) {
              const newTab = { ...tab, id: crypto.randomUUID() };
              setTabs(prev => [...prev, newTab]);
              setActiveTabId(newTab.id);
            }
          }}>
            <div className="menu-item-icon"><Copy size={15} /></div><div className="menu-item-text">Duplicate</div><div className="menu-item-shortcut">Ctrl+L</div>
          </div>
          <div className="menu-item" onClick={() => {
            const tab = tabs.find(t => t.id === tabContextMenu.tabId);
            if (tab) updateTab(tab.id, { isPinned: !tab.isPinned });
          }}>
            <div className="menu-item-icon"><Pin size={15} /></div><div className="menu-item-text">{tabs.find(t => t.id === tabContextMenu.tabId)?.isPinned ? 'Unpin Tab' : 'Pin Tab'}</div>
          </div>
          <div className="menu-item" onClick={() => {
            const tab = tabs.find(t => t.id === tabContextMenu.tabId);
            if (tab) {
              const wv = webviewRefs.current[tab.id];
              if (wv) {
                const newMutedState = !tab.isMuted;
                wv.setAudioMuted(newMutedState);
                updateTab(tab.id, { isMuted: newMutedState });
              }
            }
          }}>
            <div className="menu-item-icon">{tabs.find(t => t.id === tabContextMenu.tabId)?.isMuted ? <Volume2 size={15} /> : <VolumeX size={15} />}</div><div className="menu-item-text">{tabs.find(t => t.id === tabContextMenu.tabId)?.isMuted ? 'Unmute Site' : 'Mute Site'}</div>
          </div>
          <div className="menu-item" onClick={() => {
            const tab = tabs.find(t => t.id === tabContextMenu.tabId);
            if (tab && tab.id !== activeTabId && tab.id !== splitTabId) {
              updateTab(tab.id, { suspended: !tab.suspended, loading: false });
            }
            setTabContextMenu(null);
          }}>
            <div className="menu-item-icon">{tabs.find(t => t.id === tabContextMenu.tabId)?.suspended ? <RotateCw size={15} /> : <Moon size={15} />}</div><div className="menu-item-text">{tabs.find(t => t.id === tabContextMenu.tabId)?.suspended ? 'Resume Tab' : 'Suspend Tab'}</div>
          </div>
          <div className="menu-divider" />
          <div className="menu-divider" />
          <div className="menu-item" onClick={() => {
            const name = prompt('Group Name:');
            if (name) {
               const id = crypto.randomUUID();
               const colors = ['#ff5252', '#4caf50', '#2196f3', '#ffeb3b', '#9c27b0', '#ff9800', '#00bcd4'];
               const color = colors[Math.floor(Math.random() * colors.length)];
               setTabGroups(prev => [...prev, { id, name, color }]);
               updateTab(tabContextMenu.tabId, { groupId: id });
            }
          }}>
            <div className="menu-item-icon"><FolderPlus size={15} /></div><div className="menu-item-text">Add to New Group</div>
          </div>
          {tabs.find(t => t.id === tabContextMenu.tabId)?.groupId && (
            <div className="menu-item" onClick={() => {
              updateTab(tabContextMenu.tabId, { groupId: undefined });
            }}>
              <div className="menu-item-icon"><FolderMinus size={15} /></div><div className="menu-item-text">Remove from Group</div>
            </div>
          )}
          <div className="menu-divider" />
          <div className="menu-item" onClick={() => {
             closeTabId(tabContextMenu.tabId);
          }}>
                         <div className="menu-item-icon"><Trash2 size={15} /></div><div className="menu-item-text">Close Tab</div>

          </div>
        </div>
      )}
      {/* Utility Rail */}
      <aside className="web-panels-sidebar utility-rail" data-testid="utility-rail" aria-label="Browser utilities" style={{ position: 'absolute', right: 0, top: 0, bottom: 0, zIndex: 150 }}>
         <div className="utility-rail-brand" aria-hidden="true"><span>Ｐ</span></div>
         <div className="web-panels-icons utility-rail-actions">
           <button type="button" className={`web-panel-btn utility-rail-btn ${showHistory ? 'active' : ''}`} data-testid="utility-history" aria-label="Open history" aria-pressed={showHistory} title="History" onClick={() => { setShowMenu(false); setShowBookmarks(false); setShowDownloads(false); setShowReadingList(false); setShowHistory(prev => !prev); }}><History size={17} /></button>
           <button type="button" className={`web-panel-btn utility-rail-btn ${showDownloads ? 'active' : ''}`} data-testid="utility-downloads" aria-label="Open downloads" aria-pressed={showDownloads} title="Downloads" onClick={() => { setShowMenu(false); setShowHistory(false); setShowBookmarks(false); setShowReadingList(false); setShowDownloads(prev => !prev); }}><Download size={17} /></button>
           <button type="button" className={`web-panel-btn utility-rail-btn ${showBookmarks ? 'active' : ''}`} data-testid="utility-bookmarks" aria-label="Open bookmarks" aria-pressed={showBookmarks} title="Bookmarks" onClick={() => { setShowMenu(false); setShowHistory(false); setShowDownloads(false); setShowReadingList(false); setShowBookmarks(prev => !prev); }}><Bookmark size={17} /></button>
           <button type="button" className={`web-panel-btn utility-rail-btn ${showSettings ? 'active' : ''}`} data-testid="utility-settings" aria-label="Open settings" aria-pressed={showSettings} title="Settings" onClick={() => { setShowMenu(false); setShowHistory(false); setShowBookmarks(false); setShowDownloads(false); setShowReadingList(false); setShowSettings(prev => !prev); if (!isPrivateWindow && window.electronAPI?.getPermissions) window.electronAPI.getPermissions().then(setPermissions); if (!isPrivateWindow && window.electronAPI?.getAllPasswords) window.electronAPI.getAllPasswords().then(setPasswordsStore); }}>
<Settings size={17} /></button>
         </div>
         <div className="utility-rail-divider" />
         <div className="web-panels-icons utility-rail-actions">
           {webPanels.map(panel => (
              <button
                type="button"
                key={panel.id}
                className={`web-panel-btn utility-rail-btn ${activePanelId === panel.id ? 'active' : ''}`}
                data-testid={`utility-panel-${panel.id}`}
                aria-label={`Open ${panel.title}`}
                aria-pressed={activePanelId === panel.id}
                title={panel.title}
                onClick={() => setActivePanelId(activePanelId === panel.id ? null : panel.id)}
              >
                 <panel.icon size={17} strokeWidth={1.7} />
              </button>
           ))}
         </div>
      </aside>

      {/* Web Panel Slide-out View */}
      {activePanelId && (
        <div className="web-panel-view" style={{ position: 'absolute', right: '52px', top: 0, bottom: 0, zIndex: 149 }}>
           <div className="web-panel-header">
              <span style={{fontSize: '13px', fontWeight: 'bold'}}>{webPanels.find(p => p.id === activePanelId)?.title}</span>
              <button className="nav-btn" onClick={() => setActivePanelId(null)}><X size={14}/></button>
           </div>
           <webview // @ts-ignore
              src={webPanels.find(p => p.id === activePanelId)?.url || 'about:blank'}
              style={{flex: 1, border: 'none', background: '#fff'}}
              webpreferences="contextIsolation=yes, nodeIntegration=no"
           />
        </div>
      )}

      {/* Wrap main browser in a div that respects the right sidebar */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginRight: '52px' }}>

      {/* Titlebar with tabs */}
      <div className="titlebar" style={settings.verticalTabs ? { paddingLeft: '80px', height: '40px' } : {}}>

        {isPrivateWindow && (
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px', color: '#ff5252', fontWeight: 'bold', fontSize: '12px' }}>
            <Shield size={14} style={{ marginRight: '4px' }} />
            Private
          </div>
        )}

        {/* Workspaces Selector */}
        <div style={{ padding: '0 8px', display: 'flex', alignItems: 'center' }}>
          <select
            value={activeWorkspaceId}
            onChange={(e) => {
               const newWorkspaceId = e.target.value;
               if (newWorkspaceId === 'new_workspace') {
                 const name = prompt('Workspace Name:');
                 if (name) {
                    const id = crypto.randomUUID();
                    setWorkspaces(prev => [...prev, {id, name}]);
                    setActiveWorkspaceId(id);
                    // create first tab in new workspace
                    const newTab: Tab = {
                      id: crypto.randomUUID(),
                      url: settingsRef.current?.homepageUrl || 'https://www.google.com',
                      title: t('newTab', settings.language),
                      loading: false, canGoBack: false, canGoForward: false, isSecure: true, zoomLevel: 1, blockedCount: 0,
                      workspaceId: id
                    };
                    setTabs(prevTabs => [...prevTabs, newTab]);
                    setTimeout(() => setActiveTabId(newTab.id), 0);
                 }
               } else {
                 setActiveWorkspaceId(newWorkspaceId);
                 // find first tab in this workspace
                 const wsTabs = tabs.filter(t => (t.workspaceId || 'default') === newWorkspaceId);
                 if (wsTabs.length > 0) {
                    setActiveTabId(wsTabs[wsTabs.length - 1].id);
                 } else {
                    const newTab: Tab = {
                      id: crypto.randomUUID(),
                      url: settingsRef.current?.homepageUrl || 'https://www.google.com',
                      title: t('newTab', settings.language),
                      loading: false, canGoBack: false, canGoForward: false, isSecure: true, zoomLevel: 1, blockedCount: 0,
                      workspaceId: newWorkspaceId
                    };
                    setTabs(prevTabs => [...prevTabs, newTab]);
                    setTimeout(() => setActiveTabId(newTab.id), 0);
                 }
               }
            }}
            style={{
              background: 'var(--tab-active-bg)',
              color: 'var(--text-color)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              padding: '2px 4px',
              fontSize: '11px',
              outline: 'none',
              maxWidth: '100px',
              cursor: 'pointer'
            }}
          >
            {workspaces.map(ws => (
               <option key={ws.id} value={ws.id}>{ws.name}</option>
            ))}
            <option value="new_workspace">+ New Workspace</option>
          </select>
        </div>

        <div className="tabs" style={{ display: settings.verticalTabs ? 'none' : 'flex' }}>
          {[...tabs].filter(t => (t.workspaceId || 'default') === activeWorkspaceId).sort((a, b) => {
            if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
            if (a.groupId !== b.groupId) return (a.groupId || '') > (b.groupId || '') ? 1 : -1;
            return 0;
          }).map((tab, i, arr) => {
            const group = tab.groupId ? tabGroups.find(g => g.id === tab.groupId) : null;
            const isFirstInGroup = group && (i === 0 || arr[i - 1].groupId !== tab.groupId);

            return (
            <React.Fragment key={tab.id}>
              {isFirstInGroup && (
                 <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '2px 8px', margin: '4px 2px 4px 4px', borderRadius: '12px',
                    backgroundColor: group.color, color: '#fff', fontSize: '11px', fontWeight: 'bold',
                    maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                 }} title={group.name}>
                    {group.name}
                 </div>
              )}
            <div
              data-testid={`tab-${tab.id}`}
              className={`tab ${tab.id === activeTabId ? 'active' : ''} ${tab.isPrivate ? 'private' : ''} ${tab.isPinned ? 'pinned' : ''} ${tab.suspended ? 'suspended' : ''}`}
              role="tab"
              tabIndex={0}
              aria-selected={tab.id === activeTabId}
              aria-label={`${tab.title}${tab.suspended ? ', suspended' : ''}`}
              style={{ borderTop: group ? `3px solid ${group.color}` : undefined }}
              onClick={() => setActiveTabId(tab.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setActiveTabId(tab.id);
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setTabContextMenu({ tabId: tab.id, x: e.clientX, y: e.clientY });
              }}
              draggable
              onDragStart={(e) => {
                setDraggedTabId(tab.id);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (!draggedTabId || draggedTabId === tab.id) return;

                setTabs(prev => {
                  const draggedIndex = prev.findIndex(t => t.id === draggedTabId);
                  const dropIndex = prev.findIndex(t => t.id === tab.id);
                  if (draggedIndex === -1 || dropIndex === -1) return prev;

                  const newTabs = [...prev];
                  const [removed] = newTabs.splice(draggedIndex, 1);
                  newTabs.splice(dropIndex, 0, removed);
                  return newTabs;
                });
                setDraggedTabId(null);
              }}
              onDragEnd={() => setDraggedTabId(null)}
              onMouseDown={(e) => {
                if (e.button === 1) { // Middle click
                  closeTab(e, tab.id);
                }
              }}
            >
              {tab.isPrivate && <EyeOff size={10} style={{marginRight: '4px', opacity: 0.8}} />}

              {/* Favicon */}
              {!tab.isPrivate && (
                tab.favicon
                  ? <img src={tab.favicon} style={{width: 14, height: 14, marginRight: tab.isPinned ? 0 : 6, flexShrink: 0}} />
                  : <Globe size={14} style={{marginRight: tab.isPinned ? 0 : 6, opacity: 0.7, flexShrink: 0}} />
              )}
              {tab.loading && <span className="tab-loading-indicator" role="status" aria-label="Loading tab"><span /></span>}
              {tab.loadError && <span className="tab-error-indicator" title={tab.loadError.description} aria-label="Page failed to load"><AlertCircle size={12} /></span>}

              {!tab.isPinned && <span className="tab-title" title={tab.title}>{tab.title}</span>}
              {tab.suspended && <span className="tab-suspended-badge">Suspended</span>}
              {!tab.isPinned && (
                <button className="tab-close" type="button" aria-label={`Close ${tab.title}`} onClick={(e) => closeTab(e, tab.id)}>
                  <X size={12} />
                </button>
              )}
              {tab.isPinned && <span className="tab-title" title={tab.title} style={{display: 'none'}}>{tab.title}</span>}
              {(tab.isAudible || tab.isMuted) && (
                <div
                  className="tab-audio-indicator"
                  style={{marginLeft: '4px', display: 'flex', alignItems: 'center', opacity: 0.8}}
                  onClick={(e) => {
                    e.stopPropagation();
                    const wv = webviewRefs.current[tab.id];
                    if (wv) {
                      const newMutedState = !tab.isMuted;
                      wv.setAudioMuted(newMutedState);
                      updateTab(tab.id, { isMuted: newMutedState });
                    }
                  }}
                >
                  {tab.isMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
                </div>
              )}
            </div>
            </React.Fragment>
          )})}
          <button className="new-tab-btn" data-testid="new-tab-button" aria-label="New tab" onClick={() => createTab(isPrivateWindow)}>
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Window controls */}
      <div className="window-controls" style={{ position: 'absolute', top: 0, right: 0, zIndex: 100 }}>
        <button className="control-btn" onClick={() => window.electronAPI?.minimize()} />
        <button className="control-btn" onClick={() => window.electronAPI?.maximize()} />
        <button className="control-btn close" onClick={() => window.electronAPI?.close()} />
      </div>

      {/* Toolbar */}
      <div className="toolbar" data-testid="browser-toolbar">
        <div className="nav-buttons" aria-label="Page navigation">
          <button className="nav-btn" aria-label="Go back" title="Go back" onClick={goBack} disabled={!targetedTab?.canGoBack}>
            <ArrowLeft size={16} />
          </button>
          <button className="nav-btn" aria-label="Go forward" title="Go forward" onClick={goForward} disabled={!targetedTab?.canGoForward}>
            <ArrowRight size={16} />
          </button>
          {targetedTab?.loading ? (
            <button className="nav-btn" aria-label="Stop loading" title="Stop loading" onClick={() => {
              const wv = webviewRefs.current[targetedTabId];
              if (wv) wv.stop();
            }}>
              <X size={16} />
            </button>
          ) : (
            <button className="nav-btn" aria-label="Reload page" title="Reload page" onClick={reload}>
              <RotateCw size={16} />
            </button>
          )}
          <button className="nav-btn" aria-label="Go home" title="Go home" onClick={goHome}>
            <Home size={16} />
          </button>
          <button className="nav-btn" title="Split View" onClick={() => {
            if (splitTabId) {
              setSplitTabId(null);
              setFocusedPane('main');
            } else {
              const newTab: Tab = {
                id: crypto.randomUUID(),
                url: settingsRef.current?.homepageUrl || 'https://www.google.com',
                title: t('newTab', settings.language),
                loading: false, canGoBack: false, canGoForward: false, isSecure: true, zoomLevel: 1, blockedCount: 0,
                workspaceId: activeWorkspaceId
              };
              setTabs(prev => [...prev, newTab]);
              setSplitTabId(newTab.id);
              setFocusedPane('split');
            }
          }}>
            {splitTabId ? <PanelRight size={16} /> : <Columns size={16} />}
          </button>
          <button className="nav-btn" title="Picture in Picture" onClick={() => {
            const wv = webviewRefs.current[targetedTabId];
            if(wv) {
              wv.executeJavaScript("const v = document.querySelector('video'); if (v) { v.requestPictureInPicture(); } else { alert('No video found on this page.'); }", true);
            }
          }}>
            <PictureInPicture size={16} />
          </button>
        </div>

        <form className="address-bar-container" data-testid="address-bar" onSubmit={onSubmit} style={{position: 'relative'}}>
          <div className="security-icon" onClick={(e) => { e.stopPropagation(); setShowSiteInfo(!showSiteInfo); }} style={{cursor: 'pointer'}}>
            {targetedTab?.isSecure ? <Lock size={14} color="#4caf50" /> : <Search size={14} />}
          </div>

          {showSiteInfo && (
            <div className="downloads-popout" onClick={(e) => e.stopPropagation()} style={{
              position: 'absolute', top: '100%', left: 0, width: '280px',
              background: 'var(--bg-color)', border: '1px solid var(--border-color)',
              borderRadius: '8px', zIndex: 150, boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
              marginTop: '8px', padding: '16px'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '16px' }}>
                {targetedTab?.isSecure ? <Lock size={32} color="#4caf50" /> : <Search size={32} color="#f44336" />}
                <h3 style={{ margin: 0, fontSize: '16px', textAlign: 'center' }}>
                  {targetedTab?.isSecure ? 'Connection is secure' : 'Your connection to this site is not secure'}
                </h3>
              </div>
              <button
                className="clear-history-btn"
                style={{width: '100%', padding: '8px', fontSize: '13px', cursor: 'pointer'}}
                onClick={() => {
                  setShowSiteInfo(false);
                  setShowSettings(true);
                  if (window.electronAPI?.getPermissions) {
                    window.electronAPI.getPermissions().then(setPermissions);
                  }
                  if (window.electronAPI?.getAllPasswords) {
                    window.electronAPI.getAllPasswords().then(setPasswordsStore);
                  }
                }}
              >
                Site settings
              </button>
            </div>
          )}

          <input
            ref={addressInputRef}
            className="address-input"
            data-testid="address-input"
            type="text"
            value={inputUrl}
            onChange={async (e) => {
               const val = e.target.value;
               setInputUrl(val);

               if (val.trim().length > 0) {
                 const lowerVal = val.toLowerCase();
                 const matches: {title: string, url: string}[] = [];
                 const seen = new Set();

                 // Search bookmarks
                 bookmarks.forEach(b => {
                   if (b.title.toLowerCase().includes(lowerVal) || b.url.toLowerCase().includes(lowerVal)) {
                     if (!seen.has(b.url)) {
                       matches.push(b);
                       seen.add(b.url);
                     }
                   }
                 });
                 // Search history
                 history.forEach(h => {
                   if (h.title.toLowerCase().includes(lowerVal) || h.url.toLowerCase().includes(lowerVal)) {
                     if (!seen.has(h.url)) {
                       matches.push({ title: h.title, url: h.url });
                       seen.add(h.url);
                     }
                   }
                 });

                 // Debounce and fetch live suggestions
                 if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
                 if (fetchAbortControllerRef.current) fetchAbortControllerRef.current.abort();

                 fetchTimeoutRef.current = setTimeout(async () => {
                   if (window.electronAPI?.fetchSuggestions && !val.includes('://')) {
                     try {
                       const controller = new AbortController();
                       fetchAbortControllerRef.current = controller;

                       // Set initial matches (local only) so it appears fast
                       setAutocompleteSuggestions(matches.slice(0, 8));
                       setShowAutocomplete(matches.length > 0);

                       const suggestions = await window.electronAPI.fetchSuggestions(val);

                       if (controller.signal.aborted) return;

                       suggestions.forEach((s: string) => {
                         let suggestionUrl = `https://www.google.com/search?q=${encodeURIComponent(s)}`;
                         if (settings.defaultSearchEngine === 'Bing') {
                           suggestionUrl = `https://www.bing.com/search?q=${encodeURIComponent(s)}`;
                         } else if (settings.defaultSearchEngine === 'DuckDuckGo') {
                           suggestionUrl = `https://duckduckgo.com/?q=${encodeURIComponent(s)}`;
                         } else if (settings.defaultSearchEngine === 'Yahoo') {
                           suggestionUrl = `https://search.yahoo.com/search?p=${encodeURIComponent(s)}`;
                         } else if (settings.defaultSearchEngine === 'Ecosia') {
                           suggestionUrl = `https://www.ecosia.org/search?q=${encodeURIComponent(s)}`;
                         }
                         if (!seen.has(suggestionUrl)) {
                           matches.push({ title: s, url: suggestionUrl });
                           seen.add(suggestionUrl);
                         }
                       });

                       setAutocompleteSuggestions(matches.slice(0, 8));
                     } catch (err) {
                       console.error('Failed to fetch suggestions', err);
                     }
                   }
                 }, 150);

                 // Immediately show local matches
                 setAutocompleteSuggestions(matches.slice(0, 8)); // max 8 suggestions
                 setShowAutocomplete(matches.length > 0);
               } else {
                 setShowAutocomplete(false);
               }
            }}
            onFocus={(e) => e.target.select()}
            onBlur={() => {
               // timeout so clicks on suggestions register before hiding
               setTimeout(() => setShowAutocomplete(false), 200);
            }}
          />

          {targetedTab && targetedTab.zoomLevel !== 1 && (
            <button
              className="bookmark-toggle-btn zoom-indicator"
              type="button"
              title="Reset Zoom"
              onClick={() => {
                updateTab(targetedTabId, { zoomLevel: 1 });
                saveZoom(targetedTab.url, 1);
                const wv = webviewRefs.current[targetedTabId];
                if (wv) wv.setZoomFactor(1);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0 8px',
                fontSize: '11px',
                fontWeight: 'bold',
                color: 'var(--text-muted)',
                background: 'var(--tab-bg)',
                borderRadius: '12px',
                marginRight: '8px',
                whiteSpace: 'nowrap'
              }}
            >
              <Search size={12} style={{marginRight: '4px'}} />
              {Math.round(targetedTab.zoomLevel * 100)}%
            </button>
          )}

          {showAutocomplete && (
             <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0,
                background: 'var(--bg-color)', border: '1px solid var(--border-color)',
                borderRadius: '0 0 8px 8px', zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                maxHeight: '300px', overflowY: 'auto'
             }}>
                {autocompleteSuggestions.map((s, i) => (
                   <div key={i} style={{
                      padding: '8px 12px', cursor: 'pointer', display: 'flex', flexDirection: 'column',
                      borderBottom: i < autocompleteSuggestions.length - 1 ? '1px solid var(--border-color)' : 'none'
                   }}
                   onMouseDown={(e) => {
                      e.preventDefault(); // prevent input blur
                      navigate(s.url);
                      setShowAutocomplete(false);
                   }}
                   onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--tab-bg)'}
                   onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                   >
                      <div style={{fontSize: '13px', fontWeight: 'bold', color: 'var(--text-color)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{s.title}</div>
                      <div style={{fontSize: '11px', color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{s.url}</div>
                   </div>
                ))}
             </div>
          )}

          <button className="bookmark-toggle-btn" type="button" title="Reader Mode" onClick={() => {
            const wv = webviewRefs.current[targetedTabId];
            if (wv) {
              const script = `
                if (!document.body.dataset.readerMode) {
                  document.body.dataset.readerMode = "true";
                  document.body.dataset.origHtml = document.body.innerHTML;
                  document.body.dataset.origStyle = document.body.getAttribute('style') || '';

                  const contentText = document.body.innerText;
                  const titleText = document.title;

                  // Safely create the DOM to avoid XSS from unescaped text
                  const container = document.createElement('div');
                  container.style.cssText = 'max-width: 800px; margin: 0 auto; padding: 40px 20px; font-family: serif; font-size: 18px; line-height: 1.6; color: #333; background: #fff;';

                  const header = document.createElement('h1');
                  header.style.cssText = 'font-size: 32px; margin-bottom: 24px; border-bottom: 1px solid #eee; padding-bottom: 10px;';
                  header.textContent = titleText;

                  const bodyContent = document.createElement('div');
                  bodyContent.style.whiteSpace = 'pre-wrap';
                  bodyContent.textContent = contentText;

                  container.appendChild(header);
                  container.appendChild(bodyContent);

                  document.body.innerHTML = '';
                  document.body.appendChild(container);
                  document.body.setAttribute('style', 'background-color: #f9f9f9 !important; margin: 0 !important; overflow-y: auto !important;');
                } else {
                  document.body.innerHTML = document.body.dataset.origHtml;
                  document.body.setAttribute('style', document.body.dataset.origStyle);
                  delete document.body.dataset.readerMode;
                }
              `;
              wv.executeJavaScript(script).catch((e: any) => console.error(e));
            }
          }}>
            <BookOpen size={16} color="currentColor" />
          </button>
          <button className="bookmark-toggle-btn" type="button" onClick={toggleBookmark}>
            <Star size={16} fill={isCurrentBookmarked ? "#f5d44f" : "none"} color={isCurrentBookmarked ? "#f5d44f" : "currentColor"} />
          </button>
        </form>
        <div style={{ position: 'relative' }}>
          <div className="shield-container" data-testid="shields-button" title={t('blockedAds', settings.language, { count: targetedTab?.blockedCount || 0 })} onClick={(e) => { e.stopPropagation(); setShowBookmarks(false); setShowHistory(false); setShowMenu(false); setShowReadingList(false); setShowDownloads(false); setShowShields(!showShields); }} style={{ cursor: 'pointer' }}>
            <Shield size={16} color={!settings.adBlockerEnabled || settings.trackerProtectionEnabled === false ? '#d32f2f' : isCurrentSiteExcepted ? '#f0a000' : (targetedTab && targetedTab.blockedCount > 0 ? '#4caf50' : '#888')} />
            {settings.adBlockerEnabled !== false && settings.trackerProtectionEnabled !== false && targetedTab && targetedTab.blockedCount > 0 && <span className="shield-count">{targetedTab.blockedCount}</span>}
          </div>

          {showShields && (
            <section className="shields-popup" data-testid="shields-popup" aria-labelledby="shields-popup-title" onClick={(e) => e.stopPropagation()}>
              <header className="shields-popup-header">
                <div>
                  <span className="shields-kicker">Privacy controls</span>
                  <h3 id="shields-popup-title">Shields</h3>
                  <span className="panel-subtitle">Protection for this browsing session</span>
                </div>
                <button className="nav-btn" aria-label="Close Shields" title="Close Shields" onClick={() => setShowShields(false)}><X size={15} /></button>
              </header>

              <div className={`shields-hero ${!settings.adBlockerEnabled || settings.trackerProtectionEnabled === false ? 'disabled' : isCurrentSiteExcepted ? 'paused' : 'protected'}`} data-testid="shields-status">
                <div className="shields-hero-icon"><Shield size={21} /></div>
                <div className="shields-hero-copy">
                  <strong>{!settings.adBlockerEnabled || settings.trackerProtectionEnabled === false ? 'Shields are off' : isCurrentSiteExcepted ? 'Paused for this site' : 'You are protected'}</strong>
                  <span>{currentSiteOrigin || 'No website is active yet'}</span>
                </div>
                <span className="shields-state-dot" aria-hidden="true" />
              </div>

              <div className="shields-total-card">
                <div><strong>{targetedTab?.blockedCount || 0}</strong><span>trackers and ads blocked</span></div>
                <div className="shields-total-caption">on this site</div>
              </div>

              <div className="shields-breakdown" aria-label="Blocked request categories">
                {targetedTab?.blockedByCategory && Object.keys(targetedTab.blockedByCategory).length > 0 ? Object.entries(targetedTab.blockedByCategory).map(([category, count]) => (
                  <div className="shields-breakdown-item" key={category}><span>{category}</span><strong>{count}</strong></div>
                )) : <div className="shields-breakdown-empty">No blocked requests recorded yet.</div>}
              </div>

              <div className="shields-controls">
                <label className="shield-toggle-row">
                  <span><strong>Global protection</strong><small>Block known ads and trackers everywhere</small></span>
                  <input type="checkbox" data-testid="global-shields-toggle" checked={settings.adBlockerEnabled !== false && settings.trackerProtectionEnabled !== false} onChange={e => setSettings({...settings, adBlockerEnabled: e.target.checked, trackerProtectionEnabled: e.target.checked})} />
                </label>
                <label className={`shield-toggle-row ${!currentSiteOrigin ? 'disabled' : ''}`}>
                  <span><strong>Pause on this site</strong><small>{currentSiteOrigin ? 'Allow requests for this origin' : 'Available when a website is active'}</small></span>
                  <input type="checkbox" data-testid="site-shields-toggle" disabled={!currentSiteOrigin} checked={isCurrentSiteExcepted} onChange={e => {
                    if (!currentSiteOrigin) return;
                    const exceptions = new Set(settings.trackerExceptions || []);
                    if (e.target.checked) exceptions.add(currentSiteOrigin);
                    else exceptions.delete(currentSiteOrigin);
                    setSettings({...settings, trackerExceptions: Array.from(exceptions)});
                  }} />
                </label>
              </div>
            </section>
          )}
        </div>
        <button className="nav-btn" title="Add to Reading List" onClick={() => {
          const wv = webviewRefs.current[targetedTabId];
          if(wv) {
            wv.executeJavaScript("document.body.innerText").then((content: string) => {
              setReadingList(prev => [{ title: targetedTab?.title || '', url: targetedTab?.url || '', content, savedAt: new Date().toLocaleString() }, ...prev]);
              alert("Added to Reading List");
            });
          }
        }}>
          <BookPlus size={16} />
        </button>
        <button className="nav-btn" onClick={() => { setShowMenu(false); setShowHistory(false); setShowDownloads(false); setShowReadingList(false); setShowBookmarks(!showBookmarks); }}>
          <Bookmark size={16} />
        </button>
        <button className="nav-btn" title="Share" onClick={() => {
            const urlToShare = targetedTab?.url || 'probaho://newtab';
            if (urlToShare !== 'probaho://newtab' && urlToShare !== 'about:blank') {
               navigator.clipboard.writeText(urlToShare).then(() => {
                  alert('URL copied to clipboard!');
               });
            }
        }}>
          <Share2 size={16} />
        </button>

        <div style={{ position: 'relative' }}>
          <button className="nav-btn" title="Global Media Controls" onClick={(e) => { e.stopPropagation(); setShowBookmarks(false); setShowHistory(false); setShowMenu(false); setShowReadingList(false); setShowDownloads(false); setShowShields(false); setShowMediaControls(!showMediaControls); }}>
            <Music size={16} />
          </button>
          {showMediaControls && (
            <div className="downloads-popout" onClick={(e) => e.stopPropagation()} style={{
              position: 'absolute', top: '100%', right: 0, width: '320px',
              background: 'var(--bg-color)', border: '1px solid var(--border-color)',
              borderRadius: '8px', zIndex: 150, boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
              marginTop: '8px', padding: '16px'
            }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Global Media Controls</h3>
              {tabs.filter(t => t.isAudible).length === 0 ? (
                <div style={{ fontSize: '13px', color: '#888', textAlign: 'center', padding: '16px 0' }}>No media playing</div>
              ) : (
                tabs.filter(t => t.isAudible).map(t => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', padding: '8px', background: 'var(--tab-bg)', borderRadius: '6px' }}>
                    <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', fontSize: '13px', marginRight: '8px' }}>
                      {t.title}
                    </div>
                    <button className="nav-btn" style={{ padding: '4px' }} onClick={() => {
                      const newMutedState = !t.isMuted;
                      updateTab(t.id, { isMuted: newMutedState });
                      const wv = webviewRefs.current[t.id];
                      if (wv) wv.setAudioMuted(newMutedState);
                    }}>
                      {t.isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="downloads-anchor">
          <button
            className="nav-btn downloads-trigger"
            data-testid="downloads-button"
            aria-label={`${t('downloads', settings.language)}${hasActiveDownloads ? ' — download in progress' : ''}`}
            aria-expanded={showDownloads}
            title={t('downloads', settings.language)}
            onClick={() => { setShowBookmarks(false); setShowHistory(false); setShowMenu(false); setShowReadingList(false); setShowDownloads(!showDownloads); }}
          >
            <Download size={16} />
            {hasActiveDownloads && <span className="downloads-trigger-progress" style={{ width: `${totalDownloadProgress}%` }} />}
            {activeDownloads.length > 0 && <span className="downloads-count">{activeDownloads.length}</span>}
          </button>

          {showDownloads && (
            <section className="downloads-popout download-manager" data-testid="downloads-popout" aria-label={t('downloads', settings.language)} onClick={e => e.stopPropagation()}>
              <header className="download-manager-header">
                <div>
                  <span className="download-manager-kicker">Workspace</span>
                  <h3>{t('downloads', settings.language)}</h3>
                  <span className="panel-subtitle">{downloads.length} {downloads.length === 1 ? 'file' : 'files'} · {completedDownloads.length} completed</span>
                </div>
                <button className="nav-btn" aria-label="Close downloads" title="Close downloads" onClick={() => setShowDownloads(false)}><X size={16} /></button>
              </header>

              <div className="download-manager-summary">
                <div className="download-summary-icon"><Download size={16} /></div>
                <div>
                  <strong>{hasActiveDownloads ? `${activeDownloads.filter(d => d.state === 'progressing').length} active download${activeDownloads.filter(d => d.state === 'progressing').length === 1 ? '' : 's'}` : 'All downloads are up to date'}</strong>
                  <span>{hasActiveDownloads ? 'Transfers continue in the background.' : 'Your recent files stay available here.'}</span>
                </div>
              </div>

              <div className="download-search-wrap">
                <Search size={14} aria-hidden="true" />
                <input type="search" data-testid="download-search" aria-label="Search downloads" placeholder="Search downloads" value={downloadQuery} onChange={e => setDownloadQuery(e.target.value)} />
                {downloadQuery && <button className="download-search-clear" aria-label="Clear download search" onClick={() => setDownloadQuery('')}><X size={13} /></button>}
              </div>

              <div className="download-filters" role="tablist" aria-label="Download filters">
                {(['all', 'active', 'completed'] as const).map(filter => (
                  <button key={filter} type="button" role="tab" aria-selected={downloadFilter === filter} className={`download-filter ${downloadFilter === filter ? 'active' : ''}`} onClick={() => setDownloadFilter(filter)}>
                    {filter === 'all' ? 'All' : filter === 'active' ? `Active${activeDownloads.length ? ` · ${activeDownloads.length}` : ''}` : `Completed${completedDownloads.length ? ` · ${completedDownloads.length}` : ''}`}
                  </button>
                ))}
              </div>

              <div className="download-manager-list">
                {downloads.length === 0 ? (
                  <div className="download-empty" data-testid="downloads-empty">
                    <div className="download-empty-icon"><Download size={22} /></div>
                    <strong>No downloads yet</strong>
                    <span>Files you download will appear here.</span>
                  </div>
                ) : filteredDownloads.length === 0 ? (
                  <div className="download-empty"><Search size={22} /><strong>No matching downloads</strong><span>Try another filename or filter.</span></div>
                ) : filteredDownloads.map(d => {
                  const progress = downloadProgress(d);
                  const status = downloadStatusLabel(d);
                  const isTerminal = d.state === 'completed' || d.state === 'cancelled' || d.state === 'interrupted';
                  return (
                    <article key={d.id} className={`download-card download-state-${d.state}`} data-testid={`download-card-${d.id}`}>
                      <div className="download-card-icon" aria-hidden="true">
                        {d.state === 'completed' ? <CheckCircle2 size={17} /> : d.state === 'interrupted' || d.state === 'cancelled' ? <AlertCircle size={17} /> : <FileText size={17} />}
                      </div>
                      <div className="download-info">
                        <div className="download-card-title" title={d.fileName}>{d.fileName}</div>
                        <div className="download-card-meta"><span className={`download-status status-${d.state}`}>{status}</span><span>{formatDownloadBytes(d.receivedBytes)}{d.totalBytes > 0 ? ` / ${formatDownloadBytes(d.totalBytes)}` : ''}</span></div>
                        {(d.state === 'progressing' || d.state === 'paused') && <div className="download-progress-bar" aria-label={`${Math.round(progress)}% downloaded`}><div className="download-progress-fill" style={{ width: `${progress}%` }} /></div>}
                      </div>
                      <div className="download-actions">
                        {d.state === 'completed' && <>
                          <button className="download-action-btn" aria-label={`Open ${d.fileName}`} title={t('openFile', settings.language)} onClick={() => window.electronAPI?.openFile(d.savePath)}><FileCode size={14} /></button>
                          <button className="download-action-btn" aria-label={`Show ${d.fileName} in folder`} title={t('showInFolder', settings.language)} onClick={() => window.electronAPI?.showInFolder(d.savePath)}><Folder size={14} /></button>
                        </>}
                        {d.state === 'progressing' && <button className="download-action-btn" aria-label={`Pause ${d.fileName}`} title="Pause" onClick={() => window.electronAPI?.pauseDownload?.(d.id)}><Pause size={14} /></button>}
                        {d.state === 'paused' && <button className="download-action-btn" aria-label={`Resume ${d.fileName}`} title="Resume" onClick={() => window.electronAPI?.resumeDownload?.(d.id)}><Play size={14} /></button>}
                        <button className="download-action-btn remove" aria-label={`${isTerminal ? 'Remove' : 'Cancel'} ${d.fileName}`} title={isTerminal ? 'Remove' : 'Cancel'} onClick={() => { if (!isTerminal) window.electronAPI?.cancelDownload?.(d.id); setDownloads(prev => prev.filter(item => item.id !== d.id)); }}><Trash2 size={14} /></button>
                      </div>
                    </article>
                  );
                })}
              </div>

              {downloads.some(d => d.state !== 'progressing' && d.state !== 'paused') && <button className="download-clear-finished" type="button" onClick={() => setDownloads(prev => prev.filter(d => d.state === 'progressing' || d.state === 'paused'))}><Trash2 size={14} /> Clear finished</button>}
            </section>
          )}
        </div>

        <button className="nav-btn" data-testid="menu-button" aria-label="Open menu" onClick={() => { setShowBookmarks(false); setShowHistory(false); setShowDownloads(false); setShowReadingList(false); setShowMenu(!showMenu); }}>
          <Menu size={16} />
        </button>
      </div>

      {/* Menu Panel */}
      {showMenu && (
        <div className="menu-panel">
          <div className="menu-item" onClick={() => { createTab(); setShowMenu(false); }}>
            <div className="menu-item-icon"><Plus size={16} /></div>
            <div className="menu-item-text">{t('newTab', settings.language)}</div>
            <div className="menu-item-shortcut">Ctrl+T</div>
          </div>
          <div className="menu-item" onClick={() => { setShowMenu(false); window.electronAPI?.openNewWindow?.(); }}>
            <div className="menu-item-icon"><Columns size={16} /></div>
            <div className="menu-item-text">{t('newWindow', settings.language)}</div>
            <div className="menu-item-shortcut">Ctrl+N</div>
          </div>
          <div className="menu-item" data-testid="new-private-window" onClick={() => { setShowMenu(false); window.electronAPI?.openPrivateWindow?.(); }}>
            <div className="menu-item-icon"><EyeOff size={16} /></div>
            <div className="menu-item-text">{t('newPrivateTab', settings.language)}</div>
            <div className="menu-item-shortcut">Ctrl+Shift+N</div>
          </div>
          <div className="menu-divider" />
          <div className="menu-item" onClick={() => { setShowMenu(false); setShowHistory(true); }}>
            <div className="menu-item-icon"><History size={16} /></div>
            <div className="menu-item-text">{t('history', settings.language)}</div>
          </div>
          <div className="menu-item" onClick={() => { setShowMenu(false); setShowDownloads(true); }}>
            <div className="menu-item-icon"><Download size={16} /></div>
            <div className="menu-item-text">{t('downloads', settings.language)}</div>
          </div>
          <div className="menu-item" onClick={() => { setShowMenu(false); setShowBookmarks(true); }}>
            <div className="menu-item-icon"><Bookmark size={16} /></div>
            <div className="menu-item-text">{t('bookmarks', settings.language)}</div>
          </div>
          <div className="menu-item" onClick={() => { setShowMenu(false); setShowReadingList(true); }}>
            <div className="menu-item-icon"><BookPlus size={16} /></div>
            <div className="menu-item-text">Reading List</div>
          </div>
          <div className="menu-item" onClick={() => { setShowMenu(false); restoreTab(); }} style={{opacity: recentlyClosed.length === 0 ? 0.5 : 1}}>
            <div className="menu-item-icon"><RotateCw size={16} /></div>
            <div className="menu-item-text">Recently Closed ({recentlyClosed.length})</div>
            <div className="menu-item-shortcut">Ctrl+Shift+T</div>
          </div>
          <div className="menu-divider" />
          <div className="menu-item" onClick={(e) => e.stopPropagation()}>
            <div className="menu-item-icon"><ZoomIn size={16} /></div>
            <div className="menu-item-text">{t('zoom', settings.language)}</div>
            <div className="zoom-controls">
              <button className="zoom-btn" onClick={() => handleZoom(-0.1)}>-</button>
              <span className="zoom-level">{Math.round((activeTab?.zoomLevel || 1) * 100)}%</span>
              <button className="zoom-btn" onClick={() => handleZoom(0.1)}>+</button>
              <button className="zoom-btn" onClick={() => handleZoom(1 - (activeTab?.zoomLevel || 1))}><Square size={10} /></button>
            </div>
          </div>
          <div className="menu-item" onClick={handlePrint}>
            <div className="menu-item-icon"><Printer size={16} /></div>
            <div className="menu-item-text">{t('print', settings.language)}</div>
            <div className="menu-item-shortcut">Ctrl+P</div>
          </div>
          <div className="menu-item" onClick={() => {
              setShowMenu(false);
              window.electronAPI?.saveAsPdf?.();
          }}>
            <div className="menu-item-icon"><FileCode size={16} /></div>
            <div className="menu-item-text">Save as PDF</div>
          </div>
          <div className="menu-divider" />
          <div className="menu-item" onClick={() => {
            setShowMenu(false);
            setShowSettings(true);
            if (window.electronAPI?.getPermissions) {
              window.electronAPI.getPermissions().then(setPermissions);
            }
            if (window.electronAPI?.getAllPasswords) {
              window.electronAPI.getAllPasswords().then(setPasswordsStore);
            }
          }}>
            <div className="menu-item-icon"><Settings size={16} /></div>
            <div className="menu-item-text">{t('settings', settings.language)}</div>
          </div>
          <div className="menu-item" onClick={toggleDevTools}>
            <div className="menu-item-icon"><FileCode size={16} /></div>
            <div className="menu-item-text">{t('devTools', settings.language)}</div>
            <div className="menu-item-shortcut">F12</div>
          </div>
          <div className="menu-divider" />
          <div className="menu-item" onClick={() => {
             setShowMenu(false);
             navigate('https://github.com/susankarkarmakar-pixel/probaho-browser');
          }}>
            <div className="menu-item-icon"><Info size={16} /></div>
            <div className="menu-item-text">Help & Feedback</div>
          </div>
          <div className="menu-item" onClick={() => { setShowMenu(false); setShowAbout(true); }}>
            <div className="menu-item-icon"><Info size={16} /></div>
            <div className="menu-item-text">{t('about', settings.language)}</div>
          </div>
          <div className="menu-divider" />
          <div className="menu-item" onClick={() => window.electronAPI?.close()}>
            <div className="menu-item-icon"><LogOut size={16} /></div>
            <div className="menu-item-text">{t('exit', settings.language)}</div>
          </div>
        </div>
      )}

      {/* History Panel */}
      {showHistory && (
        <div className="bookmarks-panel history-panel" data-testid="history-panel">
          <div className="bookmarks-header history-header">
            <div>
              <h3>{t('history', settings.language)}</h3>
              <span className="panel-subtitle">{history.length} {history.length === 1 ? 'entry' : 'entries'}</span>
            </div>
            <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
              <button className="clear-history-btn" data-testid="clear-history-button" disabled={history.length === 0} onClick={() => {
                if (history.length > 0 && confirm('Clear all browsing history?')) setHistory([]);
              }}>{t('clear', settings.language)}</button>
              <button className="nav-btn" aria-label="Close history" title="Close history" onClick={() => setShowHistory(false)}><X size={16} /></button>
            </div>
          </div>
          <div className="history-search-wrap">
            <Search size={14} aria-hidden="true" />
            <input
              type="search"
              data-testid="history-search"
              aria-label="Search history"
              placeholder="Search history"
              value={historyQuery}
              onChange={e => setHistoryQuery(e.target.value)}
            />
            {historyQuery && <button className="history-search-clear" aria-label="Clear history search" onClick={() => setHistoryQuery('')}><X size={13} /></button>}
          </div>
          <div className="bookmarks-list history-list">
            {(() => {
              const query = historyQuery.trim().toLowerCase();
              const filteredHistory = query
                ? history.filter(h => h.title.toLowerCase().includes(query) || h.url.toLowerCase().includes(query))
                : history;
              if (filteredHistory.length === 0) {
                return <div className="no-bookmarks">{history.length === 0 ? t('noHistory', settings.language) : 'No matching history.'}</div>;
              }
              return filteredHistory.map((h, i) => (
                <button key={`${h.url}-${h.time}-${i}`} type="button" className="bookmark-item history-item" onClick={() => { navigate(h.url); setShowHistory(false); }}>
                  <span className="history-item-main">
                    <span className="bookmark-title">{h.title || h.url}</span>
                    <span className="bookmark-url">{h.url}</span>
                  </span>
                  <span className="history-item-time">{h.time}</span>
                </button>
              ));
            })()}
          </div>
        </div>
      )}





      {/* Settings Modal */}
      {showSettings && (
        <div className="about-modal-overlay" data-testid="settings-overlay" onClick={() => setShowSettings(false)}>
          <div className="about-modal settings-modal" data-testid="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" style={{width: '500px', maxHeight: '80vh', overflowY: 'auto'}} onClick={e => e.stopPropagation()}>
            <div className="about-header settings-header">
              <div className="settings-header-copy">
                <span className="settings-kicker">Browser preferences</span>
                <h3 id="settings-title" data-testid="settings-title">{t('settings', settings.language)}</h3>
                <p>Make Probaho feel like your personal command center.</p>
              </div>
              <div className="settings-header-mark"><SlidersHorizontal size={19} /></div>
              <button className="nav-btn settings-close-btn" aria-label="Close settings" onClick={() => setShowSettings(false)}><X size={16} /></button>
            </div>
            <div className="about-content settings-content" data-testid="settings-content" style={{textAlign: 'left', padding: '16px 24px'}}>
              <div className="settings-hero">
                <div className="settings-hero-icon"><ShieldCheck size={18} /></div>
                <div>
                  <strong>Private by default</strong>
                  <span>Performance, privacy and appearance controls are saved on this device.</span>
                </div>
              </div>
              <div className="settings-profile-actions" style={{marginBottom: '16px', display: 'flex', gap: '8px'}}>
                                  <button className="clear-history-btn settings-action-btn" data-testid="export-profile-button" style={{flex: 1, padding: '8px'}} onClick={() => {

                  const data = { bookmarks, history, readingList, settings };
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'probaho_profile.json';
                  a.click();
                  URL.revokeObjectURL(url);
                }}>Export Profile</button>
                <label className="clear-history-btn settings-action-btn" data-testid="import-profile-button" style={{flex: 1, padding: '8px', textAlign: 'center', cursor: 'pointer'}}>
                  Import Profile
                  <input type="file" accept=".json" style={{display: 'none'}} onClick={(e) => { (e.target as HTMLInputElement).value = '' }} onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        try {
                          const data = JSON.parse(ev.target?.result as string);
                          if (typeof data !== 'object' || data === null) throw new Error('Invalid format');
                          if (Array.isArray(data.bookmarks)) setBookmarks(data.bookmarks);
                          if (Array.isArray(data.history)) setHistory(data.history);
                          if (Array.isArray(data.readingList)) setReadingList(data.readingList);
                          if (typeof data.settings === 'object') setSettings(data.settings);
                          alert('Profile imported successfully!');
                        } catch (err) {
                          alert('Failed to import profile. Ensure the file is a valid JSON profile.');
                        }
                      };
                      reader.readAsText(file);
                    }
                  }} />
                </label>
              </div>

              <div style={{marginBottom: '16px'}}>
                <label style={{display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 'bold'}}>{t('homepageUrl', settings.language)}</label>
                <input
                  type="text"
                  value={settings.homepageUrl}
                  onChange={e => setSettings({...settings, homepageUrl: e.target.value})}
                  style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)'}}
                />
              </div>
              <div style={{marginBottom: '16px'}}>
                <label style={{display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 'bold'}}>{t('defaultSearchEngine', settings.language)}</label>
                <select
                  value={settings.defaultSearchEngine}
                  onChange={e => setSettings({...settings, defaultSearchEngine: e.target.value})}
                  style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)'}}
                >
                  <option value="Google">Google</option>
                  <option value="Bing">Bing</option>
                  <option value="DuckDuckGo">DuckDuckGo</option>
                  <option value="Yahoo">Yahoo</option>
                  <option value="Ecosia">Ecosia</option>
                </select>
              </div>
              <div style={{marginBottom: '16px'}}>
                <label style={{display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 'bold'}}>New Tab Background Image URL</label>
                <input
                  type="text"
                  value={settings.newTabBackgroundUrl || ''}
                  onChange={e => setSettings({...settings, newTabBackgroundUrl: e.target.value})}
                  placeholder="https://example.com/image.jpg"
                  style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)'}}
                />
              </div>
              <div style={{marginBottom: '16px'}}>
                <label style={{display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold'}}>
                  <input
                    type="checkbox"
                    checked={settings.adBlockerEnabled !== false}
                    onChange={e => setSettings({...settings, adBlockerEnabled: e.target.checked})}
                    style={{marginRight: '8px'}}
                  />
                  Enable Ad & Tracker Blocking
                </label>
              </div>
              <div style={{marginBottom: '16px'}}>
                <label style={{display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold'}}>
                  <input
                    type="checkbox"
                    checked={settings.verticalTabs === true}
                    onChange={e => setSettings({...settings, verticalTabs: e.target.checked})}
                    style={{marginRight: '8px'}}
                  />
                  Enable Vertical Tabs Sidebar
                </label>
              </div>

              <div style={{marginBottom: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px'}} data-testid="performance-settings">
                <h4 style={{margin: '0 0 12px 0', fontSize: '14px'}}>Performance</h4>
                <label style={{display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', marginBottom: '10px'}}>
                  <input
                    type="checkbox"
                    data-testid="lazy-tabs-toggle"
                    checked={settings.lazyLoadTabs !== false}
                    onChange={e => setSettings({...settings, lazyLoadTabs: e.target.checked})}
                    style={{marginRight: '8px'}}
                  />
                  Load tab pages only when opened
                </label>
                <label style={{display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', marginBottom: '10px'}}>
                  <input
                    type="checkbox"
                    data-testid="suspend-tabs-toggle"
                    checked={settings.suspendInactiveTabs !== false}
                    onChange={e => setSettings({...settings, suspendInactiveTabs: e.target.checked})}
                    style={{marginRight: '8px'}}
                  />
                  Suspend inactive tabs to save memory
                </label>
                <label style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px'}}>
                  <span>Suspend after</span>
                  <select
                    data-testid="suspension-timeout-select"
                    value={settings.suspensionTimeoutMinutes || 5}
                    disabled={settings.suspendInactiveTabs === false}
                    onChange={e => setSettings({...settings, suspensionTimeoutMinutes: Number(e.target.value)})}
                    style={{padding: '4px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)'}}
                  >
                    <option value={1}>1 minute</option>
                    <option value={5}>5 minutes</option>
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                  </select>
                </label>
              </div>

              <div style={{marginBottom: '16px'}}>
                <label style={{display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold'}}>
                  <input
                    type="checkbox"
                    checked={settings.showBookmarksBar === true}
                    onChange={e => setSettings({...settings, showBookmarksBar: e.target.checked})}
                    style={{marginRight: '8px'}}
                  />
                  {t('showBookmarksBar', settings.language)}
                </label>
              </div>

              <div style={{marginBottom: '16px'}}>
                <label style={{display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold'}}>
                  <input
                    type="checkbox"
                    checked={settings.doNotTrack === true}
                    onChange={e => setSettings({...settings, doNotTrack: e.target.checked})}
                    style={{marginRight: '8px'}}
                  />
                  Send a "Do Not Track" request with your browsing traffic
                </label>
              </div>

              <div style={{marginBottom: '16px'}}>
                <label style={{display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold'}}>
                  <input
                    type="checkbox"
                    checked={settings.askDownloadLocation === true}
                    onChange={e => setSettings({...settings, askDownloadLocation: e.target.checked})}
                    style={{marginRight: '8px'}}
                  />
                  Ask where to save each file before downloading
                </label>
              </div>

              <div style={{marginBottom: '16px'}}>
                <label style={{display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 'bold'}}>{t('language', settings.language)}</label>
                <select
                  value={settings.language}
                  onChange={e => setSettings({...settings, language: e.target.value as Language})}
                  style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)'}}
                >
                  <option value="en">{t('english', settings.language)}</option>
                  <option value="bn">{t('bengali', settings.language)}</option>
                </select>
              </div>
              <div style={{marginBottom: '16px'}}>
                <label style={{display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 'bold'}}>{t('theme', settings.language)}</label>
                <select
                  value={settings.theme}
                  onChange={e => setSettings({...settings, theme: e.target.value})}
                  style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)'}}
                >
                  <option value="dark">{t('dark', settings.language)}</option>
                  <option value="light">{t('light', settings.language)}</option>
                </select>
              </div>
              <div style={{marginBottom: '16px'}}>
                <label style={{display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 'bold'}}>Accent Color</label>
                <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                  <input
                    type="color"
                    value={settings.accentColor || '#7b2cbf'}
                    onChange={e => setSettings({...settings, accentColor: e.target.value})}
                    style={{width: '40px', height: '40px', padding: '0', border: 'none', borderRadius: '8px', cursor: 'pointer', background: 'transparent'}}
                  />
                  <span style={{fontSize: '13px', color: '#888'}}>{settings.accentColor || '#7b2cbf'}</span>
                  <button className="clear-history-btn" onClick={() => setSettings({...settings, accentColor: '#7b2cbf'})} style={{padding: '4px 8px', fontSize: '12px'}}>Reset</button>
                </div>
              </div>
              <div className="settings-update-section" data-testid="updates-section">
                <div className="settings-section-heading-row">
                  <div>
                    <span className="settings-field-kicker">Trust & maintenance</span>
                    <h4>Software updates</h4>
                  </div>
                  <span className={`settings-update-status status-${updateStatus.state}`} data-testid="update-status">{updateStatus.state === 'not-available' ? 'Up to date' : updateStatus.state === 'available' ? 'Update ready' : updateStatus.state === 'downloaded' ? 'Ready to restart' : updateStatus.state === 'downloading' ? `${Math.round(updateStatus.percent || 0)}%` : updateStatus.state === 'checking' ? 'Checking…' : updateStatus.state === 'error' ? 'Check failed' : 'Automatic checks on'}</span>
                </div>
                <p className="settings-update-copy">Updates are checked over HTTPS and verified by the signed release package before installation.</p>
                {updateStatus.error && <div className="settings-update-error" role="alert">{updateStatus.error}</div>}
                {updateStatus.state === 'downloading' && <div className="settings-update-progress" aria-label={`${Math.round(updateStatus.percent || 0)}% downloaded`}><span style={{width: `${Math.max(0, Math.min(100, updateStatus.percent || 0))}%`}} /></div>}
                <div className="settings-update-actions">
                  <button type="button" className="settings-secondary-btn" data-testid="check-updates-button" disabled={updateActionBusy || updateStatus.state === 'checking'} onClick={() => runUpdateAction(window.electronAPI?.checkForUpdates)}>Check now</button>
                  {updateStatus.state === 'available' && <button type="button" className="settings-primary-btn" data-testid="download-update-button" disabled={updateActionBusy} onClick={() => runUpdateAction(window.electronAPI?.downloadUpdate)}>Download update</button>}
                  {updateStatus.state === 'downloaded' && <button type="button" className="settings-primary-btn" data-testid="install-update-button" disabled={updateActionBusy} onClick={() => runUpdateAction(window.electronAPI?.installUpdate)}>Restart to install</button>}
                </div>
              </div>

              <div style={{marginBottom: '16px'}}>
                <button
                  className="clear-history-btn"
                  style={{width: '100%', padding: '10px', fontSize: '13px', fontWeight: 'bold', background: 'var(--primary-color)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer'}}
                  onClick={() => {
                    localStorage.removeItem('history');
                    setHistory([]);
                    if (window.electronAPI?.clearCache) {
                      window.electronAPI.clearCache();
                    }
                    alert('Browsing data cleared successfully!');
                  }}
                >
                  Clear Browsing Data (History & Cache)
                </button>
              </div>

              {/* Password Manager Section */}
              <div className="settings-section" style={{marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '16px'}} data-testid="passwords-section">
                <h4 className="settings-section-title" style={{marginBottom: '12px', fontSize: '14px'}}><Lock size={15} /> Password Manager</h4>
                {Object.keys(passwordsStore).length === 0 ? (
                  <div style={{fontSize: '13px', color: '#888'}}>No saved passwords.</div>
                ) : (
                  <div style={{maxHeight: '200px', overflowY: 'auto'}}>
                    {Object.entries(passwordsStore).map(([origin, creds]: [string, any]) => (
                      <div key={origin} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', padding: '8px', background: 'var(--tab-bg)', borderRadius: '6px'}}>
                        <div style={{flex: 1, overflow: 'hidden'}}>
                          <div style={{fontWeight: 'bold', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{origin}</div>
                          <div style={{fontSize: '12px', color: '#888'}}>Username: {creds.username || 'N/A'}</div>
                          <div style={{fontSize: '12px', color: '#888', display: 'flex', alignItems: 'center', gap: '4px'}}>
                            Password: {showPasswords[origin] ? creds.password : '••••••••'}
                            <button
                              className="nav-btn"
                              style={{padding: '2px'}}
                              onClick={() => setShowPasswords(prev => ({...prev, [origin]: !prev[origin]}))}
                            >
                              {showPasswords[origin] ? <EyeOff size={12} /> : <Eye size={12} />}
                            </button>
                          </div>
                        </div>
                        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                        <button
                          className="clear-history-btn"
                          style={{padding: '4px 8px', fontSize: '11px'}}
                          onClick={() => {
                            const newUsername = prompt("Enter new username:", creds.username);
                            const newPassword = prompt("Enter new password:", creds.password);
                            if (newUsername !== null && newPassword !== null) {
                              const updatedCreds = { username: newUsername, password: newPassword };
                              if (window.electronAPI?.savePassword) {
                                window.electronAPI.savePassword(origin, updatedCreds);
                                setPasswordsStore(prev => ({...prev, [origin]: updatedCreds}));
                              }
                            }
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="clear-history-btn"
                          style={{padding: '4px 8px', fontSize: '11px'}}
                          onClick={() => {
                            if (window.electronAPI?.deletePassword) {
                              window.electronAPI.deletePassword(origin);
                              const newStore = { ...passwordsStore };
                              delete newStore[origin];
                              setPasswordsStore(newStore);
                            }
                          }}
                        >
                          Delete
                        </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Extensions and Plugins Section */}
              <div className="settings-section" style={{marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '16px'}} data-testid="extensions-section">
                <h4 className="settings-section-title" style={{marginBottom: '6px', fontSize: '14px'}}><SlidersHorizontal size={15} /> Extensions & Plugins</h4>
                <div style={{fontSize: '11px', color: '#888', marginBottom: '12px'}}>Only manifest-validated unpacked extensions are loaded. Extension code remains isolated from this UI.</div>
                <button
                  className="clear-history-btn"
                  data-testid="load-extension-button"
                  style={{width: '100%', padding: '10px', fontSize: '13px', fontWeight: 'bold', background: 'var(--tab-bg)', color: 'var(--text-color)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer'}}
                  onClick={async () => {
                    setExtensionError(null);
                    const result = await window.electronAPI?.loadExtension?.();
                    if (!result) return;
                    if ('error' in result) setExtensionError(result.error);
                    else setExtensions(prev => [...prev.filter(item => item.id !== result.id), result]);
                  }}
                >
                  Load Extension (Unpacked)
                </button>
                {extensionError && <div style={{color: '#f44336', fontSize: '11px', marginTop: '8px'}}>{extensionError}</div>}
                <div style={{marginTop: '12px'}}>
                  {extensions.length === 0 ? (
                    <div style={{fontSize: '12px', color: '#888'}}>No custom extensions installed.</div>
                  ) : extensions.map(extension => (
                    <div key={extension.id} data-testid={`extension-${extension.id}`} style={{padding: '10px', marginBottom: '8px', border: '1px solid var(--border-color)', borderRadius: '6px'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', gap: '8px'}}>
                        <strong style={{fontSize: '12px'}}>{extension.name}</strong>
                        <span style={{fontSize: '10px', color: '#888'}}>v{extension.version}</span>
                      </div>
                      {extension.description && <div style={{fontSize: '11px', color: '#999', marginTop: '4px'}}>{extension.description}</div>}
                      <div style={{fontSize: '10px', color: '#888', marginTop: '6px'}}>Permissions: {extension.permissions.length ? extension.permissions.join(', ') : 'none'}</div>
                      <div style={{display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '8px'}}>
                        <button className="clear-history-btn" style={{padding: '4px 8px', fontSize: '10px'}} onClick={async () => {
                          const result = await window.electronAPI?.setExtensionEnabled?.(extension.id, !extension.enabled);
                          if (result && !('error' in result)) setExtensions(prev => prev.map(item => item.id === result.id ? result : item));
                          else if (result && 'error' in result) setExtensionError(result.error);
                        }}>{extension.enabled ? 'Disable' : 'Enable'}</button>
                        <button className="clear-history-btn" style={{padding: '4px 8px', fontSize: '10px'}} onClick={async () => {
                          await window.electronAPI?.removeExtension?.(extension.id);
                          setExtensions(prev => prev.filter(item => item.id !== extension.id));
                        }}>Remove</button>
                      </div>
                    </div>
                  ))}
                </div>

                <h4 style={{margin: '18px 0 6px', fontSize: '14px'}}>Plugins</h4>
                <div style={{fontSize: '11px', color: '#888', marginBottom: '8px'}}>Plugins are declarative HTTPS panels or commands; arbitrary plugin JavaScript is not supported.</div>
                {plugins.length === 0 ? (
                  <div style={{fontSize: '12px', color: '#888'}}>No registered plugins.</div>
                ) : plugins.map(plugin => (
                  <div key={plugin.id} data-testid={`plugin-${plugin.id}`} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-color)'}}>
                    <span style={{fontSize: '12px'}}>{plugin.name} <span style={{color: '#888'}}>({plugin.type})</span></span>
                    <div style={{display: 'flex', gap: '6px'}}>
                      {plugin.type === 'panel' && <button className="clear-history-btn" style={{padding: '4px 8px', fontSize: '10px'}} onClick={() => { setShowSettings(false); navigate(plugin.url); }}>Open</button>}
                      <button className="clear-history-btn" style={{padding: '4px 8px', fontSize: '10px'}} onClick={async () => {
                        const result = await window.electronAPI?.setPluginEnabled?.(plugin.id, !plugin.enabled);
                        if (result && !('error' in result)) setPlugins(prev => prev.map(item => item.id === result.id ? result : item));
                      }}>{plugin.enabled ? 'Disable' : 'Enable'}</button>
                    </div>
                  </div>
                ))}
                <textarea
                  data-testid="plugin-json-input"
                  value={pluginDraft}
                  onChange={e => setPluginDraft(e.target.value)}
                  spellCheck={false}
                  style={{width: '100%', minHeight: '76px', marginTop: '12px', padding: '8px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)', fontFamily: 'monospace', fontSize: '11px'}}
                />
                <button
                  className="clear-history-btn"
                  data-testid="register-plugin-button"
                  style={{width: '100%', padding: '8px', marginTop: '8px'}}
                  onClick={async () => {
                    try {
                      const result = await window.electronAPI?.registerPlugin?.(JSON.parse(pluginDraft));
                      if (result && 'error' in result) setExtensionError(result.error);
                      else if (result) {
                        setPlugins(prev => [...prev.filter(item => item.id !== result.id), result]);
                        setExtensionError(null);
                      }
                    } catch {
                      setExtensionError('Plugin definition must be valid JSON');
                    }
                  }}
                >
                  Register HTTPS Plugin
                </button>
              </div>

              {/* Site Permissions Section */}
              <div className="settings-section" style={{marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '16px'}} data-testid="permissions-section">
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px'}}>
                  <h4 className="settings-section-title" style={{margin: 0, fontSize: '14px'}}><Shield size={15} /> Site Permissions</h4>
                  {Object.keys(permissions).length > 0 && (
                    <button
                      className="clear-history-btn"
                      data-testid="clear-permissions-button"
                      style={{padding: '4px 8px', fontSize: '11px'}}
                      onClick={() => {
                        if (confirm('Clear all saved site permissions?')) {
                          window.electronAPI?.clearPermissions?.();
                          setPermissions({});
                        }
                      }}
                    >
                      Clear all
                    </button>
                  )}
                </div>
                {Object.keys(permissions).length === 0 ? (
                  <div style={{fontSize: '13px', color: '#888'}}>No permissions saved.</div>
                ) : (
                  <div style={{maxHeight: '200px', overflowY: 'auto'}}>
                    {Object.entries(permissions).map(([origin, perms]) => (
                      <div key={origin} style={{marginBottom: '12px'}}>
                        <div style={{fontWeight: 'bold', fontSize: '13px', marginBottom: '4px'}}>{origin}</div>
                        {Object.entries(perms).map(([perm, decision]) => (
                          <div key={perm} data-testid={`permission-${perm}`} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', paddingLeft: '8px', marginBottom: '4px', gap: '8px'}}>
                            <span>
                              {perm}: {decision.allowed ? <span style={{color: '#4caf50'}}>Allowed</span> : <span style={{color: '#f44336'}}>Blocked</span>}
                              <span style={{display: 'block', color: '#888', fontSize: '10px'}}>
                                {decision.expiresAt === null ? 'Session only' : `Expires ${new Date(decision.expiresAt).toLocaleString()}`}
                              </span>
                            </span>
                            <button
                              className="clear-history-btn"
                              style={{padding: '4px 8px', fontSize: '11px'}}
                              onClick={() => {
                                window.electronAPI?.deletePermission?.(origin, perm);
                                const newPerms: PermissionStore = { ...permissions, [origin]: { ...permissions[origin] } };
                                delete newPerms[origin][perm];
                                if (Object.keys(newPerms[origin]).length === 0) delete newPerms[origin];
                                setPermissions(newPerms);
                              }}
                            >
                              Revoke
                            </button>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}




      {/* About Modal */}
      {showAbout && (
        <div className="about-modal-overlay" onClick={() => setShowAbout(false)}>
          <div className="about-modal" onClick={e => e.stopPropagation()}>
            <div className="about-header">
              <h3>{t('aboutTitle', settings.language)}</h3>
              <button className="nav-btn" onClick={() => setShowAbout(false)}><X size={16} /></button>
            </div>
            <div className="about-content">
              <div className="about-logo">
                <div style={{fontSize: '32px', marginBottom: '10px'}}>🌐</div>
                <h2>PROBAHO BROWSER</h2>
              </div>
              <table className="about-table">
                <tbody>
                  <tr><td><strong>{t('version', settings.language)}:</strong></td><td>2.1.0</td></tr>
                  <tr><td><strong>{t('license', settings.language)}:</strong></td><td>MIT</td></tr>
                  <tr><td><strong>{t('creator', settings.language)}:</strong></td><td>Susankar Karmakar</td></tr>
                </tbody>
              </table>
              <p className="about-desc">
                Probaho Browser is a lightweight, fast, and privacy-focused web browser built with modern web technologies.
              </p>
              <div className="about-footer">
                © 2026 Susankar Karmakar. {t('rights', settings.language)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bookmarks Panel */}
      {showBookmarks && (
        <div className="bookmarks-panel">
          <div className="bookmarks-header">
            <h3>{t('bookmarks', settings.language)}</h3>
            <button className="nav-btn" onClick={() => setShowBookmarks(false)}><X size={16} /></button>
          </div>
          <div className="bookmarks-list">
            {bookmarks.length === 0 ? (
              <div className="no-bookmarks">{t('noBookmarks', settings.language)}</div>
            ) : (
              bookmarks.map((b, i) => (
                <div key={i} className="bookmark-item" onClick={() => { navigate(b.url); setShowBookmarks(false); }}>
                  <div className="bookmark-title">{b.title}</div>
                  <div className="bookmark-url">{b.url}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Reading List Panel */}
      {showReadingList && (
        <div className="bookmarks-panel">
          <div className="bookmarks-header">
            <h3>Reading List</h3>
            <button className="nav-btn" onClick={() => setShowReadingList(false)}><X size={16} /></button>
          </div>
          <div className="bookmarks-list">
            {readingList.length === 0 ? (
              <div className="no-bookmarks">No articles saved.</div>
            ) : (
              readingList.map((item, i) => (
                <div key={i} className="bookmark-item" onClick={() => {
                  const wv = webviewRefs.current[activeTabId];
                  if(wv) {
                    wv.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent('<html><head><title>Reading List</title></head><body style="background:#f9f9f9;margin:0;"><div id="content" style="max-width:800px;margin:0 auto;padding:40px;font-family:sans-serif;white-space:pre-wrap;font-size:18px;line-height:1.6;"></div></body></html>'));
                    wv.addEventListener('did-finish-load', () => {
                      wv.executeJavaScript(`document.getElementById('content').textContent = ${JSON.stringify(item.content)};`);
                    }, { once: true });
                    setShowReadingList(false);
                  }
                }}>
                  <div className="bookmark-title">{item.title}</div>
                  <div className="bookmark-url" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{item.url}</span>
                    <span>{item.savedAt}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Command Palette Overlay */}
      {showCommandPalette && (
        <div className="command-palette-overlay" onClick={() => setShowCommandPalette(false)}>
          <div className="command-palette" onClick={e => e.stopPropagation()}>
            <div className="command-palette-search">
              <Search size={18} color="#888" />
              <input
                type="text"
                autoFocus
                placeholder="Search tabs, history, bookmarks..."
                value={commandQuery}
                onChange={e => {
                  setCommandQuery(e.target.value);
                  setCommandSelectionIndex(0);
                }}
                onKeyDown={e => {
                  const lowerQuery = commandQuery.toLowerCase();

                  // Simple combined list
                  const commandResults: {type: string, title: string, url: string, action: () => void}[] = [];

                  tabs.forEach(t => {
                    if (t.title.toLowerCase().includes(lowerQuery) || t.url.toLowerCase().includes(lowerQuery)) {
                       commandResults.push({ type: 'Tab', title: t.title, url: t.url, action: () => { setActiveTabId(t.id); setShowCommandPalette(false); }});
                    }
                  });
                  bookmarks.forEach(b => {
                    if (b.title.toLowerCase().includes(lowerQuery) || b.url.toLowerCase().includes(lowerQuery)) {
                       commandResults.push({ type: 'Bookmark', title: b.title, url: b.url, action: () => { navigate(b.url); setShowCommandPalette(false); }});
                    }
                  });
                  history.forEach(h => {
                    if (h.title.toLowerCase().includes(lowerQuery) || h.url.toLowerCase().includes(lowerQuery)) {
                       commandResults.push({ type: 'History', title: h.title, url: h.url, action: () => { navigate(h.url); setShowCommandPalette(false); }});
                    }
                  });

                  // Filter out exact duplicates based on URL just for display
                  const uniqueResults = commandResults.filter((v,i,a)=>a.findIndex(v2=>(v2.url===v.url))===i).slice(0, 10);

                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setCommandSelectionIndex(prev => Math.min(prev + 1, uniqueResults.length - 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setCommandSelectionIndex(prev => Math.max(prev - 1, 0));
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (uniqueResults[commandSelectionIndex]) {
                       uniqueResults[commandSelectionIndex].action();
                    } else if (commandQuery.trim().length > 0) {
                       navigate(commandQuery);
                       setShowCommandPalette(false);
                    }
                  } else if (e.key === 'Escape') {
                    setShowCommandPalette(false);
                  }
                }}
              />
            </div>

            <div className="command-palette-results">
              {(() => {
                  const lowerQuery = commandQuery.toLowerCase();
                  const commandResults: {type: string, title: string, url: string, action: () => void}[] = [];
                  tabs.forEach(t => {
                    if (t.title.toLowerCase().includes(lowerQuery) || t.url.toLowerCase().includes(lowerQuery)) {
                       commandResults.push({ type: 'Tab', title: t.title, url: t.url, action: () => { setActiveTabId(t.id); setShowCommandPalette(false); }});
                    }
                  });
                  bookmarks.forEach(b => {
                    if (b.title.toLowerCase().includes(lowerQuery) || b.url.toLowerCase().includes(lowerQuery)) {
                       commandResults.push({ type: 'Bookmark', title: b.title, url: b.url, action: () => { navigate(b.url); setShowCommandPalette(false); }});
                    }
                  });
                  history.forEach(h => {
                    if (h.title.toLowerCase().includes(lowerQuery) || h.url.toLowerCase().includes(lowerQuery)) {
                       commandResults.push({ type: 'History', title: h.title, url: h.url, action: () => { navigate(h.url); setShowCommandPalette(false); }});
                    }
                  });
                  const uniqueResults = commandResults.filter((v,i,a)=>a.findIndex(v2=>(v2.url===v.url))===i).slice(0, 10);

                  return uniqueResults.map((res, i) => (
                    <div
                      key={i}
                      className={`command-item ${commandSelectionIndex === i ? 'selected' : ''}`}
                      onClick={() => res.action()}
                      onMouseEnter={() => setCommandSelectionIndex(i)}
                    >
                       <div className="command-item-type">{res.type}</div>
                       <div className="command-item-info">
                         <div className="command-item-title">{res.title}</div>
                         <div className="command-item-url">{res.url}</div>
                       </div>
                    </div>
                  ));
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Bookmarks Bar */}
      {settings.showBookmarksBar && !settings.verticalTabs && bookmarks.length > 0 && (
        <div className="bookmarks-bar" data-testid="bookmarks-bar" aria-label="Bookmarks bar">
          <span className="bookmarks-bar-label"><Bookmark size={13} /> Bookmarks</span>
          <div className="bookmarks-bar-items">
            {bookmarks.map((b, i) => (
              <button
                key={i}
                type="button"
                className="bookmarks-bar-item"
                data-testid="bookmark-bar-item"
                title={b.title + '\n' + b.url}
                aria-label={`Open bookmark ${b.title}`}
                onClick={() => navigate(b.url)}
              >
                <Globe size={13} aria-hidden="true" />
                <span>{b.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="content-area" style={{ display: 'flex', flexDirection: 'row', flex: 1, overflow: 'hidden' }}>

        {settings.verticalTabs && (
          <div className="vertical-tabs-sidebar" style={{
            width: '240px',
            background: 'var(--bg-color)',
            borderRight: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto'
          }}>
            <div style={{ padding: '8px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Tabs</span>
              <button className="nav-btn" onClick={() => createTab(isPrivateWindow)}><Plus size={14} /></button>
            </div>
            <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {[...tabs].filter(t => (t.workspaceId || 'default') === activeWorkspaceId).sort((a, b) => {
                if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
                if (a.groupId !== b.groupId) return (a.groupId || '') > (b.groupId || '') ? 1 : -1;
                return 0;
              }).map((tab, i, arr) => {
                const group = tab.groupId ? tabGroups.find(g => g.id === tab.groupId) : null;
                const isFirstInGroup = group && (i === 0 || arr[i - 1].groupId !== tab.groupId);

                return (
                <React.Fragment key={tab.id}>
                  {isFirstInGroup && (
                     <div style={{
                        display: 'flex', alignItems: 'center', padding: '2px 8px', margin: '4px 0',
                        borderRadius: '6px', backgroundColor: group.color, color: '#fff',
                        fontSize: '11px', fontWeight: 'bold'
                     }}>
                        {group.name}
                     </div>
                  )}
                <div
                  className={`tab vertical-tab ${tab.id === activeTabId ? 'active' : ''} ${tab.isPrivate ? 'private' : ''} ${tab.isPinned ? 'pinned' : ''} ${tab.suspended ? 'suspended' : ''}`}
                  role="tab"
                  tabIndex={0}
                  aria-selected={tab.id === activeTabId}
                  aria-label={`${tab.title}${tab.suspended ? ', suspended' : ''}`}
                  style={{
                     display: 'flex',
                     alignItems: 'center',
                     padding: '8px',
                     borderRadius: '6px',
                     cursor: 'default',
                     background: tab.id === activeTabId ? 'var(--tab-active-bg)' : 'transparent',
                     borderLeft: group ? `3px solid ${group.color}` : '1px solid transparent',
                     userSelect: 'none'
                  }}
                  onClick={() => setActiveTabId(tab.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setActiveTabId(tab.id);
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setTabContextMenu({ tabId: tab.id, x: e.clientX, y: e.clientY });
                  }}
                  draggable
                  onDragStart={(e) => {
                    setDraggedTabId(tab.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (!draggedTabId || draggedTabId === tab.id) return;
                    setTabs(prev => {
                      const draggedIndex = prev.findIndex(t => t.id === draggedTabId);
                      const dropIndex = prev.findIndex(t => t.id === tab.id);
                      if (draggedIndex === -1 || dropIndex === -1) return prev;
                      const newTabs = [...prev];
                      const [removed] = newTabs.splice(draggedIndex, 1);
                      newTabs.splice(dropIndex, 0, removed);
                      return newTabs;
                    });
                    setDraggedTabId(null);
                  }}
                  onDragEnd={() => setDraggedTabId(null)}
                  onMouseDown={(e) => {
                    if (e.button === 1) { // Middle click
                      closeTab(e, tab.id);
                    }
                  }}
                >
                  {tab.isPrivate && <EyeOff size={10} style={{marginRight: '8px', opacity: 0.8}} />}
                  {!tab.isPrivate && (
                    tab.favicon
                      ? <img src={tab.favicon} style={{width: 16, height: 16, marginRight: 8, flexShrink: 0}} />
                      : <Globe size={16} style={{marginRight: 8, opacity: 0.7, flexShrink: 0}} />
                  )}
                  {tab.loading && <span className="tab-loading-indicator" role="status" aria-label="Loading tab"><span /></span>}
                  {tab.loadError && <span className="tab-error-indicator" title={tab.loadError.description} aria-label="Page failed to load"><AlertCircle size={12} /></span>}

                  <span className="tab-title" title={tab.title} style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '13px', color: tab.id === activeTabId ? 'var(--text-color)' : 'var(--text-muted)' }}>
                    {tab.title}
                  </span>
                  {tab.suspended && <span className="tab-suspended-badge">Suspended</span>}

                  {(tab.isAudible || tab.isMuted) && (
                    <div
                      className="tab-audio-indicator"
                      style={{marginLeft: '4px', display: 'flex', alignItems: 'center', opacity: 0.8, cursor: 'pointer'}}
                      onClick={(e) => {
                        e.stopPropagation();
                        const wv = webviewRefs.current[tab.id];
                        if (wv) {
                          const newMutedState = !tab.isMuted;
                          wv.setAudioMuted(newMutedState);
                          updateTab(tab.id, { isMuted: newMutedState });
                        }
                      }}
                    >
                      {tab.isMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
                    </div>
                  )}

                  <button className="tab-close" type="button" aria-label={`Close ${tab.title}`} onClick={(e) => closeTab(e, tab.id)}>
                    <X size={12} />
                  </button>
                </div>
                </React.Fragment>
              )})}
            </div>
          </div>
        )}

        <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>

        {showFind && (
          <div className="find-bar">
            <input
              ref={findInputRef}
              type="text"
              placeholder={t('findInPage', settings.language)}
              value={findText}
              onChange={e => handleFind(e.target.value)}
              onKeyDown={handleFindKeyDown}
              className="find-input"
            />
            <span className="find-count">
              {findResult.matches > 0 ? `${findResult.activeMatchOrdinal} / ${findResult.matches}` : '0 / 0'}
            </span>
            <div className="find-actions">
              <button className="nav-btn" onClick={() => handleFind(findText, false, true)} disabled={!findText}>
                <ChevronUp size={16} />
              </button>
              <button className="nav-btn" onClick={() => handleFind(findText, true, true)} disabled={!findText}>
                <ChevronDown size={16} />
              </button>
              <div className="find-divider" />
              <button className="nav-btn" onClick={closeFind}>
                <X size={16} />
              </button>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'row', flex: 1, width: '100%', height: '100%' }}>
        {tabs.map(tab => tab.url !== 'probaho://newtab' && !tab.isPdf && !tab.suspended && (!settings.lazyLoadTabs || tab.id === activeTabId || tab.id === splitTabId) && (
          <div key={`container-${tab.id}`} style={{
              flex: 1, display: 'flex', position: 'relative',
              borderRight: tab.id === activeTabId && splitTabId ? '2px solid var(--border-color)' : 'none',
              boxShadow: focusedPane === 'main' && tab.id === activeTabId && splitTabId ? 'inset 0 0 0 2px var(--primary-color)' : (focusedPane === 'split' && tab.id === splitTabId ? 'inset 0 0 0 2px var(--primary-color)' : 'none')
          }} onClick={() => { if (splitTabId) setFocusedPane(tab.id === activeTabId ? 'main' : 'split'); }}>
            <webview // @ts-ignore
              src="about:blank"
              className="active"
              ref={(el: any) => handleWebviewRef(tab.id, el, tab.url)}
              webpreferences="contextIsolation=yes, nodeIntegration=no"
              partition={tab.isPrivate ? `private-${tab.id}` : undefined}
              style={{ flex: 1, border: 'none', width: '100%', height: '100%' }}
            />
            {tab.loading && !tab.loadError && (tab.id === activeTabId || tab.id === splitTabId) && (
              <div className="page-loading-overlay" data-testid={`loading-overlay-${tab.id}`} role="status" aria-live="polite">
                <div className="page-loading-card">
                  <span className="page-loading-spinner" aria-hidden="true" />
                  <div><strong>Loading page</strong><span>Connecting securely…</span></div>
                </div>
              </div>
            )}
            {tab.loadError && (tab.id === activeTabId || tab.id === splitTabId) && (
              <div className="load-error-overlay" data-testid={`load-error-${tab.id}`} role="alert">
                <div className="load-error-card">
                  <div className="load-error-icon"><AlertCircle size={22} /></div>
                  <span className="load-error-kicker">Navigation interrupted</span>
                  <h2>We couldn’t load this page</h2>
                  <p>{tab.loadError.description}</p>
                  <code>{tab.loadError.url}</code>
                  <div className="load-error-actions">
                    <button className="load-error-primary" type="button" onClick={() => retryTab(tab)}><RotateCw size={14} /> Try again</button>
                    <button className="load-error-secondary" type="button" onClick={() => recoverTabHome(tab)}><Home size={14} /> Go to home</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}


        {tabs.map(tab => tab.isPdf && (tab.id === activeTabId || tab.id === splitTabId) && (
           <div key={`pdf-${tab.id}`} style={{
              flex: 1, height: '100%', position: 'relative',
              borderRight: tab.id === activeTabId && splitTabId ? '2px solid var(--border-color)' : 'none',
              boxShadow: focusedPane === 'main' && tab.id === activeTabId && splitTabId ? 'inset 0 0 0 2px var(--primary-color)' : (focusedPane === 'split' && tab.id === splitTabId ? 'inset 0 0 0 2px var(--primary-color)' : 'none')
           }} onClick={() => { if (splitTabId) setFocusedPane(tab.id === activeTabId ? 'main' : 'split'); }}>
              <PdfViewer url={tab.url} />
           </div>
        ))}

        {tabs.map(tab => tab.url === 'probaho://newtab' && (tab.id === activeTabId || tab.id === splitTabId) && (
          <div
            key={`ntp-${tab.id}`}
            className="new-tab-page"
            data-testid="new-tab-page"
            onClick={() => { if (splitTabId) setFocusedPane(tab.id === activeTabId ? 'main' : 'split'); }}
            style={Object.assign({
              flex: 1, position: 'relative' as 'relative',
              borderRight: tab.id === activeTabId && splitTabId ? '2px solid var(--border-color)' : 'none',
              boxShadow: focusedPane === 'main' && tab.id === activeTabId && splitTabId ? 'inset 0 0 0 2px var(--primary-color)' : (focusedPane === 'split' && tab.id === splitTabId ? 'inset 0 0 0 2px var(--primary-color)' : 'none')
            }, settings.newTabBackgroundUrl ? {
              backgroundImage: `url('${settings.newTabBackgroundUrl}')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            } : {})}
          >
            <div style={{
              width: '100%',
              height: '100%',
              backgroundColor: settings.newTabBackgroundUrl ? 'rgba(0,0,0,0.6)' : 'transparent',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}>
              <div className="ntp-content" data-testid="ntp-content">
                <div className="ntp-header-row">
                  <div className="ntp-logo" style={settings.newTabBackgroundUrl ? { color: '#fff' } : {}}>
                    <span className="ntp-eyebrow"><span className="ntp-eyebrow-dot" /> Personal workspace</span>
                    <div className="ntp-brand-row">
                      <span className="ntp-logo-mark" aria-hidden="true">🌐</span>
                      <h1>PROBAHO</h1>
                    </div>
                    <p className="ntp-tagline">A calmer, faster space for the web</p>
                  </div>
                  <div className="ntp-protection-card" data-testid="ntp-privacy-card">
                    <div className="ntp-protection-icon"><ShieldCheck size={17} /></div>
                    <div>
                      <strong>Shields active</strong>
                      <span>{tab.blockedCount || 0} trackers blocked on this tab</span>
                    </div>
                  </div>
                </div>

                <form className="ntp-search" role="search" onSubmit={(e) => {
                  e.preventDefault();
                  const query = (e.currentTarget.elements.namedItem('ntp-query') as HTMLInputElement)?.value || '';
                  navigate(query);
                }}>
                  <div className="ntp-search-heading"><span>Explore the web</span><kbd>Enter</kbd></div>
                  <label className="sr-only" htmlFor={`ntp-search-${tab.id}`}>Search the web</label>
                  <Search className="ntp-search-icon" size={18} aria-hidden="true" />
                  <input
                    id={`ntp-search-${tab.id}`}
                    name="ntp-query"
                    type="text"
                    className="ntp-search-input"
                    data-testid="ntp-search-input"
                    aria-label="Search the web"
                    placeholder={t('searchPlaceholder', settings.language, { engine: settings.defaultSearchEngine })}
                    autoFocus
                  />
                  <span className="ntp-search-engine">{settings.defaultSearchEngine}</span>
                </form>

                <div className="ntp-quick-actions" data-testid="ntp-quick-actions">
                  <button type="button" className="ntp-quick-action" data-testid="ntp-history-action" onClick={() => setShowHistory(true)}><History size={15} /><span>History</span></button>
                  <button type="button" className="ntp-quick-action" data-testid="ntp-bookmarks-action" onClick={() => setShowBookmarks(true)}><Bookmark size={15} /><span>Bookmarks</span></button>
                  <button type="button" className="ntp-quick-action" data-testid="ntp-downloads-action" onClick={() => setShowDownloads(true)}><Download size={15} /><span>Downloads</span></button>
                  <button type="button" className="ntp-quick-action" data-testid="ntp-settings-action" onClick={() => setShowSettings(true)}><Settings size={15} /><span>Settings</span></button>
                </div>

                <div className="ntp-dashboard">
                  <section className="ntp-section ntp-top-sites-section" aria-labelledby={`ntp-top-sites-title-${tab.id}`}>
                    <div className="ntp-section-heading">
                      <div><span className="ntp-section-kicker">Your rhythm</span><h2 id={`ntp-top-sites-title-${tab.id}`}>Top sites</h2></div>
                      <span className="ntp-section-count">{history.length ? `${Math.min(8, new Set(history.map(h => { try { return new URL(h.url).hostname; } catch { return h.url; } })).size)} saved` : 'Ready when you are'}</span>
                    </div>
                    <div className="ntp-top-sites">
                      {(() => {
                        const siteCounts: Record<string, {count: number, title: string, url: string}> = {};
                        history.forEach(h => {
                          try {
                            const domain = new URL(h.url).hostname;
                            if (!siteCounts[domain]) siteCounts[domain] = { count: 0, title: h.title || domain, url: h.url };
                            siteCounts[domain].count++;
                          } catch (e) {}
                        });
                        const topSites = Object.values(siteCounts).sort((a, b) => b.count - a.count).slice(0, 8);
                        if (topSites.length === 0) {
                          return <div className="ntp-empty-state" data-testid="ntp-top-sites-empty"><div className="ntp-empty-icon"><Globe size={18} /></div><div><strong>Your shortcuts will appear here</strong><span>Visit a few sites to build your personal launchpad.</span></div></div>;
                        }
                        return topSites.map((site, i) => (
                          <button key={i} type="button" data-testid="ntp-top-site" className="ntp-tile" onClick={() => navigate(site.url)}>
                            <span className="ntp-tile-icon">{site.title.charAt(0).toUpperCase()}</span>
                            <span className="ntp-tile-title">{site.title || site.url}</span>
                            <span className="ntp-tile-domain">{site.count} visit{site.count === 1 ? '' : 's'}</span>
                          </button>
                        ));
                      })()}
                    </div>
                  </section>

                  <section className="ntp-section ntp-bookmarks-preview" data-testid="ntp-bookmarks-preview" aria-labelledby={`ntp-bookmarks-title-${tab.id}`}>
                    <div className="ntp-section-heading">
                      <div><span className="ntp-section-kicker">Saved for later</span><h2 id={`ntp-bookmarks-title-${tab.id}`}>Bookmarks</h2></div>
                      <button type="button" className="ntp-section-link" onClick={() => setShowBookmarks(true)}>View all <ChevronUp size={13} /></button>
                    </div>
                    {bookmarks.length === 0 ? (
                      <button type="button" className="ntp-empty-state ntp-empty-action" onClick={() => setShowBookmarks(true)}><div className="ntp-empty-icon"><Bookmark size={18} /></div><div><strong>Keep something close</strong><span>Open your bookmarks panel to add and manage saved pages.</span></div></button>
                    ) : (
                      <div className="ntp-bookmark-list">
                        {bookmarks.slice(0, 4).map((bookmark, index) => (
                          <button key={`${bookmark.url}-${index}`} type="button" className="ntp-bookmark-row" onClick={() => navigate(bookmark.url)}>
                            <span className="ntp-bookmark-row-icon"><Globe size={14} /></span>
                            <span className="ntp-bookmark-row-copy"><strong>{bookmark.title}</strong><span>{bookmark.url}</span></span>
                            <ChevronUp className="ntp-bookmark-row-arrow" size={13} />
                          </button>
                        ))}
                      </div>
                    )}
                  </section>
                </div>

                <div className="ntp-footer-note"><ShieldCheck size={14} /><span>Private by default. Your shortcuts and preferences stay on this device.</span><button type="button" onClick={() => setShowSettings(true)}>Manage settings</button></div>
              </div>
            </div>
          </div>
        ))}

        {tabs.map(tab => (tab.id === activeTabId || tab.id === splitTabId) && tab.crashed && (
          <div key={`crash-${tab.id}`} className="crash-overlay" style={{
            flex: 1, position: 'relative',
            borderRight: tab.id === activeTabId && splitTabId ? '2px solid var(--border-color)' : 'none',
            boxShadow: focusedPane === 'main' && tab.id === activeTabId && splitTabId ? 'inset 0 0 0 2px var(--primary-color)' : (focusedPane === 'split' && tab.id === splitTabId ? 'inset 0 0 0 2px var(--primary-color)' : 'none')
          }} onClick={() => { if (splitTabId) setFocusedPane(tab.id === activeTabId ? 'main' : 'split'); }}>
            <div className="crash-content">
              <h2>{t('awSnap', settings.language)}</h2>
              <p>{t('crashedDesc', settings.language)}</p>
              <button
                className="clear-history-btn"
                style={{padding: '8px 16px', fontSize: '14px', marginTop: '16px', background: 'var(--primary-color)', border: 'none'}}
                onClick={() => {
                  const wv = webviewRefs.current[tab.id];
                  if (wv) wv.reload();
                  updateTab(tab.id, { crashed: false });
                }}
              >
                Reload Tab
              </button>
            </div>
          </div>
        ))}
        </div>
      </div>
    </div>
    </div>
    </div>
  );
}

export default App;
