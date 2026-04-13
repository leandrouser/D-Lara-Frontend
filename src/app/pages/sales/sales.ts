import { Component, signal, inject, OnInit, computed, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { SaleItemResponse, SaleResponse, SaleService } from '../../core/service/sale.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PhoneFormatPipe } from "../../shared/pipes/phone-pipe";
import { SaleDetailsModalComponent } from '../../shared/models/sale/sale-details/sale-details';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';

@Component({
  selector: 'app-sales',
  standalone: true,
  imports: [FormsModule, CommonModule, MatIconModule, PhoneFormatPipe, SaleDetailsModalComponent],
  templateUrl: './sales.html',
  styleUrls: ['./sales.scss'],
})
export class Sales implements OnInit, OnDestroy {
  private saleService = inject(SaleService);
  private snackBar = inject(MatSnackBar);

  // Subject para o debounce da busca
  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  sales = signal<SaleResponse[]>([]);
  isLoading = signal(true);
  error = signal('');
  search = signal('');
  statusFilter = signal<string>('all');

  currentPage = signal(0);
  itemsPerPage = signal(5);
  totalElements = signal(0);
  totalPages = signal(0);

  showModal = signal(false);
  selectedSale = signal<SaleResponse | null>(null);

  salesStats = signal({
    totalAmount: 0, totalSales: 0, todaySales: 0, todayAmount: 0,
    paidSales: 0, pendingSales: 0, cancelledSales: 0, pendingAmount: 0
  });

  ngOnInit() {
    // Escuta o searchSubject com debounce de 400ms
    this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(term => {
      this.search.set(term);
      this.currentPage.set(0);
      this.loadSales();
    });

    this.loadSales();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Chamado pelo (input) do campo de busca no template
  onSearchInput(term: string) {
    this.searchSubject.next(term);
  }

  loadSales(): void {
  this.isLoading.set(true);
  this.error.set('');

  const term = this.search().trim();

  this.saleService.searchSales(term, this.currentPage(), this.itemsPerPage()).subscribe({
    next: (page) => {
      this.sales.set(page.content);
      this.totalPages.set(page.totalPages);
      this.totalElements.set(page.totalElements);
      this.calculateSalesStats(page.content);
    },
    error: () => this.error.set('Erro ao carregar vendas. Verifique sua conexão.'),
    complete: () => this.isLoading.set(false)
  });
  }

  // --- resto dos métodos sem alteração ---

  private calculateSalesStats(sales: SaleResponse[]): void {
    const today = new Date().toISOString().split('T')[0];
    const stats = sales.reduce((acc, sale) => {
      const isToday = sale.dateSale.split('T')[0] === today;
      acc.totalSales++;
      if (sale.saleStatus === 'PAID') {
        acc.paidSales++;
        acc.totalAmount += sale.total;
        if (isToday) { acc.todaySales++; acc.todayAmount += sale.total; }
      } else if (sale.saleStatus === 'PENDING') {
        acc.pendingSales++;
        acc.pendingAmount += sale.total;
      } else if (sale.saleStatus === 'CANCELLED') {
        acc.cancelledSales++;
      }
      return acc;
    }, {
      totalAmount: 0, totalSales: 0, todaySales: 0, todayAmount: 0,
      paidSales: 0, pendingSales: 0, cancelledSales: 0, pendingAmount: 0
    });
    this.salesStats.set(stats);
  }

  paginationInfo = computed(() => {
    const start = this.currentPage() * this.itemsPerPage() + 1;
    const end = Math.min((this.currentPage() + 1) * this.itemsPerPage(), this.totalElements());
    return { start, end, total: this.totalElements() };
  });

  filteredSales = computed(() => {
    const term = this.search().toLowerCase();
    const status = this.statusFilter();
    return this.sales().filter(sale => {
      const matchesSearch = sale.id.toString().includes(term) ||
                            sale.customerName?.toLowerCase().includes(term);
      const matchesStatus = status === 'all' || sale.saleStatus?.toLowerCase() === status.toLowerCase();
      return matchesSearch && matchesStatus;
    });
  });

  getAverageTicket(): number {
    const stats = this.salesStats();
    return stats.totalSales > 0 ? stats.totalAmount / stats.totalSales : 0;
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '---';
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    }).format(new Date(dateStr));
  }

  getStatusClass = (status: string) => status?.toLowerCase() || 'pending';

  getStatusIcon(status: string): string {
    const icons: any = { 'PAID': 'check_circle', 'PENDING': 'schedule', 'CANCELLED': 'cancel' };
    return icons[status] || 'help_outline';
  }

  getStatusText(status: string): string {
    const texts: any = { 'PAID': 'Paga', 'PENDING': 'Pendente', 'CANCELLED': 'Cancelada' };
    return texts[status] || status;
  }

  getCustomerDisplayName = (sale: any) => sale.customerName || 'Consumidor Final';
  getCustomerPhone = (sale: any) => sale.customerPhone || '(00) 00000-0000';

  getTotalItems(items: SaleItemResponse[] | undefined): number {
    if (!items) return 0;
    return items.reduce((acc, item) => acc + item.quantity, 0);
  }

  setFilter(status: string) {
    this.statusFilter.set(status);
    this.currentPage.set(0);
    this.loadSales();
  }

  retryLoadSales() { this.loadSales(); }

  goToPage(page: number | string) {
    if (typeof page === 'number') {
      this.currentPage.set(page - 1);
      this.loadSales();
    }
  }

  nextPage() {
    if (this.currentPage() < this.totalPages() - 1) {
      this.goToPage(this.currentPage() + 2);
    }
  }

  prevPage() {
    if (this.currentPage() > 0) {
      this.goToPage(this.currentPage());
    }
  }

  getPageNumbers(): (number | string)[] {
    const total = this.totalPages();
    const current = this.currentPage() + 1;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (current <= 4) return [1, 2, 3, 4, 5, '...', total];
    if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
    return [1, '...', current - 1, current, current + 1, '...', total];
  }

  viewSaleDetails(sale: SaleResponse) {
    this.selectedSale.set(sale);
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.selectedSale.set(null);
  }
}