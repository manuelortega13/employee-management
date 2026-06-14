import { Injectable, computed, signal } from '@angular/core';
import { db } from '../data/db';

export interface CurrencyOption {
  code: string;
  label: string;
}

export const CURRENCIES: CurrencyOption[] = [
  { code: 'USD', label: 'US Dollar (USD)' },
  { code: 'EUR', label: 'Euro (EUR)' },
  { code: 'GBP', label: 'British Pound (GBP)' },
  { code: 'PHP', label: 'Philippine Peso (PHP)' },
  { code: 'JPY', label: 'Japanese Yen (JPY)' },
  { code: 'AUD', label: 'Australian Dollar (AUD)' },
  { code: 'CAD', label: 'Canadian Dollar (CAD)' },
  { code: 'SGD', label: 'Singapore Dollar (SGD)' },
  { code: 'HKD', label: 'Hong Kong Dollar (HKD)' },
  { code: 'INR', label: 'Indian Rupee (INR)' },
  { code: 'CNY', label: 'Chinese Yuan (CNY)' },
];

const CURRENCY_KEY = 'preferences.currency';
const WORK_HOURS_KEY = 'preferences.workHoursPerDay';
const DEFAULT_CURRENCY = 'USD';
const DEFAULT_WORK_HOURS = 8;

@Injectable({ providedIn: 'root' })
export class PreferencesService {
  readonly currency = signal<string>(DEFAULT_CURRENCY);
  readonly workHoursPerDay = signal<number>(DEFAULT_WORK_HOURS);

  readonly currencyLabel = computed(
    () => CURRENCIES.find((c) => c.code === this.currency())?.label ?? this.currency()
  );

  async init(): Promise<void> {
    const [currencyRow, hoursRow] = await Promise.all([
      db.meta.get(CURRENCY_KEY),
      db.meta.get(WORK_HOURS_KEY),
    ]);
    if (currencyRow?.value) this.currency.set(currencyRow.value);
    if (hoursRow?.value) {
      const n = Number(hoursRow.value);
      if (Number.isFinite(n) && n > 0) this.workHoursPerDay.set(n);
    }
  }

  async setCurrency(code: string): Promise<void> {
    const normalized = code.trim().toUpperCase();
    if (!normalized) return;
    await db.meta.put({ key: CURRENCY_KEY, value: normalized });
    this.currency.set(normalized);
  }

  async setWorkHoursPerDay(value: number): Promise<void> {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error('Work hours per day must be greater than zero');
    }
    await db.meta.put({ key: WORK_HOURS_KEY, value: String(value) });
    this.workHoursPerDay.set(value);
  }

  formatAmount(amount: number): string {
    if (!Number.isFinite(amount)) return '—';
    try {
      return amount.toLocaleString(undefined, {
        style: 'currency',
        currency: this.currency(),
      });
    } catch {
      return `${this.currency()} ${amount.toFixed(2)}`;
    }
  }
}
