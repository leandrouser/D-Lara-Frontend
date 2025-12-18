import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { debounceTime, distinctUntilChanged, Subject, switchMap, tap } from 'rxjs';
import { PaymentService, PaymentMethodResponse } from '../../core/service/payment.service';
import { PaymentMethodDialog } from '../../shared/models/payment/payment-method-dialog/payment-method-dialog';

type PaymentState = 'idle' | 'loading' | 'success' | 'error';

@Component({
  selector: 'app-payment',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    MatDialogModule, 
    MatFormFieldModule, 
    MatInputModule, 
    MatButtonModule, 
    MatIconModule, 
    MatListModule
  ],
  templateUrl: './payment.html',
  styleUrls: ['./payment.scss']
})
export class Payment implements OnInit {
  private service = inject(PaymentService);
  private dialog = inject(MatDialog);

  // ---------------- STATE ----------------
  methods = signal<PaymentMethodResponse[]>([]);
  state = signal<PaymentState>('idle');
  errorMessage = signal('');

  search = signal('');
  activeFilter = signal<'all' | 'active' | 'inactive'>('all');

  // ✅ Estado para paginação NO FRONTEND
  currentPage = signal(1);
  itemsPerPage = signal(10);

  // ✅ Computed para dados paginados NO FRONTEND
  totalItems = computed(() => this.filteredList().length);
  totalPages = computed(() => Math.ceil(this.totalItems() / this.itemsPerPage()));
  
  paginatedMethods = computed(() => {
    const startIndex = (this.currentPage() - 1) * this.itemsPerPage();
    const endIndex = startIndex + this.itemsPerPage();
    return this.filteredList().slice(startIndex, endIndex);
  });

  // ✅ Computed para páginas visíveis
  visiblePages = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: number[] = [];

    if (total <= 5) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      if (current <= 3) {
        pages.push(1, 2, 3, 4, 5);
        if (total > 5) pages.push(-1);
      } else if (current >= total - 2) {
        pages.push(-1);
        pages.push(total - 4, total - 3, total - 2, total - 1, total);
      } else {
        pages.push(-1);
        pages.push(current - 1, current, current + 1);
        pages.push(-1);
      }
    }
    return pages;
  });

  // Subject para busca com debounce
  private searchSubject = new Subject<string>();

  // -------------- COMPUTEDS --------------
  isLoading = computed(() => this.state() === 'loading');
  hasError = computed(() => this.state() === 'error');

  // Métricas computadas
  totalMethods = computed(() => this.methods().length);
  activeCount = computed(() => this.methods().filter(m => m.active).length);
  inactiveCount = computed(() => this.totalMethods() - this.activeCount());
  allowsChangeCount = computed(() => this.methods().filter(m => m.allowsChange).length);

  // Lista filtrada
  filteredList = computed(() => {
    const term = this.search().toLowerCase().trim();
    const filter = this.activeFilter();

    return this.methods().filter(m => {
      const matchesSearch =
        m.displayName.toLowerCase().includes(term) ||
        m.code.toLowerCase().includes(term);

      const matchesFilter = 
        filter === 'all' || 
        (filter === 'active' && m.active) || 
        (filter === 'inactive' && !m.active);

      return matchesSearch && matchesFilter;
    });
  });

  ngOnInit() {
    console.log('🔄 Payment Component iniciado');
    this.setupSearch();
    this.loadMethods();
  }

  // ---------------- MODAL HANDLERS ----------------
  openModal(methodToEdit?: PaymentMethodResponse) {
    console.log('🔄 Abrindo modal via MatDialog');
    
    const dialogRef = this.dialog.open(PaymentMethodDialog, {
      width: '550px',
      disableClose: true,
      data: methodToEdit // Se passar o item, o modal entra em modo EDITAR
    });

    dialogRef.afterClosed().subscribe((result: any) => {
      if (result) {
        this.loadMethods();
      } else {
        console.log('Modal fechado sem salvar.');
      }
    });
  }

  // ---------------- SEARCH SETUP ----------------
  private setupSearch() {
    this.searchSubject.pipe(
      debounceTime(500),
      distinctUntilChanged(),
      tap(() => {
        this.state.set('loading');
        this.currentPage.set(1);
      }),
      switchMap(term => {
        return this.service.listAll();
      })
    ).subscribe({
      next: (methods) => {
        this.methods.set(methods);
        this.state.set('success');
        console.log('✅ Busca concluída. Métodos:', methods.length);
      },
      error: (err) => {
        this.state.set('error');
        this.errorMessage.set('Erro ao buscar métodos');
        console.error('Search error:', err);
      }
    });
  }

  // ---------------- LOAD DATA ----------------
  loadMethods() {
    console.log('🔄 loadMethods() chamado');
    this.state.set('loading');
    
    this.service.listAll().subscribe({
      next: (methods) => {
        console.log('✅ Dados carregados com sucesso:', methods);
        this.methods.set(methods);
        this.state.set('success');
        this.currentPage.set(1);
      },
      error: err => {
        console.error('❌ Erro ao carregar métodos:', err);
        this.state.set('error');
        this.errorMessage.set('Erro ao carregar métodos de pagamento');
      }
    });
  }

  // ---------------- PAGINATION CONTROLS ----------------
  goToPage(page: number) {
    console.log('🎯 Indo para página:', page);
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  nextPage() {
    console.log('➡️ Próxima página. Atual:', this.currentPage());
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update(page => page + 1);
    }
  }

  previousPage() {
    console.log('⬅️ Página anterior. Atual:', this.currentPage());
    if (this.currentPage() > 1) {
      this.currentPage.update(page => page - 1);
    }
  }

  changeItemsPerPage(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    console.log('📏 Mudando itens por página para:', value);
    this.itemsPerPage.set(Number(value));
    this.currentPage.set(1);
  }

  // ---------------- SEARCH HANDLERS ----------------
  onSearchInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    console.log('🔍 Buscando:', value);
    this.search.set(value);
    this.searchSubject.next(value);
  }

  // ---------------- FILTERS ----------------
  applyFilter(filter: 'all' | 'active' | 'inactive') {
    console.log('🏷️ Aplicando filtro:', filter);
    this.activeFilter.set(filter);
    this.currentPage.set(1); 
  }

  // ---------------- HELPERS ----------------
  getCardColor(code: string): string {
    const c = code.toUpperCase();
    if (c.includes('PIX')) return 'blue';
    if (c.includes('CASH') || c.includes('DINHEIRO')) return 'green';
    if (c.includes('CARD') || c.includes('CARTAO')) return 'purple';
    if (c.includes('DEBITO')) return 'orange';
    return 'indigo';
  }

  getMethodIcon(code: string): string {
    const c = code.toUpperCase();
    if (c.includes('PIX')) return 'qr_code_2';
    if (c.includes('CASH') || c.includes('DINHEIRO')) return 'payments';
    if (c.includes('CARD') || c.includes('CARTAO')) return 'credit_card';
    if (c.includes('DEBITO')) return 'account_balance';
    return 'payment';
  }

  getStatusLabel(active: boolean): string {
    return active ? 'Ativo' : 'Inativo';
  }

  getStatusColor(active: boolean): string {
    return active ? 'green' : 'red';
  }

  // ✅ Métodos auxiliares para template
  getStartIndex(): number {
    return (this.currentPage() - 1) * this.itemsPerPage() + 1;
  }

  getEndIndex(): number {
    return Math.min(this.currentPage() * this.itemsPerPage(), this.totalItems());
  }
}