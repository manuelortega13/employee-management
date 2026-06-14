import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';

import { routes } from './app.routes';
import { BackupService } from './backup/backup.service';
import { BrandingService } from './branding/branding.service';
import { applyManifest } from './branding/manifest';
import { seedIfEmpty } from './data/seed';
import { StorageService } from './data/storage.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideAppInitializer(() => {
      const storage = inject(StorageService);
      const backup = inject(BackupService);
      const branding = inject(BrandingService);
      return (async () => {
        await seedIfEmpty();
        await storage.init();
        await storage.requestPersistence();
        await backup.init();
        await branding.init();
        applyManifest(branding.logo());
        await backup.runScheduledBackup();
      })();
    }),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
