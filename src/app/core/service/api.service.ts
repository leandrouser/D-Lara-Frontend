import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environments';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  // ✅ 1. Pega a URL do environment
  private apiUrl = environment.apiUrl; 

  // ✅ 2. Injeção do HttpClient (usando inject ou construtor)
  private http = inject(HttpClient);

  constructor() {}

  // Método Genérico GET
  get<T>(endpoint: string, params?: any) {
    // Monta a URL: http://localhost:8080/api + / + products
    return this.http.get<T>(`${this.apiUrl}/${endpoint}`, { params });
  }

  // Método Genérico POST
  post<T>(endpoint: string, body: any) {
    return this.http.post<T>(`${this.apiUrl}/${endpoint}`, body);
  }

  // Método Genérico PUT
  put<T>(endpoint: string, body: any) {
    return this.http.put<T>(`${this.apiUrl}/${endpoint}`, body);
  }

  // Método Genérico DELETE
  delete<T>(endpoint: string) {
    return this.http.delete<T>(`${this.apiUrl}/${endpoint}`);
  }

  // Exemplo de uso específico que você pediu
  getfindByStockQtyLessThan() {
    // Chama o método genérico get passando o endpoint
    return this.get<any[]>('products/low-stock');
  }
}