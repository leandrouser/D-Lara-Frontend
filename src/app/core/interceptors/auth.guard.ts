import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../service/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const authService = inject(AuthService);

  // Verifica se está logado (podemos melhorar essa checagem no service)
  if (authService.isAuthenticated()) {
    return true;
  }

  // Se não, redireciona para login com a URL de retorno (opcional)
  router.navigate(['/login']);
  return false;
};