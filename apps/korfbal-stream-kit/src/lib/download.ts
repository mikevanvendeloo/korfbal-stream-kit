import html2canvas from 'html2canvas';

export async function downloadAsPng(elementId: string, filename: string) {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id ${elementId} not found`);
    return;
  }

  // Add temporary class for larger fonts and reset styles during export
  element.classList.add('exporting');

  // To capture the full width of tables that might be overflowing,
  // we temporarily allow the element to expand to its scrollWidth.
  const originalWidth = element.style.width;
  const originalMinWidth = element.style.minWidth;
  element.style.width = `${element.scrollWidth}px`;
  element.style.minWidth = `${element.scrollWidth}px`;

  try {
    const canvas = await html2canvas(element, {
      backgroundColor: '#ffffff', // Use solid white for reports
      scale: 2, // Higher resolution
      useCORS: true, // Allow cross-origin images
      allowTaint: true, // Allow tainted canvas for local development
      logging: false,
      width: element.scrollWidth,
      windowWidth: element.scrollWidth,
    });

    const link = document.createElement('a');
    link.download = filename.endsWith('.png') ? filename : `${filename}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (err) {
    console.error('Failed to generate PNG:', err);
    alert('Kon afbeelding niet genereren.');
  } finally {
    // Remove temporary class and restore original styles
    element.classList.remove('exporting');
    element.style.width = originalWidth;
    element.style.minWidth = originalMinWidth;
  }
}

export function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
