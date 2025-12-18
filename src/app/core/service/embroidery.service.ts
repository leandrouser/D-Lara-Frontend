// Define o enum para os campos de busca, seguindo o padrão que você usou em outros services
export enum EmbroiderySearchField {
  ID = 'ID',
  CUSTOMER_ID = 'CUSTOMER_ID',
  CUSTOMER_NAME = 'CUSTOMER_NAME',
  PHONE = 'PHONE',
}

// 🎯 Resposta do Servidor (Baseada no seu Record EmbroideryResponse)
export interface EmbroideryResponse {
  id: number;
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

// Service para Interação com a API de Bordados
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environments';

@Injectable({
  providedIn: 'root'
})
export class EmbroideryService {
  private http = inject(HttpClient);
private apiUrl = `${environment.apiUrl}/embroidery`;
  // 🔎 Método de Busca
  searchEmbroidery(
    term: string,
    page: number = 0,
    size: number = 10,
    searchField: EmbroiderySearchField | null = null
  ): Observable<{ content: EmbroideryResponse[], totalElements: number }> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    if (term && term.trim() !== '') {
      params = params.set('term', term);
    }
    
    if (searchField){
      params = params.set('searchField', searchField);
    }

    // ✅ O endpoint correto é /api/embroidery/search
    return this.http.get<{ content: EmbroideryResponse[], totalElements: number }>(
      `${this.apiUrl}/search`,
      { params }
    );
  }

  // 📥 Método para Deletar
  deleteEmbroidery(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  // Se você tiver o endpoint que só recebe JSON:
  create(dto: EmbroideryRequest): Observable<EmbroideryResponse> {
    return this.http.post<EmbroideryResponse>(this.apiUrl, dto);
  }

  getById(id: number): Observable<EmbroideryResponse> {
    return this.http.get<EmbroideryResponse>(`${this.apiUrl}/${id}`);
  }

   createWithFile(formData: FormData): Observable<EmbroideryResponse> {
    return this.http.post<EmbroideryResponse>(
      `${this.apiUrl}/multipart`,
      formData
    );
  }

downloadFile(id: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${id}/file`, {
      responseType: 'blob'
    });
  }

  updateWithFile(id: number, formData: FormData): Observable<EmbroideryResponse> {
    return this.http.put<EmbroideryResponse>(
      '${this.apiUrl}/${id}',
      formData
    );
  }

  // ... (outros métodos como create, update, get)
}