import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

// Define o enum para os campos de busca, seguindo o padrão que você usou em outros services
export enum EmbroiderySearchField {
  ID = 'ID',
  CUSTOMER_ID = 'CUSTOMER_ID',
  CUSTOMER_NAME = 'CUSTOMER_NAME',
  PHONE = 'PHONE',
  DELIVERY_DATE = 'DELIVERY_DATE',
}

// 🎯 Resposta do Servidor (Baseada no seu Record EmbroideryResponse)
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
}

// 🎯 Estrutura da requisição (Baseada no seu Record EmbroideryRequest - se precisar criar)
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

export type EmbroideryStatus = 'PENDING' | 'DELIVERED';
@Injectable({ providedIn: 'root' })

export class EmbroideryService {
 
  private readonly apiUrl = 'http://localhost:8080/api/embroidery';
  
  constructor(private http: HttpClient) {}
 
  // 🔎 Método de Busca
  // Busca paginada com termo (o backend ordena por data no repositório)
  search(term: string, status: string, page: number, size: number): Observable<SpringPage<EmbroideryResponse>> {
    const params = new HttpParams()
      .set('term', term)
      .set('status', status)
      .set('page', page.toString())
      .set('size', size.toString());
    return this.http.get<SpringPage<EmbroideryResponse>>(`${this.apiUrl}/search`, { params });
  }

  // Se você tiver o endpoint que só recebe JSON:
  create(dto: EmbroideryRequest): Observable<EmbroideryResponse> {
    return this.http.post<EmbroideryResponse>(this.apiUrl, dto);
  }

  getById(id: number): Observable<EmbroideryResponse> {
    return this.http.get<EmbroideryResponse>(`${this.apiUrl}/${id}`);
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
  return this.http.patch<void>(`${this.apiUrl}/${id}/status`, null, {
    params: { status }
  });
}
  // ... (outros métodos como create, update, get)
}