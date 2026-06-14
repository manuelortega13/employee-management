import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { BackupService } from '../backup/backup.service';
import { StorageService } from '../data/storage.service';

@Component({
  selector: 'app-settings',
  imports: [DatePipe],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
})
export class Settings {
  private readonly backup = inject(BackupService);
  private readonly storage = inject(StorageService);

  protected readonly lastBackupAt = this.backup.lastBackupAt;
  protected readonly folderName = this.backup.folderName;
  protected readonly fsaSupported = this.backup.fsaSupported;
  protected readonly persisted = this.storage.persisted;
  protected readonly quota = this.storage.quota;

  protected readonly status = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  protected readonly quotaText = computed(() => {
    const q = this.quota();
    if (!q) return null;
    const used = this.storage.formatBytes(q.usage);
    const total = this.storage.formatBytes(q.quota);
    const pct = q.percent.toFixed(1);
    return `${used} / ${total} (${pct}%)`;
  });

  protected readonly importInput = viewChild<ElementRef<HTMLInputElement>>('importInput');

  protected async chooseFolder(): Promise<void> {
    this.reset();
    try {
      const ok = await this.backup.chooseFolder();
      this.status.set(ok ? 'Backup folder set.' : 'No folder selected.');
    } catch (err) {
      this.error.set(this.errMessage(err, 'Could not select folder.'));
    }
  }

  protected async forgetFolder(): Promise<void> {
    this.reset();
    await this.backup.forgetFolder();
    this.status.set('Backup folder cleared.');
  }

  protected async exportNow(): Promise<void> {
    this.reset();
    this.busy.set(true);
    try {
      const result = await this.backup.exportNow();
      this.status.set(
        result.wroteToFolder
          ? `Backup saved to your folder as ${result.filename}.`
          : `Backup downloaded as ${result.filename}.`
      );
      await this.storage.refreshQuota();
    } catch (err) {
      this.error.set(this.errMessage(err, 'Backup failed.'));
    } finally {
      this.busy.set(false);
    }
  }

  protected openImportPicker(): void {
    this.reset();
    this.importInput()?.nativeElement.click();
  }

  protected async onImportFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const confirmed = confirm(
      'Importing will replace all current data. Continue?'
    );
    if (!confirmed) return;

    this.busy.set(true);
    try {
      await this.backup.importFromFile(file);
      this.status.set('Backup imported. Reloading…');
      setTimeout(() => location.reload(), 600);
    } catch (err) {
      this.error.set(this.errMessage(err, 'Import failed.'));
      this.busy.set(false);
    }
  }

  protected async requestPersistence(): Promise<void> {
    this.reset();
    const granted = await this.storage.requestPersistence();
    this.status.set(
      granted
        ? 'Storage is now persistent — browser will not auto-evict it.'
        : 'The browser declined persistent storage for now.'
    );
  }

  private reset(): void {
    this.status.set(null);
    this.error.set(null);
  }

  private errMessage(err: unknown, fallback: string): string {
    if (err instanceof Error && err.message) return err.message;
    if (typeof err === 'string') return err;
    return fallback;
  }
}
