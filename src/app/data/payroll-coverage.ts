import { db } from './db';

export interface PayrollPeriod {
  start: string;
  end: string;
}

/**
 * Returns the inclusive period ranges of all non-terminal payrolls (DRAFT or RELEASED)
 * for the given employee. CANCELLED and VOIDED payrolls release their dates back
 * into the available pool and are not returned here.
 */
export async function getActivePayrollPeriods(employeeId: number): Promise<PayrollPeriod[]> {
  const rows = await db.payrolls.where('employeeId').equals(employeeId).toArray();
  return rows
    .filter((p) => p.status === 'DRAFT' || p.status === 'RELEASED')
    .map((p) => ({ start: p.periodStart, end: p.periodEnd }));
}

export function isDateCovered(date: string, periods: PayrollPeriod[]): boolean {
  return periods.some((p) => date >= p.start && date <= p.end);
}
