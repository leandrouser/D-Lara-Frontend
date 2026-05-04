import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environments';
import { CategoryEnum } from './product.service';

export enum DiscountType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED'
}

export enum SaleStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  CANCELED = 'CANCELED'
}

export interface SaleItemRequest {
  productId: number | null;
  quantity: number;
  manualPrice?: number | null;
  description?: string;
  embroideryId?: number | null;
}

export interface SaleItemResponse {
  id: number;
  productId?: number;
  embroideryId?: number;
  productPrice: number;
  description?: string;
  manualPrice?: number;
  quantity: number;
  total: number;
  category?: CategoryEnum;
  productName: string;
  productBarcode: string;
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
  dateSale: string;
  updatedAt?: string;
}

export interface SaleResponse {
  id: number;
  customerName: string;
  customerPhone?: string;
  saleStatus: string;
  subtotal: number;
  discountType: DiscountType;
  discountValue: number;
  discount: number;
  total: number;
  dateSale: string;
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

  getSaleById(id: number): Observable<SaleResponse> {
    return this.http.get<SaleResponse>(`${this.apiUrl}/${id}`);
  }

  createSale(saleData: SaleRequest): Observable<SaleResponse> {
    return this.http.post<SaleResponse>(this.apiUrl, saleData);
  }

  update(id: number, saleData: SaleRequest): Observable<SaleResponse> {
    return this.http.put<SaleResponse>(`${this.apiUrl}/${id}`, saleData);
  }

  searchSales(term: string, page: number = 0, size: number = 10, status?: string): Observable<Page<SaleResponse>> {
  let params = new HttpParams()
    .set('q', term)
    .set('page', page.toString())
    .set('size', size.toString());

  if (status && status !== 'all') {
    params = params.set('status', status.toUpperCase());
  }

  return this.http.get<Page<SaleResponse>>(`${this.apiUrl}/search`, { params });
  }

  getSales(page: number = 0, size: number = 10): Observable<Page<SaleResponse>> {
  return this.searchSales('', page, size);
  }

  cancelSale(saleId: number): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/${saleId}/cancel`, {});
  }

}
