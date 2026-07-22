import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, ArrowRight, RotateCw, Home, Plus,
  Lock, X, Minus, Square, Search, Star, Bookmark, Menu, History, ZoomIn, FileCode, Printer, LogOut, Info, Download, Folder
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
}

const DEFAULT_URL = 'https://www.google.com';

declare global {
  interface Window {
    electronAPI: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      onNewTab: (callback: () => void) => void;
      onCloseTab: (callback: () => void) => void;
      onDownloadUpdate: (callback: (item: DownloadItem) => void) => void;
      openFile: (path: string) => void;
      showInFolder: (path: string) => void;
      onOpenLinkNewTab: (callback: (url: string) => void) => void;
      showContextMenu: (params: { x: number, y: number, linkURL: string }) => void;
      onContextMenuAction: (callback: (action: string, x?: number, y?: number) => void) => void;
    };
  }
}

function App() {
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
            canGoForward: false
          }));
        }
      }
    } catch (e) {}
    return [{
      id: Date.now().toString(),
      url: DEFAULT_URL,
      title: 'New Tab',
      loading: false,
      canGoBack: false,
      canGoForward: false,
      isSecure: true,
      zoomLevel: 1
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
  const [showMenu, setShowMenu] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  useEffect(() => {
    localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
  }, [bookmarks]);

  useEffect(() => {
    localStorage.setItem('history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
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
    localStorage.setItem('savedTabs', JSON.stringify(tabs));
    localStorage.setItem('activeTabId', activeTabId);
  }, [tabs, activeTabId]);

  // Keep a ref of the active tab id to avoid stale closures in event listeners
  const activeTabIdRef = useRef<string>(activeTabId);
  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  const webviewRefs = useRef<{ [key: string]: any }>({});

  useEffect(() => {
    const handleNewTab = () => {
      const newTab = {
        id: Date.now().toString(),
        url: DEFAULT_URL,
        title: 'New Tab',
        loading: false,
        canGoBack: false,
        canGoForward: false,
        isSecure: true,
        zoomLevel: 1
      };
      setTabs(prev => [...prev, newTab]);
      // Note: We need a slight timeout to let React render the new tab to DOM, or use ref
      setTimeout(() => setActiveTabId(newTab.id), 0);
    };

    if (window.electronAPI?.onNewTab) {
      window.electronAPI.onNewTab(handleNewTab);
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
          title: 'New Tab',
          loading: false,
          canGoBack: false,
          canGoForward: false,
          isSecure: url.startsWith('https'),
          zoomLevel: 1
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

    if (window.electronAPI?.onCloseTab) {
      window.electronAPI.onCloseTab(handleCloseTab);
    }
  }, []);


  const activeTab = tabs.find(t => t.id === activeTabId);

  useEffect(() => {
    if (activeTab) {
      setInputUrl(activeTab.url);
    }
  }, [activeTabId]);

  const createTab = () => {
    const newTab: Tab = {
      id: Date.now().toString(),
      url: DEFAULT_URL,
      title: 'New Tab',
      loading: false,
      canGoBack: false,
      canGoForward: false,
      isSecure: true,
      zoomLevel: 1
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

  const handleWebviewRef = (id: string, el: any) => {
    if (el && !webviewRefs.current[id]) {
      webviewRefs.current[id] = el;

      // Setup event listeners for the webview
      el.addEventListener('did-start-loading', () => {
        updateTab(id, { loading: true });
      });

      el.addEventListener('did-stop-loading', () => {
        updateTab(id, { loading: false });
      });

      el.addEventListener('did-navigate', (e: any) => {
        updateTab(id, {
          url: e.url,
          isSecure: e.url.startsWith('https')
        });
        if (activeTabIdRef.current === id) {
          setInputUrl(e.url);
        }
        setHistory(prev => [{ title: e.url, url: e.url, time: new Date().toLocaleString() }, ...prev]);
      });

      el.addEventListener('did-navigate-in-page', (e: any) => {
        updateTab(id, {
          url: e.url,
          isSecure: e.url.startsWith('https')
        });
        if (activeTabIdRef.current === id) {
          setInputUrl(e.url);
        }
      });

      el.addEventListener('page-title-updated', (e: any) => {
        updateTab(id, { title: e.title });
        setHistory(prev => {
          if (prev.length > 0 && prev[0].url === el.getURL()) {
            const updated = [...prev];
            updated[0] = { ...updated[0], title: e.title };
            return updated;
          }
          return prev;
        });
      });

      el.addEventListener('update-target-url', () => {
        updateTab(id, {
          canGoBack: el.canGoBack(),
          canGoForward: el.canGoForward()
        });
      });

      // Need a bit of delay or load check for canGoBack/Forward to be accurate after nav
      el.addEventListener('did-finish-load', () => {
         updateTab(id, {
          canGoBack: el.canGoBack(),
          canGoForward: el.canGoForward()
        });
      });

      el.addEventListener('context-menu', (e: any) => {
        window.electronAPI?.showContextMenu({
          x: e.params.x,
          y: e.params.y,
          linkURL: e.params.linkURL
        });
      });
    }
  };

  const navigate = (url: string) => {
    let finalUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      if (url.includes('.') && !url.includes(' ')) {
        finalUrl = `https://${url}`;
      } else {
        finalUrl = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
      }
    }

    const wv = webviewRefs.current[activeTabId];
    if (wv) {
      wv.loadURL(finalUrl);
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
    navigate(DEFAULT_URL);
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

  const handleZoom = (delta: number) => {
    const currentZoom = activeTab?.zoomLevel || 1;
    const newZoom = Math.max(0.25, Math.min(5, delta === (1 - currentZoom) ? 1 : currentZoom + delta));

    updateTab(activeTabId, { zoomLevel: newZoom });
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
          {tabs.map(tab => (
            <div
              key={tab.id}
              className={`tab ${tab.id === activeTabId ? 'active' : ''}`}
              onClick={() => setActiveTabId(tab.id)}
            >
              <span className="tab-title">{tab.title}</span>
              <div className="tab-close" onClick={(e) => closeTab(e, tab.id)}>
                <X size={12} />
              </div>
            </div>
          ))}
        </div>
        <button className="new-tab-btn" onClick={createTab}>
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
            className="address-input"
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            onFocus={(e) => e.target.select()}
          />
          <button className="bookmark-toggle-btn" type="button" onClick={toggleBookmark}>
            <Star size={16} fill={isCurrentBookmarked ? "#f5d44f" : "none"} color={isCurrentBookmarked ? "#f5d44f" : "currentColor"} />
          </button>
        </form>
        <button className="nav-btn" onClick={() => { setShowMenu(false); setShowHistory(false); setShowDownloads(false); setShowBookmarks(!showBookmarks); }}>
          <Bookmark size={16} />
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
            <div className="menu-item-text">New tab</div>
            <div className="menu-item-shortcut">Ctrl+T</div>
          </div>
          <div className="menu-divider" />
          <div className="menu-item" onClick={() => { setShowMenu(false); setShowHistory(true); }}>
            <div className="menu-item-icon"><History size={16} /></div>
            <div className="menu-item-text">History</div>
          </div>
          <div className="menu-item" onClick={() => { setShowMenu(false); setShowDownloads(true); }}>
            <div className="menu-item-icon"><Download size={16} /></div>
            <div className="menu-item-text">Downloads</div>
          </div>
          <div className="menu-item" onClick={() => { setShowMenu(false); setShowBookmarks(true); }}>
            <div className="menu-item-icon"><Bookmark size={16} /></div>
            <div className="menu-item-text">Bookmarks</div>
          </div>
          <div className="menu-divider" />
          <div className="menu-item" onClick={(e) => e.stopPropagation()}>
            <div className="menu-item-icon"><ZoomIn size={16} /></div>
            <div className="menu-item-text">Zoom</div>
            <div className="zoom-controls">
              <button className="zoom-btn" onClick={() => handleZoom(-0.1)}>-</button>
              <span className="zoom-level">{Math.round((activeTab?.zoomLevel || 1) * 100)}%</span>
              <button className="zoom-btn" onClick={() => handleZoom(0.1)}>+</button>
              <button className="zoom-btn" onClick={() => handleZoom(1 - (activeTab?.zoomLevel || 1))}><Square size={10} /></button>
            </div>
          </div>
          <div className="menu-item" onClick={handlePrint}>
            <div className="menu-item-icon"><Printer size={16} /></div>
            <div className="menu-item-text">Print...</div>
            <div className="menu-item-shortcut">Ctrl+P</div>
          </div>
          <div className="menu-divider" />
          <div className="menu-item" onClick={toggleDevTools}>
            <div className="menu-item-icon"><FileCode size={16} /></div>
            <div className="menu-item-text">Developer tools</div>
            <div className="menu-item-shortcut">F12</div>
          </div>
          <div className="menu-divider" />
          <div className="menu-item" onClick={() => { setShowMenu(false); setShowAbout(true); }}>
            <div className="menu-item-icon"><Info size={16} /></div>
            <div className="menu-item-text">About Probaho</div>
          </div>
          <div className="menu-divider" />
          <div className="menu-item" onClick={() => window.electronAPI?.close()}>
            <div className="menu-item-icon"><LogOut size={16} /></div>
            <div className="menu-item-text">Exit</div>
          </div>
        </div>
      )}

      {/* History Panel */}
      {showHistory && (
        <div className="bookmarks-panel">
          <div className="bookmarks-header">
            <h3>History</h3>
            <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
              <button className="clear-history-btn" onClick={() => setHistory([])}>Clear</button>
              <button className="nav-btn" onClick={() => setShowHistory(false)}><X size={16} /></button>
            </div>
          </div>
          <div className="bookmarks-list">
            {history.length === 0 ? (
              <div className="no-bookmarks">No history yet</div>
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
            <h3>Downloads</h3>
            <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
              <button className="clear-history-btn" onClick={() => setDownloads([])}>Clear</button>
              <button className="nav-btn" onClick={() => setShowDownloads(false)}><X size={16} /></button>
            </div>
          </div>
          <div className="bookmarks-list">
            {downloads.length === 0 ? (
              <div className="no-bookmarks">No recent downloads</div>
            ) : (
              downloads.map((d, i) => (
                <div key={i} className="download-item">
                  <div className="download-info">
                    <div className="bookmark-title" style={{marginBottom: '4px'}}>{d.fileName}</div>
                    <div className="bookmark-url">
                      {d.state === 'completed' ? 'Completed' :
                       d.state === 'progressing' ? `${Math.round(d.receivedBytes / 1024 / 1024 * 10) / 10} MB / ${Math.round(d.totalBytes / 1024 / 1024 * 10) / 10} MB` : d.state}
                    </div>
                    {d.state === 'progressing' && (
                      <div className="download-progress-bar">
                        <div className="download-progress-fill" style={{width: `${(d.receivedBytes / d.totalBytes) * 100}%`}}></div>
                      </div>
                    )}
                  </div>
                  {d.state === 'completed' && (
                    <div className="download-actions">
                      <button className="nav-btn" title="Open file" onClick={() => window.electronAPI?.openFile(d.savePath)}>
                        <FileCode size={14} />
                      </button>
                      <button className="nav-btn" title="Show in folder" onClick={() => window.electronAPI?.showInFolder(d.savePath)}>
                        <Folder size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* About Modal */}
      {showAbout && (
        <div className="about-modal-overlay" onClick={() => setShowAbout(false)}>
          <div className="about-modal" onClick={e => e.stopPropagation()}>
            <div className="about-header">
              <h3>About Probaho Browser</h3>
              <button className="nav-btn" onClick={() => setShowAbout(false)}><X size={16} /></button>
            </div>
            <div className="about-content">
              <div className="about-logo">
                <div style={{fontSize: '32px', marginBottom: '10px'}}>🌐</div>
                <h2>PROBAHO BROWSER</h2>
              </div>
              <table className="about-table">
                <tbody>
                  <tr><td><strong>Version:</strong></td><td>1.0.0</td></tr>
                  <tr><td><strong>License:</strong></td><td>MIT</td></tr>
                  <tr><td><strong>Creator:</strong></td><td>Susankar Karmakar</td></tr>
                </tbody>
              </table>
              <p className="about-desc">
                Probaho Browser is a lightweight, fast, and privacy-focused web browser built with modern web technologies.
              </p>
              <div className="about-footer">
                © 2026 Susankar Karmakar. All rights reserved.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bookmarks Panel */}
      {showBookmarks && (
        <div className="bookmarks-panel">
          <div className="bookmarks-header">
            <h3>Bookmarks</h3>
            <button className="nav-btn" onClick={() => setShowBookmarks(false)}><X size={16} /></button>
          </div>
          <div className="bookmarks-list">
            {bookmarks.length === 0 ? (
              <div className="no-bookmarks">No bookmarks yet</div>
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
        {tabs.map(tab => (
          <webview // @ts-ignore
            key={tab.id}
            className={tab.id === activeTabId ? 'active' : ''}
            src={tab.id === activeTabId && !webviewRefs.current[tab.id] ? tab.url : undefined}
            ref={(el: any) => handleWebviewRef(tab.id, el)}
          />
        ))}
      </div>
    </div>
  );
}

export default App;
