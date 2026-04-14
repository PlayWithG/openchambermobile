import React from 'react';
import { createPortal } from 'react-dom';
import { RiCloseLine, RiFileCopyLine, RiCheckLine } from '@remixicon/react';
import { VirtualizedCodeBlock, type CodeLine } from './VirtualizedCodeBlock';
import { copyTextToClipboard } from '@/lib/clipboard';

interface MobileCodeViewerProps {
  code: string;
  language: string;
  syntaxTheme: Record<string, React.CSSProperties>;
  isOpen: boolean;
  onClose: () => void;
}

export const MobileCodeViewer: React.FC<MobileCodeViewerProps> = ({
  code,
  language,
  syntaxTheme,
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = React.useState(false);

  const lines = React.useMemo((): CodeLine[] =>
    code.split('\n').map((text, i) => ({ text, lineNumber: i + 1 })),
    [code],
  );

  const handleCopy = React.useCallback(async () => {
    const result = await copyTextToClipboard(code);
    if (!result.ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, [code]);

  // Swipe down to close
  const startYRef = React.useRef<number | null>(null);
  const handleTouchStart = React.useCallback((e: React.TouchEvent) => {
    startYRef.current = e.touches[0]?.clientY ?? null;
  }, []);
  const handleTouchEnd = React.useCallback((e: React.TouchEvent) => {
    if (startYRef.current === null) return;
    const endY = e.changedTouches[0]?.clientY ?? startYRef.current;
    const delta = endY - startYRef.current;
    startYRef.current = null;
    if (delta > 80) onClose();
  }, [onClose]);

  // Lock body scroll while open
  React.useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  if (!isOpen) return null;

  const contentMaxHeight = 'calc(100dvh - var(--oc-safe-area-top, 0px) - var(--oc-safe-area-bottom, 0px) - 50px)';

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex flex-col bg-[var(--surface-elevated)]"
      style={{
        paddingTop: 'var(--oc-safe-area-top, 0px)',
        paddingBottom: 'var(--oc-safe-area-bottom, 0px)',
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Swipe indicator */}
      <div className="flex justify-center pt-2 pb-1 flex-shrink-0">
        <div className="w-8 h-1 rounded-full bg-border/60" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/70 px-4 py-2 flex-shrink-0">
        <span className="font-mono text-sm text-muted-foreground">{language}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => { void handleCopy(); }}
            className="p-2 rounded text-muted-foreground hover:text-foreground transition-colors"
            aria-label={copied ? 'Copied' : 'Copy code'}
          >
            {copied ? <RiCheckLine className="h-4 w-4" /> : <RiFileCopyLine className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <RiCloseLine className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Code content */}
      <div className="flex-1 min-h-0 px-2 py-2">
        <VirtualizedCodeBlock
          lines={lines}
          language={language}
          syntaxTheme={syntaxTheme}
          maxHeight={contentMaxHeight}
          showLineNumbers={true}
          isMobile={true}
        />
      </div>
    </div>,
    document.body,
  );
};

export default MobileCodeViewer;
