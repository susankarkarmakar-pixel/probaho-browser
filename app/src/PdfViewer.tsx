import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// The workerSrc is needed for pdf.js to run in the background
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface PdfViewerProps {
  url: string;
}

const PdfViewer: React.FC<PdfViewerProps> = ({ url }) => {
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [zoom, setZoom] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;

    const loadPdf = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch via IPC to avoid CORS
        const buffer = await (window as any).electronAPI.fetchPdf(url);
        // pdf.js needs a Uint8Array
        const data = new Uint8Array(buffer);

        const loadingTask = pdfjsLib.getDocument({ data });
        const doc = await loadingTask.promise;

        if (isMounted) {
          setPdfDoc(doc);
          setNumPages(doc.numPages);
          setPageNum(1);
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to load PDF');
          setLoading(false);
        }
      }
    };

    loadPdf();

    return () => {
      isMounted = false;
    };
  }, [url]);

  useEffect(() => {
    let isMounted = true;

    const renderPage = async () => {
      if (!pdfDoc || !canvasRef.current) return;

      try {
        const page = await pdfDoc.getPage(pageNum);
        if (!isMounted) return;

        const viewport = page.getViewport({ scale: zoom });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        // Cancel previous render task if any
        if (renderTaskRef.current) {
          await renderTaskRef.current.promise.catch(() => {}); // Ignore cancel error
        }

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;
        await renderTask.promise;

      } catch (err: any) {
        if (err.name !== 'RenderingCancelledException') {
          console.error('Error rendering page:', err);
        }
      }
    };

    renderPage();

    return () => {
      isMounted = false;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [pdfDoc, pageNum, zoom]);

  const handlePrevPage = () => {
    if (pageNum > 1) setPageNum(pageNum - 1);
  };

  const handleNextPage = () => {
    if (pageNum < numPages) setPageNum(pageNum + 1);
  };

  const handleZoomIn = () => setZoom(z => Math.min(z + 0.25, 3.0));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.25, 0.5));

  if (loading) return <div style={{ padding: 20, color: 'var(--text-color)' }}>Loading PDF...</div>;
  if (error) return <div style={{ padding: 20, color: 'red' }}>Error: {error}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', backgroundColor: 'var(--bg-color)' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '8px',
        backgroundColor: 'var(--toolbar-bg)',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <button className="nav-btn" onClick={handlePrevPage} disabled={pageNum <= 1}>
          Prev
        </button>
        <span style={{ fontSize: '13px', color: 'var(--text-color)' }}>
          Page {pageNum} of {numPages}
        </span>
        <button className="nav-btn" onClick={handleNextPage} disabled={pageNum >= numPages}>
          Next
        </button>

        <div style={{ width: '20px' }}></div>

        <button className="nav-btn" onClick={handleZoomOut} disabled={zoom <= 0.5}>
          -
        </button>
        <span style={{ fontSize: '13px', color: 'var(--text-color)', minWidth: '40px', textAlign: 'center' }}>
          {Math.round(zoom * 100)}%
        </span>
        <button className="nav-btn" onClick={handleZoomIn} disabled={zoom >= 3.0}>
          +
        </button>
      </div>

      {/* PDF Canvas Container */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', padding: '20px' }}>
        <canvas ref={canvasRef} style={{ border: '1px solid var(--border-color)', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
      </div>
    </div>
  );
};

export default PdfViewer;
