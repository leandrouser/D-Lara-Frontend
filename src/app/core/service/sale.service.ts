import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable, of, forkJoin, switchMap } from 'rxjs';
import { environment } from '../../../environments/environments';
import { CategoryEnum } from './product.service';

export enum DiscountType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED'
}

export enum SaleStatus {
  PENDING = 'PENDING',
  COMPLETED = 'PAID',
  CANCELLED = 'CANCELLED'
}

export interface SaleItemRequest {
  productId: number | null;
  quantity: number;
  manualPrice?: number | null;
  description?: string;
  embroideryId?: number | null;
}

export interface SaleItemResponse {
  productId?: number;
  embroideryId?: number;
  unitPrice: number;
  description?: string;
  manualPrice?: number;
  quantity: number;
  subtotal: number;
  category?: CategoryEnum;
}

export interface SaleRequest {
  customerId: number | null;
  cashSessionId: number | null;
  discountType: 'FIXED' | 'PERCENTAGE';
  discountValue: number;
  items: SaleItemRequest[];
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
  phone: string;
  cpf: string;
  city: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SaleResponse {
  id: number;
  customerName: string;
  customerPhone?: string;
  status: SaleStatus;
  subtotal: number;
  discountType: DiscountType;
  discountValue: number;
  discountAmount: number;
  total: number;
  createdAt: string;
  items: SaleItemResponse[];
}

export interface Page<T> {
  content: T[];
  totalPages: number;
  totalElements: number;
  size: number;
  number: number;
}

@Injectable({
  providedIn: 'root'
})
export class SaleService {
  private http = inject(HttpClient);
private apiUrl = `${environment.apiUrl}/sales`;

  getSales(page: number = 0, size: number = 10): Observable<Page<SaleResponse>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    return this.http.get<Page<SaleResponse>>(this.apiUrl, { params });
  }

  getSaleById(id: number): Observable<SaleResponse> {
    return this.http.get<SaleResponse>(`${this.apiUrl}/${id}`);
  }

  createSale(saleData: SaleRequest): Observable<SaleResponse> {
    return this.http.post<SaleResponse>(this.apiUrl, saleData);
  }

  update(id: number, saleData: SaleRequest): Observable<SaleResponse> {
    return this.http.put<SaleResponse>(`${this.apiUrl}/${id}`, saleData);
}

  // sale.service.ts
searchSales(term: string, page: number = 0, size: number = 10): Observable<Page<SaleResponse>> {
  return this.http.get<Page<SaleResponse>>(`${this.apiUrl}/search`, {
    params: { q: term, page: page.toString(), size: size.toString() }
  });
}
  
}