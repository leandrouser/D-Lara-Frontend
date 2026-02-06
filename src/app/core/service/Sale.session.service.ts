import { Injectable, signal, computed } from '@angular/core';
import { SaleItemRequest, DiscountType, SaleRequest } from './sale.service';

export interface SaleSessionItem {
  productId: number;
  productName: string;
  productPrice: number;
  quantity: number;
}

// Interface para a estrutura da venda temporária
export interface SaleSessionData {
  customerId: number | null;
  items: SaleSessionItem[];
  discount: number;
}

@Injectable({ providedIn: 'root' })
export class SaleSessionService {

  getSale(): SaleSessionData {
  return this._currentSale();
}
  
  private readonly initialSale = {
    customerId: 0,
    customerName: '',
    items: [] as SaleItemRequest[],
    discountValue: 0,
    discountType: DiscountType.FIXED
  };

  private _currentSale = signal<SaleSessionData>({
    customerId: null,
    items: [],
    discount: 0
  });
  public currentSale = this._currentSale.asReadonly();

  setCustomer(id: number, name: string) {
    this._currentSale.update(state => ({
      ...state,
      customerId: id,
      customerName: name
    }));
  }

  addItem(item: SaleSessionItem) {
    this._currentSale.update(state => {
      const existingItem = state.items.find(i => i.productId === item.productId);
      
      if (existingItem) {
        existingItem.quantity += item.quantity;
        return { ...state, items: [...state.items] };
      }
      
      return { ...state, items: [...state.items, item] };
    });
  }

  removeItem(productId: number) {
    this._currentSale.update(state => ({
      ...state,
      items: state.items.filter(i => i.productId !== productId)
    }));
  }

  clearSale() {
    this._currentSale.set({
      customerId: null,
      items: [],
      discount: 0
    });
  }

  getRawSale() {
    return this._currentSale();
  }

  totalCart = computed(() => {
    return this._currentSale().items.reduce((acc, item) => 
      acc + (item.productPrice * item.quantity), 0) - this._currentSale().discount;
  });
}