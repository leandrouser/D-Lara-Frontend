// src/app/core/service/product.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { catchError, map, Observable, of } from 'rxjs';
import { environment } from '../../../environments/environments';

export enum CategoryEnum {
  CAMA = 'CAMA',
  MESA = 'MESA',
  BANHO = 'BANHO',
  BORDADO = 'BORDADO',
}

export interface ProductRequest {
  barcode: string;
  name: string;
  description: string;
  price: number;
  stockQty: number;
  categoryEnum: CategoryEnum;
}

export interface ProductResponse {
  id: number;
  name: string;
  description: string;
  price: number;
  barcode: string;
  categoryEnum: CategoryEnum;
  stockQty: number;
}

export interface SpringPage<T> {
  content: T[];
  pageable: {
    pageNumber: number;
    pageSize: number;
    sort: any;
    offset: number;
    unpaged: boolean;
    paged: boolean;
  };
  last: boolean;
  totalPages: number;
  totalElements: number;
  first: boolean;
  size: number;
  number: number;
  sort: any;
  numberOfElements: number;
  empty: boolean;
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

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private http = inject(HttpClient);
  private apiUrl=`${environment.apiUrl}/products`;

  create(data: ProductRequest): Observable<ProductResponse> {
    return this.http.post<ProductResponse>(this.apiUrl, data);
  }

  update(id: number, data: ProductRequest): Observable<ProductResponse> {
    return this.http.put<ProductResponse>(`${this.apiUrl}/${id}`, data);
  }

  findById(id: number): Observable<ProductResponse> {
    return this.http.get<ProductResponse>(`${this.apiUrl}/${id}`);
  }

  findAll(): Observable<ProductResponse[]> {
    return this.http.get<ProductResponse[]>(this.apiUrl);
  }

   searchPaged(
  term: string,
  page: number = 0,
  size: number = 10,
  category: string = ''
): Observable<Page<ProductResponse>> {

  let params = new HttpParams()
    .set('search', term)
    .set('page', page.toString())
    .set('size', size.toString());

  if (category && category !== 'all') {
    params = params.set('search', category.trim());
  }

  return this.http.get<SpringPage<ProductResponse>>(`${this.apiUrl}/search`, { params })
    .pipe(
      map(springPage => {
        const mappedPage: Page<ProductResponse> = {
          content: springPage.content,
          totalElements: springPage.totalElements,
          totalPages: springPage.totalPages,
          size: springPage.size,
          number: springPage.number,
          first: springPage.first,
          last: springPage.last
        };
        return mappedPage;
      })
    );
}

  searchProducts(search: string = ''): Observable<ProductResponse[]> {
  let params = new HttpParams().set('size', '50');

  if (search.trim()) {
    params = params.set('search', search.trim());
  }

  return this.http.get<Page<ProductResponse>>(`${this.apiUrl}/search`, { params })
    .pipe(
      map(page => page.content),
      catchError(() => of([]))
    );
}

  getLowStockCount(): Observable<number> {
    return this.http.get<number>(`${this.apiUrl}/low-stock/count`);
  }

  getLowStockProducts(): Observable<ProductResponse[]> {
    return this.http.get<ProductResponse[]>(`${this.apiUrl}/low-stock`);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  getTopSellingProducts(): Observable<ProductResponse[]> {
  return this.http.get<ProductResponse[]>(`${this.apiUrl}/top-selling`);
}

}
