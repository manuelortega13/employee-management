import { db } from './db';
import { hashPassword } from './password';

const SEEDED_FLAG = 'seeded';

export async function seedIfEmpty(): Promise<void> {
  const flag = await db.meta.get(SEEDED_FLAG);
  if (flag) return;

  const count = await db.employees.count();
  if (count > 0) {
    await db.meta.put({ key: SEEDED_FLAG, value: 'true' });
    return;
  }

  const { hash, salt } = await hashPassword('pass123');
  const now = new Date().toISOString();

  await db.employees.add({
    id: undefined as unknown as number,
    firstName: 'Admin',
    lastName: 'User',
    email: 'admin@company.com',
    passwordHash: hash,
    passwordSalt: salt,
    phone: '555-0001',
    position: 'System Administrator',
    departmentId: null,
    dailyRate: 0,
    role: 'ADMIN',
    hireDate: '2024-01-01',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  await db.meta.put({ key: SEEDED_FLAG, value: 'true' });
}
