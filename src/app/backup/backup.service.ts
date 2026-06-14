import { Injectable, signal } from '@angular/core';
import { db } from '../data/db';
import {
  BackupFile,
  BACKUP_SCHEMA,
  BACKUP_VERSION,
  backupFilename,
} from './backup.types';
import {
  ensurePermission,
  getStoredDirectoryHandle,
  isFileSystemAccessSupported,
  pickDirectory,
  rotateBackupFiles,
  writeBackupFile,
  clearStoredDirectoryHandle,
} from './file-system';

const LAST_BACKUP_KEY = 'lastBackupAt';
const KEEP_BACKUPS = 7;

@Injectable({ providedIn: 'root' })
export class BackupService {
  readonly lastBackupAt = signal<string | null>(null);
  readonly folderName = signal<string | null>(null);
  readonly fsaSupported = signal(isFileSystemAccessSupported());

  async init(): Promise<void> {
    const meta = await db.meta.get(LAST_BACKUP_KEY);
    this.lastBackupAt.set(meta?.value ?? null);

    const handle = await getStoredDirectoryHandle();
    this.folderName.set(handle?.name ?? null);
  }

  async chooseFolder(): Promise<boolean> {
    const handle = await pickDirectory();
    if (!handle) return false;
    this.folderName.set(handle.name);
    return true;
  }

  async forgetFolder(): Promise<void> {
    await clearStoredDirectoryHandle();
    this.folderName.set(null);
  }

  async exportNow(): Promise<{ wroteToFolder: boolean; filename: string }> {
    const payload = await this.snapshot();
    const json = JSON.stringify(payload, null, 2);
    const filename = backupFilename(new Date());

    const handle = await getStoredDirectoryHandle();
    if (handle && (await ensurePermission(handle))) {
      await writeBackupFile(handle, filename, json);
      await rotateBackupFiles(handle, KEEP_BACKUPS);
      await this.markBackupTime();
      return { wroteToFolder: true, filename };
    }

    triggerDownload(filename, json);
    await this.markBackupTime();
    return { wroteToFolder: false, filename };
  }

  async importFromFile(file: File): Promise<void> {
    const text = await file.text();
    let parsed: BackupFile;
    try {
      parsed = JSON.parse(text) as BackupFile;
    } catch {
      throw new Error('Backup file is not valid JSON.');
    }
    if (parsed.schema !== BACKUP_SCHEMA) {
      throw new Error('This backup file is from a different application.');
    }
    if (typeof parsed.version !== 'number' || parsed.version > BACKUP_VERSION) {
      throw new Error('This backup was made by a newer version of the app.');
    }
    if (!parsed.tables) {
      throw new Error('Backup file is missing data tables.');
    }

    await db.transaction(
      'rw',
      [
        db.employees,
        db.attendances,
        db.breaks,
        db.departments,
        db.requests,
        db.payrolls,
        db.cashAdvances,
      ],
      async () => {
        await db.employees.clear();
        await db.attendances.clear();
        await db.breaks.clear();
        await db.departments.clear();
        await db.requests.clear();
        await db.payrolls.clear();
        await db.cashAdvances.clear();
        if (parsed.tables.employees?.length) await db.employees.bulkAdd(parsed.tables.employees);
        if (parsed.tables.attendances?.length)
          await db.attendances.bulkAdd(parsed.tables.attendances);
        if (parsed.tables.breaks?.length) await db.breaks.bulkAdd(parsed.tables.breaks);
        if (parsed.tables.departments?.length)
          await db.departments.bulkAdd(parsed.tables.departments);
        if (parsed.tables.requests?.length) await db.requests.bulkAdd(parsed.tables.requests);
        if (parsed.tables.payrolls?.length) await db.payrolls.bulkAdd(parsed.tables.payrolls);
        if (parsed.tables.cashAdvances?.length)
          await db.cashAdvances.bulkAdd(parsed.tables.cashAdvances);
      }
    );
  }

  async runScheduledBackup(): Promise<void> {
    if (!this.shouldBackup()) return;
    const handle = await getStoredDirectoryHandle();
    if (!handle) return;
    const permission = await handle.queryPermission({ mode: 'readwrite' });
    if (permission !== 'granted') return;
    await this.exportNow();
  }

  shouldBackup(): boolean {
    const last = this.lastBackupAt();
    if (!last) return true;
    const ms = Date.now() - new Date(last).getTime();
    return ms >= 24 * 60 * 60 * 1000;
  }

  private async snapshot(): Promise<BackupFile> {
    const [employees, attendances, breaks, departments, requests, payrolls, cashAdvances] =
      await Promise.all([
        db.employees.toArray(),
        db.attendances.toArray(),
        db.breaks.toArray(),
        db.departments.toArray(),
        db.requests.toArray(),
        db.payrolls.toArray(),
        db.cashAdvances.toArray(),
      ]);
    return {
      version: BACKUP_VERSION,
      schema: BACKUP_SCHEMA,
      exportedAt: new Date().toISOString(),
      tables: {
        employees,
        attendances,
        breaks,
        departments,
        requests,
        payrolls,
        cashAdvances,
      },
    };
  }

  private async markBackupTime(): Promise<void> {
    const now = new Date().toISOString();
    await db.meta.put({ key: LAST_BACKUP_KEY, value: now });
    this.lastBackupAt.set(now);
  }
}

function triggerDownload(filename: string, contents: string): void {
  const blob = new Blob([contents], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
