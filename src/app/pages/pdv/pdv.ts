import { Component, signal, OnInit, inject, computed, WritableSignal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError, tap } from 'rxjs/operators';
import { CustomerModal } from "../../shared/models/customer/customer-modal";
import { CustomerResponse } from '../../core/service/customer.service';
import { PdvService, ProductResponse, Sale } from '../../core/service/pdv.service';
import { PaymentData, PaymentModal } from '../../shared/models/payment/payment-modal/payment-modal';
import { AuthService } from '../../core/service/auth.service';
import { CashModalComponent } from '../../shared/models/cash/cash-movement.model';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { PaymentResponse } from '../../core/service/payment.service';

interface CartItem {
  id: number;
  productId: number;
  productName: string;
  productPrice: number;
  barcode?: string;
  quantity: number;
  total: number;
}

@Component({
  selector: 'app-pvd',
  standalone: true,
  imports: [CommonModule, MatIconModule, PaymentModal, CustomerModal, CashModalComponent],
  templateUrl: './pdv.html',
  styleUrls: ['./pdv.scss']
})
export class Pdv implements OnInit {

  private http = inject(HttpClient);
  private customerService = inject(PdvService);
  private pvdService = inject(PdvService);
  private authService = inject(AuthService);
  
  // Subjects para busca
  private customerSearch$ = new Subject<string>();
  private productSearch$ = new Subject<string>();

  // Signals para Clientes
  customerSearchTerm = signal('');
  customerSearchResults = signal<CustomerResponse[]>([]);
  showCustomerResults = signal<boolean>(false);
  isSearchingCustomer = signal<boolean>(false);
  selectedCustomer = signal<CustomerResponse | null>(null);
  isCustomerModalOpen = signal(false);

  // Signal computado ou direto para pegar o nome
userName = computed(() => this.authService.currentUser()?.name || 'Vendedor');

  // BUSCA DE VENDAS
  saleSearchTerm = signal('');
  saleSearchResults = signal<Sale[]>([]);
  saleSearching = signal(false);
  saleSearch$ = new Subject<string>();
  currentSaleId = signal<number | null>(null);

  // CONTROLE DO CAIXA
  isCashModalOpen = signal(false);
  isCashRegisterOpen = signal(false);


  // ✅ NOVOS SIGNALS PARA PRODUTOS
  productSearchTerm = signal('');
  productSearchResults = signal<ProductResponse[]>([]);
  isSearchingProduct = signal<boolean>(false);
  hasSearchedProducts = signal<boolean>(false);
  showProductResults = signal<boolean>(true);
  topSellingProducts = signal<ProductResponse[]>([]);
  cartItems = signal<CartItem[]>([]);
  discount = signal<number>(0);
  subtotal = computed(() => {
    return this.cartItems().reduce((sum, item) => sum + item.total, 0);
  });

  total = computed(() => {
    const subtotalValue = this.subtotal();
    const discountValue = this.discount();
    return Math.max(0, subtotalValue - discountValue);
  });

   // ====================== NOVOS SIGNALS PARA PAGAMENTO ======================
  isPaymentModalOpen = signal(false);
  paymentData = signal<any>(null);
  currentSale = signal({ saleCode: 10, total: 150.00, productsInSale: [], discountTotal: 0 });
  // ====================== MÉTODOS PARA O MODAL DE PAGAMENTO ======================

   // ✅ COMPUTED VALUES para totais do carrinho
  cartItemCount = computed(() => 
    this.cartItems().reduce((total, item) => total + item.quantity, 0)
  );

   // ✅ NOVO SIGNAL para estado de carregamento
  isProcessingSale = signal(false);
  salesResults: WritableSignal<Sale[]> = signal([]);
  isSearchingSales = signal(false);
  showSalesResults = signal(false);
  selectedSale: WritableSignal<Sale | null> = signal(null);

  constructor() {
    this.setupCustomerSearch();
    this.setupProductSearch(); 
    this.saleSearch$

  .pipe(
  debounceTime(300),
  distinctUntilChanged((a, b) => a.trim() === b.trim()),
  tap(() => this.saleSearching.set(true)),
  switchMap(term =>
    this.pvdService.searchSales(term).pipe(
      catchError(() => of([]))
    )
  )
)
.subscribe(results => {

  let sales: Sale[] = [];

  if (Array.isArray(results)) {
    // Caso o backend retorne lista simples
    sales = results;
  } else if (results && 'content' in results) {
    // Caso retorne PageResponse
    sales = results.content ?? [];
  }

  this.saleSearchResults.set(sales);
  this.saleSearching.set(false);
});
  }

  ngOnInit() {
    this.loadInitialProducts();
    this.loadTopSellingProducts();
    this.setupSalesSearch();
    this.setupProductSearch(); 
    this.checkCashStatus();
  }

  // ✅ NOVO: Configurar busca de produtos
 setupProductSearch() {
  this.productSearch$
    .pipe(
      debounceTime(300),
      distinctUntilChanged(),
      tap(() => this.isSearchingProduct.set(true)),
      switchMap(term =>
        this.pvdService.searchProducts(term).pipe(
          catchError(() => of({ content: [] }))
        )
      )
    )
    .subscribe(result => {
      this.productSearchResults.set(result.content ?? []);
      this.isSearchingProduct.set(false);
      this.hasSearchedProducts.set(true);
    });
}

checkCashStatus() {
    this.pvdService.getCashRegisterStatus().subscribe({
      next: (status) => {
        this.isCashRegisterOpen.set(status.isOpen);
        if (!status.isOpen) {
          // Opcional: Abrir modal automaticamente ao entrar na tela se estiver fechado
          // this.isCashModalOpen.set(true); 
        }
      },
      error: () => console.log('Não foi possível verificar status do caixa (Endpoint pode não existir ainda)')
    });
  }

  // ✅ NOVO: Lógica para abrir o modal
  openCashModal() {
    this.isCashModalOpen.set(true);
  }

  closeCashModal() {
    this.isCashModalOpen.set(false);
  }

  // ✅ NOVO: Salvar abertura do caixa
  onCashOpenConfirm(value: number) {
    this.pvdService.openCashRegister(value).subscribe({
      next: (res) => {
        alert('Caixa aberto com sucesso!');
        this.isCashRegisterOpen.set(true);
        this.isCashModalOpen.set(false);
      },
      error: (err) => {
        alert('Erro ao abrir caixa: ' + (err.error?.message || err.message));
      }
    });
  }

  setupSalesSearch() {
    this.saleSearch$
      .pipe(
        debounceTime(400),
        distinctUntilChanged(),
        tap(() => {
          this.isSearchingSales.set(true);
          // Opcional: limpar resultados anteriores enquanto busca
          // this.saleSearchResults.set([]); 
        }),
        switchMap(term => {
          if (!term || term.trim() === '') {
            return of(null); // Retorna null para saber que limpou
          }
          
          // Chama o serviço passando página 0 e tamanho 10 (padrão)
          return this.pvdService.searchSales(term, 0, 10).pipe(
            catchError(err => {
              console.error('Erro na busca de vendas', err);
              return of({ content: [] } as any); // Retorna objeto vazio seguro
            })
          );
        })
      )
      .subscribe(result => {
        this.isSearchingSales.set(false);

        if (result === null) {
          // Se o termo foi limpo
          this.saleSearchResults.set([]);
          this.showSalesResults.set(false);
          return;
        }

        // ✅ AQUI MUDOU: A lista está dentro de result.content
        const sales = result.content || [];
        
        this.saleSearchResults.set(sales);
        
        // Lógica visual para mostrar/esconder dropdown
        if (sales.length > 0) {
           this.showSalesResults.set(true);
        } else if (this.saleSearchTerm().length > 0) {
           // Mostra "nenhum resultado" se tiver termo digitado
           this.showSalesResults.set(true); 
        } else {
           this.showSalesResults.set(false);
        }
      });
  }

loadInitialProducts() {
  this.isSearchingProduct.set(true);

  this.pvdService.getProductsPaged(0, 30)
    .pipe(catchError(() => of({ content: [] })))
    .subscribe(result => {
      this.productSearchResults.set(result.content ?? []);
      this.hasSearchedProducts.set(true);
      this.showProductResults.set(true);
      this.isSearchingProduct.set(false);
    });
}


  // ✅ NOVO: Handler para input de busca de produtos
 onProductSearchInput(value: string) {
  this.productSearchTerm.set(value);

  if (value.trim().length === 0) {
    // volta a mostrar todos os produtos
    this.loadInitialProducts();
    return;
  }

  this.productSearch$.next(value);
}


   onSaleSearchInput(value: string) {
  this.saleSearchTerm.set(value);

  if (value.trim().length < 1) {
    this.salesResults.set([]);
    this.showSalesResults.set(false);
    return;
  }

  this.showSalesResults.set(true);
  this.saleSearch$.next(value);
}


   selectSale(sale: Sale) {
    this.selectedSale.set(sale);
    this.showSalesResults.set(false);
    this.loadSale(sale);
    this.saleSearchTerm.set('');
  }

  // ✅ NOVO: Limpar busca de produtos
  clearProductSearch() {
    this.productSearchTerm.set('');
    this.productSearchResults.set([]);
    this.hasSearchedProducts.set(false);
    this.isSearchingProduct.set(false);
  }

  loadTopSellingProducts() {
    this.pvdService.getTopSellingProducts(9)
      .pipe(catchError(() => of([])))
      .subscribe(products => {
        this.topSellingProducts.set(products.slice(0, 9));
      });
  }

  // ==== MODAL DE CLIENTE ====

// abrir modal
openCustomerModal() {
  this.isCustomerModalOpen.set(true);
}

// fechar modal
closeCustomerModal() {
  this.isCustomerModalOpen.set(false);
}

// salvar novo cliente
saveNewCustomer(data: any) {
  this.customerService.createCustomer(data).subscribe({
    next: (saved) => {
      console.log("Cliente salvo:", saved);

      // Seleciona automaticamente o cliente recém-criado
      this.selectedCustomer.set(saved);

      // Fecha modal
      this.isCustomerModalOpen.set(false);

      // Atualiza input de busca com o nome cadastrado
      this.customerSearchTerm.set(saved.name);
      this.customerSearchResults.set([saved]);
      this.showCustomerResults.set(false);
    },
    error: (err) => {
      console.error("Erro ao salvar cliente", err);
      alert("Erro ao salvar cliente.");
    }
  });
}

loadSale(sale: Sale) {
    // 1. Seleciona o cliente
    this.selectedCustomer.set({
      id: Number(sale.customerId),
      name: sale.customerName,
      phone: sale.customerPhone || '',
      active: true
    });

    // 2. Limpa carrinho atual
    this.cartItems.set([]);

    // 3. Carrega itens da venda (mapeia de volta para CartItem)
    const mappedItems = sale.items.map(it => ({
      id: Date.now() + Math.random(),
      productId: it.productId,
      productName: it.productName,
      productPrice: it.productPrice,
      quantity: it.quantity,
      total: it.total,
      barcode: '' // Assumindo que o barcode pode não vir no item de venda
    }));

    this.cartItems.set(mappedItems);
    this.discount.set(sale.discount ?? 0);
    
    // 4. Limpa estados de busca
    this.saleSearchTerm.set('');
    this.saleSearchResults.set([]);
    this.showSalesResults.set(false);
}

  trackByProductId(index: number, product: ProductResponse) {
    return product.id;
  }

  getStockClass(qty: number) {
    if (qty <= 0) return 'out-of-stock';
    if (qty <= 5) return 'low-stock';
    return 'in-stock';
  }

  formatPrice(price: number) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  }

   addToCart(product: ProductResponse) {
    console.log("Adicionando ao carrinho:", product);
    
    const existingItem = this.cartItems().find(item => item.productId === product.id);
    
    if (existingItem) {
      // Se o produto já está no carrinho, aumenta a quantidade
      this.updateQuantity(existingItem.id, existingItem.quantity + 1);
    } else {
      // Adiciona novo item ao carrinho
      const newItem: CartItem = {
        id: Date.now(), // ID temporário
        productId: product.id,
        productName: product.name,
        productPrice: product.price,
        barcode: product.barcode,
        quantity: 1,
        total: product.price
      };
      
      this.cartItems.update(items => [...items, newItem]);
    }
  }

  updateQuantity(itemId: number, newQuantity: number) {
    if (newQuantity < 1) {
      this.removeFromCart(itemId);
      return;
    }

    this.cartItems.update(items => 
      items.map(item => 
        item.id === itemId 
          ? { 
              ...item, 
              quantity: newQuantity, 
              total: item.productPrice * newQuantity 
            }
          : item
      )
    );
  }

  trackByCartItemId(index: number, item: CartItem): number {
    return item.id;
  }

  removeFromCart(itemId: number) {
    this.cartItems.update(items => items.filter(item => item.id !== itemId));
  }

  setDiscount(value: number) {
    
    const validValue = isNaN(value) ? 0 : Math.max(0, value);
    
    this.discount.set(validValue);
  }

  clearCart() {
    this.cartItems.set([]);
    this.discount.set(0);
    this.currentSaleId.set(null);
  }

  setupCustomerSearch() {
  this.customerSearch$
    .pipe(
      debounceTime(350),
      distinctUntilChanged(),
      tap(() => this.isSearchingCustomer.set(true)),
      switchMap(term =>
        this.customerService.searchCustomers(term, 0, 5).pipe(
          catchError(err => {
            console.error("Erro ao buscar clientes:", err);

            return of({
              content: [],
              totalElements: 0,
              totalPages: 0,
              size: 5,
              number: 0,
            });
          })
        )
      )
    )
    .subscribe(result => {
      this.customerSearchResults.set(result.content);
      this.isSearchingCustomer.set(false);
    });
}

  onCustomerSearchInput(value: string) {
  this.customerSearchTerm.set(value);

  if (value.trim().length < 1) {
    this.customerSearchResults.set([]);
    this.showCustomerResults.set(false);
    return;
  }

  this.showCustomerResults.set(true);
  this.customerSearch$.next(value);
}


  selectCustomer(customer: CustomerResponse) {
  this.selectedCustomer.set(customer);
  this.showCustomerResults.set(false);
}

  clearCustomer() {
    this.selectedCustomer.set(null);
    this.customerSearchTerm.set('');
    this.customerSearchResults.set([]);
  }

  trackByCustomerId(index: number, customer: CustomerResponse) {
    return customer.id;
  }

   // Abrir modal de pagamento
  openPaymentModal() {
    if (this.cartItems().length === 0) {
      alert('Adicione produtos ao carrinho antes de finalizar a venda.');
      return;
    }

    const paymentData = {
      saleId: 0, // Será preenchido após criar a venda
      totalAmount: this.total(),
      customerName: this.selectedCustomer()?.name || 'Cliente não identificado'
    };

    this.paymentData.set(paymentData);
    this.isPaymentModalOpen.set(true);
  }

  // Fechar modal de pagamento
  closePaymentModal() {
    this.isPaymentModalOpen.set(false);
    this.paymentData.set(null);
  }

  // Processar pagamento concluído
 onPaymentProcessed(response: PaymentResponse) {
  this.isPaymentModalOpen.set(false);
  this.clearCart();
  this.clearCustomer();
  this.closePaymentModal();

  alert(`Venda finalizada com sucesso! Troco: ${this.formatPrice(response.changeAmount)}`);
}

   // ====================== MÉTODO FINALIZAR VENDA ATUALIZADO ======================
finalizeSale() {
    if (this.cartItems().length === 0) {
        alert('Adicione produtos ao carrinho antes de finalizar a venda.');
        return;
    }

    const saleRequest = {
        customerId: this.selectedCustomer()?.id?.toString() || '',
        discount: this.discount(),
        saleStatus: 'PENDING' as const,
        items: this.cartItems().map(item => ({
            productId: item.productId,
            quantity: item.quantity
        }))
    };

    // ✅ CENÁRIO A: VENDA EXISTENTE (ATUALIZAR)
    if (this.currentSaleId() !== null) {
        const saleId = this.currentSaleId()!;

        // 💡 Ajuste: Tipagem do subscribe para <Sale>
        this.pvdService.updateSale(saleId, saleRequest).subscribe({
            next: (updatedSale: Sale) => {
                this.openPaymentModalWithData(updatedSale);
            },
            error: (err) => {
                console.error("Erro ao atualizar venda", err);
                alert("Erro ao atualizar itens da venda: " + (err.error?.message || err.message));
            }
        });
        return;
    }

    // ✅ CENÁRIO B: VENDA NOVA (CRIAR)
    // 💡 Ajuste: Tipagem do subscribe para <Sale>
    this.pvdService.createSale(saleRequest).subscribe({
        next: (newSale: Sale) => {
            this.currentSaleId.set(newSale.id);
            this.openPaymentModalWithData(newSale);
        },
        error: (err) => {
            // ... (A Lógica de tratamento de erro de caixa e estoque está perfeita) ...
            
            let msg = '';
            // Sua lógica de extração de erro é excelente e robusta
            if (err.error && typeof err.error === 'object' && err.error.message) {
                 msg = err.error.message;
            } else if (typeof err.error === 'string') {
                 msg = err.error;
            } else {
                 msg = err.message || 'Erro desconhecido';
            }

            if (msg.toLowerCase().includes('abrir o caixa')) {
                 if(confirm('⚠️ O Caixa está FECHADO. Deseja abrir agora?')) {
                     this.openCashModal();
                 }
            } else if (msg.toLowerCase().includes('estoque')) {
                 alert('⚠️ ESTOQUE: ' + msg);
            } else {
                 alert('❌ Erro: ' + msg);
            }
        }
    });
}
logout() {
  this.authService.logout();
}

openPaymentModalWithData(sale: any) {
    // 💡 Ajuste: Use a interface PaymentData importada para tipagem mais segura
    const paymentData: PaymentData = { 
        saleId: sale.id,
        totalAmount: sale.total, // Usa o total calculado pelo Backend!
        customerName: sale.customerName || this.selectedCustomer()?.name || 'Cliente',
        items: this.cartItems().map(item => ({
            name: item.productName,
            qty: item.quantity,
            price: item.productPrice,
            total: item.total
        }))
    };

    this.paymentData.set(paymentData);
    this.isPaymentModalOpen.set(true);
}

}