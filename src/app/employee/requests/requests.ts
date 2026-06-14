import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RequestType } from '../../data/types';
import { CreateRequest, RequestService, TimeOffRequest } from '../../requests/request.service';

@Component({
  selector: 'app-employee-requests',
  imports: [DatePipe, FormsModule],
  templateUrl: './requests.html',
  styleUrl: './requests.css',
})
export class EmployeeRequests {
  private readonly service = inject(RequestService);

  protected readonly requests = signal<TimeOffRequest[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly status = signal<string | null>(null);

  protected readonly modalOpen = signal(false);
  protected readonly cancelConfirmId = signal<number | null>(null);

  protected readonly form = signal<CreateRequest>({
    type: 'LEAVE',
    startDate: '',
    endDate: '',
    reason: '',
  });

  protected readonly pendingCount = computed(
    () => this.requests().filter((r) => r.status === 'PENDING').length
  );

  protected readonly approvedCount = computed(
    () => this.requests().filter((r) => r.status === 'APPROVED').length
  );

  constructor() {
    this.load();
  }

  protected openCreate(): void {
    this.error.set(null);
    this.status.set(null);
    this.form.set({ type: 'LEAVE', startDate: '', endDate: '', reason: '' });
    this.modalOpen.set(true);
  }

  protected closeModal(): void {
    this.modalOpen.set(false);
    this.error.set(null);
  }

  protected updateField<K extends keyof CreateRequest>(field: K, value: CreateRequest[K]): void {
    this.form.update((f) => ({ ...f, [field]: value }));
  }

  protected async submit(): Promise<void> {
    this.error.set(null);
    try {
      await this.service.create(this.form());
      this.modalOpen.set(false);
      this.status.set('Request submitted.');
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

  protected async cancelRequest(id: number): Promise<void> {
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

  protected statusBadge(status: TimeOffRequest['status']): string {
    switch (status) {
      case 'PENDING':
        return 'badge-warn';
      case 'APPROVED':
        return 'badge-good';
      case 'REJECTED':
        return 'badge-danger';
      case 'CANCELLED':
        return 'badge-neutral';
    }
  }

  protected typeLabel(type: RequestType): string {
    switch (type) {
      case 'LEAVE':
        return 'Leave';
      case 'SICK':
        return 'Sick';
      case 'OTHER':
        return 'Other';
    }
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.requests.set(await this.service.findMine());
    } finally {
      this.loading.set(false);
    }
  }
}
