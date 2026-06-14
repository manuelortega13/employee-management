import { Injectable, signal } from '@angular/core';

export interface StorageQuota {
  usage: number;
  quota: number;
  percent: number;
}

@Injectable({ providedIn: 'root' })
export class StorageService {
  readonly persisted = signal<boolean | null>(null);
  readonly quota = signal<StorageQuota | null>(null);

  async init(): Promise<void> {
    await this.checkPersistence();
    await this.refreshQuota();
  }

  async requestPersistence(): Promise<boolean> {
    if (!navigator.storage?.persist) {
      this.persisted.set(false);
      return false;
    }
    const result = await navigator.storage.persist();
    this.persisted.set(result);
    return result;
  }

  async checkPersistence(): Promise<boolean> {
    if (!navigator.storage?.persisted) {
      this.persisted.set(false);
      return false;
    }
    const result = await navigator.storage.persisted();
    this.persisted.set(result);
    return result;
  }

  async refreshQuota(): Promise<StorageQuota | null> {
    if (!navigator.storage?.estimate) {
      this.quota.set(null);
      return null;
    }
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    const percent = quota > 0 ? (usage / quota) * 100 : 0;
    const value: StorageQuota = { usage, quota, percent };
    this.quota.set(value);
    return value;
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
  }
}
