import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Employee } from '../employees/data/employee.model';
import { EmployeeService } from '../employees/data/employee.service';
import { RequestStatus, RequestType } from '../../data/types';
import { RequestService, TimeOffRequest } from '../../requests/request.service';

type FilterStatus = RequestStatus | 'ALL';

@Component({
  selector: 'app-admin-requests',
  imports: [DatePipe, FormsModule],
  templateUrl: './requests.html',
  styleUrl: './requests.css',
})
export class AdminRequests {
  private readonly service = inject(RequestService);
  private readonly employeeService = inject(EmployeeService);

  protected readonly requests = signal<TimeOffRequest[]>([]);
  protected readonly employees = signal<Map<number, Employee>>(new Map());
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly status = signal<string | null>(null);

  protected readonly filter = signal<FilterStatus>('PENDING');
  protected readonly modalOpen = signal(false);
  protected readonly modalRequest = signal<TimeOffRequest | null>(null);
  protected readonly modalDecision = signal<'APPROVED' | 'REJECTED'>('APPROVED');
  protected readonly modalNote = signal('');

  protected readonly filteredRequests = computed(() => {
    const f = this.filter();
    if (f === 'ALL') return this.requests();
    return this.requests().filter((r) => r.status === f);
  });

  protected readonly counts = computed(() => {
    const all = this.requests();
    return {
      PENDING: all.filter((r) => r.status === 'PENDING').length,
      APPROVED: all.filter((r) => r.status === 'APPROVED').length,
      REJECTED: all.filter((r) => r.status === 'REJECTED').length,
      CANCELLED: all.filter((r) => r.status === 'CANCELLED').length,
    };
  });

  constructor() {
    this.load();
  }

  protected setFilter(f: FilterStatus): void {
    this.filter.set(f);
  }

  protected employeeName(id: number): string {
    const e = this.employees().get(id);
    return e ? `${e.firstName} ${e.lastName}` : `Employee #${id}`;
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

  protected openDecision(req: TimeOffRequest, decision: 'APPROVED' | 'REJECTED'): void {
    this.modalRequest.set(req);
    this.modalDecision.set(decision);
    this.modalNote.set('');
    this.error.set(null);
    this.modalOpen.set(true);
  }

  protected closeModal(): void {
    this.modalOpen.set(false);
    this.modalRequest.set(null);
    this.modalNote.set('');
  }

  protected async submitDecision(): Promise<void> {
    const req = this.modalRequest();
    if (!req) return;
    this.error.set(null);
    try {
      await this.service.decide(req.id, {
        status: this.modalDecision(),
        decisionNote: this.modalNote(),
      });
      this.status.set(
        this.modalDecision() === 'APPROVED' ? 'Request approved.' : 'Request rejected.'
      );
      this.modalOpen.set(false);
      this.modalRequest.set(null);
      await this.load();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not submit decision');
    }
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [requests, employees] = await Promise.all([
        this.service.findAll(),
        firstValueFrom(this.employeeService.findAll()),
      ]);
      this.requests.set(requests);
      const map = new Map<number, Employee>();
      for (const e of employees) map.set(e.id, e);
      this.employees.set(map);
    } finally {
      this.loading.set(false);
    }
  }
}
