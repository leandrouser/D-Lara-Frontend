import { Injectable, signal, computed } from '@angular/core';
import { DiscountType, SaleRequest } from './sale.service';

export interface SaleSessionItem {
  productId: number;
  productName: string;
  productPrice: number;
  quantity: number;
  embroideryId?: number | null;
  description?: string;
  manualPrice?: number | null;
}

export interface SaleSessionData {
  customerId: number | null;
  customerName: string;
  cashSessionId: number | null;
  items: SaleSessionItem[];
  discountType: DiscountType;
  discountValue: number;
}

@Injectable({ providedIn: 'root' })
export class SaleSessionService {

  private _currentSale = signal<SaleSessionData>({
    customerId: null,
    customerName: '',
    cashSessionId: null,
    items: [],
    discountType: DiscountType.FIXED,
    discountValue: 0
  });

  public currentSale = this._currentSale.asReadonly();

  getSale(): SaleSessionData {
    return this._currentSale();
  }

  getRawSale(): SaleSessionData {
    return this._currentSale();
  }

  subtotal = computed(() => {
    return this._currentSale().items.reduce((acc, item) => {
      const price = item.manualPrice ?? item.productPrice;
      return acc + (price * item.quantity);
    }, 0);
  });

  discountAmount = computed(() => {
    const sale = this._currentSale();
    const subtotal = this.subtotal();

    if (sale.discountType === DiscountType.PERCENTAGE) {
      return subtotal * (sale.discountValue / 100);
    }
    return sale.discountValue;
  });

  totalCart = computed(() => {
    return Math.max(0, this.subtotal() - this.discountAmount());
  });

  setCustomer(id: number | null, name: string = '') {
    this._currentSale.update(state => ({
      ...state,
      customerId: id,
      customerName: name
    }));
  }

  setCashSession(cashSessionId: number | null) {
    this._currentSale.update(state => ({
      ...state,
      cashSessionId
    }));
  }

  setDiscount(type: DiscountType, value: number) {
    this._currentSale.update(state => ({
      ...state,
      discountType: type,
      discountValue: Math.max(0, value)
    }));
  }

  addItem(item: SaleSessionItem) {
    this._currentSale.update(state => {
      const existingItemIndex = state.items.findIndex(
        i => i.productId === item.productId &&
             i.embroideryId === item.embroideryId
      );

      if (existingItemIndex !== -1) {
        const updatedItems = [...state.items];
        updatedItems[existingItemIndex] = {
          ...updatedItems[existingItemIndex],
          quantity: updatedItems[existingItemIndex].quantity + item.quantity
        };
        return { ...state, items: updatedItems };
      }

      return { ...state, items: [...state.items, item] };
    });
  }

  updateItemQuantity(productId: number, quantity: number, embroideryId?: number | null) {
    this._currentSale.update(state => {
      const updatedItems = state.items.map(item => {
        if (item.productId === productId && item.embroideryId === embroideryId) {
          return { ...item, quantity: Math.max(1, quantity) };
        }
        return item;
      });
      return { ...state, items: updatedItems };
    });
  }

  removeItem(productId: number, embroideryId?: number | null) {
    this._currentSale.update(state => ({
      ...state,
      items: state.items.filter(
        i => !(i.productId === productId && i.embroideryId === embroideryId)
      )
    }));
  }

  clearSale() {
    this._currentSale.set({
      customerId: null,
      customerName: '',
      cashSessionId: null,
      items: [],
      discountType: DiscountType.FIXED,
      discountValue: 0
    });
  }

  convertToSaleRequest(): SaleRequest {
    const sale = this._currentSale();

    return {
      customerId: sale.customerId,
      cashSessionId: sale.cashSessionId,
      discountType: sale.discountType,
      discountValue: sale.discountValue,
      items: sale.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        manualPrice: item.manualPrice,
        description: item.description,
        embroideryId: item.embroideryId
      }))
    };
  }
}
