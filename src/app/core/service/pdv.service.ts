import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable, of, forkJoin, switchMap } from 'rxjs';
import { environment } from '../../../environments/environments';
import { Page } from './sale.service';
import { ApiService } from './api.service';

export interface OpenCashRequest {
  value: number;
}

export interface CashStatusResponse {
  isOpen: boolean;
  cashMovementId: number | null;
}

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
  saleStatus: 'PENDING' | 'PAID' | 'CANCELLED';
}

export interface ProductResponse {
  id: number;
  name: string;
  price: number;
  stockQty: number;
  barcode?: string;
  categoryEnum?: string;
}

export interface SaleRequest {
  customerId: string;
  discount: number;
  saleStatus: 'PENDING' | 'PAID' | 'CANCELLED';
  items: SaleItemRequest[];
}

export interface SaleItemRequest {
  productId: number;
  quantity: number;
}

export interface PaymentRequest {
  saleId: number;
  paymentMethod: 'DINHEIRO' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO' | 'PIX';
  amountPaid: number;
}

export interface CustomerRequest {
  name: string;
  phone: string;
  active: boolean;
}

export interface CustomerResponse {
  phone: string;
  id: number;
  name: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface PageResponse<T> {
  content: T[];
  pageable: {
    sort: {
      empty: boolean;
      sorted: boolean;
      unsorted: boolean;
    };
    offset: number;
    pageNumber: number;
    pageSize: number;
    paged: boolean;
    unpaged: boolean;
  };
  last: boolean;
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  sort: {
    empty: boolean;
    sorted: boolean;
    unsorted: boolean;
  };
  first: boolean;
  numberOfElements: number;
  empty: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class PdvService {
  create(data: any) {
    throw new Error('Method not implemented.');
  }

  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;
  private api = inject(ApiService);

  // Sales endpoints
  getSales(): Observable<Sale[]> {
    return this.http.get<Sale[]>(`${this.apiUrl}/sales`);
  }

  getSaleById(id: number): Observable<Sale> {
    return this.http.get<Sale>(`${this.apiUrl}/sales/${id}`);
  }

  createSale(saleData: SaleRequest): Observable<Sale> {
    return this.http.post<Sale>(`${this.apiUrl}/sales`, saleData);
  }

  updateSale(id: number, saleRequest: any) {
    return this.api.put<any>(`sales/${id}`, saleRequest);
  }

  getTodaySales(): Observable<Sale[]> {
    return this.http.get<Sale[]>(`${this.apiUrl}/sales/today`);
  }

  getLatestSales(): Observable<Sale[]> {
    return this.http.get<Sale[]>(`${this.apiUrl}/sales/latest`);
  }

  getMonthTotal(): Observable<number> {
    return this.http.get<number>(`${this.apiUrl}/sales/month/total`);
  }

  getMonthCount(): Observable<number> {
    return this.http.get<number>(`${this.apiUrl}/sales/month/count`);
  }

  // Products endpoints
  getProductsPaged(page: number = 0, size: number = 30):
  Observable<PageResponse<ProductResponse>> {

  const params = new HttpParams()
    .set("page", page)
    .set("size", size);

  return this.http.get<PageResponse<ProductResponse>>(
    `${this.apiUrl}/products/search`,
    { params }
  );
}

  getCashRegisterStatus() {
    return this.http.get<CashStatusResponse>(`${this.apiUrl}/cash/status`);
  }

  // Abrir o caixa
  openCashRegister(value: number) {
    const body: OpenCashRequest = { value };
    return this.http.post<any>(`${this.apiUrl}/cash/open`, body);
  }

  searchProducts(query: string, page: number = 0, size: number = 10): Observable<PageResponse<ProductResponse>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    if (query) {
      params = params.set('search', query); // Seu backend usa 'search', não 'q'
    }

    return this.http.get<PageResponse<ProductResponse>>(`${this.apiUrl}/products/search`, { params });
  }

  getProductByBarcode(barcode: string): Observable<ProductResponse> { // Usar ProductResponse
    return this.http.get<ProductResponse>(`${this.apiUrl}/products/barcode/${barcode}`);
  }

  getProductById(id: number): Observable<ProductResponse> { // Usar ProductResponse
    return this.http.get<ProductResponse>(`${this.apiUrl}/products/${id}`);
  }

  // Payment endpoints
  processPayment(paymentRequest: PaymentRequest): Observable<PaymentResponse> {
    return this.http.post<PaymentResponse>(`${this.apiUrl}/payments`, paymentRequest);
  }

  getTodayPayments(): Observable<PaymentResponse[]> {
    return this.http.get<PaymentResponse[]>(`${this.apiUrl}/payments/today`);
  }

  getTodayPaymentsTotal(): Observable<number> {
    return this.http.get<number>(`${this.apiUrl}/payments/today/total`);
  }

  // Customer endpoints
  createCustomer(customer: CustomerRequest): Observable<CustomerResponse> {
    return this.http.post<CustomerResponse>(`${this.apiUrl}/customers`, customer);
  }

  getCustomers(): Observable<CustomerResponse[]> {
    return this.http.get<CustomerResponse[]>(`${this.apiUrl}/customers`);
  }

  searchCustomers(query: string, page: number = 0, size: number = 5):
  Observable<PageResponse<CustomerResponse>> {

  let params = new HttpParams()
    .set("q", query)
    .set("page", page)
    .set("size", size);

  return this.http.get<PageResponse<CustomerResponse>>(
    `${this.apiUrl}/customers/search`,
    { params }
  );
}

  // Helper methods
  createSaleItemRequest(productId: number, quantity: number): SaleItemRequest {
    return { productId, quantity };
  }

  createSaleRequest(customerId: string, discount: number, items: SaleItemRequest[]): SaleRequest {
    return {
      customerId,
      discount,
      saleStatus: 'PENDING',
      items
    };
  }

  createPaymentRequest(saleId: number, paymentMethod: 'DINHEIRO' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO' | 'PIX', amountPaid: number): PaymentRequest {
    return {
      saleId,
      paymentMethod,
      amountPaid
    };
  }

  getTopSellingProducts(limit: number = 9): Observable<ProductResponse[]> {
    let params = new HttpParams().set('limit', limit.toString());
    return this.http.get<ProductResponse[]>(`${this.apiUrl}/products/top-selling`, { params });
  }

  // Utility method to calculate cart totals
  calculateCartTotals(items: {productId: number, quantity: number}[], products: ProductResponse[]): { subtotal: number, total: number } {
    const subtotal = items.reduce((sum, item) => {
      const product = products.find(p => p.id === item.productId);
      return sum + (product ? product.price * item.quantity : 0);
    }, 0);

    return { subtotal, total: subtotal };
  }

  // Busca dinâmica de vendas (Paginada)
  searchSales(term: string, page: number = 0, size: number = 10) {
    // O Controller espera: /api/sales/search?q=termo&page=0&size=10
    const params = {
      q: term,
      page: page.toString(),
      size: size.toString()
    };

    return this.api.get<Page<Sale>>('sales/search', params);
  }
  

getTopProducts(): Observable<ProductResponse[]> {
  return this.http.get<PageResponse<ProductResponse>>(`${this.apiUrl}/products?size=12`)
    .pipe(map(res => res.content));
}

processMultiPayment(request: {
  saleId: number;
  payments: { paymentMethodId: number; amountPaid: number }[];
}): Observable<PaymentResponse> {
  return this.http.post<PaymentResponse>(
    `${this.apiUrl}/payments/multi`,
    request
  );
}


}