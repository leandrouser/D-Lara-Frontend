import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, map, catchError, of } from 'rxjs';
import { environment } from '../../../environments/environments';

export type MovementType = 'OPENING' | 'SUPPLY' | 'SANGRIA' | 'SALE' | 'CHANGE';

export interface OpenSessionRequest {
  value: number;
}

export interface CashRegisterStatus {
  isOpen: boolean;
  cashMovementId: number | null;
}

export interface CashTransactionRequestDTO {
  value: number;
  type: 'SUPPLY' | 'SANGRIA';
  description?: string;
}

export interface CashMovementResponse {
  id: number;
  timestamp: string;
  description: string;
  value: number;
  type: MovementType;
  methodName: string;
  sessionId: number;
  uniqueKey: string;
}

export interface PaymentMethodCountDTO {
  paymentMethodId: number;
  reportedValue: number;
}

export interface CloseSessionRequest {
  sessionId: number;
  reportedPayments: PaymentMethodCountDTO[];
}

export interface PaymentMethodTotal {
  paymentMethodId: number;
  methodName: string;
  expectedAmount: number;
}

export interface CloseSessionResponse {
  sessionId: number;
  closedAt: string;
  details: MethodComparisonDTO[];
  totalSystemExpected: number;
  totalUserReported: number;
  totalDiscrepancy: number;
  status: 'CLOSED';
  totalDiscounts: number;
  initialValue: number;
  totalSalesOnly: number;
  totalSalesCash: number;
}

export interface MethodComparisonDTO {
  paymentMethodId: number;
  methodName: string;
  expectedAmount: number;
  reportedAmount: number;
  difference: number;
  initialValue: number;
  salesOnly: number;
}

export interface CashSessionResponse {
  id: number;
  openedAt: string;
  closedAt?: string;
  initialValue: number;
  totalIncomes: number;
  totalExpenses: number;
  finalBalance: number;
  status: 'OPEN' | 'CLOSED';
  userId: number;
  userName: string;
}

@Injectable({
  providedIn: 'root'
})
export class CashService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/cash`;

  private _activeSession = signal<CashSessionResponse | null>(null);
  private _isInitializing = signal(true);

  public activeSession = this._activeSession.asReadonly();
  public isInitializing = this._isInitializing.asReadonly();

  public activeSessionId = computed(() => this._activeSession()?.id || null);
  public isCashOpen = computed(() => this._activeSession()?.status === 'OPEN');

  constructor() {
    this.checkExistingSession();
  }

  openCashRegister(request: OpenSessionRequest): Observable<CashSessionResponse> {
    return this.http.post<CashSessionResponse>(`${this.apiUrl}/open`, request).pipe(
      tap(session => {
        this._activeSession.set(session);
        localStorage.setItem('active_cash_id', session.id.toString());
      })
    );
  }

  createManualTransaction(sessionId: number, request: CashTransactionRequestDTO): Observable<void> {
  return this.http.post<void>(`${this.apiUrl}/movement`, {
    value: request.value,
    type: request.type,
    description: request.description,
    sessionId: sessionId
  });
}

  getExpectedTotals(sessionId: number): Observable<PaymentMethodTotal[]> {
    return this.http.get<PaymentMethodTotal[]>(`${this.apiUrl}/session/${sessionId}/summary`);
  }

  getPaymentMethodTotals(sessionId: number): Observable<PaymentMethodTotal[]> {
    return this.http.get<PaymentMethodTotal[]>(`${this.apiUrl}/session/${sessionId}/summary`).pipe(
      map(totals => totals.map(t => ({
        paymentMethodId: t.paymentMethodId,
        methodName: t.methodName,
        expectedAmount: t.expectedAmount
      })))
    );
  }


  closeSession(sessionId: number, request: CloseSessionRequest): Observable<CloseSessionResponse> {
    return this.http.post<CloseSessionResponse>(`${this.apiUrl}/session/${sessionId}/close`, request).pipe(
      tap(() => this.clearLocalSession())
    );
  }

  private clearLocalSession() {
  this._activeSession.set(null);
  localStorage.removeItem('active_cash_id');
  }

  checkExistingSession() {
  this._isInitializing.set(true);
  this.http.get<CashSessionResponse>(`${this.apiUrl}/active`).subscribe({
    next: (session) => {
      if (session) {
        this._activeSession.set(session);
        localStorage.setItem('active_cash_id', session.id.toString());
      } else {
        this.clearLocalSession();
      }
      this._isInitializing.set(false);
    },
    error: (err) => {
      if (err.status === 404 || err.status === 204) {
        this.clearLocalSession();
      }
      this._isInitializing.set(false);
    }
  });
  }

  getOpenCashRegisterStatus(): Observable<CashRegisterStatus> { // removeu userId
  return this.http.get<CashSessionResponse>(`${this.apiUrl}/active`).pipe( // era /active/${userId}
    map(session => ({
      isOpen: !!session,
      cashMovementId: session?.id || null
    })),
    catchError(() => of({ isOpen: false, cashMovementId: null }))
  );
  }

  getMovementsBySession(sessionId: number): Observable<CashMovementResponse[]> {
    return this.http.get<CashMovementResponse[]>(`${this.apiUrl}/session/${sessionId}/movements`);
  }
}
