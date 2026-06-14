import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../auth/auth.service';
import { PayrollRecord } from '../../data/types';
import { PayrollService } from '../../payroll/payroll.service';
import { PreferencesService } from '../../preferences/preferences.service';

@Component({
  selector: 'app-employee-payrolls',
  imports: [DatePipe],
  templateUrl: './payrolls.html',
  styleUrl: './payrolls.css',
})
export class EmployeePayrolls {
  private readonly service = inject(PayrollService);
  private readonly auth = inject(AuthService);
  private readonly preferences = inject(PreferencesService);

  protected readonly payrolls = signal<PayrollRecord[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly detailRecord = signal<PayrollRecord | null>(null);

  protected readonly totals = computed(() => {
    const rows = this.payrolls();
    return {
      count: rows.length,
      gross: rows.reduce((s, r) => s + r.grossSalary, 0),
      net: rows.reduce((s, r) => s + r.netSalary, 0),
    };
  });

  constructor() {
    this.load();
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

  protected openDetail(record: PayrollRecord): void {
    this.detailRecord.set(record);
  }

  protected closeDetail(): void {
    this.detailRecord.set(null);
  }

  protected printDetail(): void {
    window.print();
  }

  private async load(): Promise<void> {
    const user = this.auth.user();
    if (!user) return;
    this.loading.set(true);
    try {
      const rows = await this.service.findAll({
        status: 'RELEASED',
        employeeId: user.id,
      });
      this.payrolls.set(rows);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not load payrolls.');
    } finally {
      this.loading.set(false);
    }
  }
}
