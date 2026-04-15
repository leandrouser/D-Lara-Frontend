import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environments';
import { ProductService, ProductResponse } from '../../core/service/product.service';

interface SaleItem {
  id: number;
  name: string;
  quantity: number;
  total: number;
}

interface SaleResponse {
  id: number;
  dateSale: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  total: number;
  saleStatus: string;
  items: SaleItem[];
}

interface ProductsStats {
  totalProducts: number;
  totalValue: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss'],
})
export class Dashboard implements OnInit {
  private http = inject(HttpClient);
  private productService = inject(ProductService);
  readonly Math = Math;

  lowStockCount = signal(0);
  loadingLowStock = signal(true);
  lowStockProducts = signal<ProductResponse[]>([]);

  readonly lowStockPageSize = 5;
  lowStockPage = signal(0);

  lowStockPaged = computed(() => {
    const start = this.lowStockPage() * this.lowStockPageSize;
    return this.lowStockProducts().slice(start, start + this.lowStockPageSize);
  });

  lowStockTotalPages = computed(() =>
    Math.ceil(this.lowStockProducts().length / this.lowStockPageSize)
  );

  lowStockPageNumbers = computed(() => {
  const total = this.lowStockTotalPages();
  const current = this.lowStockPage();
  return this.getPageWindow(current, total);
  });

  totalProducts = signal(0);
  totalProductsValue = signal(0);
  loadingProducts = signal(true);

  todayPaymentsTotal = signal(0);
  todaySales = signal<SaleResponse[]>([]);
  loadingToday = signal(true);
  todaySalesTotal = signal(0);

  ticketMedio = computed(() => {
  const count = this.monthSalesCount();
  const total = this.monthSalesTotal();
  return count > 0 ? total / count : 0;
  });

  salesByHour = signal<{ hour: string; total: number }[]>([]);

  monthSalesTotal = signal(0);
  monthSalesCount = signal(0);

  readonly salesPageSize = 5;
  salesPage = signal(0);

  salesPaged = computed(() => {
    const start = this.salesPage() * this.salesPageSize;
    return this.todaySales().slice(start, start + this.salesPageSize);
  });

  salesTotalPages = computed(() =>
    Math.ceil(this.todaySales().length / this.salesPageSize)
  );

  maxSalesValue = computed(() => {
  const data = this.salesByHour();
  if (!data || data.length === 0) return 1;
  return Math.max(...data.map(h => h.total || 0));
  });

  salesPageNumbers = computed(() => {
  const total = this.salesTotalPages();
  const current = this.salesPage();
  return this.getPageWindow(current, total);
  });

  ngOnInit() {
    this.loadLowStockProducts();
    this.loadTodayPayments();
    this.loadTodaySales();
    this.loadProductsStats();
    this.loadMonthSales();
  }

  loadProductsStats() {
    this.loadingProducts.set(true);
    this.http.get<ProductsStats>(`${environment.apiUrl}/products/stats`).subscribe({
      next: (stats) => {
        this.totalProducts.set(stats.totalProducts || 0);
        this.totalProductsValue.set(stats.totalValue || 0);
        this.loadingProducts.set(false);
      },
      error: (err) => {
        console.error('Erro ao carregar estatísticas:', err);
        this.totalProducts.set(0);
        this.totalProductsValue.set(0);
        this.loadingProducts.set(false);
      },
    });
  }

  refreshProductsStats() {
    this.loadProductsStats();
  }

  loadLowStockProducts() {
    this.loadingLowStock.set(true);
    this.productService.getLowStockProducts().subscribe({
      next: (products) => {
        this.lowStockProducts.set(products);
        this.lowStockCount.set(products.length);
        this.lowStockPage.set(0);
        this.loadingLowStock.set(false);
      },
      error: (err) => {
        console.error('Erro ao carregar estoque baixo:', err);
        this.loadingLowStock.set(false);
      },
    });
  }

  refreshLowStock() {
    this.loadLowStockProducts();
  }

  lowStockPrevPage() {
    if (this.lowStockPage() > 0) this.lowStockPage.update(p => p - 1);
  }

  lowStockNextPage() {
    if (this.lowStockPage() < this.lowStockTotalPages() - 1)
      this.lowStockPage.update(p => p + 1);
  }

  lowStockGoToPage(page: number) {
    this.lowStockPage.set(page);
  }

  loadTodayPayments() {
    this.http.get<number>(`${environment.apiUrl}/payments/today/total`).subscribe({
      next: (total) => this.todayPaymentsTotal.set(total),
      error: (err) => console.error('Erro ao carregar pagamentos de hoje:', err),
    });
  }

  loadTodaySales() {
    this.loadingToday.set(true);
    this.http.get<SaleResponse[]>(`${environment.apiUrl}/sales/today`).subscribe({
      next: (sales) => {
        this.todaySales.set(sales);
        this.salesPage.set(0);

        const totalPaid = sales
          .filter(s => this.getNormalizedStatus(s.saleStatus) === 'paid')
          .reduce((sum, s) => sum + (s.total || 0), 0);
        this.todaySalesTotal.set(totalPaid);

        const hourMap: Record<number, number> = {};
        sales
          .filter(s => this.getNormalizedStatus(s.saleStatus) === 'paid')
          .forEach(s => {
            const hour = new Date(s.dateSale).getHours();
            hourMap[hour] = (hourMap[hour] || 0) + (s.total || 0);
          });

        const byHour = Array.from({ length: 24 }, (_, h) => ({
          hour: `${h.toString().padStart(2, '0')}h`,
          total: hourMap[h] || 0
        })).filter((_, h) => h >= 6 && h <= 22); // mostra só horário comercial

        this.salesByHour.set(byHour);
        this.loadingToday.set(false);
      },
      error: (err) => {
        console.error('Erro ao carregar vendas do dia:', err);
        this.todaySalesTotal.set(0);
        this.loadingToday.set(false);
      },
    });
  }

  refreshTodaySales() {
    this.loadTodaySales();
  }

  salesPrevPage() {
    if (this.salesPage() > 0) this.salesPage.update(p => p - 1);
  }

  salesNextPage() {
    if (this.salesPage() < this.salesTotalPages() - 1)
      this.salesPage.update(p => p + 1);
  }

  salesGoToPage(page: number) {
    this.salesPage.set(page);
  }

  loadMonthSales() {
    this.http.get<number>(`${environment.apiUrl}/sales/month/total`).subscribe({
      next: (total) => this.monthSalesTotal.set(total),
      error: (err) => console.error('Erro ao carregar total do mês:', err),
    });
    this.http.get<number>(`${environment.apiUrl}/sales/month/count`).subscribe({
      next: (count) => this.monthSalesCount.set(count),
      error: (err) => console.error('Erro ao carregar contagem do mês:', err),
    });
  }

  refreshMonthSales() {
    this.loadMonthSales();
  }

  getNormalizedStatus(status: string | undefined): string {
    if (!status) return 'unknown';
    const statusMap: Record<string, string> = {
      paid: 'paid', pago: 'paid', pagamento: 'paid',
      completed: 'paid', concluído: 'paid', concluido: 'paid', finalizado: 'paid',
      pending: 'pending', pendente: 'pending', pendência: 'pending',
      pendencia: 'pending', aguardando: 'pending',
      cancelled: 'cancelled', canceled: 'cancelled',
      cancelado: 'cancelled', cancelada: 'cancelled',
    };
    return statusMap[status.toLowerCase().trim()] || 'unknown';
  }

  getStatusText(status: string | undefined): string {
    switch (this.getNormalizedStatus(status)) {
      case 'paid':      return 'Pago';
      case 'pending':   return 'Pendente';
      case 'cancelled': return 'Cancelado';
      default:          return status ?? 'N/A';
    }
  }

  getStatusIcon(status: string | undefined): string {
    switch (this.getNormalizedStatus(status)) {
      case 'paid':      return 'check_circle';
      case 'pending':   return 'schedule';
      case 'cancelled': return 'cancel';
      default:          return 'help';
    }
  }

  private getPageWindow(current: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);

  const pages: (number | null)[] = [];
  const delta = 2;

  pages.push(0);

  const left = Math.max(1, current - delta);
  const right = Math.min(total - 2, current + delta);

  if (left > 1) pages.push(null);
  for (let i = left; i <= right; i++) pages.push(i);
  if (right < total - 2) pages.push(null);
  pages.push(total - 1);
  return pages;
  }
}
