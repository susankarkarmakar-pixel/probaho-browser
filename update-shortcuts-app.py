with open("app/src/App.tsx", "r") as f:
    content = f.read()

replacement1 = """      onRestoreTab?: (callback: () => void) => void;
      onToggleBookmarksBar?: (callback: () => void) => void;
      onOpenSettings?: (callback: () => void) => void;
      onViewSource?: (callback: () => void) => void;"""

content = content.replace("""      onRestoreTab?: (callback: () => void) => void;""", replacement1)


replacement2 = """    if (window.electronAPI?.onRestoreTab) {
      window.electronAPI.onRestoreTab(() => {
        restoreTab();
      });
    }

    if (window.electronAPI?.onToggleBookmarksBar) {
      window.electronAPI.onToggleBookmarksBar(() => {
        setSettings(prev => ({ ...prev, showBookmarksBar: !prev.showBookmarksBar }));
      });
    }

    if (window.electronAPI?.onOpenSettings) {
      window.electronAPI.onOpenSettings(() => {
        setShowMenu(false);
        setShowSettings(true);
        if (window.electronAPI?.getPermissions) {
          window.electronAPI.getPermissions().then(setPermissions);
        }
        if (window.electronAPI?.getAllPasswords) {
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
              window.electronAPI?.onOpenLinkNewTab?.('view-source:' + currentUrl);
           }
        }
      });
    }"""

content = content.replace("""    if (window.electronAPI?.onRestoreTab) {
      window.electronAPI.onRestoreTab(() => {
        restoreTab();
      });
    }""", replacement2)

with open("app/src/App.tsx", "w") as f:
    f.write(content)
