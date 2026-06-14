import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, defer, from, map, tap } from 'rxjs';
import { db } from '../data/db';
import { verifyPassword } from '../data/password';

export interface AuthUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: 'ADMIN' | 'EMPLOYEE';
}

interface LoginResponse {
  user: AuthUser;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly router = inject(Router);

  readonly user = signal<AuthUser | null>(this.loadUser());
  readonly isLoggedIn = computed(() => this.user() !== null);
  readonly isAdmin = computed(() => this.user()?.role === 'ADMIN');

  login(email: string, password: string): Observable<LoginResponse> {
    return defer(() => from(this.attemptLogin(email, password))).pipe(
      tap((response) => {
        localStorage.setItem('auth_user', JSON.stringify(response.user));
        this.user.set(response.user);
      }),
      map((response) => response)
    );
  }

  logout(): void {
    localStorage.removeItem('auth_user');
    this.user.set(null);
    this.router.navigate(['/login']);
  }

  redirectAfterLogin(): void {
    const user = this.user();
    if (user?.role === 'ADMIN') {
      this.router.navigate(['/manage']);
    } else {
      this.router.navigate(['/attendance']);
    }
  }

  private async attemptLogin(email: string, password: string): Promise<LoginResponse> {
    const normalized = email.trim().toLowerCase();
    const employee = await db.employees.where('email').equalsIgnoreCase(normalized).first();
    if (!employee || !employee.isActive) {
      throw new Error('Invalid email or password');
    }
    const ok = await verifyPassword(password, employee.passwordHash, employee.passwordSalt);
    if (!ok) {
      throw new Error('Invalid email or password');
    }
    return {
      user: {
        id: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        role: employee.role,
      },
    };
  }

  private loadUser(): AuthUser | null {
    const stored = localStorage.getItem('auth_user');
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
}
