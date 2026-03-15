import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environments';

interface Product {
  id: number;
  name: string;
  stockQty: number;
  minStock: number;
  price: number;
}

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

  lowStockCount = signal(0);
  loadingLowStock = signal(true);
  lowStockProducts = signal<Product[]>([]);

  todayPaymentsTotal = signal(0);
  todaySales = signal<SaleResponse[]>([]);
  loadingToday = signal(true);
  monthSalesTotal = signal(0);
  monthSalesCount = signal(0);
  todaySalesTotal = signal(0);

  totalProducts = signal(0);
  totalProductsValue = signal(0);
  loadingProducts = signal(true);

  ngOnInit() {
    this.loadDashboard();
    this.loadMonthSales();
    this.loadProductsStats();
  }

  loadDashboard() {
    this.loadLowStockProducts();
    this.loadTodayPayments();
    this.loadTodaySales();
    this.loadProductsStats();
  }

  loadProductsStats() {
    this.loadingProducts.set(true);
    this.http.get<ProductsStats>(`${environment.apiUrl}/products/stats`).subscribe({
      next: (stats) => {
        console.log('Estatísticas carregadas:', stats);
        this.totalProducts.set(stats.totalProducts || 0);
        this.totalProductsValue.set(stats.totalValue || 0);
        this.loadingProducts.set(false);
      },
      error: (err) => {
        console.error('Erro ao carregar estatísticas de produtos:', err);
        this.totalProducts.set(0);
        this.totalProductsValue.set(0);
        this.loadingProducts.set(false);
      },
    });
  }

  refreshProductsStats() {
    this.loadProductsStats();
  }
  getNormalizedStatus(status: string | undefined): string {
    if (!status) return 'unknown';
    
    const statusLower = status.toLowerCase().trim();
    
    const statusMap: { [key: string]: string } = {
      'paid': 'paid',
      'pago': 'paid',
      'pagamento': 'paid',
      'completed': 'paid',
      'concluído': 'paid',
      'concluido': 'paid',
      'finalizado': 'paid',
      
      'pending': 'pending',
      'pendente': 'pending',
      'pendência': 'pending',
      'pendencia': 'pending',
      'aguardando': 'pending',
      
      'cancelled': 'cancelled',
      'canceled': 'cancelled',
      'cancelado': 'cancelled',
      'cancelada': 'cancelled'
    };
    
    return statusMap[statusLower] || 'unknown';
  }

  getStatusText(status: string | undefined): string {
    if (!status) return 'N/A';
    
    const normalized = this.getNormalizedStatus(status);
    
    switch (normalized) {
      case 'paid': return 'Pago';
      case 'pending': return 'Pendente';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  }

  getStatusIcon(status: string | undefined): string {
    if (!status) return 'help';
    
    const normalizedStatus = this.getNormalizedStatus(status);
    
    switch (normalizedStatus) {
      case 'paid':
        return 'check_circle';
      case 'pending':
        return 'schedule';
      case 'cancelled':
        return 'cancel';
      default:
        return 'help';
    }
  }

  loadLowStockProducts() {
    this.loadingLowStock.set(true);
    this.http.get<Product[]>(`${environment.apiUrl}/products/low-stock`).subscribe({
      next: (products) => {
        this.lowStockProducts.set(products);
        this.lowStockCount.set(products.length);
        this.loadingLowStock.set(false);
      },
      error: (err) => {
        console.error('Erro ao carregar estoque baixo:', err);
        this.loadMockLowStockData();
        this.loadingLowStock.set(false);
      },
    });
  }

  private loadMockLowStockData() {
    const mockProducts: Product[] = [
      { id: 1, name: 'Notebook Dell', stockQty: 2, minStock: 5, price: 2500.0 },
      { id: 2, name: 'Mouse Gamer', stockQty: 3, minStock: 10, price: 150.0 },
      { id: 3, name: 'Teclado Mecânico', stockQty: 1, minStock: 8, price: 300.0 },
      { id: 4, name: 'Monitor 24"', stockQty: 4, minStock: 6, price: 800.0 },
    ];
    this.lowStockProducts.set(mockProducts);
    this.lowStockCount.set(mockProducts.length);
  }

  refreshLowStock() {
    this.loadLowStockProducts();
  }

    loadTodayPayments() {
    this.http.get<number>(`${environment.apiUrl}/payments/today/total`).subscribe({
      next: (total) => this.todayPaymentsTotal.set(total),
      error: (err) => console.error('Erro ao carregar total de pagamentos de hoje:', err),
    });
  }

  refreshTodayPayments() {
    this.loadTodayPayments();
  }

   loadTodaySales() {
  this.loadingToday.set(true);

  this.http.get<SaleResponse[]>(`${environment.apiUrl}/sales/today`).subscribe({
    next: (sales) => {
      console.log('Vendas carregadas:', sales);

      this.todaySales.set(sales);

      const totalPaidToday = sales
        .filter(sale => this.getNormalizedStatus(sale.saleStatus) === 'paid')
        .reduce((sum, sale) => sum + (sale.total || 0), 0);

      this.todaySalesTotal.set(totalPaidToday);

      this.loadingToday.set(false);
    },
    error: (err) => {
      console.error('Erro ao carregar vendas do dia:', err);

      this.todaySalesTotal.set(0);

      this.loadingToday.set(false);
    },
  });
}


  loadMonthSales() {
    this.http.get<number>(`${environment.apiUrl}/sales/month/total`).subscribe({
      next: (total) => this.monthSalesTotal.set(total),
      error: (err) => console.error('Erro ao carregar total do mês:', err)
    });

    this.http.get<number>(`${environment.apiUrl}/sales/month/count`).subscribe({
      next: (count) => this.monthSalesCount.set(count),
      error: (err) => console.error('Erro ao carregar quantidade do mês:', err)
    });
  }

  refreshMonthSales() {
    this.loadMonthSales();
  }

  refreshTodaySales() {
  this.loadTodaySales();
}
}