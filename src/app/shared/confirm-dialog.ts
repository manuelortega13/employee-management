import { Component, HostListener, inject } from '@angular/core';
import { ConfirmService } from './confirm.service';

@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.css',
})
export class ConfirmDialog {
  private readonly service = inject(ConfirmService);
  protected readonly pending = this.service.pending;

  protected confirm(): void {
    this.service.resolve(true);
  }

  protected cancel(): void {
    this.service.resolve(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.pending()) this.cancel();
  }

  @HostListener('document:keydown.enter')
  onEnter(): void {
    if (this.pending()) this.confirm();
  }
}
