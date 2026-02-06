import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environments';
import { Observable } from 'rxjs';

export interface CartItem {
  product: any;
  quantity: number;
  total: number;
  isEmbroidery?: boolean;
  observations?: string;
  embroideryId?: number;
}

@Injectable({
  providedIn: 'root'
})
export class PdvService {
  private http = inject(HttpClient);
  private apiUrl=`${environment.apiUrl}/payments`;

  constructor() { }

  processMultiPayment(requestBody: any): Observable<any> {
    // Retorna o Observable que o seu componente está esperando para o subscribe
    return this.http.post<any>(`${this.apiUrl}/processar`, requestBody);
  }

  // Futuros métodos de API entrarão aqui
}