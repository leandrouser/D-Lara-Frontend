import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { CustomerLedgerEntry, CustomerResponse, CustomerService, Page } from '../../../core/service/customer.service';
import { SaleResponse, SaleService } from '../../../core/service/sale.service';
import { SaleDetailsModalComponent } from '../sale/sale-details/sale-details';

@Component({
  selector: 'fiado-ledger-modal',
  standalone: true,
  imports: [CommonModule, MatIconModule, SaleDetailsModalComponent],
  templateUrl: './fiado-ledger-modal.html',
  styleUrls: ['./fiado-ledger-modal.scss']
})
export class FiadoLedgerModal implements OnChanges {
  private customerService = inject(CustomerService);
  private saleService = inject(SaleService);

  @Input() isOpen = false;
  @Input() customer: CustomerResponse | null = null;
  @Output() close = new EventEmitter<void>();

  entries = signal<CustomerLedgerEntry[]>([]);
  paged = signal<Page<CustomerLedgerEntry> | null>(null);
  page = signal(0);
  readonly pageSize = 15;

  isLoading = signal(false);
  errorMessage = signal('');
  selectedSale = signal<SaleResponse | null>(null);
  isSaleLoading = signal(false);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']?.currentValue === true && this.customer) {
      this.page.set(0);
      this.loadLedger();
    }
  }

  private loadLedger() {
    if (!this.customer) return;

    this.isLoading.set(true);
    this.errorMessage.set('');

    this.customerService.getLedger(this.customer.id, this.page(), this.pageSize).subscribe({
      next: (response) => {
        this.paged.set(response);
        this.entries.set(response.content || []);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set('Erro ao carregar extrato.');
        this.isLoading.set(false);
        console.error(err);
      }
    });
  }

  nextPage() {
    const pagedData = this.paged();
    if (pagedData && !pagedData.last) {
      this.page.update(p => p + 1);
      this.loadLedger();
    }
  }

  prevPage() {
    if (this.page() > 0) {
      this.page.update(p => p - 1);
      this.loadLedger();
    }
  }

  closeModal() {
    this.closeSaleDetails();
    this.close.emit();
  }

  openSaleDetails(entry: CustomerLedgerEntry) {
    if (!entry.saleId || this.isSaleLoading()) return;

    this.isSaleLoading.set(true);
    this.saleService.getSaleById(entry.saleId).subscribe({
      next: sale => {
        this.selectedSale.set(sale);
        this.isSaleLoading.set(false);
      },
      error: err => {
        this.isSaleLoading.set(false);
        console.error('Erro ao carregar detalhes da venda.', err);
      }
    });
  }

  closeSaleDetails() {
    this.selectedSale.set(null);
    this.isSaleLoading.set(false);
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  }

  isDebit(type: string): boolean {
    return type === 'DEBIT_SALE' || type === 'MANUAL_DEBIT_ADJUSTMENT';
  }

  typeLabel(type: string): string {
    const map: Record<string, string> = {
      'DEBIT_SALE': 'Venda a prazo',
      'CREDIT_PAYMENT': 'Pagamento recebido',
      'MANUAL_DEBIT_ADJUSTMENT': 'Ajuste (débito)',
      'MANUAL_CREDIT_ADJUSTMENT': 'Ajuste (crédito)'
    };
    return map[type] || type;
  }

  typeIcon(type: string): string {
    const map: Record<string, string> = {
      'DEBIT_SALE': 'shopping_cart',
      'CREDIT_PAYMENT': 'payments',
      'MANUAL_DEBIT_ADJUSTMENT': 'edit',
      'MANUAL_CREDIT_ADJUSTMENT': 'edit'
    };
    return map[type] || 'receipt';
  }
}
