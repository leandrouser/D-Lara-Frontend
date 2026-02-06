import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environments';

export interface User {
  id: number;
  name: string;
  role: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private apiUrl = environment.apiUrl;

  // Signal para acesso global ao usuário logado
  currentUser = signal<User | null>(this.getUserFromStorage());

  login(credentials: { userName?: string; password?: string }) {
    return this.http.post<any>(`${this.apiUrl}/auth/login`, credentials)
      .pipe(
        tap(response => {
          // Salva token e usuário
          localStorage.setItem('token', response.token);
          
          // Assumindo que o back retorna o objeto 'user'
          // Se o back retornar só token, você precisaria decodificar o JWT aqui
          const user = response.user || { name: 'Usuário', role: 'ADMIN' }; 
          
          localStorage.setItem('user', JSON.stringify(user));
          this.currentUser.set(user);

          this.router.navigate(['/pdv']);
        })
      );
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  // Método usado pelo Guard
  isAuthenticated(): boolean {
    const token = localStorage.getItem('token');
    // Aqui você poderia verificar expiração do JWT se quisesse ser mais rigoroso
    return !!token; 
  }

  private getUserFromStorage(): User | null {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }

  getUserId(): number | null {
    const user = this.currentUser();
    return user ? user.id : null;
  }
}