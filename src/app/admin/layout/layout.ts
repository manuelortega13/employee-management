import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { BrandingService } from '../../branding/branding.service';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './layout.html',
  styleUrl: './layout.css',
})
export class AdminLayout {
  private readonly auth = inject(AuthService);
  private readonly branding = inject(BrandingService);
  protected readonly user = this.auth.user;
  protected readonly logo = this.branding.displayLogo;
  protected readonly companyName = this.branding.companyName;

  protected logout(): void {
    this.auth.logout();
  }
}
