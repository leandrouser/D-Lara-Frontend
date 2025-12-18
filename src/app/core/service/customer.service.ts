import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators'; // ✅ Importar o map
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

@Injectable({
  providedIn: 'root'
})
export class CustomerService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/customers`;

  // ✅ IMPLEMENTADO: Estatísticas de clientes
  getCustomerStats(): Observable<CustomerStats> {
    return this.http.get<CustomerStats>(`${this.apiUrl}/stats`);
  }

  // ✅ IMPLEMENTADO: Contar clientes ativos
  countActiveCustomers(): Observable<number> {
    return this.http.get<CustomerResponse[]>(`${this.apiUrl}/status/true`).pipe(
      map(customers => customers.length)
    );
  }

  // ✅ IMPLEMENTADO: Contar clientes inativos
  countInactiveCustomers(): Observable<number> {
    return this.http.get<CustomerResponse[]>(`${this.apiUrl}/status/false`).pipe(
      map(customers => customers.length)
    );
  }

  // ✅ IMPLEMENTADO: Buscar todos os clientes (alternativa)
  getCustomers(): Observable<CustomerResponse[]> {
    return this.http.get<CustomerResponse[]>(this.apiUrl);
  }

  // ✅ IMPLEMENTADO: Buscar clientes por termo
  searchCustomers(
        searchTerm: string = '', 
        page: number = 0, 
        size: number = 10
    ): Observable<Page<CustomerResponse>> {
        // Redireciona a chamada para o método de busca paginada que já está correto
        return this.searchPaged(searchTerm, page, size);
    }

  // ✅ IMPLEMENTADO: Criar cliente (alternativa)
  createCustomer(customerData: any): Observable<CustomerResponse> {
    return this.http.post<CustomerResponse>(this.apiUrl, customerData);
  }

  // --- MÉTODOS EXISTENTES (já funcionam) ---
  
  // Criar cliente
  create(data: CustomerRequest): Observable<CustomerResponse> {
    return this.http.post<CustomerResponse>(this.apiUrl, data);
  }

  // Atualizar cliente
  update(id: number, data: CustomerRequest): Observable<CustomerResponse> {
    return this.http.put<CustomerResponse>(`${this.apiUrl}/${id}`, data);
  }

  // Busca paginada
  searchPaged(
  query: string = '',
  page: number = 0,
  size: number = 10
): Observable<Page<CustomerResponse>> {
  const params = new HttpParams()
    .set('q', query)
    .set('page', page)
    .set('size', size);

  return this.http.get<Page<CustomerResponse>>(`${this.apiUrl}/search`, { params });
}


  // Buscar todos (não paginado)
  findAll(): Observable<CustomerResponse[]> {
    return this.http.get<CustomerResponse[]>(this.apiUrl);
  }

  // Buscar por status
  findByStatus(active: boolean): Observable<CustomerResponse[]> {
    return this.http.get<CustomerResponse[]>(`${this.apiUrl}/status/${active}`);
  }

  // Alternar status
  toggleStatus(id: number): Observable<CustomerResponse> {
    return this.http.patch<CustomerResponse>(`${this.apiUrl}/${id}/toggle-status`, {});
  }

  // Ativar
  activate(id: number): Observable<CustomerResponse> {
    return this.http.patch<CustomerResponse>(`${this.apiUrl}/${id}/activate`, {});
  }

  // Desativar
  deactivate(id: number): Observable<CustomerResponse> {
    return this.http.patch<CustomerResponse>(`${this.apiUrl}/${id}/deactivate`, {});
  }
}