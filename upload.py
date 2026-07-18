import urllib.request
import json

file_path = "app/release/Probaho Browser Setup.exe"
url = "https://transfer.sh/Probaho_Browser_Setup.exe"

with open(file_path, "rb") as f:
    data = f.read()

req = urllib.request.Request(url, data=data, method="PUT")
with urllib.request.urlopen(req) as response:
    print(response.read().decode('utf-8'))
