import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { CashAdvance, CashAdvanceService } from '../../cash-advance/cash-advance.service';
import { CashAdvanceStatus } from '../../data/types';
import { PreferencesService } from '../../preferences/preferences.service';
import { Employee } from '../employees/data/employee.model';
import { EmployeeService } from '../employees/data/employee.service';

type FilterStatus = CashAdvanceStatus | 'ALL';

@Component({
  selector: 'app-admin-cash-advances',
  imports: [DatePipe, FormsModule],
  templateUrl: './cash-advances.html',
  styleUrl: './cash-advances.css',
})
export class AdminCashAdvances {
  private readonly service = inject(CashAdvanceService);
  private readonly employeeService = inject(EmployeeService);
  private readonly preferences = inject(PreferencesService);

  protected readonly advances = signal<CashAdvance[]>([]);
  protected readonly employees = signal<Map<number, Employee>>(new Map());
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly status = signal<string | null>(null);

  protected readonly filter = signal<FilterStatus>('PENDING');
  protected readonly modalOpen = signal(false);
  protected readonly modalAdvance = signal<CashAdvance | null>(null);
  protected readonly modalAction = signal<'APPROVE' | 'REJECT'>('APPROVE');
  protected readonly modalNote = signal('');

  protected readonly filteredAdvances = computed(() => {
    const f = this.filter();
    if (f === 'ALL') return this.advances();
    return this.advances().filter((a) => a.status === f);
  });

  protected readonly counts = computed(() => {
    const all = this.advances();
    return {
      PENDING: all.filter((a) => a.status === 'PENDING').length,
      APPROVED: all.filter((a) => a.status === 'APPROVED').length,
      DEDUCTED: all.filter((a) => a.status === 'DEDUCTED').length,
      REJECTED: all.filter((a) => a.status === 'REJECTED').length,
      CANCELLED: all.filter((a) => a.status === 'CANCELLED').length,
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

  protected openAction(advance: CashAdvance, action: 'APPROVE' | 'REJECT'): void {
    this.error.set(null);
    this.modalAdvance.set(advance);
    this.modalAction.set(action);
    this.modalNote.set('');
    this.modalOpen.set(true);
  }

  protected closeModal(): void {
    this.modalOpen.set(false);
    this.modalAdvance.set(null);
    this.modalNote.set('');
  }

  protected async submitDecision(): Promise<void> {
    const adv = this.modalAdvance();
    if (!adv) return;
    this.error.set(null);
    try {
      if (this.modalAction() === 'APPROVE') {
        await this.service.approve(adv.id, this.modalNote());
        this.status.set('Cash advance approved.');
      } else {
        await this.service.reject(adv.id, this.modalNote());
        this.status.set('Cash advance rejected.');
      }
      this.modalOpen.set(false);
      this.modalAdvance.set(null);
      await this.load();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not submit decision');
    }
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [advances, employees] = await Promise.all([
        this.service.findAll(),
        firstValueFrom(this.employeeService.findAll()),
      ]);
      this.advances.set(advances);
      const map = new Map<number, Employee>();
      for (const e of employees) map.set(e.id, e);
      this.employees.set(map);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not load advances');
    } finally {
      this.loading.set(false);
    }
  }
}
