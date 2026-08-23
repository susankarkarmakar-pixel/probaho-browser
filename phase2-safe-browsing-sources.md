# Phase 2 Safe Browsing sources

1. Google Safe Browsing Lookup API v4: https://developers.google.com/safe-browsing/v4/lookup-api

The official documentation specifies a POST request to `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=API_KEY`, with a JSON body containing a non-user-specific client ID/version and `threatInfo` containing threat types, platform types, URL entry types, and URL entries. The request can contain up to 500 URLs. An empty response means no match; a `matches` array identifies unsafe URLs and threat types. The Lookup API uses URL entries rather than hash entries and includes cache duration information.

2. Google Safe Browsing setup: https://developers.google.com/safe-browsing/v4/get-started

The official setup requires a Google Account, a Google Developer Console project, an API key, and activation of Safe Browsing APIs. The API key is passed as a query parameter. The docs also state that users should review terms, pricing, and usage limits.

3. Google Safe Browsing REST reference: https://developers.google.com/safe-browsing/reference/rest

The official REST reference states that the Safe Browsing APIs cross-reference resources against Google-generated unsafe-resource lists, and that Safe Browsing APIs are intended for non-commercial use; commercial malicious-URL detection should use Web Risk instead. The service endpoint is `https://safebrowsing.googleapis.com` and v4 includes `threatMatches:find`.

Implementation implication: the browser must keep the API key out of renderer code and source control, call the provider from the Electron main process, cache short-lived URL results, expose only sanitized results over the isolated preload bridge, and degrade transparently when no key is configured or the provider is unavailable.
