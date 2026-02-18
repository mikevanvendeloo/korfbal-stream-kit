import html2canvas from 'html2canvas';

export async function downloadAsPng(elementId: string, filename: string) {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id ${elementId} not found`);
    return;
  }

  try {
    const canvas = await html2canvas(element, {
      backgroundColor: null, // Transparent background if possible, or use '#ffffff'
      scale: 2, // Higher resolution
    });

    const link = document.createElement('a');
    link.download = filename.endsWith('.png') ? filename : `${filename}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (err) {
    console.error('Failed to generate PNG:', err);
    alert('Kon afbeelding niet genereren.');
  }
}
