import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { provideRouter } from '@angular/router';
import { routes } from './app/app.routes';
import 'zone.js';
import { provideHttpClient } from '@angular/common/http';

bootstrapApplication(App, appConfig) 
.catch((err) => console.error(err));
