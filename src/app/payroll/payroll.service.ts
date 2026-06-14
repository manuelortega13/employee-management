import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { CashAdvanceService } from '../cash-advance/cash-advance.service';
import { db } from '../data/db';
import {
  AttendanceRecordRow,
  EmployeeRecord,
  PayrollRecord,
  PayrollStatus,
} from '../data/types';
import { PreferencesService } from '../preferences/preferences.service';

export interface PayrollComputation {
  employeeId: number;
  periodStart: string;
  periodEnd: string;
  dailyRate: number;
  workHoursPerDay: number;
  hourlyRate: number;
  totalHoursMs: number;
  totalBreakMs: number;
  daysComplete: number;
  daysIncomplete: number;
  grossSalary: number;
  outstandingAdvanceTotal: number;
  outstandingAdvanceCount: number;
}

export interface GeneratePayrollInput {
  employeeId: number;
  periodStart: string;
  periodEnd: string;
  deductions?: number;
  bonuses?: number;
  notes?: string;
}

export interface UpdatePayrollInput {
  deductions?: number;
  bonuses?: number;
  notes?: string;
}

export interface PayrollFilters {
  status?: PayrollStatus | 'ALL';
  employeeId?: number | null;
  from?: string;
  to?: string;
}

const HOUR_MS = 60 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class PayrollService {
  private readonly auth = inject(AuthService);
  private readonly preferences = inject(PreferencesService);
  private readonly cashAdvances = inject(CashAdvanceService);

  async computePreview(
    employeeId: number,
    periodStart: string,
    periodEnd: string
  ): Promise<PayrollComputation> {
    const { employee, attendance } = await this.loadInputs(employeeId, periodStart, periodEnd);
    const advances = await this.cashAdvances.findOutstandingApproved(employeeId);
    const base = this.compute(employee, attendance, periodStart, periodEnd);
    return {
      ...base,
      outstandingAdvanceTotal: round2(advances.reduce((s, a) => s + a.amount, 0)),
      outstandingAdvanceCount: advances.length,
    };
  }

  async generate(input: GeneratePayrollInput): Promise<PayrollRecord> {
    if (input.periodStart > input.periodEnd) {
      throw new Error('End date must be on or after start date');
    }
    const me = this.auth.user();
    if (!me) throw new Error('You must be signed in');

    const { employee, attendance } = await this.loadInputs(
      input.employeeId,
      input.periodStart,
      input.periodEnd
    );
    const comp = this.compute(employee, attendance, input.periodStart, input.periodEnd);

    const outstandingAdvances = await this.cashAdvances.findOutstandingApproved(input.employeeId);
    const advanceTotal = round2(outstandingAdvances.reduce((s, a) => s + a.amount, 0));

    const manualDeductions = round2(input.deductions ?? 0);
    const deductions = round2(manualDeductions + advanceTotal);
    const bonuses = round2(input.bonuses ?? 0);
    const netSalary = round2(comp.grossSalary + bonuses - deductions);

    const advanceNote =
      outstandingAdvances.length > 0
        ? `Cash advances deducted: ${outstandingAdvances.length} (${advanceTotal.toFixed(2)})`
        : '';
    const noteParts = [input.notes?.trim() ?? '', advanceNote].filter((x) => x.length > 0);

    const now = new Date().toISOString();
    const id = await db.payrolls.add({
      id: undefined as unknown as number,
      employeeId: comp.employeeId,
      periodStart: comp.periodStart,
      periodEnd: comp.periodEnd,
      dailyRate: comp.dailyRate,
      workHoursPerDay: comp.workHoursPerDay,
      hourlyRate: comp.hourlyRate,
      totalHoursMs: comp.totalHoursMs,
      totalBreakMs: comp.totalBreakMs,
      daysComplete: comp.daysComplete,
      daysIncomplete: comp.daysIncomplete,
      grossSalary: comp.grossSalary,
      deductions,
      bonuses,
      netSalary,
      notes: noteParts.join(' · '),
      status: 'DRAFT',
      generatedAt: now,
      generatedById: me.id,
      releasedAt: null,
      releasedById: null,
      cancelledAt: null,
      cancelledById: null,
      voidedAt: null,
      voidedById: null,
      createdAt: now,
      updatedAt: now,
    });

    const newId = id as number;
    for (const adv of outstandingAdvances) {
      await this.cashAdvances.markDeducted(adv.id, newId);
    }

    return (await db.payrolls.get(newId))!;
  }

  async update(id: number, patch: UpdatePayrollInput): Promise<PayrollRecord> {
    const row = await db.payrolls.get(id);
    if (!row) throw new Error('Payroll not found');
    if (row.status !== 'DRAFT') {
      throw new Error('Only DRAFT payrolls can be edited');
    }

    const deductions = round2(patch.deductions ?? row.deductions);
    const bonuses = round2(patch.bonuses ?? row.bonuses);
    const netSalary = round2(row.grossSalary + bonuses - deductions);

    await db.payrolls.update(id, {
      deductions,
      bonuses,
      netSalary,
      ...(patch.notes !== undefined ? { notes: patch.notes.trim() } : {}),
      updatedAt: new Date().toISOString(),
    });
    return (await db.payrolls.get(id))!;
  }

  async release(id: number): Promise<PayrollRecord> {
    const row = await this.assertStatus(id, ['DRAFT']);
    const me = this.requireAdmin();
    const now = new Date().toISOString();
    await db.payrolls.update(id, {
      status: 'RELEASED',
      releasedAt: now,
      releasedById: me.id,
      updatedAt: now,
    });
    return (await db.payrolls.get(id))!;
  }

  async cancel(id: number): Promise<PayrollRecord> {
    const row = await this.assertStatus(id, ['DRAFT']);
    const me = this.requireAdmin();
    const now = new Date().toISOString();
    await db.payrolls.update(id, {
      status: 'CANCELLED',
      cancelledAt: now,
      cancelledById: me.id,
      updatedAt: now,
    });
    await this.cashAdvances.revertDeduction(id);
    return (await db.payrolls.get(id))!;
  }

  async void(id: number): Promise<PayrollRecord> {
    const row = await this.assertStatus(id, ['RELEASED']);
    const me = this.requireAdmin();
    const now = new Date().toISOString();
    await db.payrolls.update(id, {
      status: 'VOIDED',
      voidedAt: now,
      voidedById: me.id,
      updatedAt: now,
    });
    await this.cashAdvances.revertDeduction(id);
    return (await db.payrolls.get(id))!;
  }

  async delete(id: number): Promise<void> {
    const row = await db.payrolls.get(id);
    if (!row) throw new Error('Payroll not found');
    await this.cashAdvances.revertDeduction(id);
    await db.payrolls.delete(id);
  }

  async findAll(filters: PayrollFilters = {}): Promise<PayrollRecord[]> {
    let rows = await db.payrolls.toArray();
    if (filters.status && filters.status !== 'ALL') {
      rows = rows.filter((r) => r.status === filters.status);
    }
    if (filters.employeeId != null) {
      rows = rows.filter((r) => r.employeeId === filters.employeeId);
    }
    if (filters.from) {
      rows = rows.filter((r) => r.periodEnd >= filters.from!);
    }
    if (filters.to) {
      rows = rows.filter((r) => r.periodStart <= filters.to!);
    }
    return rows.sort((a, b) =>
      a.periodStart === b.periodStart
        ? a.createdAt < b.createdAt
          ? 1
          : -1
        : a.periodStart < b.periodStart
        ? 1
        : -1
    );
  }

  async findById(id: number): Promise<PayrollRecord | undefined> {
    return db.payrolls.get(id);
  }

  async bulkGenerate(
    periodStart: string,
    periodEnd: string,
    employeeIds: number[]
  ): Promise<{ created: number; skipped: number; errors: string[] }> {
    let created = 0;
    let skipped = 0;
    const errors: string[] = [];
    for (const id of employeeIds) {
      try {
        const preview = await this.computePreview(id, periodStart, periodEnd);
        if (preview.daysComplete === 0) {
          skipped++;
          continue;
        }
        await this.generate({ employeeId: id, periodStart, periodEnd });
        created++;
      } catch (err) {
        errors.push(err instanceof Error ? err.message : 'Unknown error');
      }
    }
    return { created, skipped, errors };
  }

  private async loadInputs(
    employeeId: number,
    periodStart: string,
    periodEnd: string
  ): Promise<{ employee: EmployeeRecord; attendance: AttendanceRecordRow[] }> {
    const employee = await db.employees.get(employeeId);
    if (!employee) throw new Error('Employee not found');
    const attendance = await db.attendances
      .where('employeeId')
      .equals(employeeId)
      .filter((r) => r.date >= periodStart && r.date <= periodEnd)
      .toArray();
    return { employee, attendance };
  }

  private compute(
    employee: EmployeeRecord,
    attendance: AttendanceRecordRow[],
    periodStart: string,
    periodEnd: string
  ): PayrollComputation {
    const workHoursPerDay = this.preferences.workHoursPerDay();
    const dailyRate = employee.dailyRate ?? 0;
    const hourlyRate = workHoursPerDay > 0 ? dailyRate / workHoursPerDay : 0;

    let totalHoursMs = 0;
    let totalBreakMs = 0;
    let daysComplete = 0;
    let daysIncomplete = 0;

    for (const r of attendance) {
      if (!r.checkOut) {
        daysIncomplete++;
        continue;
      }
      const start = parseUtc(r.checkIn).getTime();
      const end = parseUtc(r.checkOut).getTime();
      const breakMs = r.totalBreakMs ?? 0;
      const worked = Math.max(0, end - start - breakMs);
      totalHoursMs += worked;
      totalBreakMs += breakMs;
      daysComplete++;
    }

    const grossSalary = round2((totalHoursMs / HOUR_MS) * hourlyRate);

    return {
      employeeId: employee.id,
      periodStart,
      periodEnd,
      dailyRate: round2(dailyRate),
      workHoursPerDay,
      hourlyRate: round2(hourlyRate),
      totalHoursMs,
      totalBreakMs,
      daysComplete,
      daysIncomplete,
      grossSalary,
      outstandingAdvanceTotal: 0,
      outstandingAdvanceCount: 0,
    };
  }

  private async assertStatus(id: number, allowed: PayrollStatus[]): Promise<PayrollRecord> {
    const row = await db.payrolls.get(id);
    if (!row) throw new Error('Payroll not found');
    if (!allowed.includes(row.status)) {
      throw new Error(
        `Action not allowed for ${row.status} payroll (requires one of: ${allowed.join(', ')})`
      );
    }
    return row;
  }

  private requireAdmin() {
    const me = this.auth.user();
    if (!me || me.role !== 'ADMIN') throw new Error('Only admins can perform this action');
    return me;
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseUtc(ts: string): Date {
  return new Date(ts.endsWith('Z') ? ts : ts + 'Z');
}
