import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environments';
import { Observable } from 'rxjs';

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
  payments: PaymentItemRequest[];
}

export interface PaymentMultiResponse {
  saleId: number;
  totalSale: number;
  totalPaid: number;
  changeAmount: number;
  payments: PaymentResponse[];
}

@Injectable({
  providedIn: 'root'
})
export class PaymentService {

  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/payments`;

  listPaymentMethods(): Observable<PaymentMethodResponse[]> {
    return this.http.get<PaymentMethodResponse[]>(`${this.baseUrl}/methods`);
  }

  processMultiPayment(
    request: PaymentMultiRequest
  ): Observable<PaymentMultiResponse> {
    return this.http.post<PaymentMultiResponse>(
      `${this.baseUrl}/multi`,
      request
    );
  }

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

  getAllMethods() {
  return this.http.get<PaymentMethodResponse[]>(`${environment.apiUrl}/payment-methods`);
}

createMethod(request: PaymentMethodRequest): Observable<PaymentMethodResponse> {
  return this.http.post<PaymentMethodResponse>(`${environment.apiUrl}/payment-methods`, request);
}

updateMethod(id: number, request: PaymentMethodRequest): Observable<PaymentMethodResponse> {
  return this.http.put<PaymentMethodResponse>(`${environment.apiUrl}/payment-methods/${id}`, request);
}
}
