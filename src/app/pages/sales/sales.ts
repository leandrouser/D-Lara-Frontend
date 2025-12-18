import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Sale, SaleItem, SaleService } from '../../core/service/sale.service';
import { SaleDetails, SaleModal } from '../../shared/models/sale/sale-modal';

@Component({
  selector: 'app-sales',
  standalone: true,
  imports: [
    FormsModule,
    CommonModule,
    MatIconModule
],
  templateUrl: './sales.html',
  styleUrl: './sales.scss',
})
export class Sales implements OnInit {
getPageNumbers(): (number | string)[] {
  const current = this.currentPage();
  const total = this.totalPages();
  const pages: (number | string)[] = [];

  // Se não há páginas, retorna array vazio
  if (total <= 0) {
    return [];
  }

  if (total <= 7) {
    // Mostrar todas as páginas
    for (let i = 1; i <= total; i++) {
      pages.push(i);
    }
  } else {
    // Lógica para páginas com ellipsis
    if (current <= 4) {
      for (let i = 1; i <= 5; i++) {
        pages.push(i);
      }
      pages.push('...');
      pages.push(total);
    } else if (current >= total - 3) {
      pages.push(1);
      pages.push('...');
      for (let i = total - 4; i <= total; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      pages.push('...');
      for (let i = current - 1; i <= current + 1; i++) {
        pages.push(i);
      }
      pages.push('...');
      pages.push(total);
    }
  }

  return pages;
}
  private saleService = inject(SaleService);
  
  sales = signal<Sale[]>([]);
  isLoading = signal(true);
  error = signal('');
  search = signal('');
  statusFilter = signal('all');
  
  // SINAIS PARA PAGINAÇÃO
  currentPage = signal(1);
  itemsPerPage = signal(10);
  
  salesStats = signal({
    totalAmount: 0,
    totalSales: 0,
    todaySales: 0,
    todayAmount: 0,
    paidSales: 0,
    pendingSales: 0,
    cancelledSales: 0,
    pendingAmount: 0
  });

  // COMPUTED PARA PAGINAÇÃO
  filteredSales = computed(() => {
    const sales = this.sales();
    const searchTerm = this.search().toLowerCase();
    const status = this.statusFilter();

    return sales.filter(sale => {
      const matchesSearch = 
        sale.id.toString().includes(searchTerm) ||
        sale.customerName.toLowerCase().includes(searchTerm) ||
        sale.items.some(item => item.productName.toLowerCase().includes(searchTerm));
      
      const matchesStatus = 
        status === 'all' || 
        (status === 'paid' && sale.saleStatus === 'PAID') ||
        (status === 'pending' && sale.saleStatus === 'PENDING') ||
        (status === 'cancelled' && sale.saleStatus === 'CANCELLED');

      return matchesSearch && matchesStatus;
    });
  });

  paginatedSales = computed(() => {
    const filtered = this.filteredSales();
    const startIndex = (this.currentPage() - 1) * this.itemsPerPage();
    const endIndex = startIndex + this.itemsPerPage();
    return filtered.slice(startIndex, endIndex);
  });

  totalPages = computed(() => {
    const filtered = this.filteredSales();
    return Math.ceil(filtered.length / this.itemsPerPage());
  });

  totalFilteredItems = computed(() => {
    return this.filteredSales().length;
  });

  paginationInfo = computed(() => {
    const total = this.totalFilteredItems();
    const start = ((this.currentPage() - 1) * this.itemsPerPage()) + 1;
    const end = Math.min(this.currentPage() * this.itemsPerPage(), total);
    
    return { start, end, total };
  });

  ngOnInit() {
    this.loadSales();
  }

  loadSales(): void {
    this.isLoading.set(true);
    this.error.set('');
    
    this.saleService.getSales().subscribe({
      next: (sales) => {
        console.log('Dados recebidos do backend:', sales);
        this.sales.set(sales);
        this.calculateSalesStats(sales);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Erro ao carregar vendas:', err);
        this.error.set('Erro ao carregar vendas. Tente novamente.');
        this.isLoading.set(false);
      }
    });
  }

  // MÉTODOS DE PAGINAÇÃO
  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.set(this.currentPage() + 1);
    }
  }

  prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.set(this.currentPage() - 1);
    }
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  setItemsPerPage(items: number): void {
    this.itemsPerPage.set(items);
    this.currentPage.set(1); // Reset para primeira página
  }

  // MÉTODOS EXISTENTES (mantenha os outros métodos que já existiam)
  private calculateSalesStats(sales: Sale[]): void {
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];
    
    let totalAmount = 0;
    let totalSales = sales.length;
    let todaySales = 0;
    let todayAmount = 0;
    let paidSales = 0;
    let pendingSales = 0;
    let cancelledSales = 0;
    let pendingAmount = 0;

    sales.forEach(sale => {
      const saleDate = new Date(sale.dateSale);
      const saleDateString = saleDate.toISOString().split('T')[0];
      
      totalAmount += sale.total;

      if (saleDateString === todayString) {
        todaySales++;
        todayAmount += sale.total;
      }

      switch (sale.saleStatus) {
        case 'PAID':
          paidSales++;
          break;
        case 'PENDING':
          pendingSales++;
          pendingAmount += sale.total;
          break;
        case 'CANCELLED':
          cancelledSales++;
          break;
      }
    });

    this.salesStats.set({
      totalAmount,
      totalSales,
      todaySales,
      todayAmount,
      paidSales,
      pendingSales,
      cancelledSales,
      pendingAmount
    });
  }

  getAverageTicket(): number {
    const stats = this.salesStats();
    if (stats.totalSales === 0) return 0;
    return stats.totalAmount / stats.totalSales;
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('pt-BR');
  }

  setFilter(status: string): void {
    this.statusFilter.set(status);
    this.currentPage.set(1); // Reset para primeira página ao mudar filtro
  }

  retryLoadSales(): void {
    this.loadSales();
  }

  getTotalItems(items: any[]): number {
    return items.reduce((total, item) => total + item.quantity, 0);
  }

  getCustomerDisplayName(sale: Sale): string {
    return sale.customerName || `Cliente ${sale.customerId}`;
  }

  getCustomerPhone(sale: Sale): string {
    return sale.customerPhone || 'Não informado';
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'PAID': return 'status-paid';
      case 'PENDING': return 'status-pending';
      case 'CANCELLED': return 'status-cancelled';
      default: return 'status-pending';
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'PAID': return 'check_circle';
      case 'PENDING': return 'schedule';
      case 'CANCELLED': return 'cancel';
      default: return 'help';
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'PAID': return 'Paga';
      case 'PENDING': return 'Pendente';
      case 'CANCELLED': return 'Cancelada';
      default: return status;
    }
  }

  viewSaleDetails(sale: Sale): void {
    console.log('Visualizar venda:', sale);
  }
}