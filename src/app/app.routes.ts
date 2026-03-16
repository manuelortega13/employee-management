import { Routes } from '@angular/router';
import { AdminLayout } from './admin/layout/layout';
import { AdminDashboard } from './admin/dashboard/dashboard';
import { AdminEmployees } from './admin/employees/employees';
import { AdminDepartments } from './admin/departments/departments';
import { EmployeeLayout } from './employee/layout/layout';
import { EmployeeDashboard } from './employee/dashboard/dashboard';
import { EmployeeProfile } from './employee/profile/profile';
import { EmployeeRequests } from './employee/requests/requests';
import { EmployeeAttendance } from './employee/attendance/attendance';
import { AttendanceReport } from './employee/attendance-report/attendance-report';
import { Login } from './auth/login/login';
import { authGuard, adminGuard, guestGuard } from './auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    component: Login,
    canActivate: [guestGuard],
  },
  {
    path: 'manage',
    component: AdminLayout,
    canActivate: [authGuard, adminGuard],
    children: [
      { path: '', component: AdminDashboard },
      { path: 'employees', component: AdminEmployees },
      { path: 'departments', component: AdminDepartments },
    ],
  },
  {
    path: '',
    component: EmployeeLayout,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'attendance', pathMatch: 'full' },
      { path: 'attendance', component: EmployeeAttendance },
      { path: 'attendance-report', component: AttendanceReport },
      { path: 'dashboard', component: EmployeeDashboard },
      { path: 'profile', component: EmployeeProfile },
      { path: 'requests', component: EmployeeRequests },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
