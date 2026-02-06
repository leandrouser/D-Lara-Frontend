import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environments';
import { Observable } from 'rxjs';

/* =======================
   MODELS
======================= */

export interface PaymentResponse {
  id: number;
  saleId: number;
  paymentMethod: string;
  amountPaid: number;
  changeAmount: number;
  paymentDate: string;
}

export interface PaymentMethodResponse {
  id: number;
  code: string;
  displayName: string;
  description: string;
  active: boolean;
  allowsChange: boolean;
  allowsInstallments: boolean;
}

export interface PaymentMethodRequest {
  code: string;
  displayName: string;
  description: string;
  active: boolean;
  allowsChange: boolean;
  allowsInstallments: boolean;
}

export interface PaymentItemRequest {
  paymentMethodId: number;
  amountPaid: number;
}

export interface PaymentMultiRequest {
  saleId: number;
  totalAmount: number;
  changeAmount: number;
  payments: PaymentItemRequest[];
}

export interface PaymentMultiResponse {
  saleId: number;
  totalSale: number;
  totalPaid: number;
  changeAmount: number;
  payments: PaymentResponse[];
}

/* =======================
   SERVICE
======================= */

@Injectable({
  providedIn: 'root'
})
export class PaymentService {

  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/payments`;

  /* =======================
     MÉTODOS DE PAGAMENTO
  ======================= */

  listPaymentMethods(): Observable<PaymentMethodResponse[]> {
    return this.http.get<PaymentMethodResponse[]>(`${this.baseUrl}/methods`);
  }

  /* =======================
     PAGAMENTO MULTIPLO (PDV)
  ======================= */

  processMultiPayment(
    request: PaymentMultiRequest
  ): Observable<PaymentMultiResponse> {
    return this.http.post<PaymentMultiResponse>(
      `${this.baseUrl}/multi`,
      request
    );
  }

  /* =======================
     CONSULTAS
  ======================= */

  listPaymentsBySale(saleId: number): Observable<PaymentResponse[]> {
    return this.http.get<PaymentResponse[]>(
      `${this.baseUrl}/sale/${saleId}`
    );
  }

  getTodayPayments(): Observable<PaymentResponse[]> {
    return this.http.get<PaymentResponse[]>(`${this.baseUrl}/today`);
  }

  getTodayTotal(): Observable<number> {
    return this.http.get<number>(`${this.baseUrl}/today/total`);
  }

  listAll(): Observable<PaymentMethodResponse[]> {
    return this.http.get<PaymentMethodResponse[]>(this.baseUrl);
  }

  createMethod(request: PaymentMethodRequest): Observable<PaymentMethodResponse> {
  return this.http.post<PaymentMethodResponse>(this.baseUrl, request);
}

updateMethod(id: number, request: PaymentMethodRequest): Observable<PaymentMethodResponse> {
  return this.http.put<PaymentMethodResponse>(`${this.baseUrl}/${id}`, request);
}
}
