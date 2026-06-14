export interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  position: string;
  departmentId: number | null;
  dailyRate: number;
  role: 'ADMIN' | 'EMPLOYEE';
  hireDate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeCreateRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
  position: string;
  departmentId: number | null;
  dailyRate: number;
  role: 'ADMIN' | 'EMPLOYEE';
  hireDate: string;
}

export interface EmployeeUpdateRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  phone?: string;
  position?: string;
  departmentId?: number | null;
  dailyRate?: number;
  role?: 'ADMIN' | 'EMPLOYEE';
  hireDate?: string;
  isActive?: boolean;
}
