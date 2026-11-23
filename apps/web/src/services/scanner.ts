import { BarcodeDetector, prepareZXingModule } from 'barcode-detector/ponyfill';
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';

/**
 * Lecture des codes-barres par la caméra. Safari n'a pas de lecteur intégré :
 * FORGE embarque le moteur ZXing (WebAssembly), servi par l'app elle-même, donc utilisable hors ligne.
 */
prepareZXingModule({
  overrides: {
    locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path),
  },
});

const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });

export async function detectBarcode(source: HTMLVideoElement): Promise<string | null> {
  if (source.readyState < 2) return null;
  const codes = await detector.detect(source);
  return codes[0]?.rawValue ?? null;
}

export type CameraError = 'denied' | 'unavailable' | 'insecure';

export async function openCamera(): Promise<MediaStream> {
  if (!window.isSecureContext) throw Object.assign(new Error('insecure'), { kind: 'insecure' as CameraError });
  if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('unavailable'), { kind: 'unavailable' as CameraError });
  try {
    return await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
  } catch (error) {
    const name = error instanceof DOMException ? error.name : '';
    throw Object.assign(new Error(name), { kind: (name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable') as CameraError });
  }
}
