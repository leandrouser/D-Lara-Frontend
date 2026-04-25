import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environments';

export interface SaleItemResponse {
  id: number;
  productId: number | null;
  productName: string;
  productPrice: number;
  quantity: number;
  total: number;
  embroidery: unknown | null;
}

export interface SaleResponse {
  id: number;
  customerId: number;
  customerName: string;
  total: number;
  saleStatus: string;
  dateSale: string;
  items: SaleItemResponse[];
}

export interface ProductResponse {
  id: number;
  name: string;
  price: number;
  stockQty: number;
  description: string;
  barcode: string;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
}

export interface SaleItemView {
  id: number;
  productId: number | null;
  description: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  manualItem: boolean;
  hasEmbroidery: boolean;
}

export interface SaleView {
  id: number;
  customerId: number;
  customerName: string;
  total: number;
  status: string;
  dateSale: string;
  items: SaleItemView[];
}

export interface ProductView {
  id: number;
  name: string;
  price: number;
  stockQty: number;
}

export interface ExchangeItemRequest {
  saleItemId: number;
  quantity: number;
}

export interface NewItemRequest {
  productId: number;
  quantity: number;
}

export interface ExchangeRequest {
  saleId: number;
  returnedItems: ExchangeItemRequest[];
  newItems: NewItemRequest[];
  paymentMethodCode: string;
  reason: string;
}

export interface ExchangeResponse {
  originalSaleId: number;
  returnedItems: string[];
  newItems: string[];
  totalReturned: number;
  totalNewItems: number;
  difference: number;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ExchangeService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getSaleWithItems(saleId: number): Observable<SaleView> {
    return this.http
      .get<SaleResponse>(`${this.apiUrl}/sales/${saleId}`)
      .pipe(map(raw => this.mapSale(raw)));
  }

  searchProducts(term: string): Observable<ProductView[]> {
    return this.http
      .get<PageResponse<ProductResponse>>(
        `${this.apiUrl}/products/search?search=${encodeURIComponent(term)}&size=15`
      )
      .pipe(map(page => page.content));
  }

  processExchange(request: ExchangeRequest): Observable<ExchangeResponse> {
    return this.http.post<ExchangeResponse>(
      `${this.apiUrl}/exchange`,
      request
    );
  }

  private mapSale(raw: SaleResponse): SaleView {
    return {
      id: raw.id,
      customerId: raw.customerId,
      customerName: raw.customerName,
      total: raw.total,
      status: raw.saleStatus,
      dateSale: raw.dateSale,
      items: raw.items.map(i => this.mapItem(i)),
    };
  }

  private mapItem(raw: SaleItemResponse): SaleItemView {
    return {
      id: raw.id,
      productId: raw.productId,
      description: raw.productName ?? '(sem descrição)',
      quantity: raw.quantity,
      unitPrice: raw.productPrice ?? 0,
      subtotal: raw.total ?? 0,
      manualItem: raw.productId === null && raw.embroidery === null,
      hasEmbroidery: raw.embroidery !== null,
    };
  }
}