import React, { useState, useEffect, useRef } from 'react';
import { t, Language } from './i18n';
import PdfViewer from './PdfViewer';
import {
  ArrowLeft, ArrowRight, RotateCw, Home, Plus,
  Lock, X, Minus, Square, Search, Star, Bookmark, Menu, History, ZoomIn, FileCode, Printer, LogOut, Info, Download, Folder, Settings, ChevronUp, ChevronDown, EyeOff, Shield, BookOpen, Volume2, VolumeX, Globe
} from 'lucide-react';

interface DownloadItem {
  id: string;
  fileName: string;
  state: 'progressing' | 'completed' | 'cancelled' | 'interrupted';
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
      onCloseTab: (callback: () => void) => void;
      onDownloadUpdate: (callback: (item: DownloadItem) => void) => void;
      openFile: (path: string) => void;
      showInFolder: (path: string) => void;
      onOpenLinkNewTab: (callback: (url: string) => void) => void;
      showContextMenu: (params: { x: number, y: number, linkURL: string }) => void;
      onContextMenuAction: (callback: (action: string, x?: number, y?: number) => void) => void;
      onFind: (callback: () => void) => void;
      onCycleTabPrev: (callback: () => void) => void;
      onCycleTabNext: (callback: () => void) => void;
      onJumpTab: (callback: (index: number) => void) => void;
      onFocusAddress: (callback: () => void) => void;
      setAdBlocker: (enabled: boolean) => void;
      onAdBlocked: (callback: (webContentsId: number) => void) => void;
      onTabCrashed: (callback: (webContentsId: number, reason: string) => void) => void;
      onOpenPdfViewer: (callback: (url: string) => void) => void;
      clearCache?: () => void;
      getPermissions?: () => Promise<Record<string, Record<string, boolean>>>;
      deletePermission?: (origin: string, permission: string) => void;
      cancelDownload?: (id: string) => void;
    };
  }
}

function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [showFind, setShowFind] = useState(false);
  const [findText, setFindText] = useState('');
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [findResult, setFindResult] = useState({ activeMatchOrdinal: 0, matches: 0 });
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
          newTabBackgroundUrl: ''
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
      newTabBackgroundUrl: ''
    };
    settingsRef.current = def;
    return def;
  });

  const [tabs, setTabs] = useState<Tab[]>(() => {
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

  useEffect(() => {
    localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
  }, [bookmarks]);

  useEffect(() => {
    localStorage.setItem('history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    settingsRef.current = settings;
    localStorage.setItem('probaho-settings', JSON.stringify(settings));
    document.body.className = settings.theme === 'light' ? 'theme-light' : '';
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
  }, []);

  useEffect(() => {
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
  }, [tabs, activeTabId]);

  // Keep a ref of the active tab id to avoid stale closures in event listeners
  const activeTabIdRef = useRef<string>(activeTabId);
  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

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
        const newTab = {
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
        };
        setTabs(prev => [...prev, newTab]);
        setTimeout(() => setActiveTabId(newTab.id), 0);
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
          blockedCount: 0
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
      window.electronAPI.onOpenPdfViewer((url: string) => {
        setTabs(prev => prev.map(t => {
          if (t.id === activeTabIdRef.current) {
             return { ...t, url, isPdf: true, title: url.split('/').pop() || 'PDF Document' };
          }
          return t;
        }));
        setInputUrl(url);
      });
    }

    if (window.electronAPI?.onCloseTab) {
      window.electronAPI.onCloseTab(handleCloseTab);
    }
  }, []);


  const activeTab = tabs.find(t => t.id === activeTabId);

  useEffect(() => {
    if (activeTab) {
      setInputUrl(activeTab.url === 'probaho://newtab' ? '' : activeTab.url);
    }
    // Hide find bar when switching tabs
    if (showFind) {
      const wv = webviewRefs.current[activeTabIdRef.current];
      if (wv) wv.stopFindInPage('clearSelection');
      setShowFind(false);
      setFindText('');
      setFindResult({ activeMatchOrdinal: 0, matches: 0 });
    }
  }, [activeTabId]);

  const createTab = (isPrivate = false) => {
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
      isPrivate: isPrivate
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  };

  const closeTabId = (id: string) => {
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

    // Event: DOM ready
    el.addEventListener('dom-ready', () => {
      try {
        const wcId = el.getWebContentsId();
        updateTab(id, { webContentsId: wcId });
      } catch (err) {}
    });

    // Event: main frame navigation
    el.addEventListener('did-navigate', (e: any) => {
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
          setHistory(hPrev => [{ title: e.url, url: e.url, time: new Date().toLocaleString() }, ...hPrev]);
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
              return updated;
            }
            return prev;
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
      if (e.isMainFrame && e.errorCode !== -3) { // -3 is aborted, not a real error
        console.error('Navigation failed:', e.errorCode, e.errorDescription, e.validatedURL);
        updateTab(id, { loading: false, title: t('error', settingsRef.current?.language || 'en') });
      }
    });

    // Event: context menu
    el.addEventListener('context-menu', (e: any) => {
      window.electronAPI?.showContextMenu({
        x: e.params.x,
        y: e.params.y,
        linkURL: e.params.linkURL
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
        blockedCount: 0
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

    updateTab(activeTabId, { url: finalUrl, isPdf: false });

    if (finalUrl.toLowerCase().endsWith('.pdf')) {
      updateTab(activeTabId, { url: finalUrl, isPdf: true, title: finalUrl.split('/').pop() || 'PDF Document' });
      setInputUrl(finalUrl);
      return;
    }

    const wv = webviewRefs.current[activeTabId];
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
    const wv = webviewRefs.current[activeTabId];
    if (wv && wv.canGoBack()) wv.goBack();
  };

  const goForward = () => {
    const wv = webviewRefs.current[activeTabId];
    if (wv && wv.canGoForward()) wv.goForward();
  };

  const reload = () => {
    const wv = webviewRefs.current[activeTabId];
    if (wv) wv.reload();
  };

  const goHome = () => {
    navigate(settings.homepageUrl);
  };

  const toggleBookmark = () => {
    const tab = tabs.find(t => t.id === activeTabIdRef.current);
    if (!tab) return;
    const isBookmarked = bookmarks.some(b => b.url === tab.url);
    if (isBookmarked) {
      setBookmarks(prev => prev.filter(b => b.url !== tab.url));
    } else {
      setBookmarks(prev => [...prev, { title: tab.title, url: tab.url }]);
    }
  };

  const isCurrentBookmarked = activeTab ? bookmarks.some(b => b.url === activeTab.url) : false;

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
    const currentZoom = activeTab?.zoomLevel || 1;
    const newZoom = Math.max(0.25, Math.min(5, delta === (1 - currentZoom) ? 1 : currentZoom + delta));

    updateTab(activeTabId, { zoomLevel: newZoom });
    if (activeTab) {
      saveZoom(activeTab.url, newZoom);
    }
    const wv = webviewRefs.current[activeTabId];
    if (wv) wv.setZoomFactor(newZoom);
  };

  const handlePrint = () => {
    const wv = webviewRefs.current[activeTabId];
    if (wv) wv.print();
    setShowMenu(false);
  };

  const toggleDevTools = () => {
    const wv = webviewRefs.current[activeTabId];
    if (wv) wv.openDevTools();
    setShowMenu(false);
  };

  return (
    <div className="browser-container">
      {/* Titlebar with tabs */}
      <div className="titlebar">
        <div className="tabs">
          {[...tabs].sort((a, b) => {
            if (a.isPinned === b.isPinned) return 0;
            return a.isPinned ? -1 : 1;
          }).map(tab => (
            <div
              key={tab.id}
              className={`tab ${tab.id === activeTabId ? 'active' : ''} ${tab.isPrivate ? 'private' : ''} ${tab.isPinned ? 'pinned' : ''}`}
              onClick={() => setActiveTabId(tab.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                updateTab(tab.id, { isPinned: !tab.isPinned });
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
            >
              {tab.isPrivate && <EyeOff size={10} style={{marginRight: '4px', opacity: 0.8}} />}

              {/* Favicon */}
              {!tab.isPrivate && (
                tab.favicon
                  ? <img src={tab.favicon} style={{width: 14, height: 14, marginRight: tab.isPinned ? 0 : 6, flexShrink: 0}} />
                  : <Globe size={14} style={{marginRight: tab.isPinned ? 0 : 6, opacity: 0.7, flexShrink: 0}} />
              )}

              {!tab.isPinned && <span className="tab-title">{tab.title}</span>}
              {!tab.isPinned && (
                <div className="tab-close" onClick={(e) => closeTab(e, tab.id)}>
                  <X size={12} />
                </div>
              )}
              {tab.isPinned && <span className="tab-title" style={{display: 'none'}}>{tab.title}</span>}
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
          ))}
        </div>
        <button className="new-tab-btn" onClick={() => createTab(false)}>
          <Plus size={16} />
        </button>

        {/* Window controls */}
        <div className="window-controls">
          <button className="control-btn" onClick={() => window.electronAPI?.minimize()}>
            <Minus size={16} />
          </button>
          <button className="control-btn" onClick={() => window.electronAPI?.maximize()}>
            <Square size={12} />
          </button>
          <button className="control-btn close" onClick={() => window.electronAPI?.close()}>
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="nav-buttons">
          <button className="nav-btn" onClick={goBack} disabled={!activeTab?.canGoBack}>
            <ArrowLeft size={16} />
          </button>
          <button className="nav-btn" onClick={goForward} disabled={!activeTab?.canGoForward}>
            <ArrowRight size={16} />
          </button>
          <button className="nav-btn" onClick={reload}>
            <RotateCw size={16} className={activeTab?.loading ? "animate-spin" : ""} />
          </button>
          <button className="nav-btn" onClick={goHome}>
            <Home size={16} />
          </button>
        </div>

        <form className="address-bar-container" onSubmit={onSubmit}>
          <div className="security-icon">
            {activeTab?.isSecure ? <Lock size={14} color="#4caf50" /> : <Search size={14} />}
          </div>
          <input
            ref={addressInputRef}
            className="address-input"
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            onFocus={(e) => e.target.select()}
          />
          <button className="bookmark-toggle-btn" type="button" title="Reader Mode" onClick={() => {
            const wv = webviewRefs.current[activeTabId];
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
        {settings.adBlockerEnabled !== false && (
          <div className="shield-container" title={t('blockedAds', settings.language, { count: activeTab?.blockedCount || 0 })}>
            <Shield size={16} color={activeTab && activeTab.blockedCount > 0 ? '#4caf50' : '#888'} />
            {activeTab && activeTab.blockedCount > 0 && <span className="shield-count">{activeTab.blockedCount}</span>}
          </div>
        )}
        <button className="nav-btn" onClick={() => { setShowMenu(false); setShowHistory(false); setShowDownloads(false); setShowBookmarks(!showBookmarks); }}>
          <Bookmark size={16} />
        </button>
        <button
          className="nav-btn"
          style={{ position: 'relative' }}
          onClick={() => { setShowBookmarks(false); setShowHistory(false); setShowMenu(false); setShowDownloads(!showDownloads); }}
        >
          <Download size={16} />
          {hasActiveDownloads && (
            <div style={{ position: 'absolute', bottom: 0, left: 0, height: '3px', backgroundColor: '#4caf50', width: `${totalDownloadProgress}%`, transition: 'width 0.3s' }} />
          )}
        </button>
        <button className="nav-btn" onClick={() => { setShowBookmarks(false); setShowHistory(false); setShowDownloads(false); setShowMenu(!showMenu); }}>
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
          <div className="menu-item" onClick={() => { createTab(true); setShowMenu(false); }}>
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



      {/* Downloads Panel */}
      {showDownloads && (
        <div className="bookmarks-panel" style={{width: '350px'}}>
          <div className="bookmarks-header">
            <h3>{t('downloads', settings.language)}</h3>
            <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
              <button className="clear-history-btn" onClick={() => setDownloads([])}>{t('clear', settings.language)}</button>
              <button className="nav-btn" onClick={() => setShowDownloads(false)}><X size={16} /></button>
            </div>
          </div>
          <div className="bookmarks-list">
            {downloads.length === 0 ? (
              <div className="no-bookmarks">{t('noDownloads', settings.language)}</div>
            ) : (
              downloads.map((d, i) => (
                <div key={i} className="download-item">
                  <div className="download-info">
                    <div className="bookmark-title" style={{marginBottom: '4px'}}>{d.fileName}</div>
                    <div className="bookmark-url">
                      {d.state === 'completed' ? t('completed', settings.language) :
                       d.state === 'progressing' ? `${Math.round(d.receivedBytes / 1024 / 1024 * 10) / 10} MB / ${Math.round(d.totalBytes / 1024 / 1024 * 10) / 10} MB` : d.state}
                    </div>
                    {d.state === 'progressing' && (
                      <div className="download-progress-bar">
                        <div className="download-progress-fill" style={{width: `${(d.receivedBytes / d.totalBytes) * 100}%`}}></div>
                      </div>
                    )}
                  </div>
                  <div className="download-actions">
                    {d.state === 'completed' && (
                      <>
                        <button className="nav-btn" title={t('openFile', settings.language)} onClick={() => window.electronAPI?.openFile(d.savePath)}>
                          <FileCode size={14} />
                        </button>
                        <button className="nav-btn" title={t('showInFolder', settings.language)} onClick={() => window.electronAPI?.showInFolder(d.savePath)}>
                          <Folder size={14} />
                        </button>
                      </>
                    )}
                    <button className="nav-btn" title="Remove" onClick={() => {
                      if (d.state === 'progressing') {
                        window.electronAPI?.cancelDownload?.(d.id);
                      }
                      setDownloads(prev => prev.filter(item => item.id !== d.id));
                    }}>
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}


      {/* Settings Modal */}
      {showSettings && (
        <div className="about-modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="about-modal" style={{width: '500px'}} onClick={e => e.stopPropagation()}>
            <div className="about-header">
              <h3>{t('settings', settings.language)}</h3>
              <button className="nav-btn" onClick={() => setShowSettings(false)}><X size={16} /></button>
            </div>
            <div className="about-content" style={{textAlign: 'left', padding: '16px 24px'}}>
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

      {/* Content Area */}
      <div className="content-area">

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
        {tabs.map(tab => tab.url !== 'probaho://newtab' && !tab.isPdf && (
          <webview // @ts-ignore
            key={tab.id}
            src="about:blank"
            className={tab.id === activeTabId ? 'active' : ''}
            ref={(el: any) => handleWebviewRef(tab.id, el, tab.url)}
            webpreferences="contextIsolation=yes, nodeIntegration=no"
            partition={tab.isPrivate ? `private-${tab.id}` : undefined}
            allowpopups={true}
          />
        ))}


        {tabs.map(tab => tab.id === activeTabId && tab.isPdf && (
           <div key={`pdf-${tab.id}`} style={{height: '100%', width: '100%'}}>
              <PdfViewer url={tab.url} />
           </div>
        ))}

        {tabs.map(tab => tab.id === activeTabId && tab.url === 'probaho://newtab' && (
          <div
            key={`ntp-${tab.id}`}
            className="new-tab-page"
            style={settings.newTabBackgroundUrl ? {
              backgroundImage: `url('${settings.newTabBackgroundUrl}')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            } : {}}
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

        {tabs.map(tab => tab.id === activeTabId && tab.crashed && (
          <div key={`crash-${tab.id}`} className="crash-overlay">
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
  );
}

export default App;
