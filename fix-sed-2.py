with open("app/src/App.tsx", "r") as f:
    content = f.read()

replacement = """          case 'inspect':
            if (x !== undefined && y !== undefined) {
              wv.inspectElement(x, y);
            }
            break;
          case 'copy-image':
            if (x !== undefined && y !== undefined) {
              wv.copyImageAt(x, y);
            }
            break;"""

content = content.replace("""          case 'inspect':
            if (x !== undefined && y !== undefined) {
              wv.inspectElement(x, y);
            }
            break;""", replacement)

with open("app/src/App.tsx", "w") as f:
    f.write(content)
