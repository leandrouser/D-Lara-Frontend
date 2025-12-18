import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable, of, forkJoin, switchMap } from 'rxjs';
import { environment } from '../../../environments/environments';

export interface SaleItem {
  id: number;
  productId: number;
  productName: string;
  productPrice: number;
  quantity: number;
  total: number;
}

export interface Sale {
  
  id: number;
  dateSale: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  saleStatus: 'PENDING' | 'PAID' | 'CANCELLED'; // Ajustado para PAID
}

export interface CustomerRequest {
  name: string;
  contact: string;
  cpf: string;
  city: string;
  active: boolean;
}

export interface CustomerResponse {
  id: number;
  name: string;
  contact: string;
  cpf: string;
  city: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Page<T> {
  content: T[];
  totalPages: number;
  totalElements: number;
  size: number;
  number: number; // número da página atual
  first: boolean;
  last: boolean;
  empty: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class SaleService {
  private http = inject(HttpClient);
private apiUrl = `${environment.apiUrl}/sales`;

  getSales(): Observable<Sale[]> {
    return this.http.get<Sale[]>(`${this.apiUrl}/sales`);
  }

  getSaleById(id: number): Observable<Sale> {
    return this.http.get<Sale>(`${this.apiUrl}/sales/${id}`);
  }

  createSale(saleData: any): Observable<Sale> {
    return this.http.post<Sale>(`${this.apiUrl}/sales`, saleData);
  }

  updateSaleStatus(id: number, status: Sale['saleStatus']): Observable<Sale> {
    return this.http.patch<Sale>(`${this.apiUrl}/sales/${id}/status`, { status });
  }
  
}