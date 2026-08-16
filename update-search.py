with open("app/electron/main.js", "r") as f:
    content = f.read()

replacement = """  if (params.selectionText) {
    const trimmedText = params.selectionText.length > 15 ? params.selectionText.substring(0, 15) + '...' : params.selectionText;
    let searchUrl = `https://www.google.com/search?q=${encodeURIComponent(params.selectionText)}`;
    const searchEngine = params.searchEngine || 'Google';
    if (searchEngine === 'Bing') {
      searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(params.selectionText)}`;
    } else if (searchEngine === 'DuckDuckGo') {
      searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(params.selectionText)}`;
    }

    template.push({
      label: `Search ${searchEngine} for "${trimmedText}"`,
      click: () => {
        if (win) win.webContents.send('open-link-new-tab', searchUrl);
      }
    });
  }"""

content = content.replace("""  if (params.selectionText) {
    const trimmedText = params.selectionText.length > 15 ? params.selectionText.substring(0, 15) + '...' : params.selectionText;
    template.push({
      label: `Search Google for "${trimmedText}"`,
      click: () => {
        if (win) win.webContents.send('open-link-new-tab', `https://www.google.com/search?q=${encodeURIComponent(params.selectionText)}`);
      }
    });
  }""", replacement)

with open("app/electron/main.js", "w") as f:
    f.write(content)
