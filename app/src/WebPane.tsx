import React from 'react';
import { AlertCircle, Home, RotateCw } from 'lucide-react';

export type WebPaneModel = {
  id: string;
  url: string;
  title: string;
  loading: boolean;
  isPrivate?: boolean;
  loadError?: { description: string; url: string };
};

type WebPaneProps = {
  tab: WebPaneModel;
  isActive: boolean;
  isSplit: boolean;
  focusedPane: 'main' | 'split';
  onFocusPane: (pane: 'main' | 'split') => void;
  onWebviewRef: (id: string, element: any, initialUrl: string) => void;
  onRetry: (tab: WebPaneModel) => void;
  onHome: (tab: WebPaneModel) => void;
};

const WebPane = React.memo(function WebPane({
  tab,
  isActive,
  isSplit,
  focusedPane,
  onFocusPane,
  onWebviewRef,
  onRetry,
  onHome
}: WebPaneProps) {
  const isFocused = isSplit ? (isActive ? focusedPane === 'main' : focusedPane === 'split') : true;
  return (
    <div
      key={`container-${tab.id}`}
      className="web-pane-container"
      style={{
        flex: 1,
        display: 'flex',
        position: 'relative',
        borderRight: isActive && isSplit ? '2px solid var(--border-color)' : 'none',
        boxShadow: isFocused ? 'inset 0 0 0 2px var(--primary-color)' : 'none'
      }}
      data-testid={`web-pane-${tab.id}`}
      onClick={() => { if (isSplit) onFocusPane(isActive ? 'main' : 'split'); }}
    >
      <webview // @ts-ignore
        src="about:blank"
        className="active"
        aria-label={`Web content for ${tab.title || tab.url}`}
        ref={(element: any) => onWebviewRef(tab.id, element, tab.url)}
        webpreferences="contextIsolation=yes, nodeIntegration=no"
        partition={tab.isPrivate ? `private-${tab.id}` : undefined}
        style={{ flex: 1, border: 'none', width: '100%', height: '100%' }}
      />
      {tab.loading && !tab.loadError && (isActive || isSplit) && (
        <div className="page-loading-overlay" data-testid={`loading-overlay-${tab.id}`} role="status" aria-live="polite">
          <div className="page-loading-card">
            <span className="page-loading-spinner" aria-hidden="true" />
            <div><strong>Loading page</strong><span>Connecting securely…</span></div>
          </div>
        </div>
      )}
      {tab.loadError && (isActive || isSplit) && (
        <div className="load-error-overlay" data-testid={`load-error-${tab.id}`} role="alert">
          <div className="load-error-card">
            <div className="load-error-icon"><AlertCircle size={22} /></div>
            <span className="load-error-kicker">Navigation interrupted</span>
            <h2>We couldn’t load this page</h2>
            <p>{tab.loadError.description}</p>
            <code>{tab.loadError.url}</code>
            <div className="load-error-actions">
              <button className="load-error-primary" type="button" onClick={() => onRetry(tab)}><RotateCw size={14} /> Try again</button>
              <button className="load-error-secondary" type="button" onClick={() => onHome(tab)}><Home size={14} /> Go to home</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default WebPane;
