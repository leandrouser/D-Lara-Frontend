// pdv.service.ts
import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal, computed, effect } from '@angular/core';
import { environment } from '../../../environments/environments';
import { Observable } from 'rxjs';
import { CustomerResponse } from './customer.service';

export interface CartProduct {
  id: number;
  name: string;
  price: number;
  barcode: string;
  stockQty: number;
}

export interface CartItem {
  product: CartProduct;
  quantity: number;
  total: number;
  isEmbroidery?: boolean;
  observations?: string;
  embroideryId?: number;
}

export interface PdvState {
  cart: CartItem[];
  selectedCustomer: CustomerResponse | null;
  discountType: 'value' | 'percent';
  discountInput: number;
  activeSaleId: number | null;
  isCopiedSale: boolean;
}

const STORAGE_KEY = 'pdv_state';

const emptyState = (): PdvState => ({
  cart: [],
  selectedCustomer: null,
  discountType: 'value',
  discountInput: 0,
  activeSaleId: null,
  isCopiedSale: false,
});

@Injectable({ providedIn: 'root' })
export class PdvService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/payments`;

  readonly state = signal<PdvState>(this.loadState());

  readonly cart         = computed(() => this.state().cart);
  readonly selectedCustomer = computed(() => this.state().selectedCustomer);
  readonly discountType = computed(() => this.state().discountType);
  readonly discountInput = computed(() => this.state().discountInput);
  readonly activeSaleId = computed(() => this.state().activeSaleId);
  readonly isCopiedSale = computed(() => this.state().isCopiedSale);

  constructor() {
    effect(() => {
      this.saveState(this.state());
    });
  }

  patch(partial: Partial<PdvState>) {
    this.state.update(s => ({ ...s, ...partial }));
  }

  reset() {
    this.state.set(emptyState());
    sessionStorage.removeItem(STORAGE_KEY);
  }

  private loadState(): PdvState {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? { ...emptyState(), ...JSON.parse(raw) } : emptyState();
    } catch {
      return emptyState();
    }
  }

  private saveState(state: PdvState) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }

  processMultiPayment(requestBody: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/processar`, requestBody);
  }
}
