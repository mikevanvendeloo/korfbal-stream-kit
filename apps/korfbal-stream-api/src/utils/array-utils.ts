export function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array]; // Maak een kopie om de originele array niet aan te passen
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
