// src/app/pages/product/product.ts
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

  // ---------------- STATE ----------------
  products = signal<ProductResponse[]>([]);
  state = signal<ProductState>('idle');
  errorMessage = signal('');

  search = signal('');
  categoryFilter = signal<CategoryEnum | 'all'>('all');

  // ✅ Estado para controle de edição
  editingProductId = signal<number | null>(null);
  editForm = signal({
    price: 0,
    stockQty: 0
  });

  // ✅ Estado para paginação NO FRONTEND
  currentPage = signal(1);
  itemsPerPage = signal(10);

  // ✅ Computed para dados paginados NO FRONTEND
  totalItems = computed(() => this.filteredList().length);
  totalPages = computed(() => Math.ceil(this.totalItems() / this.itemsPerPage()));
  
  paginatedProducts = computed(() => {
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
  totalProducts = computed(() => this.products().length);
  lowStockCount = computed(() => this.products().filter(p => this.isLowStock(p)).length);
  inStockCount = computed(() => this.totalProducts() - this.lowStockCount());

  // Métricas por categoria
  camaCount = computed(() => this.products().filter(p => p.categoryEnum === CategoryEnum.CAMA).length);
  mesaCount = computed(() => this.products().filter(p => p.categoryEnum === CategoryEnum.MESA).length);
  banhoCount = computed(() => this.products().filter(p => p.categoryEnum === CategoryEnum.BANHO).length);
  bordadoCount = computed(() => this.products().filter(p => p.categoryEnum === CategoryEnum.BORDADO).length);

  // Lista filtrada
  filteredList = computed(() => {
    const term = this.search().toLowerCase().trim();
    const filter = this.categoryFilter();

    return this.products().filter(p => {
      const matchesSearch =
        p.name.toLowerCase().includes(term) ||
        p.description?.toLowerCase().includes(term) ||
        p.barcode?.includes(term);

      const matchesCategory = filter === 'all' || p.categoryEnum === filter;

      return matchesSearch && matchesCategory;
    });
  });

  // Categorias disponíveis
  categories = Object.values(CategoryEnum);

  ngOnInit() {
    console.log('🔄 Product Component iniciado');
    this.setupSearch();
    this.loadProducts();
  }

  // ---------------- MODAL HANDLERS ----------------
  openModal() { // ✅ ATUALIZADO
    console.log('🔄 Abrindo modal de cadastro via MatDialog');
    
    // Abre o diálogo
    const dialogRef = this.dialog.open(ProductCreateDialogComponent, {
        width: '550px', // Define a largura padrão
        disableClose: true // Opcional: força o uso dos botões
    });

    // Se inscreve para receber o resultado quando o diálogo for fechado
    dialogRef.afterClosed().subscribe((result: ProductRequest | undefined) => {
        // 'result' só terá valor se o botão 'Salvar' (que chama dialogRef.close(data)) for pressionado.
        if (result) {
            this.createProduct(result);
        } else {
            console.log('Modal fechado sem salvar.');
        }
    });
  }

  closeModal() {
    // Não é mais necessário, MatDialog lida com o fechamento
  }

  // ---------------- SEARCH SETUP ----------------
  private setupSearch() {
    this.searchSubject.pipe(
      debounceTime(500),
      distinctUntilChanged(),
      tap(() => {
        this.state.set('loading');
        this.currentPage.set(1); // Reset para primeira página ao buscar
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

  // ---------------- LOAD DATA ----------------
  loadProducts() {
    console.log('🔄 loadProducts() chamado');
    this.state.set('loading');
    
    this.api.findAll().subscribe({
      next: (products) => {
        console.log('✅ Dados carregados com sucesso:', products);
        this.products.set(products);
        this.state.set('success');
        this.currentPage.set(1); // Sempre começa na página 1
      },
      error: err => {
        console.error('❌ Erro ao carregar produtos:', err);
        this.state.set('error');
        this.errorMessage.set('Erro ao carregar produtos');
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
    this.currentPage.set(1); // Reset para primeira página
  }

  // ---------------- SEARCH HANDLERS ----------------
  onSearchInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    console.log('🔍 Buscando:', value);
    this.search.set(value);
    this.searchSubject.next(value);
  }

  // ---------------- CREATE PRODUCT ----------------
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

  // ---------------- FILTERS ----------------
  applyCategoryFilter(category: CategoryEnum | 'all') {
    console.log('🏷️ Aplicando filtro:', category);
    this.categoryFilter.set(category);
    this.currentPage.set(1); 
  }

  // ---------------- EDIT PRODUCT (IN-LINE) ----------------
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
    
    // Validações
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

  // ---------------- STOCK HELPERS ----------------
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

  // ✅ Métodos auxiliares para template
  getStartIndex(): number {
    return (this.currentPage() - 1) * this.itemsPerPage() + 1;
  }

  getEndIndex(): number {
    return Math.min(this.currentPage() * this.itemsPerPage(), this.totalItems());
  }

  handleProductCreated(data: ProductRequest) { // ✅ NOVO MÉTODO
    this.api.create(data).subscribe({
      next: (newProduct) => {
        // Adiciona o novo produto à lista local de signals
        this.products.update(list => [...list, newProduct]);
        this.showModal.set(false); // Fecha o modal
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