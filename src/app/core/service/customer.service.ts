import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environments';

export interface CustomerRequest {
  name: string;
  phone: string;
  active?: boolean;
}

export interface CustomerResponse {
  id: number;
  name: string;
  phone: string;
  active: boolean;
}

export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
}

export interface CustomerStats {
  total: number;
  active: number;
  inactive: number;
}

@Injectable({ providedIn: 'root' })
export class CustomerService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/customers`;

  // --- CRUD ---
  getById(id: number): Observable<CustomerResponse> {
    return this.http.get<CustomerResponse>(`${this.apiUrl}/${id}`).pipe(catchError(this.handleError));
  }

  create(data: CustomerRequest): Observable<CustomerResponse> {
    return this.http.post<CustomerResponse>(this.apiUrl, data).pipe(catchError(this.handleError));
  }

  update(id: number, data: CustomerRequest): Observable<CustomerResponse> {
    return this.http.put<CustomerResponse>(`${this.apiUrl}/${id}`, data).pipe(catchError(this.handleError));
  }

  // --- LISTAGEM E FILTROS PAGINADOS ---
  // Este método é usado apenas para a busca por TEXTO
  searchPaged(term: string, page: number, size: number): Observable<Page<CustomerResponse>> {
    const params = new HttpParams()
      .set('q', term || '')
      .set('page', page.toString())
      .set('size', size.toString());
    return this.http.get<Page<CustomerResponse>>(`${this.apiUrl}/search`, { params });
  }

  getActiveCustomers(page: number, size: number): Observable<Page<CustomerResponse>> {
    const params = new HttpParams().set('page', page.toString()).set('size', size.toString());
    return this.http.get<Page<CustomerResponse>>(`${this.apiUrl}/status/true`, { params });
  }

  getInactiveCustomers(page: number, size: number): Observable<Page<CustomerResponse>> {
    const params = new HttpParams().set('page', page.toString()).set('size', size.toString());
    return this.http.get<Page<CustomerResponse>>(`${this.apiUrl}/status/false`, { params });
  }

  // --- STATUS E ESTATÍSTICAS ---
  toggleStatus(id: number): Observable<CustomerResponse> {
    return this.http.patch<CustomerResponse>(`${this.apiUrl}/${id}/toggle-status`, {});
  }

  getCustomerStats(): Observable<CustomerStats> {
    return this.http.get<CustomerStats>(`${this.apiUrl}/stats`);
  }

  countActiveCustomers(): Observable<number> {
    return this.http.get<CustomerResponse[]>(`${this.apiUrl}/status/true`).pipe(map(c => c.length));
  }

  countInactiveCustomers(): Observable<number> {
    return this.http.get<CustomerResponse[]>(`${this.apiUrl}/status/false`).pipe(map(c => c.length));
  }

  private handleError(error: any) {
    return throwError(() => new Error(error.message || 'Erro no servidor'));
  }

  searchCustomers(term: string, page: number, size: number): Observable<Page<CustomerResponse>> {
  // Ele apenas redireciona para o searchPaged que criamos
  return this.searchPaged(term, page, size);
}
}