import { Component, signal, inject, computed, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';

import { SaleService, SaleResponse, SaleItemResponse } from '../../core/service/sale.service';
import {
  ExchangeService,
  ExchangeResponse,
} from '../../core/service/exchange.service';

interface ReturnItemState {
  saleItem: SaleItemResponse;
  selected: boolean;
  quantityToReturn: number;
}

interface NewItemState {
  productId: number;
  productName: string;
  price: number;
  stockQty: number;
  quantity: number;
}

interface ExchangeRecord {
  id: number;
  saleId: number;
  totalReturned: number;
  totalNewItems: number;
  difference: number;
  message: string;
  doneAt: string;
}

@Component({
  selector: 'app-exchange',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, CurrencyPipe],
  templateUrl: './exchange.component.html',
  styleUrls: ['./exchange.component.scss'],
})
export class ExchangeComponent implements OnInit {
  private saleService  = inject(SaleService);
  private exchangeService = inject(ExchangeService);
  private snackBar = inject(MatSnackBar);

  step = signal<1 | 2 | 3>(1);

  saleIdInput   = signal('');
  loadingSale   = signal(false);
  sale          = signal<SaleResponse | null>(null);
  saleError     = signal('');

  returnItems = signal<ReturnItemState[]>([]);

  productSearchTerm = signal('');
  productResults    = signal<NewItemState[]>([]);
  searchingProducts = signal(false);
  newItems          = signal<NewItemState[]>([]);

  reason            = signal('');
  paymentMethodCode = signal('DINHEIRO');
  submitting        = signal(false);

  history = signal<ExchangeRecord[]>([]);
  private nextHistoryId = 1;

  stats = signal({ total: 0, totalReturned: 0, totalNewItems: 0, totalDiff: 0 });

  totalReturned = computed(() =>
    this.returnItems()
      .filter(r => r.selected)
      .reduce((sum, r) => sum + (r.saleItem.productPrice ?? 0) * r.quantityToReturn, 0)
  );

  totalNewItems = computed(() =>
    this.newItems().reduce((sum, n) => sum + n.price * n.quantity, 0)
  );

  difference = computed(() => this.totalNewItems() - this.totalReturned());

  selectedCount = computed(() => this.returnItems().filter(r => r.selected).length);

  canGoStep2 = computed(() =>
    this.sale() !== null && this.returnItems().some(r => r.selected)
  );

  canSubmit = computed(() =>
    this.canGoStep2() && this.reason().trim().length > 0
  );

  ngOnInit() {}

  goToStep(n: 1 | 2 | 3) { this.step.set(n); }

  searchSale() {
    const id = Number(this.saleIdInput());
    if (!id) return;

    this.loadingSale.set(true);
    this.saleError.set('');
    this.sale.set(null);
    this.returnItems.set([]);

    this.saleService.getSaleById(id).subscribe({
      next: (s) => {
        if (s.saleStatus !== 'PAID') {
          this.saleError.set('Apenas vendas com status PAGO podem ser trocadas.');
          this.loadingSale.set(false);
          return; // Importante para não continuar o processamento
        }

        // Sucesso: popula os sinais
        this.sale.set(s);
        this.returnItems.set(
          (s.items ?? []).map((item) => ({
            saleItem: item, // Aqui o 'id' real do banco será preservado
            selected: false,
            quantityToReturn: item.quantity,
          }))
        );
        this.loadingSale.set(false);
      },
      error: (err) => {
        this.loadingSale.set(false);
        const message = err?.error?.message || 'Venda não encontrada. Verifique o número e tente novamente.';
        
        this.snackBar.open(message, 'Fechar', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
        
        this.saleError.set(message);
      }
    });
  }

  onSaleInputKeyup(e: KeyboardEvent) {
    if (e.key === 'Enter') this.searchSale();
  }

  toggleItem(idx: number) {
    const items = [...this.returnItems()];
    items[idx] = { ...items[idx], selected: !items[idx].selected };
    this.returnItems.set(items);
  }

  updateReturnQty(idx: number, val: string) {
    const qty = Math.max(1, Math.min(Number(val), this.returnItems()[idx].saleItem.quantity));
    const items = [...this.returnItems()];
    items[idx] = { ...items[idx], quantityToReturn: qty };
    this.returnItems.set(items);
  }

  selectAll() {
    this.returnItems.set(this.returnItems().map(r => ({ ...r, selected: true })));
  }

  clearSelection() {
    this.returnItems.set(this.returnItems().map(r => ({ ...r, selected: false })));
  }

  searchProducts() {
    const term = this.productSearchTerm().trim();
    if (term.length < 2) return;

    this.searchingProducts.set(true);
    this.exchangeService.searchProducts(term).subscribe({
      next: (products) => {
        this.productResults.set(
          products.map(p => ({
            productId: p.id,
            productName: p.name,
            price: Number(p.price),
            stockQty: p.stockQty,
            quantity: 1,
          }))
        );
        this.searchingProducts.set(false);
      },
      error: () => this.searchingProducts.set(false)
    });
  }

  onProductSearchKeyup(e: KeyboardEvent) {
    if (e.key === 'Enter') this.searchProducts();
  }

  addNewItem(item: NewItemState) {
    if (this.newItems().some(n => n.productId === item.productId)) {
      this.snackBar.open('Produto já adicionado.', 'OK', { duration: 2000 });
      return;
    }
    this.newItems.set([...this.newItems(), { ...item, quantity: 1 }]);
    this.productResults.set([]);
    this.productSearchTerm.set('');
  }

  updateNewQty(idx: number, val: string) {
    const items = [...this.newItems()];
    const qty = Math.max(1, Math.min(Number(val), items[idx].stockQty));
    items[idx] = { ...items[idx], quantity: qty };
    this.newItems.set(items);
  }

  removeNewItem(idx: number) {
    const items = [...this.newItems()];
    items.splice(idx, 1);
    this.newItems.set(items);
  }

  confirm() {
    if (!this.canSubmit()) return;
    this.submitting.set(true);

    const returnedItems = this.returnItems()
      .filter(r => r.selected)
        .map(r => ({ saleItemId: r.saleItem.id, quantity: r.quantityToReturn }));

    const newItems = this.newItems().map(n => ({
      productId: n.productId,
      quantity: n.quantity,
    }));

    this.exchangeService.processExchange({
      saleId: this.sale()!.id,
      returnedItems,
      newItems,
      paymentMethodCode: this.paymentMethodCode(),
      reason: this.reason(),
    }).subscribe({
      next: (res: ExchangeResponse) => {
        this.snackBar.open(res.message, 'OK', { duration: 5000 });
        this.addToHistory(res);
        this.updateStats(res);
        this.reset();
        this.submitting.set(false);
      },
      error: (err: any) => {
        const msg = err?.error?.message || 'Erro ao processar troca.';
        this.snackBar.open(msg, 'Fechar', { duration: 5000 });
        this.submitting.set(false);
      }
    });
  }

  private addToHistory(res: ExchangeResponse) {
    const record: ExchangeRecord = {
      id: this.nextHistoryId++,
      saleId: res.originalSaleId,
      totalReturned: res.totalReturned,
      totalNewItems: res.totalNewItems,
      difference: res.difference,
      message: res.message,
      doneAt: new Date().toISOString(),
    };
    this.history.set([record, ...this.history()]);
  }

  private updateStats(res: ExchangeResponse) {
    const s = this.stats();
    this.stats.set({
      total: s.total + 1,
      totalReturned: s.totalReturned + res.totalReturned,
      totalNewItems: s.totalNewItems + res.totalNewItems,
      totalDiff: s.totalDiff + res.difference,
    });
  }

  reset() {
    this.saleIdInput.set('');
    this.sale.set(null);
    this.returnItems.set([]);
    this.newItems.set([]);
    this.productResults.set([]);
    this.productSearchTerm.set('');
    this.reason.set('');
    this.saleError.set('');
    this.step.set(1);
  }

  formatDate(d: string): string {
    if (!d) return '---';
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    }).format(new Date(d));
  }

  diffLabel(): string {
    const d = this.difference();
    if (d > 0) return 'Cliente paga';
    if (d < 0) return 'Loja reembolsa';
    return 'Troca equivalente';
  }

  diffClass(): string {
    const d = this.difference();
    if (d > 0) return 'diff-positive';
    if (d < 0) return 'diff-negative';
    return 'diff-neutral';
  }

  historyDiffClass(diff: number): string {
    if (diff > 0) return 'diff-positive';
    if (diff < 0) return 'diff-negative';
    return 'diff-neutral';
  }
}