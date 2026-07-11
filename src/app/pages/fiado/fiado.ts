import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { CustomerService, CustomerResponse, Page } from '../../core/service/customer.service';
import { PhoneFormatPipe } from '../../shared/pipes/phone-pipe';
import { FiadoLedgerModal } from '../../shared/models/fiado/fiado-ledger-modal';
import { FiadoPaymentModal } from '../../shared/models/fiado/fiado-payment/fiado-payment.modal';

type FiadoFilter = 'all' | 'withDebt';

@Component({
  selector: 'app-fiado',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, PhoneFormatPipe, FiadoLedgerModal, FiadoPaymentModal],
  templateUrl: './fiado.html',
  styleUrls: ['./fiado.scss']
})
export class Fiado implements OnInit, OnDestroy {
  private api = inject(CustomerService);

  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  isLoading = signal(true);
  error = signal('');
  search = signal('');
  statusFilter = signal<FiadoFilter>('withDebt');

  customers = signal<CustomerResponse[]>([]);

  currentPage = signal(0);
  itemsPerPage = signal(8);
  totalElements = signal(0);
  totalPages = signal(0);

  fiadoStats = signal({
    customersWithDebt: 0,
    totalReceivable: 0,
    totalCreditGranted: 0,
    totalAvailable: 0
  });

  showLedgerModal = signal(false);
  showPaymentModal = signal(false);
  selectedCustomer = signal<CustomerResponse | null>(null);

  // Todos os clientes com saldo devedor (carregado à parte, independente da paginação da tabela)
  private allDebtors = signal<CustomerResponse[]>([]);

  displayedCustomers = computed(() => {
    if (this.statusFilter() === 'withDebt') {
      const start = this.currentPage() * this.itemsPerPage();
      const end = start + this.itemsPerPage();
      return this.allDebtors().slice(start, end);
    }
    return this.customers();
  });

  private effectiveTotalElements = computed(() =>
    this.statusFilter() === 'withDebt' ? this.allDebtors().length : this.totalElements()
  );

  private effectiveTotalPages = computed(() =>
    this.statusFilter() === 'withDebt'
      ? Math.max(1, Math.ceil(this.allDebtors().length / this.itemsPerPage()))
      : this.totalPages()
  );

  paginationInfo = computed(() => {
    const total = this.effectiveTotalElements();
    const start = total === 0 ? 0 : this.currentPage() * this.itemsPerPage() + 1;
    const end = Math.min((this.currentPage() + 1) * this.itemsPerPage(), total);
    return { start, end, total };
  });

  ngOnInit() {
    this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(term => {
      this.search.set(term);
      this.currentPage.set(0);
      this.loadCustomers(term);
    });

    this.loadCustomers();
    this.loadStats();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearchInput(term: string) {
    this.searchSubject.next(term);
  }

  loadCustomers(termOverride?: string): void {
    this.isLoading.set(true);
    this.error.set('');

    const term = (termOverride !== undefined ? termOverride : this.search()).trim();

    this.api.searchPaged(term, this.currentPage(), this.itemsPerPage()).subscribe({
      next: (page: Page<CustomerResponse>) => {
        this.customers.set(page.content);
        this.totalPages.set(page.totalPages);
        this.totalElements.set(page.totalElements);
      },
      error: () => this.error.set('Erro ao carregar clientes. Verifique sua conexão.'),
      complete: () => this.isLoading.set(false)
    });
  }

  private loadStats(): void {
    this.api.searchPaged('', 0, 9999).subscribe({
      next: (page: Page<CustomerResponse>) => {
        this.calculateStats(page.content);
        this.allDebtors.set(page.content.filter(c => (c.debtBalance ?? 0) > 0));
      }
    });
  }

  private calculateStats(all: CustomerResponse[]): void {
    const withDebt = all.filter(c => (c.debtBalance ?? 0) > 0);

    const stats = {
      customersWithDebt: withDebt.length,
      totalReceivable: withDebt.reduce((sum, c) => sum + (c.debtBalance ?? 0), 0),
      totalCreditGranted: all.reduce((sum, c) => sum + (c.creditLimit ?? 0), 0),
      totalAvailable: all.reduce((sum, c) => sum + ((c.creditLimit ?? 0) - (c.debtBalance ?? 0)), 0)
    };

    this.fiadoStats.set(stats);
  }

  setFilter(filter: FiadoFilter) {
    this.statusFilter.set(filter);
    this.currentPage.set(0);
    this.loadCustomers();
  }

  retryLoad() {
    this.loadCustomers();
    this.loadStats();
  }

  goToPage(page: number | string) {
    if (typeof page === 'number') {
      this.currentPage.set(page - 1);
      this.loadCustomers();
    }
  }

  nextPage() {
    if (this.currentPage() < this.effectiveTotalPages() - 1) {
      this.goToPage(this.currentPage() + 2);
    }
  }

  prevPage() {
    if (this.currentPage() > 0) {
      this.goToPage(this.currentPage());
    }
  }

  getPageNumbers(): (number | string)[] {
    const total = this.effectiveTotalPages();
    const current = this.currentPage() + 1;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (current <= 4) return [1, 2, 3, 4, 5, '...', total];
    if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
    return [1, '...', current - 1, current, current + 1, '...', total];
  }

  openLedger(customer: CustomerResponse) {
    this.selectedCustomer.set(customer);
    this.showLedgerModal.set(true);
  }

  openPayment(customer: CustomerResponse) {
    this.selectedCustomer.set(customer);
    this.showPaymentModal.set(true);
  }

  closeLedgerModal() {
    this.showLedgerModal.set(false);
    this.selectedCustomer.set(null);
  }

  closePaymentModal() {
    this.showPaymentModal.set(false);
    this.selectedCustomer.set(null);
  }

  onPaymentRegistered() {
    this.closePaymentModal();
    this.loadCustomers();
    this.loadStats();
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  }

  getDebtStatusClass(customer: CustomerResponse): string {
    if ((customer.debtBalance ?? 0) <= 0) return 'ok';
    const usage = customer.creditLimit > 0 ? customer.debtBalance / customer.creditLimit : 1;
    if (usage >= 1) return 'full';
    if (usage >= 0.7) return 'warning';
    return 'ok';
  }
}
