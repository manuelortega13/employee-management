import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-employee-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './layout.html',
  styleUrl: './layout.css',
})
export class EmployeeLayout {
  private readonly auth = inject(AuthService);
  protected readonly user = this.auth.user;

  protected logout(): void {
    this.auth.logout();
  }
}
