import React, { useState, useEffect, useRef } from 'react';
import { t, Language } from './i18n';
import PdfViewer from './PdfViewer';
import {
  ArrowLeft, ArrowRight, RotateCw, Home, Plus,
  Lock, X, Square, Search, Star, Bookmark, Menu, History, ZoomIn, FileCode, Printer, LogOut, Info, Download, Folder, Settings, ChevronUp, ChevronDown, EyeOff, Shield, BookOpen, Volume2, VolumeX, Globe, BookPlus, PictureInPicture, Share2, MessageSquare, Music, MessageCircle, Library, Columns, PanelRight
} from 'lucide-react';

interface DownloadItem {
  id: string;
  fileName: string;
  state: 'progressing' | 'completed' | 'cancelled' | 'interrupted' | 'paused';
  receivedBytes: number;
  totalBytes: number;
  savePath: string;
}

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
  isPrivate?: boolean;
  crashed?: boolean;
  isPdf?: boolean;
  isPinned?: boolean;
  isAudible?: boolean;
  isMuted?: boolean;
  favicon?: string;
  workspaceId?: string;
  groupId?: string;
}

const DEFAULT_URL = 'https://www.google.com';

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
      showContextMenu: (params: { x: number, y: number, linkURL: string, hasImageContents?: boolean, srcURL?: string, selectionText?: string }) => void;
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
      onAppCommand?: (callback: (cmd: string) => void) => void;
      saveAsPdf?: () => void;
      onTriggerSaveAsPdf?: (callback: () => void) => void;
      executeSavePdf?: (data: ArrayBuffer) => void;
      fetchSuggestions?: (query: string) => Promise<string[]>;
      setAdBlocker: (enabled: boolean) => void;
      onAdBlocked: (callback: (webContentsId: number) => void) => void;
      onTabCrashed: (callback: (webContentsId: number, reason: string) => void) => void;
      onOpenPdfViewer: (callback: (url: string, webContentsId?: number) => void) => void;
      clearCache?: () => void;
      getPermissions?: () => Promise<Record<string, Record<string, boolean>>>;
      deletePermission?: (origin: string, permission: string) => void;
      cancelDownload?: (id: string) => void;
      pauseDownload?: (id: string) => void;
      resumeDownload?: (id: string) => void;
      openPrivateWindow?: () => void;
      openNewWindow?: () => void;
      loadExtension?: () => Promise<string | null>;
      getPassword?: (origin: string) => Promise<any>;
      savePassword?: (origin: string, creds: any) => void;
    };
  }
}

function App() {
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
          accentColor: '#7b2cbf'
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
      accentColor: '#7b2cbf'
    };
    settingsRef.current = def;
    return def;
  });

  const isPrivateWindow = window.location.search.includes('private=true');
  const [webPanels] = useState([
    { id: 'chatgpt', title: 'ChatGPT', url: 'https://chat.openai.com', icon: MessageSquare },
    { id: 'spotify', title: 'Spotify', url: 'https://open.spotify.com', icon: Music },
    { id: 'whatsapp', title: 'WhatsApp', url: 'https://web.whatsapp.com', icon: MessageCircle },
    { id: 'wikipedia', title: 'Wikipedia', url: 'https://wikipedia.org', icon: Library }
  ]);
  const [activePanelId, setActivePanelId] = useState<string | null>(null);

  const [workspaces, setWorkspaces] = useState<{id: string, name: string}[]>(() => {
    const saved = localStorage.getItem('workspaces');
    return saved ? JSON.parse(saved) : [{id: 'default', name: 'Personal'}];
  });
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(() => {
    return localStorage.getItem('activeWorkspaceId') || 'default';
  });

  const [tabGroups, setTabGroups] = useState<{id: string, name: string, color: string}[]>(() => {
    const saved = localStorage.getItem('tabGroups');
    return saved ? JSON.parse(saved) : [];
  });

  const [splitTabId, setSplitTabId] = useState<string | null>(null);
  const [focusedPane, setFocusedPane] = useState<'main' | 'split'>('main');

  const [tabs, setTabs] = useState<Tab[]>(() => {
    if (isPrivateWindow) {
      return [{
        id: Date.now().toString(),
        url: settingsRef.current?.homepageUrl || 'probaho://newtab',
        title: t('newPrivateTab', settingsRef.current?.language || 'en'),
        loading: false,
        canGoBack: false,
        canGoForward: false,
        isSecure: true,
        zoomLevel: 1,
        blockedCount: 0,
        isPrivate: true
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
            blockedCount: 0
          }));
        }
      }
    } catch (e) {}
    let initialUrl = settingsRef.current?.homepageUrl || 'https://www.google.com';
    return [{
      id: Date.now().toString(),
      url: initialUrl,
      title: t('newTab', settingsRef.current?.language || 'en'),
      loading: false,
      canGoBack: false,
      canGoForward: false,
      isSecure: true,
      zoomLevel: 1,
      blockedCount: 0,
      isPrivate: false
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
    const saved = localStorage.getItem('bookmarks');
    return saved ? JSON.parse(saved) : [];
  });
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [readingList, setReadingList] = useState<{title: string, url: string, content: string, savedAt: string}[]>(() => {
    const saved = localStorage.getItem('readingList');
    return saved ? JSON.parse(saved) : [];
  });
  const [showReadingList, setShowReadingList] = useState(false);
  const [history, setHistory] = useState<{title: string, url: string, time: string}[]>(() => {
    const saved = localStorage.getItem('history');
    return saved ? JSON.parse(saved) : [];
  });
  const [showHistory, setShowHistory] = useState(false);
  const [showDownloads, setShowDownloads] = useState(false);
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [permissions, setPermissions] = useState<Record<string, Record<string, boolean>>>({});
  const [showMenu, setShowMenu] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [showShields, setShowShields] = useState(false);
  const [showMediaControls, setShowMediaControls] = useState(false);
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<{title: string, url: string}[]>([]);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fetchAbortControllerRef = useRef<AbortController | null>(null);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [commandSelectionIndex, setCommandSelectionIndex] = useState(0);
  const [recentlyClosed, setRecentlyClosed] = useState<{title: string, url: string}[]>([]);

  useEffect(() => {
    localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
  }, [bookmarks]);

  useEffect(() => {
    localStorage.setItem('readingList', JSON.stringify(readingList));
  }, [readingList]);

  useEffect(() => {
    localStorage.setItem('history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    settingsRef.current = settings;
    localStorage.setItem('probaho-settings', JSON.stringify(settings));
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
  }, [settings]);

  useEffect(() => {
    if (window.electronAPI?.onAdBlocked) {
      window.electronAPI.onAdBlocked((webContentsId) => {
        setTabs(prev => prev.map(t => {
          if (t.webContentsId === webContentsId) {
            return { ...t, blockedCount: t.blockedCount + 1 };
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
        setTabs(prev => prev.map(t => t.webContentsId === webContentsId ? { ...t, crashed: true } : t));
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
      id: Date.now().toString(),
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
    localStorage.setItem('workspaces', JSON.stringify(workspaces));
  }, [workspaces]);

  useEffect(() => {
    localStorage.setItem('activeWorkspaceId', activeWorkspaceId);
  }, [activeWorkspaceId]);

  useEffect(() => {
    localStorage.setItem('tabGroups', JSON.stringify(tabGroups));
  }, [tabGroups]);

  const targetedTabId = focusedPane === 'split' && splitTabId ? splitTabId : activeTabId;

  // Keep a ref of the active tab id to avoid stale closures in event listeners
  const activeTabIdRef = useRef<string>(activeTabId);
  useEffect(() => {
    activeTabIdRef.current = targetedTabId;
  }, [targetedTabId]);

  const activeDownloads = downloads.filter(d => d.state === 'progressing');
  const hasActiveDownloads = activeDownloads.length > 0;
  let totalDownloadProgress = 0;
  if (hasActiveDownloads) {
    const totalBytes = activeDownloads.reduce((acc, curr) => acc + curr.totalBytes, 0);
    const receivedBytes = activeDownloads.reduce((acc, curr) => acc + curr.receivedBytes, 0);
    totalDownloadProgress = totalBytes > 0 ? (receivedBytes / totalBytes) * 100 : 0;
  }

  const webviewRefs = useRef<{ [key: string]: any }>({});

  useEffect(() => {
    const handleNewTab = () => {
      const newTab = {
        id: Date.now().toString(),
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
        }
      });
    }

    if (window.electronAPI?.onOpenLinkNewTab) {
      window.electronAPI.onOpenLinkNewTab((url) => {
        const newTab = {
          id: Date.now().toString(),
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
      id: Date.now().toString(),
      url: settingsRef.current?.homepageUrl || 'https://www.google.com',
      title: isPrivate ? t('newPrivateTab', settings.language) : t('newTab', settings.language),
      loading: false,
      canGoBack: false,
      canGoForward: false,
      isSecure: true,
      zoomLevel: 1,
      blockedCount: 0,
      isPrivate: isPrivate,
      workspaceId: activeWorkspaceId
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
            id: Date.now().toString(),
            url: toRestore.url,
            title: toRestore.title,
            loading: false,
            canGoBack: false,
            canGoForward: false,
            isSecure: toRestore.url.startsWith('https'),
            zoomLevel: 1,
            blockedCount: 0,
            isPrivate: isPrivateWindow
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

  const handleWebviewRef = (id: string, el: any, initialUrl: string) => {
    // Handle React unmount / StrictMode double-mount: clean up old ref
    if (!el) {
      delete webviewRefs.current[id];
      return;
    }

    // Always update ref to latest element (handles StrictMode re-mount)
    webviewRefs.current[id] = el;

    // Wait for the webview to fully attach to the Electron process
    const loadWhenReady = (url: string) => {
      const tryLoad = () => {
        try {
          if (el.getURL() === 'about:blank' || !el.getURL()) {
            el.loadURL(url);
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
      loadWhenReady(initialUrl);
    }

    // Event: loading started
    el.addEventListener('did-start-loading', () => {
      updateTab(id, { loading: true, crashed: false });
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
          if (confirm('Save password for ' + origin + '?')) {
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
        if (currentUrl && currentUrl.startsWith('http')) {
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
      updateTab(id, {
        canGoBack: el.canGoBack(),
        canGoForward: el.canGoForward()
      });
    });

    // Event: navigation FAILED (NEW - Bug 5 fix)
    el.addEventListener('did-fail-load', (e: any) => {
      if (e.isMainFrame && e.errorCode !== -3 && !e.validatedURL.startsWith('probaho://') && e.validatedURL !== '' && e.validatedURL !== 'about:blank') { // -3 is aborted, not a real error
        console.error('Navigation failed:', e.errorCode, e.errorDescription, e.validatedURL);
        updateTab(id, { loading: false, title: t('error', settingsRef.current?.language || 'en') });
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
        selectionText: e.params.selectionText
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
        id: Date.now().toString(),
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
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('file://')) {
      if (url.includes('.') && !url.includes(' ') && !url.startsWith('localhost')) {
        finalUrl = `https://${url}`;
      } else {
        if (settings.defaultSearchEngine === 'Bing') {
          finalUrl = `https://www.bing.com/search?q=${encodeURIComponent(url)}`;
        } else if (settings.defaultSearchEngine === 'DuckDuckGo') {
          finalUrl = `https://duckduckgo.com/?q=${encodeURIComponent(url)}`;
        } else {
          finalUrl = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
        }
      }
    }

    updateTab(targetedTabId, { url: finalUrl, isPdf: false });

    if (finalUrl.toLowerCase().endsWith('.pdf')) {
      updateTab(targetedTabId, { url: finalUrl, isPdf: true, title: finalUrl.split('/').pop() || 'PDF Document' });
      setInputUrl(finalUrl);
      return;
    }

    const wv = webviewRefs.current[targetedTabId];
    if (wv) {
      try {
        wv.loadURL(finalUrl);
      } catch (e) {
        console.error('Error in wv.loadURL:', e);
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

  const getDomainFromUrl = (url: string) => {
    try {
      if (url.startsWith('probaho://')) return url;
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };

  const getSavedZoom = (url: string) => {
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
    };
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, [tabContextMenu, showShields, showMediaControls]);

  return (
    <div className="browser-container">
      {tabContextMenu && (
        <div className="menu-panel" style={{ position: 'fixed', left: tabContextMenu.x, top: tabContextMenu.y, zIndex: 9999 }}>
          <div className="menu-item" onClick={() => {
            const tab = tabs.find(t => t.id === tabContextMenu.tabId);
            if (tab) {
              const newTab = { ...tab, id: Date.now().toString() };
              setTabs(prev => [...prev, newTab]);
              setActiveTabId(newTab.id);
            }
          }}>
            <div className="menu-item-text">Duplicate</div>
          </div>
          <div className="menu-item" onClick={() => {
            const tab = tabs.find(t => t.id === tabContextMenu.tabId);
            if (tab) updateTab(tab.id, { isPinned: !tab.isPinned });
          }}>
            <div className="menu-item-text">{tabs.find(t => t.id === tabContextMenu.tabId)?.isPinned ? 'Unpin Tab' : 'Pin Tab'}</div>
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
            <div className="menu-item-text">{tabs.find(t => t.id === tabContextMenu.tabId)?.isMuted ? 'Unmute Site' : 'Mute Site'}</div>
          </div>
          <div className="menu-divider" />
          <div className="menu-divider" />
          <div className="menu-item" onClick={() => {
            const name = prompt('Group Name:');
            if (name) {
               const id = Date.now().toString();
               const colors = ['#ff5252', '#4caf50', '#2196f3', '#ffeb3b', '#9c27b0', '#ff9800', '#00bcd4'];
               const color = colors[Math.floor(Math.random() * colors.length)];
               setTabGroups(prev => [...prev, { id, name, color }]);
               updateTab(tabContextMenu.tabId, { groupId: id });
            }
          }}>
            <div className="menu-item-text">Add to New Group</div>
          </div>
          {tabs.find(t => t.id === tabContextMenu.tabId)?.groupId && (
            <div className="menu-item" onClick={() => {
              updateTab(tabContextMenu.tabId, { groupId: undefined });
            }}>
              <div className="menu-item-text">Remove from Group</div>
            </div>
          )}
          <div className="menu-divider" />
          <div className="menu-item" onClick={() => {
             closeTabId(tabContextMenu.tabId);
          }}>
            <div className="menu-item-text">Close Tab</div>
          </div>
        </div>
      )}
      {/* Web Panels Sidebar (Right) - Now globally scoped outside content area */}
      <div className="web-panels-sidebar" style={{ position: 'absolute', right: 0, top: 0, bottom: 0, zIndex: 150 }}>
         <div className="web-panels-icons">
           {webPanels.map(panel => (
              <button
                key={panel.id}
                className={`web-panel-btn ${activePanelId === panel.id ? 'active' : ''}`}
                title={panel.title}
                onClick={() => setActivePanelId(activePanelId === panel.id ? null : panel.id)}
              >
                 <panel.icon size={20} strokeWidth={1.5} />
              </button>
           ))}
         </div>
      </div>

      {/* Web Panel Slide-out View */}
      {activePanelId && (
        <div className="web-panel-view" style={{ position: 'absolute', right: '48px', top: 0, bottom: 0, zIndex: 149 }}>
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
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginRight: '48px' }}>

      {/* Titlebar with tabs */}
      <div className="titlebar" style={settings.verticalTabs ? { paddingLeft: '80px', height: '40px' } : {}}>

        {/* Workspaces Selector */}
        <div style={{ padding: '0 8px', display: 'flex', alignItems: 'center' }}>
          <select
            value={activeWorkspaceId}
            onChange={(e) => {
               const newWorkspaceId = e.target.value;
               if (newWorkspaceId === 'new_workspace') {
                 const name = prompt('Workspace Name:');
                 if (name) {
                    const id = Date.now().toString();
                    setWorkspaces(prev => [...prev, {id, name}]);
                    setActiveWorkspaceId(id);
                    // create first tab in new workspace
                    const newTab: Tab = {
                      id: Date.now().toString(),
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
                      id: Date.now().toString(),
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
              className={`tab ${tab.id === activeTabId ? 'active' : ''} ${tab.isPrivate ? 'private' : ''} ${tab.isPinned ? 'pinned' : ''}`}
              style={{ borderTop: group ? `3px solid ${group.color}` : undefined }}
              onClick={() => setActiveTabId(tab.id)}
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

              {!tab.isPinned && <span className="tab-title" title={tab.title}>{tab.title}</span>}
              {!tab.isPinned && (
                <div className="tab-close" onClick={(e) => closeTab(e, tab.id)}>
                  <X size={12} />
                </div>
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
          <button className="new-tab-btn" onClick={() => createTab(isPrivateWindow)}>
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
      <div className="toolbar">
        <div className="nav-buttons">
          <button className="nav-btn" onClick={goBack} disabled={!targetedTab?.canGoBack}>
            <ArrowLeft size={16} />
          </button>
          <button className="nav-btn" onClick={goForward} disabled={!targetedTab?.canGoForward}>
            <ArrowRight size={16} />
          </button>
          {targetedTab?.loading ? (
            <button className="nav-btn" onClick={() => {
              const wv = webviewRefs.current[targetedTabId];
              if (wv) wv.stop();
            }}>
              <X size={16} />
            </button>
          ) : (
            <button className="nav-btn" onClick={reload}>
              <RotateCw size={16} />
            </button>
          )}
          <button className="nav-btn" onClick={goHome}>
            <Home size={16} />
          </button>
          <button className="nav-btn" title="Split View" onClick={() => {
            if (splitTabId) {
              setSplitTabId(null);
              setFocusedPane('main');
            } else {
              const newTab: Tab = {
                id: Date.now().toString(),
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

        <form className="address-bar-container" onSubmit={onSubmit} style={{position: 'relative'}}>
          <div className="security-icon">
            {targetedTab?.isSecure ? <Lock size={14} color="#4caf50" /> : <Search size={14} />}
          </div>
          <input
            ref={addressInputRef}
            className="address-input"
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
                         const suggestionUrl = settings.defaultSearchEngine === 'Bing' ? `https://www.bing.com/search?q=${encodeURIComponent(s)}` : settings.defaultSearchEngine === 'DuckDuckGo' ? `https://duckduckgo.com/?q=${encodeURIComponent(s)}` : `https://www.google.com/search?q=${encodeURIComponent(s)}`;
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
          <div className="shield-container" title={t('blockedAds', settings.language, { count: targetedTab?.blockedCount || 0 })} onClick={(e) => { e.stopPropagation(); setShowBookmarks(false); setShowHistory(false); setShowMenu(false); setShowReadingList(false); setShowDownloads(false); setShowShields(!showShields); }} style={{ cursor: 'pointer' }}>
            <Shield size={16} color={!settings.adBlockerEnabled ? '#d32f2f' : (targetedTab && targetedTab.blockedCount > 0 ? '#4caf50' : '#888')} />
            {settings.adBlockerEnabled && targetedTab && targetedTab.blockedCount > 0 && <span className="shield-count">{targetedTab.blockedCount}</span>}
          </div>

          {showShields && (
            <div className="downloads-popout" onClick={(e) => e.stopPropagation()} style={{
              position: 'absolute', top: '100%', right: 0, width: '280px',
              background: 'var(--bg-color)', border: '1px solid var(--border-color)',
              borderRadius: '8px', zIndex: 150, boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
              marginTop: '8px', padding: '16px'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '16px' }}>
                <Shield size={32} color={!settings.adBlockerEnabled ? '#d32f2f' : '#4caf50'} />
                <h3 style={{ margin: 0, fontSize: '16px' }}>{targetedTab?.blockedCount || 0}</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-color)', opacity: 0.8 }}>Trackers & ads blocked on this site</span>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
                <span>Shields (Global)</span>
                <input
                  type="checkbox"
                  checked={settings.adBlockerEnabled !== false}
                  onChange={e => setSettings({...settings, adBlockerEnabled: e.target.checked})}
                />
              </label>
            </div>
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

        <div style={{ position: 'relative' }}>
          <button
            className="nav-btn"
            style={{ position: 'relative' }}
            onClick={() => { setShowBookmarks(false); setShowHistory(false); setShowMenu(false); setShowReadingList(false); setShowDownloads(!showDownloads); }}
          >
            <Download size={16} />
            {hasActiveDownloads && (
              <div style={{ position: 'absolute', bottom: 0, left: 0, height: '3px', backgroundColor: '#4caf50', width: `${totalDownloadProgress}%`, transition: 'width 0.3s' }} />
            )}
          </button>

          {/* Downloads Pop-out Panel inside relative container */}
          {showDownloads && (
            <div className="downloads-popout" style={{
              position: 'absolute', top: '100%', right: 0, width: '350px',
              background: 'var(--bg-color)', border: '1px solid var(--border-color)',
              borderRadius: '8px', zIndex: 100, boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
              marginTop: '8px'
            }}>
              <div className="bookmarks-header" style={{padding: '12px 16px', borderBottom: '1px solid var(--border-color)', margin: 0}}>
                <h3 style={{margin: 0, fontSize: '14px'}}>{t('downloads', settings.language)}</h3>
                <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                  <button className="clear-history-btn" onClick={() => setDownloads([])} style={{padding: '4px 8px'}}>{t('clear', settings.language)}</button>
                </div>
              </div>
              <div className="bookmarks-list" style={{maxHeight: '300px', overflowY: 'auto', padding: '8px'}}>
                {downloads.length === 0 ? (
                  <div className="no-bookmarks" style={{padding: '16px', textAlign: 'center'}}>{t('noDownloads', settings.language)}</div>
                ) : (
                  downloads.map((d, i) => (
                    <div key={i} className="download-item" style={{marginBottom: '8px', padding: '8px', borderRadius: '6px', background: 'var(--tab-bg)', display: 'flex', justifyContent: 'space-between'}}>
                      <div className="download-info" style={{flex: 1, overflow: 'hidden'}}>
                        <div className="bookmark-title" style={{marginBottom: '4px', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{d.fileName}</div>
                        <div className="bookmark-url" style={{fontSize: '11px'}}>
                          {d.state === 'completed' ? t('completed', settings.language) :
                           d.state === 'progressing' ? `${Math.round(d.receivedBytes / 1024 / 1024 * 10) / 10} MB / ${Math.round(d.totalBytes / 1024 / 1024 * 10) / 10} MB` : d.state}
                        </div>
                        {d.state === 'progressing' && (
                          <div className="download-progress-bar" style={{marginTop: '4px'}}>
                            <div className="download-progress-fill" style={{width: `${(d.receivedBytes / d.totalBytes) * 100}%`}}></div>
                          </div>
                        )}
                      </div>
                      <div className="download-actions" style={{display: 'flex', gap: '4px', alignItems: 'center', paddingLeft: '8px'}}>
                        {d.state === 'completed' && (
                          <>
                            <button className="nav-btn" style={{width: '24px', height: '24px', padding: 0}} title={t('openFile', settings.language)} onClick={() => window.electronAPI?.openFile(d.savePath)}>
                              <FileCode size={12} />
                            </button>
                            <button className="nav-btn" style={{width: '24px', height: '24px', padding: 0}} title={t('showInFolder', settings.language)} onClick={() => window.electronAPI?.showInFolder(d.savePath)}>
                              <Folder size={12} />
                            </button>
                          </>
                        )}
                        {d.state === 'progressing' && (
                          <button className="nav-btn" style={{width: '24px', height: '24px', padding: 0}} title="Pause" onClick={() => window.electronAPI?.pauseDownload?.(d.id)}>
                            <Square size={10} style={{fill: 'currentColor'}} />
                          </button>
                        )}
                        {d.state === 'paused' && (
                          <button className="nav-btn" style={{width: '24px', height: '24px', padding: 0}} title="Resume" onClick={() => window.electronAPI?.resumeDownload?.(d.id)}>
                            <ArrowRight size={12} />
                          </button>
                        )}
                        <button className="nav-btn" style={{width: '24px', height: '24px', padding: 0}} title="Remove" onClick={() => {
                          if (d.state === 'progressing' || d.state === 'paused') {
                            window.electronAPI?.cancelDownload?.(d.id);
                          }
                          setDownloads(prev => prev.filter(item => item.id !== d.id));
                        }}>
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <button className="nav-btn" onClick={() => { setShowBookmarks(false); setShowHistory(false); setShowDownloads(false); setShowReadingList(false); setShowMenu(!showMenu); }}>
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
          <div className="menu-item" onClick={() => { setShowMenu(false); window.electronAPI?.openPrivateWindow?.(); }}>
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
        <div className="bookmarks-panel">
          <div className="bookmarks-header">
            <h3>{t('history', settings.language)}</h3>
            <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
              <button className="clear-history-btn" onClick={() => setHistory([])}>{t('clear', settings.language)}</button>
              <button className="nav-btn" onClick={() => setShowHistory(false)}><X size={16} /></button>
            </div>
          </div>
          <div className="bookmarks-list">
            {history.length === 0 ? (
              <div className="no-bookmarks">{t('noHistory', settings.language)}</div>
            ) : (
              history.map((h, i) => (
                <div key={i} className="bookmark-item" onClick={() => { navigate(h.url); setShowHistory(false); }}>
                  <div className="bookmark-title">{h.title}</div>
                  <div className="bookmark-url">{h.url} • {h.time}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}





      {/* Settings Modal */}
      {showSettings && (
        <div className="about-modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="about-modal" style={{width: '500px', maxHeight: '80vh', overflowY: 'auto'}} onClick={e => e.stopPropagation()}>
            <div className="about-header">
              <h3>{t('settings', settings.language)}</h3>
              <button className="nav-btn" onClick={() => setShowSettings(false)}><X size={16} /></button>
            </div>
            <div className="about-content" style={{textAlign: 'left', padding: '16px 24px'}}>
              <div style={{marginBottom: '16px', display: 'flex', gap: '8px'}}>
                <button className="clear-history-btn" style={{flex: 1, padding: '8px'}} onClick={() => {
                  const data = { bookmarks, history, readingList, settings };
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'probaho_profile.json';
                  a.click();
                  URL.revokeObjectURL(url);
                }}>Export Profile</button>
                <label className="clear-history-btn" style={{flex: 1, padding: '8px', textAlign: 'center', cursor: 'pointer'}}>
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

              {/* Extensions Section */}
              <div style={{marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '16px'}}>
                <h4 style={{marginBottom: '12px', fontSize: '14px'}}>Extensions</h4>
                <button
                  className="clear-history-btn"
                  style={{width: '100%', padding: '10px', fontSize: '13px', fontWeight: 'bold', background: 'var(--tab-bg)', color: 'var(--text-color)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer'}}
                  onClick={() => {
                    if (window.electronAPI?.loadExtension) {
                      window.electronAPI.loadExtension().then((path) => {
                        if (path) alert(`Extension loaded from: ${path}`);
                      });
                    }
                  }}
                >
                  Load Extension (Unpacked)
                </button>
              </div>

              {/* Site Permissions Section */}
              <div style={{marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '16px'}}>
                <h4 style={{marginBottom: '12px', fontSize: '14px'}}>Site Permissions</h4>
                {Object.keys(permissions).length === 0 ? (
                  <div style={{fontSize: '13px', color: '#888'}}>No permissions saved.</div>
                ) : (
                  <div style={{maxHeight: '150px', overflowY: 'auto'}}>
                    {Object.entries(permissions).map(([origin, perms]) => (
                      <div key={origin} style={{marginBottom: '12px'}}>
                        <div style={{fontWeight: 'bold', fontSize: '13px', marginBottom: '4px'}}>{origin}</div>
                        {Object.entries(perms).map(([perm, allowed]) => (
                          <div key={perm} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', paddingLeft: '8px', marginBottom: '4px'}}>
                            <span>{perm}: {allowed ? <span style={{color: '#4caf50'}}>Allowed</span> : <span style={{color: '#f44336'}}>Blocked</span>}</span>
                            <button
                              className="clear-history-btn"
                              style={{padding: '4px 8px', fontSize: '11px'}}
                              onClick={() => {
                                if (window.electronAPI?.deletePermission) {
                                  window.electronAPI.deletePermission(origin, perm);
                                  const newPerms = { ...permissions };
                                  delete newPerms[origin][perm];
                                  if (Object.keys(newPerms[origin]).length === 0) {
                                    delete newPerms[origin];
                                  }
                                  setPermissions(newPerms);
                                }
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
        <div className="bookmarks-bar" style={{
          display: 'flex',
          alignItems: 'center',
          padding: '4px 16px',
          background: 'var(--bg-color)',
          borderBottom: '1px solid var(--border-color)',
          gap: '12px',
          overflowX: 'auto',
          whiteSpace: 'nowrap'
        }}>
          {bookmarks.map((b, i) => (
            <div
              key={i}
              title={b.title + '\n' + b.url}
              onClick={() => navigate(b.url)}
              style={{
                display: 'flex',
                alignItems: 'center',
                fontSize: '12px',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '4px',
                color: 'var(--text-color)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--tab-bg)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <Globe size={12} style={{marginRight: '6px', opacity: 0.7}} />
              <span style={{maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis'}}>{b.title}</span>
            </div>
          ))}
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
                  className={`tab vertical-tab ${tab.id === activeTabId ? 'active' : ''} ${tab.isPrivate ? 'private' : ''} ${tab.isPinned ? 'pinned' : ''}`}
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

                  <span className="tab-title" title={tab.title} style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '13px', color: tab.id === activeTabId ? 'var(--text-color)' : 'var(--text-muted)' }}>
                    {tab.title}
                  </span>

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

                  <div className="tab-close" onClick={(e) => closeTab(e, tab.id)} style={{ padding: '2px', marginLeft: '4px', borderRadius: '4px', cursor: 'pointer' }}>
                    <X size={12} />
                  </div>
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
        {tabs.map(tab => tab.url !== 'probaho://newtab' && !tab.isPdf && (tab.id === activeTabId || tab.id === splitTabId) && (
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
              allowpopups={true}
              style={{ flex: 1, border: 'none', width: '100%', height: '100%' }}
            />
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
              <div className="ntp-content" style={{ marginTop: '100px' }}>
                <div className="ntp-logo" style={settings.newTabBackgroundUrl ? { color: '#fff' } : {}}>
                  <span style={{fontSize: '48px'}}>🌐</span>
                  <h1 style={{marginTop: '10px'}}>PROBAHO</h1>
                </div>
              <div className="ntp-search">
                <Search size={18} color="#888" style={{marginLeft: '16px', position: 'absolute'}} />
                <input
                  type="text"
                  className="ntp-search-input"
                  placeholder={t('searchPlaceholder', settings.language, { engine: settings.defaultSearchEngine })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      navigate(e.currentTarget.value);
                    }
                  }}
                  autoFocus
                />
              </div>

              <div className="ntp-top-sites">
                {(() => {
                  // Compute top 8 sites from history
                  const siteCounts: Record<string, {count: number, title: string, url: string}> = {};
                  history.forEach(h => {
                    try {
                      const domain = new URL(h.url).hostname;
                      if (!siteCounts[domain]) {
                        siteCounts[domain] = { count: 0, title: h.title, url: `https://${domain}` };
                      }
                      siteCounts[domain].count++;
                    } catch(e) {}
                  });

                  const topSites = Object.values(siteCounts)
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 8);

                  if (topSites.length === 0) {
                     return <div style={{color: '#666'}}>{t('noHistory', settings.language)}</div>;
                  }

                  return topSites.map((site, i) => (
                    <div key={i} className="ntp-tile" onClick={() => navigate(site.url)} style={settings.newTabBackgroundUrl ? { backgroundColor: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.2)' } : {}}>
                      <div className="ntp-tile-icon">
                        {site.title.charAt(0).toUpperCase()}
                      </div>
                      <div className="ntp-tile-title" style={settings.newTabBackgroundUrl ? { color: '#fff' } : {}}>{site.title || site.url}</div>
                    </div>
                  ));
                })()}
              </div>
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
