import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environments';
import { Observable } from 'rxjs';

export interface PaymentResponse {
  id: number;
  saleId: number;
  paymentMethod: 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'PIX';
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

export interface PaymentMethod {
  id: number;
  name: string;
}

export interface PaymentMethodRequest {
  code: string;
  displayName: string;
  description: string;
  active: boolean;
  allowsChange: boolean;
  allowsInstallments: boolean;
}

export interface PaymentRequest {
  saleId: number;
  methodId: number;
  amount: number;
}

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/payments`;
  private apiMethodsUrl = `${environment.apiUrl}/payment-methods`;

  listAll(): Observable<PaymentMethodResponse[]> {
  return this.http.get<PaymentMethodResponse[]>(this.apiMethodsUrl);
}

  // CRIAR novo método (O que o modal chama)
  createMethod(request: PaymentMethodRequest): Observable<PaymentMethodResponse> {
    return this.http.post<PaymentMethodResponse>(this.apiMethodsUrl, request);
  }

  update(id: number, request: PaymentMethodRequest): Observable<any> {
  return this.http.put(`${environment.apiUrl}/payment-methods/${id}`, request);
}

  // Processar pagamento de venda
  processMultiPayment(request: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/multi`, request);
  }

  getPaymentMethods() {
    // Se não tiver endpoint, retorne um array fixo para teste:
    // return of([{id: 1, name: 'DINHEIRO'}, {id: 2, name: 'PIX'}]);
    return this.http.get<PaymentMethod[]>(`${environment.apiUrl}/payment-methods`);
  }

  processPayment(request: PaymentRequest) {
    return this.http.post<any>(this.apiUrl, request);
  }
}