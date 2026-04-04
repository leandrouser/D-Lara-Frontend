import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environments';

export type UserType = 'ADMIN' | 'OPERATOR';

export interface UserRequest {
  userName: string;
  phone?: string;
  password: string;
  userType: UserType;
}

export interface UserResponse {
  id: number;
  userName: string;
  phone?: string;
  userType: UserType;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/users`;

  list(): Observable<UserResponse[]> {
    return this.http.get<UserResponse[]>(this.apiUrl);
  }

  create(data: UserRequest): Observable<UserResponse> {
    return this.http.post<UserResponse>(this.apiUrl, data);
  }

  update(id: number, data: UserRequest): Observable<UserResponse> {
    return this.http.put<UserResponse>(`${this.apiUrl}/${id}`, data);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
