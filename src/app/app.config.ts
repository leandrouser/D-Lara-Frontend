import { ApplicationConfig, provideZoneChangeDetection, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withInterceptors } from '@angular/common/http'; // 👈 Use withInterceptors
import { MAT_DATE_LOCALE, MatNativeDateModule } from '@angular/material/core';

// 👇 Importe o interceptor que criamos
import { authInterceptor } from './core/interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideAnimations(),
    provideHttpClient(
      withInterceptors([authInterceptor]) 
    ),
    { provide: MAT_DATE_LOCALE, useValue: 'pt-BR' },

    
    importProvidersFrom(MatNativeDateModule),
  ]
};