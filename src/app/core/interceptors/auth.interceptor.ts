import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const token = localStorage.getItem('token');

  let authReq = req;
  if (token) {
    console.log('🔑 Anexando Token na requisição:', req.url);
    authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      
      if (error.status === 401 || error.status === 403) {
        
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        if (!router.url.includes('/login')) {
            router.navigate(['/login']);
        }
      }
      
      return throwError(() => error);
    })
  );
};