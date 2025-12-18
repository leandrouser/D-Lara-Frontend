import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { debounceTime, distinctUntilChanged, Subject, switchMap, tap } from 'rxjs';

import { MatIconModule } from '@angular/material/icon';

import { CustomerService, CustomerResponse, Page, CustomerStats } from '../../core/service/customer.service';
import { CustomerModal } from '../../shared/models/customer/customer-modal';

type CustomerState = 'idle' | 'loading' | 'success' | 'error';

@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    RouterModule, 
    CustomerModal,
    MatIconModule
  ],
  templateUrl: './customer.html',
  styleUrls: ['./customer.scss']
})
export class Customer implements OnInit {

  showModal = signal(false);
  private api = inject(CustomerService);

  customerStats = signal<CustomerStats>({ total: 0, active: 0, inactive: 0 });

  // ---------------- STATE ----------------
  customers = signal<CustomerResponse[]>([]);
  paged = signal<Page<CustomerResponse> | null>(null);

  state = signal<CustomerState>('idle');
  errorMessage = signal('');

  search = signal('');
  statusFilter = signal<'all' | 'active' | 'inactive'>('all');

  page = signal(0);
  readonly pageSize = 6;
  pageSizeOptions = [6, 12, 24, 48];

  // Subject para busca com debounce
  private searchSubject = new Subject<string>();

  // -------------- COMPUTEDS --------------
  isLoading = computed(() => this.state() === 'loading');
  hasError = computed(() => this.state() === 'error');

  // ✅ CORREÇÃO: Garantir que sempre retorna array
  currentPageData = computed(() => {
    const pagedData = this.paged();
    if (pagedData && Array.isArray(pagedData.content)) {
      return pagedData.content;
    }
    const customersData = this.customers();
    return Array.isArray(customersData) ? customersData : [];
  });

  // ✅ CORREÇÃO: Métricas vindas do backend
  totalClientes = computed(() => this.customerStats().total);
  clientesAtivos = computed(() => this.customerStats().active);
  clientesInativos = computed(() => this.customerStats().inactive);

  // ✅ PAGINATION COMPUTEDS - CORRIGIDAS
  showPagination = computed(() => {
    const totalPages = this.getTotalPages();
    return totalPages > 1;
  });

  currentPageDisplay = computed(() => {
    return this.page() + 1;
  });

  totalPages = computed(() => {
    return this.getTotalPages();
  });

  totalElements = computed(() => {
    return this.getTotalElements();
  });

  pageNumbers = computed(() => {
    return this.getPageNumbers();
  });

  hasPrevPage = computed(() => {
    return this.page() > 0;
  });

  hasNextPage = computed(() => {
    return this.canGoNext();
  });

  ngOnInit() {
    this.setupSearch();
    this.loadCustomers();
    this.loadCustomerStats(); // ✅ CORRIGIDO: chamar o método, não a signal
  }

  // ---------------- CARREGAR ESTATÍSTICAS ----------------
  private loadCustomerStats() {
    this.api.getCustomerStats().subscribe({
      next: (stats) => {
        this.customerStats.set(stats);
      },
      error: (err) => {
        console.error('Erro ao carregar estatísticas:', err);
        // Fallback: usar o endpoint existente
        this.loadStatsFromExistingEndpoint();
      }
    });
  }

  // No método loadStatsFromExistingEndpoint, atualize para:
private loadStatsFromExistingEndpoint() {
  // Carregar clientes ativos
  this.api.countActiveCustomers().subscribe({
    next: (activeCount) => {
      // Carregar clientes inativos
      this.api.countInactiveCustomers().subscribe({
        next: (inactiveCount) => {
          this.customerStats.set({
            total: activeCount + inactiveCount,
            active: activeCount,
            inactive: inactiveCount
          });
        },
        error: (err) => {
          console.error('Erro ao carregar inativos:', err);
          this.calculateLocalStats();
        }
      });
    },
    error: (err) => {
      console.error('Erro ao carregar ativos:', err);
      this.calculateLocalStats();
    }
  });
}

  // Fallback final: calcular localmente
  private calculateLocalStats() {
    const customers = this.customers();
    const stats = {
      total: customers.length,
      active: customers.filter(c => c.active).length,
      inactive: customers.filter(c => !c.active).length
    };
    this.customerStats.set(stats);
  }

  // ---------------- SEARCH SETUP ----------------
  private setupSearch() {
    this.searchSubject.pipe(
      debounceTime(500),
      distinctUntilChanged(),
      tap(() => this.state.set('loading')),
      switchMap(term => {
        if (term.trim().length >= 1) {
          return this.api.searchPaged(term, this.page(), this.pageSize);
        } else {
          return this.api.searchPaged('', this.page(), this.pageSize);
        }
      })
    ).subscribe({
      next: (result) => {
        this.paged.set(result);
        this.customers.set(Array.isArray(result.content) ? result.content : []);
        this.state.set('success');
      },
      error: (err) => {
        this.state.set('error');
        this.errorMessage.set('Erro ao buscar clientes');
        console.error('Search error:', err);
      }
    });
  }

  // ---------------- LOAD DATA ----------------
  loadCustomers() {
    this.state.set('loading');
    this.api.searchPaged('', this.page(), this.pageSize).subscribe({
      next: (pagedResult) => {
        this.paged.set(pagedResult);
        this.customers.set(Array.isArray(pagedResult.content) ? pagedResult.content : []);
        this.state.set('success');
        
        // Se não conseguiu carregar stats do backend, calcular localmente
        if (this.customerStats().total === 0) {
          this.calculateLocalStats();
        }
      },
      error: err => {
        this.state.set('error');
        this.errorMessage.set('Erro ao carregar clientes');
      }
    });
  }

  // ---------------- SEARCH HANDLERS ----------------
  onSearchInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.search.set(value);
    this.page.set(0);
    this.searchSubject.next(value);
  }

  // ---------------- CREATE CUSTOMER ----------------
  createCustomer(data: any) {
    this.api.create(data).subscribe({
      next: (newCustomer) => {
        this.loadCustomers();
        this.loadCustomerStats(); // ✅ Recarregar estatísticas
        this.showModal.set(false);
        alert("Cliente criado com sucesso!");
      },
      error: (err) => {
        alert("Erro ao criar cliente");
        console.error('Create error:', err);
      }
    });
  }

  // ---------------- FILTERS ----------------
  applyFilter(filter: 'all' | 'active' | 'inactive') {
    this.statusFilter.set(filter);
    this.page.set(0);
    
    if (this.search().trim().length >= 1) {
      this.searchSubject.next(this.search());
    } else {
      this.loadCustomers();
    }
  }

  // ---------------- STATUS ----------------
  toggleStatus(customer: CustomerResponse) {
    if (!customer?.id) {
      console.error('ID do cliente não encontrado');
      return;
    }

    this.api.toggleStatus(customer.id).subscribe({
      next: updated => {
        if (this.search().trim().length >= 1) {
          this.searchSubject.next(this.search());
        } else {
          this.loadCustomers();
        }
        this.loadCustomerStats(); // ✅ Recarregar estatísticas
      },
      error: (err) => {
        alert("Erro ao alterar status do cliente");
        console.error('Toggle status error:', err);
      }
    });
  }

  // ---------------- PAGINATION ----------------
  nextPage() {
    const pagedData = this.paged();
    if (pagedData && !pagedData.last) {
      this.page.update(p => p + 1);
      this.loadPage();
    }
  }

  prevPage() {
    if (this.page() > 0) {
      this.page.update(p => p - 1);
      this.loadPage();
    }
  }

  goToPage(pageNumber: number) {
    this.page.set(pageNumber);
    this.loadPage();
  }

  private loadPage() {
    if (this.search().trim().length >= 1) {
      this.searchSubject.next(this.search());
    } else {
      this.loadCustomers();
    }
  }

  // ---------------- PAGINATION HELPERS ----------------
  getPageNumbers(): number[] {
    const pagedData = this.paged();
    if (!pagedData || typeof pagedData.totalPages !== 'number') {
      return [];
    }
    
    const totalPages = pagedData.totalPages;
    const currentPage = this.page();
    const pages: number[] = [];
    
    const startPage = Math.max(0, currentPage - 2);
    const endPage = Math.min(totalPages - 1, currentPage + 2);
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return pages;
  }

  canGoNext(): boolean {
    const pagedData = this.paged();
    return pagedData ? !pagedData.last : false;
  }

  getTotalPages(): number {
    const pagedData = this.paged();
    return pagedData && typeof pagedData.totalPages === 'number' ? pagedData.totalPages : 0;
  }

  getTotalElements(): number {
    const pagedData = this.paged();
    return pagedData && typeof pagedData.totalElements === 'number' ? pagedData.totalElements : this.customers().length;
  }

  isCurrentPage(pageNum: number): boolean {
    return this.page() === pageNum;
  }
}