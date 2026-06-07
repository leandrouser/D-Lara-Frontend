import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, map, catchError, of } from 'rxjs';
import { environment } from '../../../environments/environments';

export type MovementType = 'OPENING' | 'SUPPLEMENT' | 'SANGRIA' | 'SALE' | 'CHANGE';
export type CashSessionStatus = 'OPEN' | 'CLOSED' | 'REVIEWED';
export type CashReviewStatus = 'PENDING_REVIEW' | 'UNDER_REVIEW' | 'APPROVED' | 'ADJUSTED';

export interface OpenSessionRequest {
  value: number;
}

export interface CashRegisterStatus {
  isOpen: boolean;
  cashMovementId: number | null;
}

export interface CashTransactionRequestDTO {
  value: number;
  type: 'SUPPLEMENT' | 'SANGRIA';
  description?: string;
}

export interface CashMovementUpdateRequest {
  value: number;
  type: MovementType;
  description?: string;
  paymentMethodId?: number | null;
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
  verifiedAmount: number | null;
  verifiedDifference: number | null;
}

export interface CashSessionResponse {
  id: number;
  openedAt: string;
  closedAt?: string;
  initialValue: number;
  totalIncomes: number;
  totalExpenses: number;
  finalBalance: number;
  status: CashSessionStatus;
  reviewStatus?: CashReviewStatus;
  reviewedAt?: string;
  reviewedBy?: string;
  userId: number;
  userName: string;
}

export interface CashSummaryResponse {
  totalSales: number;
  totalSupplement: number;
  totalSangria: number;
  totalChange: number;
  totalExchangeReturn: number;
  currentBalance: number;
  openingDate: string;
}

export interface CashSessionReportFilter {
  status?: CashSessionStatus | 'ALL';
  reviewStatus?: CashReviewStatus | 'ALL';
  dateFrom?: string;
  dateTo?: string;
}

export interface CashMovementReportFilter {
  sessionId?: number | null;
  type?: MovementType | 'ALL';
  dateFrom?: string;
  dateTo?: string;
}

export interface CashReviewConfirmationRequest {
  observation?: string;
}

export interface CashReviewResponse {
  session: CashSessionResponse;
  summary: CashSummaryResponse;
  movements: CashMovementResponse[];
  details: MethodComparisonDTO[];
}

export interface PaymentMethodTotalsResponse {
  paymentMethodId: number;
  methodName: string;
  expectedAmount: number;
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

  getSessionSummary(sessionId: number): Observable<CashSummaryResponse> {
    return this.http.get<CashSummaryResponse>(`${this.apiUrl}/session/${sessionId}/summary`);
  }

  getPaymentMethodTotals(sessionId: number): Observable<PaymentMethodTotal[]> {
    return this.http.get<PaymentMethodTotal[]>(`${this.apiUrl}/session/${sessionId}/payment-totals`);
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

  getOpenCashRegisterStatus(): Observable<CashRegisterStatus> {
    return this.http.get<CashSessionResponse>(`${this.apiUrl}/active`).pipe(
      map(session => ({
        isOpen: !!session && session.status === 'OPEN',
        cashMovementId: session?.id || null
      })),
      catchError(() => of({ isOpen: false, cashMovementId: null }))
    );
  }

  getMovementsBySession(sessionId: number): Observable<CashMovementResponse[]> {
    return this.http.get<CashMovementResponse[]>(`${this.apiUrl}/session/${sessionId}/movements`);
  }

  getSessionsForReview(filter: CashSessionReportFilter = {}): Observable<CashSessionResponse[]> {
    return this.http.get<CashSessionResponse[]>(`${this.apiUrl}/sessions`, {
      params: this.cleanParams({
        status: filter.status ?? 'CLOSED',
        reviewStatus: filter.reviewStatus ?? 'PENDING_REVIEW',
        dateFrom: filter.dateFrom,
        dateTo: filter.dateTo
      })
    });
  }

  getSessionReview(sessionId: number): Observable<CashReviewResponse> {
    return this.http.get<CashReviewResponse>(`${this.apiUrl}/session/${sessionId}/review`);
  }

  updateMovement(
    sessionId: number,
    movementId: number,
    request: CashMovementUpdateRequest
  ): Observable<CashMovementResponse> {
    return this.http.put<CashMovementResponse>(
      `${this.apiUrl}/session/${sessionId}/movements/${movementId}`,
      request
    );
  }

  confirmSessionReview(
    sessionId: number,
    request: CashReviewConfirmationRequest
  ): Observable<CashSessionResponse> {
    return this.http.post<CashSessionResponse>(
      `${this.apiUrl}/session/${sessionId}/review/confirm`,
      request
    );
  }

  getSessionReport(filter: CashSessionReportFilter = {}): Observable<CashSessionResponse[]> {
    return this.http.get<CashSessionResponse[]>(`${this.apiUrl}/reports/sessions`, {
      params: this.cleanParams(filter)
    });
  }

  getMovementReport(filter: CashMovementReportFilter = {}): Observable<CashMovementResponse[]> {
    return this.http.get<CashMovementResponse[]>(`${this.apiUrl}/reports/movements`, {
      params: this.cleanParams(filter)
    });
  }

  private cleanParams(params: object): Record<string, string> {
    return Object.entries(params as Record<string, unknown>).reduce<Record<string, string>>((acc, [key, value]) => {
      if (value !== undefined && value !== null && value !== '' && value !== 'ALL') {
        acc[key] = String(value);
      }
      return acc;
    }, {});
  }

  verifyMethod(sessionId: number, paymentMethodId: number, verifiedAmount: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/session/${sessionId}/verify-method`, {
      paymentMethodId,
      verifiedAmount
    });
  }
}