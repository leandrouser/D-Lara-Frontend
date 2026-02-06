import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { HttpClient } from '@angular/common/http';

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
  saleStatus: string; // CORRIGIDO: era 'status'
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

  // ==============================
  // ESTOQUE BAIXO
  // ==============================
  lowStockCount = signal(0);
  loadingLowStock = signal(true);
  lowStockProducts = signal<Product[]>([]);

  // ==============================
  // VENDAS
  // ==============================
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

  // ==============================
  // CARREGA TODOS OS DADOS
  // ==============================
  loadDashboard() {
    this.loadLowStockProducts();
    this.loadTodayPayments();
    this.loadTodaySales();
    this.loadProductsStats();
  }

  loadProductsStats() {
    this.loadingProducts.set(true);
    this.http.get<ProductsStats>('http://localhost:8080/api/products/stats').subscribe({
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

  // ==============================
  // TRATAMENTO DE STATUS MELHORADO
  // ==============================
  getNormalizedStatus(status: string | undefined): string {
    if (!status) return 'unknown';
    
    const statusLower = status.toLowerCase().trim();
    
    // Mapeamento de possíveis valores de status
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

  // ==============================
  // ESTOQUE BAIXO
  // ==============================
  loadLowStockProducts() {
    this.loadingLowStock.set(true);
    this.http.get<Product[]>('http://localhost:8080/api/products/low-stock').subscribe({
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

  // ==============================
  // TOTAL DE PAGAMENTOS HOJE
  // ==============================
  loadTodayPayments() {
    this.http.get<number>('http://localhost:8080/api/payments/today/total').subscribe({
      next: (total) => this.todayPaymentsTotal.set(total),
      error: (err) => console.error('Erro ao carregar total de pagamentos de hoje:', err),
    });
  }

  refreshTodayPayments() {
    this.loadTodayPayments();
  }

  // ==============================
  // VENDAS DO DIA
  // ==============================
  loadTodaySales() {
  this.loadingToday.set(true);

  this.http.get<SaleResponse[]>('http://localhost:8080/api/sales/today').subscribe({
    next: (sales) => {
      console.log('Vendas carregadas:', sales);

      // Lista para a tabela
      this.todaySales.set(sales);

      // Soma apenas vendas PAGAS
      const totalPaidToday = sales
        .filter(sale => this.getNormalizedStatus(sale.saleStatus) === 'paid')
        .reduce((sum, sale) => sum + (sale.total || 0), 0);

      // Atualiza o card "Vendas Hoje"
      this.todaySalesTotal.set(totalPaidToday);

      this.loadingToday.set(false);
    },
    error: (err) => {
      console.error('Erro ao carregar vendas do dia:', err);

      // Segurança para não deixar valor antigo no card
      this.todaySalesTotal.set(0);

      this.loadingToday.set(false);
    },
  });
}


  loadMonthSales() {
    this.http.get<number>('http://localhost:8080/api/sales/month/total').subscribe({
      next: (total) => this.monthSalesTotal.set(total),
      error: (err) => console.error('Erro ao carregar total do mês:', err)
    });

    this.http.get<number>('http://localhost:8080/api/sales/month/count').subscribe({
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