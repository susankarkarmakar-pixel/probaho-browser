with open("app/src/App.tsx", "r") as f:
    content = f.read()

content = content.replace("setSettings(prev => ({ ...prev, showBookmarksBar: !prev.showBookmarksBar }));", "setSettings((prev: any) => ({ ...prev, showBookmarksBar: !prev.showBookmarksBar }));")
content = content.replace("window.electronAPI?.onOpenLinkNewTab?.('view-source:' + currentUrl);", "navigate('view-source:' + currentUrl);")

with open("app/src/App.tsx", "w") as f:
    f.write(content)
