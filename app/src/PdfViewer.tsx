import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import AnnotationLayer, { Annotation } from './AnnotationLayer';
// The workerSrc is needed for pdf.js to run in the background
// @ts-ignore
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

interface PdfViewerProps {
  url: string;
  privateMode?: boolean;
  annotationMode?: boolean;
}

const PdfViewer: React.FC<PdfViewerProps> = ({ url, privateMode = false, annotationMode = false }) => {
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [zoom, setZoom] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [renderedSize, setRenderedSize] = useState({ width: 0, height: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);
  const loadingTaskRef = useRef<any>(null);
  const pdfDocRef = useRef<any>(null);
  const pdfDataRef = useRef<Uint8Array | null>(null);

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
        pdfDataRef.current = data;

        // Never execute JavaScript embedded in untrusted PDFs.
        const loadingTask = pdfjsLib.getDocument({
          data,
          // PDF.js supports this runtime option, but the current type definition omits it.
          enableScripting: false,
        } as any);
        loadingTaskRef.current = loadingTask;
        const doc = await loadingTask.promise;

        if (isMounted) {
          pdfDocRef.current = doc;
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
      const loadingTask = loadingTaskRef.current;
      loadingTaskRef.current = null;
      if (loadingTask?.destroy) {
        Promise.resolve(loadingTask.destroy()).catch(() => {});
      }
      const documentToDestroy = pdfDocRef.current;
      pdfDocRef.current = null;
      pdfDataRef.current = null;
      documentToDestroy?.destroy?.();
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
        setRenderedSize({ width: viewport.width, height: viewport.height });

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        // Cancel the previous render before starting a new one.
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
          await renderTaskRef.current.promise.catch(() => {});
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
        renderTaskRef.current = null;
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

  const colorFromHex = (hex: string) => {
    const normalized = hex.replace('#', '');
    const value = normalized.length === 3 ? normalized.split('').map(char => char + char).join('') : normalized;
    const red = Number.parseInt(value.slice(0, 2), 16) / 255;
    const green = Number.parseInt(value.slice(2, 4), 16) / 255;
    const blue = Number.parseInt(value.slice(4, 6), 16) / 255;
    return rgb(Number.isFinite(red) ? red : 1, Number.isFinite(green) ? green : 0.8, Number.isFinite(blue) ? blue : 0);
  };

  const readPageAnnotations = (pageIndex: number): Annotation[] => {
    if (privateMode) return [];
    try {
      const saved = localStorage.getItem(`probaho-annotations:${url}#page=${pageIndex + 1}`);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const exportFlattenedPdf = async () => {
    if (!pdfDataRef.current) throw new Error('PDF data is not ready for export.');
    if (!window.electronAPI?.executeSavePdf) throw new Error('The PDF save dialog is unavailable.');
    const outputDoc = await PDFDocument.load(pdfDataRef.current);
    const font = await outputDoc.embedFont(StandardFonts.Helvetica);
    outputDoc.getPages().forEach((page, pageIndex) => {
      const pageWidth = page.getWidth();
      const pageHeight = page.getHeight();
      readPageAnnotations(pageIndex).forEach(annotation => {
        const annotationColor = colorFromHex(annotation.color);
        if (annotation.type === 'highlight') {
          const x = annotation.x * pageWidth;
          const y = pageHeight - (annotation.y + (annotation.height || 0)) * pageHeight;
          page.drawRectangle({
            x,
            y,
            width: Math.abs(annotation.width || 0) * pageWidth,
            height: Math.abs(annotation.height || 0) * pageHeight,
            color: annotationColor,
            opacity: 0.34,
            borderOpacity: 0
          });
        } else if (annotation.type === 'pen' && annotation.points?.length) {
          for (let pointIndex = 1; pointIndex < annotation.points.length; pointIndex += 1) {
            const previous = annotation.points[pointIndex - 1];
            const current = annotation.points[pointIndex];
            page.drawLine({
              start: { x: previous.x * pageWidth, y: pageHeight - previous.y * pageHeight },
              end: { x: current.x * pageWidth, y: pageHeight - current.y * pageHeight },
              thickness: 2.5,
              color: annotationColor,
              opacity: 0.9
            });
          }
        } else if (annotation.type === 'text' && annotation.text) {
          page.drawText(annotation.text, {
            x: annotation.x * pageWidth,
            y: pageHeight - annotation.y * pageHeight - 16,
            size: 15,
            font,
            color: annotationColor,
            opacity: 0.95
          });
        }
      });
    });
    const output = await outputDoc.save();
    const arrayBuffer = output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength) as ArrayBuffer;
    window.electronAPI.executeSavePdf(arrayBuffer);
  };

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
      <div className="pdf-viewer-scroll" style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', padding: '20px' }}>
        <div className="pdf-page-shell" style={{ width: renderedSize.width || 'auto', height: renderedSize.height || 'auto' }}>
          <canvas ref={canvasRef} className="pdf-page-canvas" style={{ border: '1px solid var(--border-color)', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
          {annotationMode && renderedSize.width > 0 && renderedSize.height > 0 && (
            <AnnotationLayer
              documentKey={`${url}#page=${pageNum}`}
              width={renderedSize.width}
              height={renderedSize.height}
              privateMode={privateMode}
              onExportPdf={exportFlattenedPdf}
              className="pdf-annotation-layer"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default PdfViewer;
