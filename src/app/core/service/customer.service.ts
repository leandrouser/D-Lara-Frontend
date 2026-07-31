import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environments';

export interface CustomerRequest {
  name: string;
  phone: string;
  active?: boolean;
  creditLimit?: number;
}

export interface CustomerResponse {
  id: number;
  name: string;
  phone: string;
  active: boolean;
  creditLimit: number;
  debtBalance: number;
}

export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
}

export interface CustomerStats {
  total: number;
  active: number;
  inactive: number;
}

export interface CustomerAccountSummary {
  customerId: number;
  name: string;
  debtBalance: number;
  creditLimit: number;
  availableCredit: number;
}

export type LedgerEntryType = 'DEBIT_SALE' | 'CREDIT_PAYMENT' | 'MANUAL_DEBIT_ADJUSTMENT' | 'MANUAL_CREDIT_ADJUSTMENT';

export interface CustomerLedgerEntry {
  id: number;
  type: LedgerEntryType;
  amount: number;
  createdAt: string;
  saleId: number | null;
  paymentMethodName: string | null;
  operatorName: string;
  note: string | null;
}

export interface CustomerPaymentReceiptResponse {
  entryId: number;
  customerId: number;
  customerName: string;
  paymentDateTime: string;
  previousBalance: number;
  amountPaid: number;
  remainingBalance: number;
  paymentMethodId: number;
  paymentMethodName: string;
  operatorName: string;
}

export interface RegisterPaymentRequest {
  customerId: number;
  amount: number;
  paymentMethodId: number;
}

@Injectable({ providedIn: 'root' })
export class CustomerService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/customers`;

  getById(id: number): Observable<CustomerResponse> {
    return this.http.get<CustomerResponse>(`${this.apiUrl}/${id}`).pipe(catchError(this.handleError));
  }

  create(data: CustomerRequest): Observable<CustomerResponse> {
    return this.http.post<CustomerResponse>(this.apiUrl, data).pipe(catchError(this.handleError));
  }

  update(id: number, data: CustomerRequest): Observable<CustomerResponse> {
    return this.http.put<CustomerResponse>(`${this.apiUrl}/${id}`, data).pipe(catchError(this.handleError));
  }

  searchPaged(term: string, page: number, size: number): Observable<Page<CustomerResponse>> {
    const params = new HttpParams()
      .set('q', term || '')
      .set('page', page.toString())
      .set('size', size.toString());
    return this.http.get<Page<CustomerResponse>>(`${this.apiUrl}/search`, { params });
  }

  getActiveCustomers(page: number, size: number): Observable<Page<CustomerResponse>> {
    const params = new HttpParams().set('page', page.toString()).set('size', size.toString());
    return this.http.get<Page<CustomerResponse>>(`${this.apiUrl}/status/true`, { params });
  }

  getInactiveCustomers(page: number, size: number): Observable<Page<CustomerResponse>> {
    const params = new HttpParams().set('page', page.toString()).set('size', size.toString());
    return this.http.get<Page<CustomerResponse>>(`${this.apiUrl}/status/false`, { params });
  }

  toggleStatus(id: number): Observable<CustomerResponse> {
    return this.http.patch<CustomerResponse>(`${this.apiUrl}/${id}/toggle-status`, {});
  }

  getCustomerStats(): Observable<CustomerStats> {
    return this.http.get<CustomerStats>(`${this.apiUrl}/stats`);
  }

  countActiveCustomers(): Observable<number> {
    return this.http.get<CustomerResponse[]>(`${this.apiUrl}/status/true`).pipe(map(c => c.length));
  }

  countInactiveCustomers(): Observable<number> {
    return this.http.get<CustomerResponse[]>(`${this.apiUrl}/status/false`).pipe(map(c => c.length));
  }

  private handleError(error: any) {
    const backendMessage = error?.error?.message || error?.message || 'Erro no servidor';
    return throwError(() => new Error(backendMessage));
  }

  searchCustomers(term: string, page: number, size: number): Observable<Page<CustomerResponse>> {
    return this.searchPaged(term, page, size);
  }

  checkPhoneExists(phone: string): Observable<boolean> {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) return of(false);

    return this.http.get<boolean>(`${this.apiUrl}/check-phone`, {
      params: new HttpParams().set('phone', digits)
    }).pipe(catchError(() => of(false)));
  }

  findById(id: number): Observable<CustomerResponse> {
    return this.http.get<CustomerResponse>(`${this.apiUrl}/${id}`);
  }

  getAccountSummary(customerId: number): Observable<CustomerAccountSummary> {
    return this.http.get<CustomerAccountSummary>(`${this.apiUrl}/${customerId}/account/summary`)
      .pipe(catchError(this.handleError));
  }

  getLedger(customerId: number, page: number, size: number): Observable<Page<CustomerLedgerEntry>> {
    const params = new HttpParams().set('page', page.toString()).set('size', size.toString());
    return this.http.get<Page<CustomerLedgerEntry>>(`${this.apiUrl}/${customerId}/account/ledger`, { params })
      .pipe(catchError(this.handleError));
  }

  registerPayment(request: RegisterPaymentRequest): Observable<CustomerPaymentReceiptResponse> {
    return this.http.post<CustomerPaymentReceiptResponse>(`${this.apiUrl}/${request.customerId}/account/payments`, {
      amount: request.amount,
      paymentMethodId: request.paymentMethodId
    }).pipe(catchError(this.handleError));
  }
}
