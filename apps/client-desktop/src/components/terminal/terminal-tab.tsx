import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import '@xterm/xterm/css/xterm.css';

interface TerminalTabProps {
  terminalId: string;
  active: boolean;
  onData: (terminalId: string, data: string) => void;
  onResize: (terminalId: string, cols: number, rows: number) => void;
  onOutput: (terminalId: string, listener: (data: string) => void) => () => void;
}

export function TerminalTab({ terminalId, active, onData, onResize, onOutput }: TerminalTabProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      fontFamily: "'Cascadia Code', 'Fira Code', Consolas, monospace",
      fontSize: 13,
      theme: {
        background: '#1e1e1e',
        foreground: '#cccccc',
        cursor: '#cccccc',
        selectionBackground: '#264f78',
      },
      cursorBlink: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(containerRef.current);

    // Try WebGL addon for better performance
    try {
      const webglAddon = new WebglAddon();
      term.loadAddon(webglAddon);
    } catch {
      // WebGL not available, fallback to canvas
    }

    fitAddon.fit();
    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Forward user input to Core
    term.onData((data) => {
      onData(terminalId, data);
    });

    // Send initial size
    onResize(terminalId, term.cols, term.rows);

    // Subscribe to output
    const unsubOutput = onOutput(terminalId, (data: string) => {
      term.write(data);
    });

    // Handle container resize
    const observer = new ResizeObserver(() => {
      fitAddon.fit();
      onResize(terminalId, term.cols, term.rows);
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      unsubOutput();
      term.dispose();
    };
  }, [terminalId, onData, onResize, onOutput]);

  // Re-fit when tab becomes active
  useEffect(() => {
    if (active && fitAddonRef.current) {
      fitAddonRef.current.fit();
    }
  }, [active]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{ display: active ? 'block' : 'none' }}
    />
  );
}
