import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { db } from '../data/db';
import { getActivePayrollPeriods, isDateCovered } from '../data/payroll-coverage';
import { CashAdvanceRecord, CashAdvanceStatus } from '../data/types';
import { PreferencesService } from '../preferences/preferences.service';

export interface CashAdvance {
  id: number;
  employeeId: number;
  amount: number;
  reason: string;
  status: CashAdvanceStatus;
  decisionNote: string | null;
  decidedById: number | null;
  decidedAt: string | null;
  deductedAt: string | null;
  deductedPayrollId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface AvailabilityInfo {
  earned: number;
  outstandingApproved: number;
  available: number;
  hoursWorkedMs: number;
  hourlyRate: number;
  since: string;
}

const HOUR_MS = 60 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class CashAdvanceService {
  private readonly auth = inject(AuthService);
  private readonly preferences = inject(PreferencesService);

  async findMine(): Promise<CashAdvance[]> {
    const user = this.auth.user();
    if (!user) return [];
    return this.findByEmployee(user.id);
  }

  async findByEmployee(employeeId: number): Promise<CashAdvance[]> {
    const rows = await db.cashAdvances.where('employeeId').equals(employeeId).toArray();
    return sortedNewestFirst(rows).map(toAdvance);
  }

  async findAll(): Promise<CashAdvance[]> {
    const rows = await db.cashAdvances.toArray();
    return sortedNewestFirst(rows).map(toAdvance);
  }

  async findOutstandingApproved(employeeId: number): Promise<CashAdvance[]> {
    const rows = await db.cashAdvances
      .where('[employeeId+status]')
      .equals([employeeId, 'APPROVED'])
      .toArray();
    return rows.map(toAdvance);
  }

  async computeAvailable(employeeId: number): Promise<AvailabilityInfo> {
    const employee = await db.employees.get(employeeId);
    if (!employee) throw new Error('Employee not found');

    const coveredPeriods = await getActivePayrollPeriods(employeeId);
    const since = coveredPeriods.reduce<string>(
      (max, p) => (p.end > max ? p.end : max),
      '0000-01-01'
    );
    const today = formatIsoDate(new Date());

    const attendance = await db.attendances
      .where('employeeId')
      .equals(employeeId)
      .filter((r) => r.date > since && r.date <= today)
      .toArray();

    let hoursWorkedMs = 0;
    for (const r of attendance) {
      if (!r.checkOut) continue;
      if (isDateCovered(r.date, coveredPeriods)) continue;
      const start = parseUtc(r.checkIn).getTime();
      const end = parseUtc(r.checkOut).getTime();
      hoursWorkedMs += Math.max(0, end - start - (r.totalBreakMs ?? 0));
    }

    const workHoursPerDay = this.preferences.workHoursPerDay();
    const hourlyRate = workHoursPerDay > 0 ? (employee.dailyRate ?? 0) / workHoursPerDay : 0;
    const earned = round2((hoursWorkedMs / HOUR_MS) * hourlyRate);

    const outstanding = await this.findOutstandingApproved(employeeId);
    const outstandingApproved = round2(outstanding.reduce((s, a) => s + a.amount, 0));

    const available = Math.max(0, round2(earned - outstandingApproved));

    return {
      earned,
      outstandingApproved,
      available,
      hoursWorkedMs,
      hourlyRate: round2(hourlyRate),
      since: since === '0000-01-01' ? 'since hire' : since,
    };
  }

  async request(amount: number, reason: string): Promise<CashAdvance> {
    const user = this.auth.user();
    if (!user) throw new Error('You must be signed in');
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Amount must be greater than zero');
    }
    if (!reason.trim()) {
      throw new Error('Please provide a reason');
    }

    const availability = await this.computeAvailable(user.id);
    if (amount > availability.available + 0.005) {
      throw new Error(
        `Amount exceeds available cap. You can request up to ${availability.available.toFixed(2)}.`
      );
    }

    const now = new Date().toISOString();
    const id = await db.cashAdvances.add({
      id: undefined as unknown as number,
      employeeId: user.id,
      amount: round2(amount),
      reason: reason.trim(),
      status: 'PENDING',
      decisionNote: null,
      decidedById: null,
      decidedAt: null,
      deductedAt: null,
      deductedPayrollId: null,
      createdAt: now,
      updatedAt: now,
    });
    return toAdvance((await db.cashAdvances.get(id as number))!);
  }

  async cancel(id: number): Promise<void> {
    const user = this.auth.user();
    if (!user) throw new Error('You must be signed in');
    const row = await db.cashAdvances.get(id);
    if (!row) throw new Error('Cash advance not found');
    if (row.employeeId !== user.id) throw new Error('You can only cancel your own requests');
    if (row.status !== 'PENDING') throw new Error('Only pending requests can be cancelled');
    await db.cashAdvances.update(id, {
      status: 'CANCELLED',
      updatedAt: new Date().toISOString(),
    });
  }

  async approve(id: number, note: string): Promise<void> {
    const me = this.requireAdmin();
    const row = await db.cashAdvances.get(id);
    if (!row) throw new Error('Cash advance not found');
    if (row.status !== 'PENDING') throw new Error('Only pending requests can be approved');
    const now = new Date().toISOString();
    await db.cashAdvances.update(id, {
      status: 'APPROVED',
      decisionNote: note.trim() || null,
      decidedById: me.id,
      decidedAt: now,
      updatedAt: now,
    });
  }

  async reject(id: number, note: string): Promise<void> {
    const me = this.requireAdmin();
    const row = await db.cashAdvances.get(id);
    if (!row) throw new Error('Cash advance not found');
    if (row.status !== 'PENDING') throw new Error('Only pending requests can be rejected');
    const now = new Date().toISOString();
    await db.cashAdvances.update(id, {
      status: 'REJECTED',
      decisionNote: note.trim() || null,
      decidedById: me.id,
      decidedAt: now,
      updatedAt: now,
    });
  }

  async markDeducted(id: number, payrollId: number): Promise<void> {
    const row = await db.cashAdvances.get(id);
    if (!row) throw new Error('Cash advance not found');
    if (row.status !== 'APPROVED') {
      throw new Error('Only approved advances can be deducted');
    }
    const now = new Date().toISOString();
    await db.cashAdvances.update(id, {
      status: 'DEDUCTED',
      deductedAt: now,
      deductedPayrollId: payrollId,
      updatedAt: now,
    });
  }

  async revertDeduction(payrollId: number): Promise<number> {
    const rows = await db.cashAdvances.toArray();
    const targets = rows.filter(
      (r) => r.status === 'DEDUCTED' && r.deductedPayrollId === payrollId
    );
    const now = new Date().toISOString();
    for (const r of targets) {
      await db.cashAdvances.update(r.id, {
        status: 'APPROVED',
        deductedAt: null,
        deductedPayrollId: null,
        updatedAt: now,
      });
    }
    return targets.length;
  }

  async delete(id: number): Promise<void> {
    const row = await db.cashAdvances.get(id);
    if (!row) throw new Error('Cash advance not found');
    if (row.status === 'DEDUCTED') {
      throw new Error('Cannot delete a deducted advance. Void the linked payroll first.');
    }
    await db.cashAdvances.delete(id);
  }

  private requireAdmin() {
    const me = this.auth.user();
    if (!me || me.role !== 'ADMIN') throw new Error('Only admins can perform this action');
    return me;
  }
}

function toAdvance(row: CashAdvanceRecord): CashAdvance {
  return { ...row };
}

function sortedNewestFirst(rows: CashAdvanceRecord[]): CashAdvanceRecord[] {
  return [...rows].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseUtc(ts: string): Date {
  return new Date(ts.endsWith('Z') ? ts : ts + 'Z');
}
