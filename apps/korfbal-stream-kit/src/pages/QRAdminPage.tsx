import React from 'react';
import QRCode from 'react-qr-code';
import IconButton from '../components/IconButton';
import { MdDownload, MdContentCopy } from 'react-icons/md';

function isValidUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return !!u.protocol && !!u.host;
  } catch {
    return false;
  }
}

function isValidEmail(s: string): boolean {
  // Simple email check
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export default function QRAdminPage() {
  const [mode, setMode] = React.useState<'url' | 'email'>('url');
  const [input, setInput] = React.useState<string>('');
  const [size, setSize] = React.useState<number>(256);
  const svgRef = React.useRef<SVGSVGElement | null>(null);

  const qrValue = React.useMemo(() => {
    if (mode === 'email') {
      const trimmed = input.trim();
      if (!trimmed) return '';
      // Use simple mailto: scheme
      return `mailto:${trimmed}`;
    }
    return input.trim();
  }, [mode, input]);

  const valid = React.useMemo(() => {
    if (!qrValue) return false;
    if (mode === 'email') return isValidEmail(input.trim());
    return isValidUrl(qrValue);
  }, [qrValue, mode, input]);

  function downloadSvg() {
    const svg = svgRef.current;
    if (!svg) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr-${mode}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function downloadPng() {
    const svg = svgRef.current;
    if (!svg) return;
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svg);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    const scale = 1; // could expose UI later
    const canvas = document.createElement('canvas');
    canvas.width = size * scale;
    canvas.height = size * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    await new Promise<void>((resolve, reject) => {
      img.onload = () => {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve();
      };
      img.onerror = () => reject(new Error('Failed to render SVG'));
      img.src = url;
    });

    const pngUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = pngUrl;
    a.download = `qr-${mode}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function copyValue() {
    if (!qrValue) return;
    navigator.clipboard?.writeText(qrValue).catch(() => {});
  }

  return (
    <div className="container py-6 text-gray-800 dark:text-gray-100">
      <h1 className="text-2xl font-semibold mb-4">QR Generator</h1>

      <div className="flex flex-col sm:flex-row gap-3 items-end mb-4">
        <div>
          <label className="block text-xs mb-1">Type</label>
          <select aria-label="Type" value={mode} onChange={(e) => setMode(e.target.value as any)} className="px-2 py-1 border rounded bg-white dark:bg-gray-950">
            <option value="url">URL</option>
            <option value="email">E-mail</option>
          </select>
        </div>
        <div className="flex-1 min-w-[260px]">
          <label className="block text-xs mb-1">{mode === 'email' ? 'E-mail adres' : 'URL'}</label>
          <input
            aria-label={mode === 'email' ? 'Email input' : 'URL input'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mode === 'email' ? 'naam@voorbeeld.nl' : 'https://voorbeeld.nl'}
            className="px-2 py-1 border rounded w-full bg-white dark:bg-gray-950"
          />
          {!valid && input.trim().length > 0 && (
            <div className="text-xs text-red-600 mt-1">{mode === 'email' ? 'Ongeldig e‑mailadres' : 'Ongeldige URL'}</div>
          )}
        </div>
        <div>
          <label className="block text-xs mb-1">Grootte</label>
          <input
            aria-label="QR size"
            type="number"
            min={128}
            max={1024}
            step={32}
            value={size}
            onChange={(e) => setSize(Number(e.target.value) || 256)}
            className="px-2 py-1 border rounded w-28 bg-white dark:bg-gray-950"
          />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-6 items-start">
        <div className="p-4 rounded border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="text-sm text-gray-500 mb-2">Voorbeeld</div>
          <div className="bg-white p-2 inline-block">
            {valid ? (
              <QRCode ref={svgRef as any} value={qrValue} size={size} fgColor="#000000" bgColor="#ffffff" />
            ) : (
              <div className="w-[256px] h-[256px] flex items-center justify-center text-gray-400">Geen geldige invoer</div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-sm">Inhoud: <span className="font-mono break-all">{qrValue || '(leeg)'}</span></div>
          <div className="flex items-center gap-2">
            <IconButton ariaLabel="copy-value" title="Kopieer inhoud" onClick={copyValue}>
              <MdContentCopy className="w-5 h-5" />
            </IconButton>
            <IconButton ariaLabel="download-svg" title="Download SVG" onClick={downloadSvg}>
              <MdDownload className="w-5 h-5" />
            </IconButton>
            <IconButton ariaLabel="download-png" title="Download PNG" onClick={downloadPng}>
              <MdDownload className="w-5 h-5" />
            </IconButton>
          </div>
          <div className="text-xs text-gray-500">Tip: SVG is vector en blijft scherp; PNG is raster.</div>
        </div>
      </div>
    </div>
  );
}
