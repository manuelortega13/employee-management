import { Injectable, computed, signal } from '@angular/core';
import { db } from '../data/db';

const LOGO_KEY = 'branding.logo';
const LOGO_SIZE = 512;
const MAX_INPUT_BYTES = 5 * 1024 * 1024;

export const DEFAULT_LOGO_PATH = 'icons/icon-512.png';

@Injectable({ providedIn: 'root' })
export class BrandingService {
  readonly logo = signal<string | null>(null);
  readonly displayLogo = computed(() => this.logo() ?? DEFAULT_LOGO_PATH);

  async init(): Promise<void> {
    const row = await db.meta.get(LOGO_KEY);
    this.logo.set(row?.value ?? null);
  }

  async setLogoFromFile(file: File): Promise<void> {
    if (!file.type.startsWith('image/')) {
      throw new Error('Please choose an image file.');
    }
    if (file.size > MAX_INPUT_BYTES) {
      throw new Error('Image is too large. Pick a file under 5 MB.');
    }
    const dataUrl = await resizeToSquarePng(file, LOGO_SIZE);
    await db.meta.put({ key: LOGO_KEY, value: dataUrl });
    this.logo.set(dataUrl);
  }

  async clearLogo(): Promise<void> {
    await db.meta.delete(LOGO_KEY);
    this.logo.set(null);
  }
}

function resizeToSquarePng(file: File, size: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas is not available in this browser.'));
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      const scale = Math.min(size / img.width, size / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      const x = (size - w) / 2;
      const y = (size - h) / 2;
      ctx.drawImage(img, x, y, w, h);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read the image. Try a different file.'));
    };
    img.src = url;
  });
}
