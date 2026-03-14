import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { debounceTime, distinctUntilChanged, Observable, Subject, switchMap, tap } from 'rxjs';

import { MatIconModule } from '@angular/material/icon';

import { CustomerService, CustomerResponse, Page, CustomerStats } from '../../core/service/customer.service';
import { CustomerModal } from '../../shared/models/customer/customer-modal';
import { PhoneFormatPipe } from "../../shared/pipes/phone-pipe";

type CustomerState = 'idle' | 'loading' | 'success' | 'error';

@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    CustomerModal,
    MatIconModule,
    PhoneFormatPipe
],
  templateUrl: './customer.html',
  styleUrls: ['./customer.scss']
})
export class Customer implements OnInit {

  showModal = signal(false);
  private api = inject(CustomerService);

  selectedCustomer = signal<CustomerResponse | null>(null);

  customerStats = signal<CustomerStats>({ total: 0, active: 0, inactive: 0 });

  // ---------------- STATE ----------------
  customers = signal<CustomerResponse[]>([]);
  paged = signal<Page<CustomerResponse> | null>(null);

  state = signal<CustomerState>('idle');
  errorMessage = signal('');

  search = signal('');
  statusFilter = signal<'all' | 'active' | 'inactive'>('all');

  page = signal(0);
  readonly pageSize = 5;
  pageSizeOptions = [5, 10, 15, 20];

  private searchSubject = new Subject<string>();

  isLoading = computed(() => this.state() === 'loading');
  hasError = computed(() => this.state() === 'error');

  currentPageData = computed(() => {
    const pagedData = this.paged();
    if (pagedData && Array.isArray(pagedData.content)) {
      return pagedData.content;
    }
    const customersData = this.customers();
    return Array.isArray(customersData) ? customersData : [];
  });

  totalClientes = computed(() => this.customerStats().total);
  clientesAtivos = computed(() => this.customerStats().active);
  clientesInativos = computed(() => this.customerStats().inactive);

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
    this.loadCustomerStats();
  }

  private loadCustomerStats() {
    this.api.getCustomerStats().subscribe({
      next: (stats) => {
        this.customerStats.set(stats);
      },
      error: (err) => {
        console.error('Erro ao carregar estatísticas:', err);
        this.loadStatsFromExistingEndpoint();
      }
    });
  }

private loadStatsFromExistingEndpoint() {
  this.api.countActiveCustomers().subscribe({
    next: (activeCount) => {
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
  private calculateLocalStats() {
    const customers = this.customers();
    const stats = {
      total: customers.length,
      active: customers.filter(c => c.active).length,
      inactive: customers.filter(c => !c.active).length
    };
    this.customerStats.set(stats);
  }

 private setupSearch() {
    this.searchSubject.pipe(
      debounceTime(500),
      distinctUntilChanged(),
      switchMap(term => {
        this.state.set('loading');
        return this.getRequestObservable(term, this.statusFilter(), this.page(), this.pageSize);
      })
    ).subscribe({
      next: (result) => {
        this.paged.set(result);
        this.customers.set(result.content || []);
        this.state.set('success');
      }
    });
  }

 loadCustomers() {
  this.state.set('loading');
  
  const query = this.search() || '';
  const page = this.page();
  const size = this.pageSize;
  const status = this.statusFilter();

  let request$: Observable<Page<CustomerResponse>>;

  if (query.trim().length > 0) {
    request$ = this.api.searchPaged(query, page, size);
  } 
  else {
    if (status === 'active') {
      request$ = this.api.getActiveCustomers(page, size);
    } else if (status === 'inactive') {
      request$ = this.api.getInactiveCustomers(page, size);
    } else {
      request$ = this.api.searchPaged('', page, size);
    }
  }

  request$.subscribe({
    next: (response) => {
      this.paged.set(response);
      this.customers.set(response.content || []);
      this.state.set('success');
    },
    error: (err) => {
      this.state.set('error');
      console.error(err);
    }
  });
}

  onSearchInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.search.set(value);
    this.page.set(0);
    this.searchSubject.next(value);
  }

  createCustomer(data: any) {
    this.api.create(data).subscribe({
      next: (newCustomer) => {
        this.loadCustomers();
        this.loadCustomerStats();
        this.showModal.set(false);
        alert("Cliente criado com sucesso!");
      },
      error: (err) => {
        alert("Erro ao criar cliente");
        console.error('Create error:', err);
      }
    });
  }

  applyFilter(filter: 'all' | 'active' | 'inactive') {
    this.statusFilter.set(filter);
    this.page.set(0);
    this.loadCustomers();
  }

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
        this.loadCustomerStats();
      },
      error: (err) => {
        alert("Erro ao alterar status do cliente");
        console.error('Toggle status error:', err);
      }
    });
  }

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
    return pagedData && typeof pagedData.totalPages === 'number' ? 
    pagedData.totalPages : 0;
  }

  getTotalElements(): number {
    const pagedData = this.paged();
    return pagedData && typeof pagedData.totalElements === 'number' ? 
    pagedData.totalElements : this.customers().length;
  }

  isCurrentPage(pageNum: number): boolean {
    return this.page() === pageNum;
  }

  openEditModal(customer: CustomerResponse) {
  this.selectedCustomer.set(customer);
  this.showModal.set(true);
}

openCreateModal() {
  this.selectedCustomer.set(null);
  this.showModal.set(true);
}

saveCustomer(formData: any) {
  const customerToEdit = this.selectedCustomer();

  if (customerToEdit) {
    this.api.update(customerToEdit.id, formData).subscribe({
      next: () => {
        alert("Cliente atualizado com sucesso!");
        this.closeModal();
        this.loadCustomers();
      },
      error: (err) => alert("Erro ao atualizar")
    });
  } else {
    this.createCustomer(formData);
  }
}

closeModal() {
  this.showModal.set(false);
  this.selectedCustomer.set(null);
}

handleSave(formData: any) {
  const customerToEdit = this.selectedCustomer();

  if (customerToEdit && customerToEdit.id) {
    this.api.update(customerToEdit.id, formData).subscribe({
      next: () => {
        alert('Cliente atualizado com sucesso!');
        this.closeModal();
        this.loadCustomers();
        this.loadCustomerStats();
      },
      error: (err) => {
        console.error('Erro ao editar:', err);
        alert('Erro ao atualizar cliente.');
      }
    });
  } else {
    this.api.create(formData).subscribe({
      next: () => {
        alert('Cliente cadastrado com sucesso!');
        this.closeModal();
        this.loadCustomers();
        this.loadCustomerStats();
      },
      error: (err) => {
        console.error('Erro ao criar:', err);
        alert('Erro ao cadastrar cliente.');
      }
    });
  }

}

private getRequestObservable(query: string, status: string, page: number, size: number): 
Observable<Page<CustomerResponse>> {
    if (query.trim().length > 0) {
      return this.api.searchPaged(query, page, size);
    } else {
      if (status === 'active') return this.api.getActiveCustomers(page, size);
      if (status === 'inactive') return this.api.getInactiveCustomers(page, size);
      return this.api.searchPaged('', page, size);
    }
  }
}