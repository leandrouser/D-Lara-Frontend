import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { debounceTime, distinctUntilChanged,
  Subject, switchMap, tap } from 'rxjs';
import { ProductService, ProductResponse, CategoryEnum, ProductRequest } from '../../core/service/product.service';
import { ProductCreateDialogComponent } from '../../shared/models/product/product-modal';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';


type ProductState = 'idle' | 'loading' | 'success' | 'error';

@Component({
  selector: 'app-product',
  standalone: true,
  imports: [CommonModule,
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

  products = signal<ProductResponse[]>([]);
  state = signal<ProductState>('idle');
  errorMessage = signal('');

  search = signal('');
  categoryFilter = signal<CategoryEnum | 'all'>('all');
  lowStockFilter = signal(false);

  editingProductId = signal<number | null>(null);
  editForm = signal({
    price: 0,
    stockQty: 0
  });

  currentPage = signal(1);
  itemsPerPage = signal(10);

  totalItems = computed(() => this.filteredList().length);
  totalPages = computed(() => Math.ceil(this.totalItems() / this.itemsPerPage()));

  paginatedProducts = computed(() => {
    const startIndex = (this.currentPage() - 1) * this.itemsPerPage();
    const endIndex = startIndex + this.itemsPerPage();
    return this.filteredList().slice(startIndex, endIndex);
  });

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

  private searchSubject = new Subject<string>();

  isLoading = computed(() => this.state() === 'loading');
  hasError = computed(() => this.state() === 'error');

  totalProducts = computed(() => this.products().length);
  lowStockCount = computed(() => this.products().filter(p => this.isLowStock(p)).length);
  inStockCount = computed(() => this.totalProducts() - this.lowStockCount());

  camaCount = computed(() => this.products().filter(p => p.categoryEnum === CategoryEnum.CAMA).length);
  mesaCount = computed(() => this.products().filter(p => p.categoryEnum === CategoryEnum.MESA).length);
  banhoCount = computed(() => this.products().filter(p => p.categoryEnum === CategoryEnum.BANHO).length);
  bordadoCount = computed(() => this.products().filter(p => p.categoryEnum === CategoryEnum.BORDADO).length);

filteredList = computed(() => {
  const term = this.search().toLowerCase().trim();
  const filter = this.categoryFilter();
  const isLowStockActive = this.lowStockFilter();

  return this.products().filter(p => {

    const matchesSearch =
      p.name.toLowerCase().includes(term) ||
      p.description?.toLowerCase().includes(term) ||
      p.barcode?.includes(term);

    const matchesCategory =
      filter === 'all' || p.categoryEnum === filter;

    const matchesLowStock =
      !isLowStockActive || this.isLowStock(p);

    return matchesSearch && matchesCategory && matchesLowStock;
  });
});

applyLowStockFilter() {
  this.lowStockFilter.set(true);
  this.categoryFilter.set('all');
  this.currentPage.set(1);
}

categoriesWithoutBordado = Object
  .values(CategoryEnum)
  .filter(cat => cat !== CategoryEnum.BORDADO);

  ngOnInit() {
    console.log('🔄 Product Component iniciado');
    this.setupSearch();
    this.loadProducts();
  }

  openModal() {
  console.log('🔄 Abrindo modal de cadastro via MatDialog');
    const dialogRef = this.dialog.open(ProductCreateDialogComponent, {
        width: '550px',
        disableClose: true
    });

    dialogRef.afterClosed().subscribe((result: ProductRequest | undefined) => {
        if (result) {
            this.createProduct(result);
        } else {
            console.log('Modal fechado sem salvar.');
        }
    });
  }

  private setupSearch() {
    this.searchSubject.pipe(
      debounceTime(500),
      distinctUntilChanged(),
      tap(() => {
        this.state.set('loading');
        this.currentPage.set(1);
      }),
      switchMap(term => {
        return this.api.findAll();
      })
    ).subscribe({
      next: (products) => {
        this.products.set(products);
        this.state.set('success');
        console.log('✅ Busca concluída. Produtos:', products.length);
      },
      error: (err) => {
        this.state.set('error');
        this.errorMessage.set('Erro ao buscar produtos');
        console.error('Search error:', err);
      }
    });
  }

  loadProducts() {
    console.log('🔄 loadProducts() chamado');
    this.state.set('loading');

    this.api.findAll().subscribe({
      next: (products) => {
        console.log('✅ Dados carregados com sucesso:', products);
        this.products.set(products);
        this.state.set('success');
        this.currentPage.set(1);
      },
      error: err => {
        console.error('❌ Erro ao carregar produtos:', err);
        this.state.set('error');
        this.errorMessage.set('Erro ao carregar produtos');
      }
    });
  }

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

  onSearchInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    console.log('🔍 Buscando:', value);
    this.search.set(value);
    this.searchSubject.next(value);
  }

  createProduct(data: ProductRequest) {
    this.api.create(data).subscribe({
      next: (newProduct) => {
        this.products.update(list => [...list, newProduct]);
        alert(`Produto "${newProduct.name}" criado com sucesso!`);
      },
      error: (err) => {
        alert("Erro ao criar produto. Verifique o console.");
        console.error('Create error:', err);
      }
    });
  }

applyCategoryFilter(category: CategoryEnum | 'all') {
  this.lowStockFilter.set(false);
  this.categoryFilter.set(category);
  this.currentPage.set(1);
}

  startEditing(product: ProductResponse) {
    this.editingProductId.set(product.id);
    this.editForm.set({
      price: product.price,
      stockQty: product.stockQty
    });
  }

  cancelEditing() {
    this.editingProductId.set(null);
    this.editForm.set({
      price: 0,
      stockQty: 0
    });
  }

  saveEditing() {
    const productId = this.editingProductId();
    if (!productId) return;

    const formData = this.editForm();

    if (formData.price < 0) {
      alert('Por favor, informe um preço válido');
      return;
    }
    if (formData.stockQty < 0) {
      alert('Por favor, informe uma quantidade válida');
      return;
    }

    const currentProduct = this.products().find(p => p.id === productId);
    if (!currentProduct) return;

    const updateData = {
      barcode: currentProduct.barcode,
      name: currentProduct.name,
      description: currentProduct.description,
      categoryEnum: currentProduct.categoryEnum,
      price: formData.price,
      stockQty: formData.stockQty
    };

    this.api.update(productId, updateData).subscribe({
      next: (updatedProduct) => {
        this.products.update(list =>
          list.map(p => p.id === productId ? updatedProduct : p)
        );
        this.cancelEditing();
        alert("Produto atualizado com sucesso!");
      },
      error: (err) => {
        alert("Erro ao atualizar produto");
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
      [CategoryEnum.CAMA]: 'Cama',
      [CategoryEnum.MESA]: 'Mesa',
      [CategoryEnum.BANHO]: 'Banho',
      [CategoryEnum.BORDADO]: 'Bordado',
    };
    return labels[category] || category;
  }

  getCategoryIcon(category: CategoryEnum): string {
    const icons = {
      [CategoryEnum.CAMA]: 'bed',
      [CategoryEnum.MESA]: 'table_restaurant',
      [CategoryEnum.BANHO]: 'bathtub',
      [CategoryEnum.BORDADO]: 'embroidery_needle',
    };
    return icons[category] || 'category';
  }

  getStartIndex(): number {
    return (this.currentPage() - 1) * this.itemsPerPage() + 1;
  }

  getEndIndex(): number {
    return Math.min(this.currentPage() * this.itemsPerPage(), this.totalItems());
  }

  handleProductCreated(data: ProductRequest) {
    this.api.create(data).subscribe({
      next: (newProduct) => {
        this.products.update(list => [...list, newProduct]);
        this.showModal.set(false);
        alert(`Produto "${newProduct.name}" criado com sucesso!`);
        console.log('✅ Novo produto criado:', newProduct);
      },
      error: (err) => {
        alert("Erro ao criar produto. Verifique o console.");
        console.error('Create error:', err);
      }
    });
  }
}
