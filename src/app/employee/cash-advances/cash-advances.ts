import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../auth/auth.service';
import {
  AvailabilityInfo,
  CashAdvance,
  CashAdvanceService,
} from '../../cash-advance/cash-advance.service';
import { PreferencesService } from '../../preferences/preferences.service';

@Component({
  selector: 'app-employee-cash-advances',
  imports: [DatePipe, FormsModule],
  templateUrl: './cash-advances.html',
  styleUrl: './cash-advances.css',
})
export class EmployeeCashAdvances {
  private readonly service = inject(CashAdvanceService);
  private readonly auth = inject(AuthService);
  private readonly preferences = inject(PreferencesService);

  protected readonly advances = signal<CashAdvance[]>([]);
  protected readonly availability = signal<AvailabilityInfo | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly status = signal<string | null>(null);

  protected readonly modalOpen = signal(false);
  protected readonly cancelConfirmId = signal<number | null>(null);
  protected readonly form = signal({ amount: 0, reason: '' });

  protected readonly pendingCount = computed(
    () => this.advances().filter((a) => a.status === 'PENDING').length
  );
  protected readonly approvedCount = computed(
    () => this.advances().filter((a) => a.status === 'APPROVED').length
  );

  constructor() {
    this.load();
  }

  // Formatting

  protected formatMoney(amount: number): string {
    return this.preferences.formatAmount(amount);
  }

  protected statusBadge(status: CashAdvance['status']): string {
    switch (status) {
      case 'PENDING':
        return 'badge-warn';
      case 'APPROVED':
        return 'badge-good';
      case 'REJECTED':
        return 'badge-danger';
      case 'DEDUCTED':
        return 'badge-info';
      case 'CANCELLED':
        return 'badge-neutral';
    }
  }

  // Modal

  protected openRequest(): void {
    this.reset();
    this.form.set({ amount: 0, reason: '' });
    this.modalOpen.set(true);
  }

  protected closeModal(): void {
    this.modalOpen.set(false);
  }

  protected updateField(field: 'amount' | 'reason', value: number | string): void {
    this.form.update((f) => ({ ...f, [field]: value }));
  }

  protected async submit(): Promise<void> {
    this.error.set(null);
    try {
      const data = this.form();
      await this.service.request(Number(data.amount), String(data.reason));
      this.status.set('Cash advance requested. Waiting for admin approval.');
      this.modalOpen.set(false);
      await this.load();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not submit request');
    }
  }

  protected confirmCancel(id: number): void {
    this.cancelConfirmId.set(id);
  }

  protected dismissCancel(): void {
    this.cancelConfirmId.set(null);
  }

  protected async cancel(id: number): Promise<void> {
    try {
      await this.service.cancel(id);
      this.cancelConfirmId.set(null);
      this.status.set('Request cancelled.');
      await this.load();
    } catch (err) {
      this.cancelConfirmId.set(null);
      this.error.set(err instanceof Error ? err.message : 'Could not cancel');
    }
  }

  // Helpers

  private async load(): Promise<void> {
    const user = this.auth.user();
    if (!user) return;
    this.loading.set(true);
    try {
      const [advances, availability] = await Promise.all([
        this.service.findMine(),
        this.service.computeAvailable(user.id),
      ]);
      this.advances.set(advances);
      this.availability.set(availability);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not load data');
    } finally {
      this.loading.set(false);
    }
  }

  private reset(): void {
    this.error.set(null);
    this.status.set(null);
  }
}
