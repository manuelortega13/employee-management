import { Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AttendanceRecord, AttendanceService } from './attendance.service';

type CameraAction = 'checkIn' | 'checkOut' | 'startBreak' | 'endBreak';

@Component({
  selector: 'app-employee-attendance',
  imports: [DatePipe],
  templateUrl: './attendance.html',
  styleUrl: './attendance.css',
})
export class EmployeeAttendance {
  private readonly attendance = inject(AttendanceService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly validActions: ReadonlyArray<CameraAction> = [
    'checkIn',
    'checkOut',
    'startBreak',
    'endBreak',
  ];

  protected readonly now = signal(new Date());
  protected readonly records = this.attendance.records;
  protected readonly loading = this.attendance.loading;
  protected readonly error = signal<string | null>(null);

  protected readonly previewPhoto = signal<string | null>(null);

  protected readonly cameraOpen = signal(false);
  protected readonly cameraReady = signal(false);
  protected readonly cameraError = signal<string | null>(null);
  protected readonly capturedPhoto = signal<string | null>(null);
  protected readonly cameraAction = signal<CameraAction>('checkIn');

  protected readonly video = viewChild<ElementRef<HTMLVideoElement>>('videoEl');
  protected readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvasEl');

  protected readonly todayRecord = computed(() => {
    this.now();
    return this.attendance.todayRecord();
  });

  protected readonly isCheckedIn = computed(() => {
    const record = this.todayRecord();
    return record !== null && record.checkOut === null;
  });

  protected readonly isCheckedOut = computed(() => {
    const record = this.todayRecord();
    return record !== null && record.checkOut !== null;
  });

  protected readonly isOnBreak = this.attendance.isOnBreak;

  private clockInterval: ReturnType<typeof setInterval> | null = null;
  private stream: MediaStream | null = null;

  constructor() {
    this.clockInterval = setInterval(() => this.now.set(new Date()), 1000);
    this.attendance.loadRecords();

    this.route.queryParamMap.subscribe((params) => {
      const action = params.get('action') as CameraAction | null;
      if (action && this.validActions.includes(action) && !this.cameraOpen()) {
        this.openCamera(action);
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { action: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      }
    });
  }

  ngOnDestroy(): void {
    if (this.clockInterval !== null) {
      clearInterval(this.clockInterval);
    }
    this.stopCamera();
  }

  protected openCamera(action: CameraAction): void {
    this.cameraAction.set(action);
    this.capturedPhoto.set(null);
    this.cameraError.set(null);
    this.error.set(null);
    this.cameraReady.set(false);
    this.cameraOpen.set(true);
    this.startCamera();
  }

  protected closeCamera(): void {
    this.cameraOpen.set(false);
    this.capturedPhoto.set(null);
    this.cameraError.set(null);
    this.stopCamera();
  }

  protected capture(): void {
    const videoEl = this.video()?.nativeElement;
    const canvasEl = this.canvas()?.nativeElement;
    if (!videoEl || !canvasEl) return;

    canvasEl.width = videoEl.videoWidth;
    canvasEl.height = videoEl.videoHeight;
    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(videoEl, 0, 0);
    const dataUrl = canvasEl.toDataURL('image/jpeg', 0.8);
    this.capturedPhoto.set(dataUrl);
    this.stopCamera();
  }

  protected retake(): void {
    this.capturedPhoto.set(null);
    this.cameraReady.set(false);
    this.startCamera();
  }

  protected confirmPhoto(): void {
    const photo = this.capturedPhoto();
    if (!photo) return;

    const action = this.cameraAction();
    const onSuccess = () => this.closeCamera();
    const onError = (msg: string) => this.error.set(msg);

    if (action === 'checkIn') {
      this.attendance.checkIn(photo, onSuccess, onError);
    } else if (action === 'checkOut') {
      this.attendance.checkOut(photo, onSuccess, onError);
    } else if (action === 'startBreak') {
      this.attendance.startBreak(photo, onSuccess, onError);
    } else if (action === 'endBreak') {
      this.attendance.endBreak(photo, onSuccess, onError);
    }
  }

  private async startCamera(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });

      await new Promise((resolve) => setTimeout(resolve, 0));

      const videoEl = this.video()?.nativeElement;
      if (videoEl) {
        videoEl.srcObject = this.stream;
        videoEl.onloadedmetadata = () => this.cameraReady.set(true);
      }
    } catch {
      this.cameraError.set(
        'Could not access the camera. Please allow camera permissions and try again.'
      );
    }
  }

  protected openPreview(photo: string): void {
    this.previewPhoto.set(photo);
  }

  protected closePreview(): void {
    this.previewPhoto.set(null);
  }

  protected readonly cameraLabels: Record<CameraAction, string> = {
    checkIn: 'Check In',
    checkOut: 'Check Out',
    startBreak: 'Start Break',
    endBreak: 'End Break',
  };

  protected utc(timestamp: string): string {
    return this.attendance.toLocalTime(timestamp);
  }

  protected formatBreakDuration(record: AttendanceRecord): string {
    return this.attendance.formatDuration(record.totalBreakMs ?? 0);
  }

  protected formatDuration(record: AttendanceRecord): string {
    return this.attendance.formatDuration(this.attendance.getWorkedMs(record));
  }

  private stopCamera(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
  }
}
