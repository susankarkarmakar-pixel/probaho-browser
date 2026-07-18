import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, ArrowRight, RotateCw, Home, Plus,
  Lock, X, Minus, Square, Search
} from 'lucide-react';

interface Tab {
  id: string;
  url: string;
  title: string;
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  isSecure: boolean;
}

const DEFAULT_URL = 'https://www.google.com';

declare global {
  interface Window {
    electronAPI: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;
    };
  }
}

function App() {
  const [tabs, setTabs] = useState<Tab[]>([{
    id: Date.now().toString(),
    url: DEFAULT_URL,
    title: 'New Tab',
    loading: false,
    canGoBack: false,
    canGoForward: false,
    isSecure: true
  }]);
  const [activeTabId, setActiveTabId] = useState<string>(tabs[0].id);
  const [inputUrl, setInputUrl] = useState(DEFAULT_URL);

  // Keep a ref of the active tab id to avoid stale closures in event listeners
  const activeTabIdRef = useRef<string>(activeTabId);
  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  const webviewRefs = useRef<{ [key: string]: any }>({});

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
      isSecure: true
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newTab.id);
  };

  const closeTab = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (tabs.length === 1) {
      window.electronAPI?.close();
      return;
    }
    const newTabs = tabs.filter(t => t.id !== id);
    if (activeTabId === id) {
      setActiveTabId(newTabs[newTabs.length - 1].id);
    }
    setTabs(newTabs);
    delete webviewRefs.current[id];
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
      })
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
        </form>
      </div>

      {/* Content Area */}
      <div className="content-area">
        {tabs.map(tab => (
          <webview
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
