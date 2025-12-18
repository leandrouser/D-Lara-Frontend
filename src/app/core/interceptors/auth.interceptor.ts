import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const token = localStorage.getItem('token');

  // 1. Clona a requisição para adicionar o cabeçalho (se tiver token)
  let authReq = req;
  if (token) {
    console.log('🔑 Anexando Token na requisição:', req.url);
    authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  // 2. Passa a requisição adiante e escuta erros
  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      
      // Se der erro 401 (Não autorizado) ou 403 (Proibido)
      if (error.status === 401 || error.status === 403) {
        
        // Limpa tudo
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        // Redireciona para login (evita loop se já estiver no login)
        if (!router.url.includes('/login')) {
            router.navigate(['/login']);
        }
      }
      
      return throwError(() => error);
    })
  );
};