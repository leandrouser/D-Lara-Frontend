import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { environment } from '../../../environments/environments';

export interface OpenSessionRequest {
  initialValue: number;
}

export interface CashRegisterStatus {
  isOpen: boolean;
  cashMovementId: number | null;
}

export interface CashTransactionRequestDTO {
  value: number;
  type: 'SUPPLEMENT' | 'SANGRIA' | 'SALE' | 'CHANGE';
  observation?: string;
  paymentMethodId: number;
}

export interface PaymentMethodCountDTO {
  paymentMethodId: number;
  physicalAmount: number;
}

export interface CloseSessionRequest {
  sessionId: number;
  counts: PaymentMethodCountDTO[];
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
}

export interface MethodComparisonDTO {
  paymentMethodId: number;
  methodName: string;
  expectedAmount: number;
  reportedAmount: number;
  difference: number;
}

export interface CloseSessionResponse {
  sessionId: number;
  closedAt: string;
  details: MethodComparisonDTO[];
  totalSystemExpected: number;
  totalUserReported: number;
  totalDiscrepancy: number;
  status: 'CLOSED';
}

export interface Transaction {
  id: number;
  value: number;
  type: 'SUPPLEMENT' | 'SANGRIA' | 'SALE' | 'CHANGE' | 'OPENING';
  description?: string;
  createdAt: string;
  sessionId: number;
}

@Injectable({
  providedIn: 'root'
})
export class CashService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/cash-sessions`;

  // Gerenciamento de Estado com Signals
  private _activeSession = signal<CashSessionResponse | null>(null);
  private _isInitializing = signal(true);

  // Exposição pública dos sinais (somente leitura)
  public activeSession = this._activeSession.asReadonly();
  public isInitializing = this._isInitializing.asReadonly();

  // Atalho para quem só quer o ID (facilita a vida do componente)
  public activeSessionId = computed(() => this._activeSession()?.id || null);

  constructor() {
    this.checkExistingSession();
  }

  /**
   * 1. Abrir o Caixa
   * Backend: POST /api/v1/cash-sessions/open
   */
  openCashRegister(request: OpenSessionRequest): Observable<CashSessionResponse> {
    return this.http.post<CashSessionResponse>(`${this.apiUrl}/open`, request).pipe(
      tap(session => {
        this._activeSession.set(session);
        localStorage.setItem('active_cash_id', session.id.toString());
      })
    );
  }

  /**
   * 2. Registrar Movimentação Manual (Sangria ou Suprimento)
   * Backend: POST /api/v1/cash-sessions/{sessionId}/transactions
   */
  createManualTransaction(sessionId: number, request: CashTransactionRequestDTO): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${sessionId}/transactions`, request);
  }

  /**
   * 3. Fechar o Caixa com Conferência Cega
   * Backend: POST /api/v1/cash-sessions/{sessionId}/close
   */
  closeSession(sessionId: number, request: CloseSessionRequest): Observable<CloseSessionResponse> {
    return this.http.post<CloseSessionResponse>(`${this.apiUrl}/${sessionId}/close`, request).pipe(
      tap(() => this.clearLocalSession())
    );
  }

  /**
   * 4. Verifica no banco se existe sessão aberta para o usuário
   * Backend: GET /api/v1/cash-sessions/active/{userId}
   */
  checkExistingSession() {
    const userId = 1; // Temporário até ter Auth
    this._isInitializing.set(true);

    this.http.get<CashSessionResponse>(`${this.apiUrl}/active/${userId}`).subscribe({
      next: (session) => {
        if (session) {
          this._activeSession.set(session);
          localStorage.setItem('active_cash_id', session.id.toString());
        } else {
          this.clearLocalSession();
        }
        this._isInitializing.set(false);
      },
      error: () => {
        this.clearLocalSession();
        this._isInitializing.set(false);
      }
    });
  }

  private clearLocalSession() {
    this._activeSession.set(null);
    localStorage.removeItem('active_cash_id');
  }

  getOpenCashRegister(userId: number): Observable<CashRegisterStatus> {
  return this.http.get<any>(`${this.apiUrl}/active/${userId}`).pipe(
    map(response => {
      // Se o backend retornar 204 No Content, o response será null
      if (!response) {
        return { isOpen: false, cashMovementId: null };
      }
      // Se houver resposta, o caixa está aberto
      return { 
        isOpen: true, 
        cashMovementId: response.id // Verifique se o ID da sessão no Java se chama 'id'
      };
    })
  );
}
  
  closeCashRegister(id: number, data: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/close/${id}`, data);
  }

  getTransactionsBySession(sessionId: number): Observable<Transaction[]> {
  return this.http.get<Transaction[]>(`${this.apiUrl}/${sessionId}/transactions`);
}
}