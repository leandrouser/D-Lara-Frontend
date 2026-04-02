import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environments';

export enum EmbroiderySearchField {
  ID = 'ID',
  CUSTOMER_ID = 'CUSTOMER_ID',
  CUSTOMER_NAME = 'CUSTOMER_NAME',
  PHONE = 'PHONE',
  DELIVERY_DATE = 'DELIVERY_DATE',
}

export interface EmbroideryResponse {
  id: number;
  status: EmbroideryStatus;
  customerId: number;
  customerName: string;
  description: string;
  price: number;
  fileName: string;
  createdAt: string;
  deliveryDate: string;
  deliveredAt: string | null;
}

export interface EmbroideryRequest {
  customerId: number;
  description: string;
  price: number;
  deliveryDate: string;
  fileName?: string;
  fileData?: string;
}

export interface SpringPage<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export interface EmbroideryMetrics {
  totalPending: number;
  totalCompleted: number;
  totalProcessing: number;
  totalCanceled: number;
  overdueCount: number;
  todayDeliveries: number;
  totalRevenue: number;
  pendingRevenue: number;
  lastUpdated: string;
}

export type EmbroideryStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'CANCELED';
@Injectable({ providedIn: 'root' })

export class EmbroideryService {

  private readonly apiUrl = `${environment.apiUrl}/embroidery`;

  constructor(private http: HttpClient) {}

  search(term: string, status: string, page: number, size: number): Observable<SpringPage<EmbroideryResponse>> {
    const params = new HttpParams()
      .set('term', term)
      .set('status', status)
      .set('page', page.toString())
      .set('size', size.toString());
    return this.http.get<SpringPage<EmbroideryResponse>>(`${this.apiUrl}/search`, { params });
  }

  create(dto: EmbroideryRequest): Observable<EmbroideryResponse> {
    return this.http.post<EmbroideryResponse>(this.apiUrl, dto);
  }

  getById(id: number): Observable<EmbroideryResponse> {
    return this.http.get<EmbroideryResponse>(`${this.apiUrl}/${id}`);
  }

  getMetrics(): Observable<EmbroideryMetrics> {
  return this.http.get<EmbroideryMetrics>(`${this.apiUrl}/metrics`);
  }

  createWithFile(formData: FormData): Observable<EmbroideryResponse> {
    return this.http.post<EmbroideryResponse>(`${this.apiUrl}/multipart`, formData);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }


  downloadFile(id: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${id}/file`, {
      responseType: 'blob'
    });
  }

  updateWithFile(id: number, formData: FormData) {
  return this.http.put<EmbroideryResponse>(`${this.apiUrl}/${id}`, formData);
  }

  updateStatus(id: number, status: string): Observable<void> {
  const httpParams = new HttpParams().set('status', status);

  return this.http.patch<void>(
    `${this.apiUrl}/${id}/status`,
    null,
    { params: httpParams }
  );
}

  findAll(page: number = 0, size: number = 5): Observable<SpringPage<EmbroideryResponse>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    return this.http.get<SpringPage<EmbroideryResponse>>(`${this.apiUrl}`, { params });
  }

  findByStatus(status: string, page: number = 0, size: number = 10): Observable<SpringPage<EmbroideryResponse>> {
    const params = new HttpParams()
      .set('status', status)
      .set('page', page.toString())
      .set('size', size.toString());
    return this.http.get<SpringPage<EmbroideryResponse>>(`${this.apiUrl}/by-status`, { params });
  }

  findAllPending(page: number = 0, size: number = 10): Observable<SpringPage<EmbroideryResponse>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    return this.http.get<SpringPage<EmbroideryResponse>>(`${this.apiUrl}/pending`, { params });
  }

  findAllCompleted(page: number = 0, size: number = 10): Observable<SpringPage<EmbroideryResponse>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    return this.http.get<SpringPage<EmbroideryResponse>>(`${this.apiUrl}/completed`, { params });
  }
}
