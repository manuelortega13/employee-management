import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BackupService } from '../backup/backup.service';
import { BrandingService } from '../branding/branding.service';
import { applyManifest } from '../branding/manifest';
import { StorageService } from '../data/storage.service';
import { CURRENCIES, PreferencesService } from '../preferences/preferences.service';
import { ConfirmService } from '../shared/confirm.service';

@Component({
  selector: 'app-settings',
  imports: [DatePipe, FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
})
export class Settings {
  private readonly backup = inject(BackupService);
  private readonly storage = inject(StorageService);
  private readonly branding = inject(BrandingService);
  private readonly preferences = inject(PreferencesService);
  private readonly confirmService = inject(ConfirmService);

  protected readonly lastBackupAt = this.backup.lastBackupAt;
  protected readonly folderName = this.backup.folderName;
  protected readonly fsaSupported = this.backup.fsaSupported;
  protected readonly persisted = this.storage.persisted;
  protected readonly quota = this.storage.quota;
  protected readonly logo = this.branding.logo;
  protected readonly companyName = this.branding.companyName;
  protected readonly companyNameDraft = signal(this.branding.companyName());
  protected readonly currency = this.preferences.currency;
  protected readonly currencies = CURRENCIES;
  protected readonly workHoursPerDay = this.preferences.workHoursPerDay;

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
  protected readonly logoInput = viewChild<ElementRef<HTMLInputElement>>('logoInput');

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

    const confirmed = await this.confirmService.ask({
      title: 'Import backup?',
      message:
        'This will replace ALL current data with the contents of the backup file. Continue?',
      confirmText: 'Replace data',
      cancelText: 'Keep current',
      variant: 'danger',
    });
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
    if (granted) {
      this.status.set('Storage is now persistent — browser will not auto-evict it.');
    } else {
      this.error.set(
        'The browser did not grant persistent storage. On Chrome/Edge, installing this site as a PWA is the most reliable way to enable it — look for the install icon in your address bar, or use Settings → Cast/Save & Share → Install.'
      );
    }
  }

  protected openLogoPicker(): void {
    this.reset();
    this.logoInput()?.nativeElement.click();
  }

  protected async onLogoFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.busy.set(true);
    try {
      await this.branding.setLogoFromFile(file);
      applyManifest(this.branding.logo(), this.branding.companyName());
      this.status.set('Logo updated. Reinstall the app to refresh the icon on already-installed PWAs.');
    } catch (err) {
      this.error.set(this.errMessage(err, 'Could not set logo.'));
    } finally {
      this.busy.set(false);
    }
  }

  protected async commitCompanyName(): Promise<void> {
    this.reset();
    const draft = this.companyNameDraft().trim();
    if (!draft || draft === this.branding.companyName()) {
      this.companyNameDraft.set(this.branding.companyName());
      return;
    }
    try {
      await this.branding.setCompanyName(draft);
      applyManifest(this.branding.logo(), this.branding.companyName());
      this.status.set('Name updated.');
    } catch (err) {
      this.companyNameDraft.set(this.branding.companyName());
      this.error.set(this.errMessage(err, 'Could not update name.'));
    }
  }

  protected async onWorkHoursChange(value: number): Promise<void> {
    this.reset();
    try {
      await this.preferences.setWorkHoursPerDay(value);
      this.status.set('Standard work hours updated.');
    } catch (err) {
      this.error.set(this.errMessage(err, 'Could not update work hours.'));
    }
  }

  protected async onCurrencyChange(code: string): Promise<void> {
    this.reset();
    try {
      await this.preferences.setCurrency(code);
      this.status.set('Currency updated.');
    } catch (err) {
      this.error.set(this.errMessage(err, 'Could not update currency.'));
    }
  }

  protected previewAmount(): string {
    return this.preferences.formatAmount(1234.5);
  }

  protected async removeLogo(): Promise<void> {
    this.reset();
    this.busy.set(true);
    try {
      await this.branding.clearLogo();
      applyManifest(null, this.branding.companyName());
      this.status.set('Logo removed.');
    } finally {
      this.busy.set(false);
    }
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
