import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { PayrollRecord, PayrollStatus } from '../../data/types';
import {
  GeneratePayrollInput,
  PayrollComputation,
  PayrollService,
} from '../../payroll/payroll.service';
import { PreferencesService } from '../../preferences/preferences.service';
import { ConfirmService } from '../../shared/confirm.service';
import { formatLocalDate } from '../../shared/date-util';
import { Employee } from '../employees/data/employee.model';
import { EmployeeService } from '../employees/data/employee.service';

type FilterStatus = PayrollStatus | 'ALL';

@Component({
  selector: 'app-admin-payroll',
  imports: [DatePipe, FormsModule],
  templateUrl: './payroll.html',
  styleUrl: './payroll.css',
})
export class AdminPayroll {
  private readonly service = inject(PayrollService);
  private readonly employeeService = inject(EmployeeService);
  private readonly preferences = inject(PreferencesService);
  private readonly confirmService = inject(ConfirmService);

  protected readonly payrolls = signal<PayrollRecord[]>([]);
  protected readonly employees = signal<Employee[]>([]);
  protected readonly employeeMap = computed(() => {
    const map = new Map<number, Employee>();
    for (const e of this.employees()) map.set(e.id, e);
    return map;
  });

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly status = signal<string | null>(null);

  protected readonly filter = signal<FilterStatus>('ALL');
  protected readonly filterEmployeeId = signal<number | null>(null);

  // Generate modal
  protected readonly generateOpen = signal(false);
  protected readonly generateBusy = signal(false);
  protected readonly preview = signal<PayrollComputation | null>(null);
  protected readonly generateForm = signal<GeneratePayrollInput>({
    employeeId: 0,
    periodStart: '',
    periodEnd: '',
    deductions: 0,
    bonuses: 0,
    notes: '',
  });

  // Detail / edit modal
  protected readonly detailOpen = signal(false);
  protected readonly detailRecord = signal<PayrollRecord | null>(null);
  protected readonly detailEditing = signal(false);
  protected readonly editForm = signal({ deductions: 0, bonuses: 0, notes: '' });

  // Bulk modal
  protected readonly bulkOpen = signal(false);
  protected readonly bulkBusy = signal(false);
  protected readonly bulkForm = signal({
    periodStart: '',
    periodEnd: '',
    employeeIds: new Set<number>(),
  });

  protected readonly confirmDeleteId = signal<number | null>(null);

  protected readonly filteredPayrolls = computed(() => {
    const status = this.filter();
    const employeeId = this.filterEmployeeId();
    return this.payrolls().filter((p) => {
      if (status !== 'ALL' && p.status !== status) return false;
      if (employeeId !== null && p.employeeId !== employeeId) return false;
      return true;
    });
  });

  protected readonly counts = computed(() => {
    const all = this.payrolls();
    return {
      DRAFT: all.filter((p) => p.status === 'DRAFT').length,
      RELEASED: all.filter((p) => p.status === 'RELEASED').length,
      CANCELLED: all.filter((p) => p.status === 'CANCELLED').length,
      VOIDED: all.filter((p) => p.status === 'VOIDED').length,
    };
  });

  protected readonly totals = computed(() => {
    const rows = this.filteredPayrolls();
    return {
      count: rows.length,
      gross: rows.reduce((s, r) => s + r.grossSalary, 0),
      net: rows.reduce((s, r) => s + r.netSalary, 0),
      pending: rows.filter((r) => r.status === 'DRAFT').length,
    };
  });

  constructor() {
    this.load();
  }

  // Loading

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [payrolls, employees] = await Promise.all([
        this.service.findAll(),
        firstValueFrom(this.employeeService.findAll()),
      ]);
      this.payrolls.set(payrolls);
      this.employees.set(employees);
    } catch (err) {
      this.error.set(this.errMessage(err, 'Could not load payrolls.'));
    } finally {
      this.loading.set(false);
    }
  }

  // Filter

  protected setFilter(f: FilterStatus): void {
    this.filter.set(f);
  }

  protected setFilterEmployee(id: string | number | null): void {
    if (id === '' || id === null) this.filterEmployeeId.set(null);
    else this.filterEmployeeId.set(+id);
  }

  protected employeeName(id: number): string {
    const e = this.employeeMap().get(id);
    return e ? `${e.firstName} ${e.lastName}` : `Employee #${id}`;
  }

  protected statusBadge(s: PayrollStatus): string {
    switch (s) {
      case 'DRAFT':
        return 'badge-warn';
      case 'RELEASED':
        return 'badge-good';
      case 'CANCELLED':
        return 'badge-neutral';
      case 'VOIDED':
        return 'badge-danger';
    }
  }

  protected formatMoney(amount: number): string {
    return this.preferences.formatAmount(amount ?? 0);
  }

  protected formatHours(ms: number): string {
    const totalMinutes = Math.floor(ms / 60000);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}h ${m}m`;
  }

  // Generate modal

  protected openGenerate(): void {
    this.reset();
    this.preview.set(null);
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    this.generateForm.set({
      employeeId: this.employees()[0]?.id ?? 0,
      periodStart: formatIsoDate(start),
      periodEnd: formatIsoDate(today),
      deductions: 0,
      bonuses: 0,
      notes: '',
    });
    this.generateOpen.set(true);
    void this.refreshPreview();
  }

  protected closeGenerate(): void {
    this.generateOpen.set(false);
    this.preview.set(null);
  }

  protected updateGenerateField<K extends keyof GeneratePayrollInput>(
    field: K,
    value: GeneratePayrollInput[K]
  ): void {
    this.generateForm.update((f) => ({ ...f, [field]: value }));
    if (field === 'employeeId' || field === 'periodStart' || field === 'periodEnd') {
      void this.refreshPreview();
    }
  }

  private async refreshPreview(): Promise<void> {
    const f = this.generateForm();
    if (!f.employeeId || !f.periodStart || !f.periodEnd) {
      this.preview.set(null);
      return;
    }
    try {
      const comp = await this.service.computePreview(f.employeeId, f.periodStart, f.periodEnd);
      this.preview.set(comp);
    } catch (err) {
      this.preview.set(null);
      this.error.set(this.errMessage(err, 'Could not compute preview.'));
    }
  }

  protected previewNet(): number {
    const comp = this.preview();
    if (!comp) return 0;
    const f = this.generateForm();
    return comp.grossSalary + (f.bonuses ?? 0) - (f.deductions ?? 0) - comp.outstandingAdvanceTotal;
  }

  protected async submitGenerate(): Promise<void> {
    this.error.set(null);
    this.generateBusy.set(true);
    try {
      await this.service.generate(this.generateForm());
      this.status.set('Payroll generated as DRAFT.');
      this.generateOpen.set(false);
      await this.load();
    } catch (err) {
      this.error.set(this.errMessage(err, 'Could not generate payroll.'));
    } finally {
      this.generateBusy.set(false);
    }
  }

  // Detail / edit / actions

  protected openDetail(record: PayrollRecord): void {
    this.reset();
    this.detailRecord.set(record);
    this.detailEditing.set(false);
    this.editForm.set({
      deductions: record.deductions,
      bonuses: record.bonuses,
      notes: record.notes,
    });
    this.detailOpen.set(true);
  }

  protected closeDetail(): void {
    this.detailOpen.set(false);
    this.detailRecord.set(null);
    this.detailEditing.set(false);
  }

  protected enterEditMode(): void {
    const r = this.detailRecord();
    if (!r || r.status !== 'DRAFT') return;
    this.editForm.set({
      deductions: r.deductions,
      bonuses: r.bonuses,
      notes: r.notes,
    });
    this.detailEditing.set(true);
  }

  protected updateEditField<K extends keyof ReturnType<typeof this.editForm>>(
    field: K,
    value: ReturnType<typeof this.editForm>[K]
  ): void {
    this.editForm.update((f) => ({ ...f, [field]: value }));
  }

  protected async saveEdit(): Promise<void> {
    const r = this.detailRecord();
    if (!r) return;
    try {
      const updated = await this.service.update(r.id, this.editForm());
      this.detailRecord.set(updated);
      this.detailEditing.set(false);
      this.status.set('Payroll updated.');
      await this.load();
    } catch (err) {
      this.error.set(this.errMessage(err, 'Could not update payroll.'));
    }
  }

  protected async release(): Promise<void> {
    const r = this.detailRecord();
    if (!r) return;
    const ok = await this.confirmService.ask({
      title: 'Release payroll?',
      message:
        'This marks the payroll as RELEASED. Released payrolls cannot be edited afterwards — only voided.',
      confirmText: 'Release',
      variant: 'primary',
    });
    if (!ok) return;
    try {
      const updated = await this.service.release(r.id);
      this.detailRecord.set(updated);
      this.status.set('Payroll released.');
      await this.load();
    } catch (err) {
      this.error.set(this.errMessage(err, 'Could not release.'));
    }
  }

  protected async cancel(): Promise<void> {
    const r = this.detailRecord();
    if (!r) return;
    const ok = await this.confirmService.ask({
      title: 'Cancel payroll?',
      message: 'The draft will be kept on file but marked CANCELLED.',
      confirmText: 'Cancel payroll',
      cancelText: 'Keep draft',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      const updated = await this.service.cancel(r.id);
      this.detailRecord.set(updated);
      this.status.set('Payroll cancelled.');
      await this.load();
    } catch (err) {
      this.error.set(this.errMessage(err, 'Could not cancel.'));
    }
  }

  protected async voidPayroll(): Promise<void> {
    const r = this.detailRecord();
    if (!r) return;
    const ok = await this.confirmService.ask({
      title: 'Void this released payroll?',
      message:
        'Use this if the payment was reversed. Any cash advances deducted by this payroll will become available again.',
      confirmText: 'Void payroll',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      const updated = await this.service.void(r.id);
      this.detailRecord.set(updated);
      this.status.set('Payroll voided.');
      await this.load();
    } catch (err) {
      this.error.set(this.errMessage(err, 'Could not void.'));
    }
  }

  protected confirmDelete(id: number): void {
    this.confirmDeleteId.set(id);
  }

  protected dismissDelete(): void {
    this.confirmDeleteId.set(null);
  }

  protected async deletePayroll(id: number): Promise<void> {
    try {
      await this.service.delete(id);
      this.confirmDeleteId.set(null);
      this.closeDetail();
      this.status.set('Payroll deleted.');
      await this.load();
    } catch (err) {
      this.error.set(this.errMessage(err, 'Could not delete.'));
    }
  }

  // Print

  protected printDetail(): void {
    window.print();
  }

  // CSV export

  protected exportCsv(): void {
    const rows = this.filteredPayrolls();
    if (rows.length === 0) {
      this.error.set('Nothing to export for the current filter.');
      return;
    }
    const header = [
      'Employee',
      'Period Start',
      'Period End',
      'Status',
      'Days',
      'Hours Worked',
      'Daily Rate',
      'Hourly Rate',
      'Gross',
      'Deductions',
      'Bonuses',
      'Net',
      'Released At',
    ];
    const lines = rows.map((r) =>
      [
        csvCell(this.employeeName(r.employeeId)),
        r.periodStart,
        r.periodEnd,
        r.status,
        r.daysComplete,
        (r.totalHoursMs / (60 * 60 * 1000)).toFixed(2),
        r.dailyRate.toFixed(2),
        r.hourlyRate.toFixed(2),
        r.grossSalary.toFixed(2),
        r.deductions.toFixed(2),
        r.bonuses.toFixed(2),
        r.netSalary.toFixed(2),
        r.releasedAt ?? '',
      ].join(',')
    );
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `payroll-${formatIsoDate(new Date())}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  // Bulk generate

  protected openBulk(): void {
    this.reset();
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    this.bulkForm.set({
      periodStart: formatIsoDate(start),
      periodEnd: formatIsoDate(today),
      employeeIds: new Set(this.employees().filter((e) => e.isActive).map((e) => e.id)),
    });
    this.bulkOpen.set(true);
  }

  protected closeBulk(): void {
    this.bulkOpen.set(false);
  }

  protected updateBulkPeriod(field: 'periodStart' | 'periodEnd', value: string): void {
    this.bulkForm.update((f) => ({ ...f, [field]: value }));
  }

  protected toggleBulkEmployee(id: number, checked: boolean): void {
    this.bulkForm.update((f) => {
      const next = new Set(f.employeeIds);
      if (checked) next.add(id);
      else next.delete(id);
      return { ...f, employeeIds: next };
    });
  }

  protected isBulkEmployeeSelected(id: number): boolean {
    return this.bulkForm().employeeIds.has(id);
  }

  protected async runBulk(): Promise<void> {
    const f = this.bulkForm();
    if (f.employeeIds.size === 0) {
      this.error.set('Pick at least one employee.');
      return;
    }
    this.bulkBusy.set(true);
    try {
      const result = await this.service.bulkGenerate(
        f.periodStart,
        f.periodEnd,
        Array.from(f.employeeIds)
      );
      this.bulkOpen.set(false);
      this.status.set(
        `Generated ${result.created} DRAFT payroll(s)` +
          (result.skipped > 0 ? `, skipped ${result.skipped} (no attendance)` : '') +
          (result.errors.length > 0 ? `, ${result.errors.length} error(s)` : '') +
          '.'
      );
      await this.load();
    } catch (err) {
      this.error.set(this.errMessage(err, 'Bulk generation failed.'));
    } finally {
      this.bulkBusy.set(false);
    }
  }

  // Helpers

  private reset(): void {
    this.error.set(null);
    this.status.set(null);
  }

  private errMessage(err: unknown, fallback: string): string {
    if (err instanceof Error && err.message) return err.message;
    return fallback;
  }
}

function formatIsoDate(date: Date): string {
  return formatLocalDate(date);
}

function csvCell(value: string): string {
  if (value == null) return '';
  const escaped = String(value).replace(/"/g, '""');
  return `"${escaped}"`;
}
