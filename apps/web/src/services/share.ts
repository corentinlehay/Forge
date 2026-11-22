/**
 * Enregistrer un fichier depuis l'app : sur iPhone, la feuille de partage propose
 * « Enregistrer dans Fichiers » (iCloud Drive compris). Ailleurs, un téléchargement classique.
 */
export type SaveResult = 'shared' | 'downloaded' | 'cancelled';

export async function saveFile(file: File): Promise<SaveResult> {
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: file.name });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      // Partage refusé par le système : on bascule sur le téléchargement.
    }
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}
