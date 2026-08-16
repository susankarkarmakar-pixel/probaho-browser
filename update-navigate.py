with open("app/src/App.tsx", "r") as f:
    content = f.read()

replacement = """  const navigate = (url: string) => {
    if (!url) return;
    console.log('navigate called with', url);
    let finalUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('file://') && !url.startsWith('view-source:')) {"""

content = content.replace("""  const navigate = (url: string) => {
    if (!url) return;
    console.log('navigate called with', url);
    let finalUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('file://')) {""", replacement)

with open("app/src/App.tsx", "w") as f:
    f.write(content)
