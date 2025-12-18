// src/app/services/cash-movement.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, tap } from 'rxjs/operators';

export enum TypeMovementCash {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  SALE = 'SALE',
  CHANGE = 'CHANGE'
}

export interface CashMovement {
  id: number;
  initialValue: number;
  value: number;
  dateMovement: Date;
  typeMovementCash: TypeMovementCash;
  userId: number;
  observation?: string;
}

export interface OpenCashRegisterRequest {
  value: number;
}

export interface CashMovementResponse {
  id: number;
  initialValue: number;
  value: number;
  dateMovement: Date;
  typeMovementCash: string;
  userId: number;
}

export interface PaymentMethodTotal {
  paymentMethodId: number;
  displayName: string;
  total: number;
}

export interface CloseCashRegisterResponse {
  cashRegisterId: number;
  totalsByPaymentMethod: Map<number, number>;
  status: string;
}

// src/app/models/user.model.ts
export interface User {
  id: number;
  username: string;
  name: string;
  email: string;
}

// src/app/models/payment-method.model.ts
export interface PaymentMethod {
  id: number;
  name: string;
  displayName: string;
  active: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class CashMovementService {
  private apiUrl = '${environment.apiUrl}/cash';
  private currentCashRegister = new BehaviorSubject<CashMovement | null>(null);
  currentCashRegister$ = this.currentCashRegister.asObservable();

  constructor(private http: HttpClient) {}

  // Verifica se há caixa aberto
  checkOpenCashRegister(): Observable<boolean> {
    return this.http.get<CashMovementResponse>(`${this.apiUrl}/current-open`).pipe(
      map(response => !!response),
      tap(hasOpen => {
        if (!hasOpen) {
          this.currentCashRegister.next(null);
        }
      })
    );
  }

  // Busca caixa aberto atual
  getCurrentOpenCash(): Observable<CashMovementResponse> {
    return this.http.get<CashMovementResponse>(`${this.apiUrl}/current-open`).pipe(
      tap(cash => {
        if (cash) {
          this.currentCashRegister.next(this.mapToCashMovement(cash));
        }
      })
    );
  }

  // Abre novo caixa
  openCashRegister(
    request: OpenCashRegisterRequest // <-- ESTE DEVE SER O TIPO
  ): Observable<CashMovementResponse> {
    const url = `${this.apiUrl}/open`;
    // O backend espera um corpo JSON como: { "value": 150.00 }
    return this.http.post<CashMovementResponse>(url, request);
  }

  // Fecha caixa atual
  closeCashRegister(cashMovementId: number): Observable<CloseCashRegisterResponse> {
    return this.http.post<CloseCashRegisterResponse>(
      `${this.apiUrl}/${cashMovementId}/close`, 
      {}
    ).pipe(
      tap(() => {
        this.currentCashRegister.next(null);
      })
    );
  }

  // Lista movimentos do dia
  getTodayMovements(): Observable<CashMovement[]> {
    return this.http.get<CashMovementResponse[]>(`${this.apiUrl}/today`).pipe(
      map(responses => responses.map(res => this.mapToCashMovement(res)))
    );
  }

  // Lista movimentos por período
  getMovementsByPeriod(startDate: Date, endDate: Date): Observable<CashMovement[]> {
    const params = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    };
    return this.http.get<CashMovementResponse[]>(`${this.apiUrl}/period`, { params }).pipe(
      map(responses => responses.map(res => this.mapToCashMovement(res)))
    );
  }

  // Busca totais de vendas por método de pagamento
  getPaymentMethodTotals(cashMovementId: number): Observable<PaymentMethodTotal[]> {
    return this.http.get<PaymentMethodTotal[]>(`${this.apiUrl}/${cashMovementId}/totals`);
  }

  // Busca métodos de pagamento
  getPaymentMethods(): Observable<PaymentMethod[]> {
    return this.http.get<PaymentMethod[]>(`${this.apiUrl}/payment-methods`);
  }

  // Método privado para mapear resposta
  private mapToCashMovement(response: CashMovementResponse): CashMovement {
    return {
      id: response.id,
      initialValue: response.initialValue,
      value: response.value,
      dateMovement: new Date(response.dateMovement),
      typeMovementCash: response.typeMovementCash as TypeMovementCash,
      userId: response.userId
    };
  }

  // Emite evento de caixa aberto manualmente
  setCurrentCashRegister(cash: CashMovement | null): void {
    this.currentCashRegister.next(cash);
  }
}