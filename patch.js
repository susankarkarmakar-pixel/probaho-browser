const fs = require('fs');
let code = fs.readFileSync('app/src/App.tsx', 'utf8');

code = code.replace(
  "    const wv = webviewRefs.current[activeTabId];\n    if (wv) {\n      wv.loadURL(finalUrl);\n    } else {\n      updateTab(activeTabId, { url: finalUrl });\n    }\n    setInputUrl(finalUrl);\n  };",
  "    const wv = webviewRefs.current[activeTabId];\n    if (wv) {\n      wv.loadURL(finalUrl);\n    } else {\n      updateTab(activeTabId, { url: finalUrl });\n    }\n    setInputUrl(finalUrl);\n  };"
);

fs.writeFileSync('app/src/App.tsx', code);
