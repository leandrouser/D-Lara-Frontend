import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { debounceTime, distinctUntilChanged, Subject, switchMap, tap } from 'rxjs';
import { ProductService, ProductResponse, CategoryEnum, ProductRequest, Page, ProductBulkRequest } from '../../core/service/product.service';
import { ProductCreateDialogComponent } from '../../shared/models/product/product-modal';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

type ProductState = 'idle' | 'loading' | 'success' | 'error';

@Component({
  selector: 'app-product',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatIconModule,
    MatDialogModule,
  ],
  templateUrl: './product.html',
  styleUrls: ['./product.scss']
})
export class Product implements OnInit {
  showModal = signal(false);
  private api = inject(ProductService);
  private dialog = inject(MatDialog);

  isBulkEditing = signal(false);
  serverPage = signal<Page<ProductResponse> | null>(null);
  state = signal<ProductState>('idle');
  errorMessage = signal('');

  search = signal('');
  categoryFilter = signal<CategoryEnum | 'all'>('all');
  lowStockFilter = signal(false);

  editingProductId = signal<number | null>(null);
  editForm = signal({
    barcode: '',
    name: '',
    description: '',
    categoryEnum: CategoryEnum.CAMA,
    price: 0,
    stockQty: 0
  });

  currentPage = signal(1);
  itemsPerPage = signal(10);

  products = computed(() => this.serverPage()?.content ?? []);
  totalItems = computed(() => this.serverPage()?.totalElements ?? 0);
  totalPages = computed(() => this.serverPage()?.totalPages ?? 0);

  totalProducts = computed(() => this.totalItems());

  lowStockCount = computed(() => this.products().filter(p => this.isLowStock(p)).length);
  inStockCount  = computed(() => this.products().filter(p => !this.isLowStock(p) && p.stockQty > 0).length);

  camaCount    = computed(() => this.products().filter(p => p.categoryEnum === CategoryEnum.CAMA).length);
  mesaCount    = computed(() => this.products().filter(p => p.categoryEnum === CategoryEnum.MESA).length);
  banhoCount   = computed(() => this.products().filter(p => p.categoryEnum === CategoryEnum.BANHO).length);
  bordadoCount = computed(() => this.products().filter(p => p.categoryEnum === CategoryEnum.BORDADO).length);

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

  isLoading = computed(() => this.state() === 'loading');
  hasError  = computed(() => this.state() === 'error');

  private searchSubject = new Subject<string>();

  categoriesWithoutBordado = Object
    .values(CategoryEnum)
    .filter(cat => cat !== CategoryEnum.BORDADO);

  ngOnInit() {
    this.setupSearch();
    this.loadPage();
  }

  loadPage() {
    this.state.set('loading');

    const term     = this.search();
    const page     = this.currentPage() - 1;
    const size     = this.itemsPerPage();
    const category = this.lowStockFilter()
      ? ''
      : (this.categoryFilter() as string);

    this.api.searchPaged(term, page, size, category).subscribe({
      next: result => {
        this.serverPage.set(result);
        this.state.set('success');
      },
      error: err => {
        console.error('❌ Erro ao carregar produtos:', err);
        this.state.set('error');
        this.errorMessage.set('Erro ao carregar produtos');
      }
    });
  }

  private setupSearch() {
    this.searchSubject.pipe(
      debounceTime(500),
      distinctUntilChanged(),
      tap(() => {
        this.currentPage.set(1);
        this.state.set('loading');
      }),
      switchMap(() => {
        const term     = this.search();
        const page     = 0;
        const size     = this.itemsPerPage();
        const category = this.lowStockFilter() ? '' : (this.categoryFilter() as string);
        return this.api.searchPaged(term, page, size, category);
      })
    ).subscribe({
      next: result => {
        this.serverPage.set(result);
        this.state.set('success');
      },
      error: err => {
        this.state.set('error');
        this.errorMessage.set('Erro ao buscar produtos');
        console.error('Search error:', err);
      }
    });
  }

  applyCategoryFilter(category: CategoryEnum | 'all') {
    this.lowStockFilter.set(false);
    this.categoryFilter.set(category);
    this.currentPage.set(1);
    this.loadPage();
  }

  applyLowStockFilter() {
    this.lowStockFilter.set(true);
    this.categoryFilter.set('all');
    this.currentPage.set(1);
    this.loadPage();
  }

  filteredList = computed(() => {
    const isLowStockActive = this.lowStockFilter();
    if (!isLowStockActive) return this.products();
    return this.products().filter(p => this.isLowStock(p));
  });

  onSearchInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.search.set(value);
    this.searchSubject.next(value);
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
      this.loadPage();
    }
  }

  nextPage() {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update(p => p + 1);
      this.loadPage();
    }
  }

  previousPage() {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
      this.loadPage();
    }
  }

  changeItemsPerPage(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    this.itemsPerPage.set(Number(value));
    this.currentPage.set(1);
    this.loadPage();
  }

  getStartIndex(): number {
    if (this.totalItems() === 0) return 0;
    return (this.currentPage() - 1) * this.itemsPerPage() + 1;
  }

  getEndIndex(): number {
    return Math.min(this.currentPage() * this.itemsPerPage(), this.totalItems());
  }

  openModal() {
    const dialogRef = this.dialog.open(ProductCreateDialogComponent, {
      width: '550px',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe((result: ProductRequest | undefined) => {
      if (result) {
        this.createProduct(result);
      }
    });
  }

  createProduct(data: ProductRequest) {
    this.api.create(data).subscribe({
      next: newProduct => {
        alert(`Produto "${newProduct.name}" criado com sucesso!`);
        this.loadPage();   // recarrega a página atual para refletir o novo produto
      },
      error: err => {
        alert('Erro ao criar produto. Verifique o console.');
        console.error('Create error:', err);
      }
    });
  }

  handleProductCreated(data: ProductRequest) {
    this.api.create(data).subscribe({
      next: newProduct => {
        this.showModal.set(false);
        alert(`Produto "${newProduct.name}" criado com sucesso!`);
        this.loadPage();
      },
      error: err => {
        alert('Erro ao criar produto. Verifique o console.');
        console.error('Create error:', err);
      }
    });
  }

  startEditing(product: ProductResponse) {
    this.editingProductId.set(product.id);
    this.editForm.set({
      barcode: product.barcode || '',
      name: product.name,
      description: product.description || '',
      categoryEnum: product.categoryEnum,
      price: product.price,
      stockQty: product.stockQty
    });
   }

  cancelEditing() {
    this.editingProductId.set(null);
    this.editForm.set({
      barcode: '',
      name: '',
      description: '',
      categoryEnum: CategoryEnum.CAMA,
      price: 0,
      stockQty: 0
    });
  }

  saveEditing() {
    const productId = this.editingProductId();
    if (!productId) return;

    const formData = this.editForm();

    // Validações básicas
    if (!formData.name.trim()) {
      alert('O nome do produto é obrigatório');
      return;
    }
    if (formData.price < 0 || formData.stockQty < 0) {
      alert('Valores não podem ser negativos');
      return;
    }

    const currentProduct = this.products().find(p => p.id === productId);
    if (!currentProduct) return;

    const updateData: ProductRequest = {
      barcode: formData.barcode,
      name: formData.name,
      description: formData.description,
      categoryEnum: formData.categoryEnum,
      price: Number(formData.price),
      stockQty: Number(formData.stockQty)
    };

    this.api.update(productId, updateData).subscribe({
      next: () => {
        this.cancelEditing();
        alert('Produto atualizado com sucesso!');
        this.loadPage();
      },
      error: err => {
        alert('Erro ao atualizar produto');
        console.error('Update error:', err);
      }
    });
  }

  isLowStock(product: ProductResponse): boolean {
    return product.stockQty < 5;
  }

  getStockStatus(product: ProductResponse): string {
    if (product.stockQty === 0) return 'Esgotado';
    if (this.isLowStock(product)) return 'Estoque Baixo';
    return 'Em Estoque';
  }

  getCategoryLabel(category: CategoryEnum): string {
    const labels = {
      [CategoryEnum.CAMA]:    'Cama',
      [CategoryEnum.MESA]:    'Mesa',
      [CategoryEnum.BANHO]:   'Banho',
      [CategoryEnum.BORDADO]: 'Bordado',
    };
    return labels[category] || category;
  }

  getCategoryIcon(category: CategoryEnum): string {
    const icons = {
      [CategoryEnum.CAMA]:    'bed',
      [CategoryEnum.MESA]:    'table_restaurant',
      [CategoryEnum.BANHO]:   'bathtub',
      [CategoryEnum.BORDADO]: 'embroidery_needle',
    };
    return icons[category] || 'category';
  }

  toggleBulkEdit() {
  if (this.isBulkEditing()) {
    this.cancelEditing(); // Limpa estados se estiver cancelando
  }
  this.isBulkEditing.set(!this.isBulkEditing());
}

// 3. Método para salvar todos os produtos da página atual
saveAllChanges() {
  this.state.set('loading');

  // Mapeia os produtos da tela para o formato que o backend espera
  const updates: ProductBulkRequest[] = this.products().map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    price: p.price,
    stockQty: p.stockQty,
    barcode: p.barcode,
    categoryEnum: p.categoryEnum
  }));

  this.api.updateBulk(updates).subscribe({
    next: () => {
      alert('Todos os produtos foram atualizados!');
      this.isBulkEditing.set(false);
      this.loadPage();
    },
    error: (err) => {
      this.state.set('error');
      alert('Erro ao atualizar em massa.');
      console.error(err);
    }
  });
  }

  updateEditFormField(field: string, value: any) {
  this.editForm.update(prev => ({
    ...prev,
    [field]: value
  }));
}
}
