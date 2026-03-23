import { Component, computed, inject, OnDestroy, OnInit, signal, HostListener, ViewChild, ElementRef, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { Subject, of, take, takeUntil, debounceTime, distinctUntilChanged, switchMap, map } from 'rxjs';
import { CartItem } from '../../core/service/pdv.service';
import { CustomerService, CustomerResponse, CustomerRequest } from '../../core/service/customer.service';
import { ProductService, CategoryEnum } from '../../core/service/product.service';
import { SaleService, SaleResponse, SaleRequest } from '../../core/service/sale.service';
import { CustomerModal } from "../../shared/models/customer/customer-modal";
import { CashModalComponent } from "../../shared/models/cash/cash-modal.component";
import { EmbroideryService } from '../../core/service/embroidery.service';
import { PaymentData, PaymentModal } from "../../shared/models/payment/payment-modal/payment-modal";
import { CashService, OpenSessionRequest } from '../../core/service/cash.service';

@Component({
  selector: 'app-pdv',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    CustomerModal,
    CashModalComponent,
    PaymentModal
],
  templateUrl: './pdv.html',
  styleUrls: ['./pdv.scss']
})
export class Pdv implements OnInit, OnDestroy {
paymentDataForModal() {
throw new Error('Method not implemented.');
}

  private saleService = inject(SaleService);
  private customerService = inject(CustomerService);
  private snackBar = inject(MatSnackBar);
  private embroideryService = inject(EmbroideryService);
  private productSearchSubject = new Subject<string>();
  private productService = inject(ProductService);
  private cashService = inject(CashService);

  private destroy$ = new Subject<void>();
  private customerSearchSubject = new Subject<string>();

  searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  pageTitle = signal('Frente de Caixa');
  pageSubtitle = signal('Vendas e Ordens de Serviço');
  isLoading = signal(false);
  isOpeningModalOpen = signal(false);
  isPaymentModalOpen = signal(false);
  isModalOpen = signal(false);
  isDetailVisible = signal(false);
  CategoryEnum = CategoryEnum;
  showDelivered = signal<boolean>(false);
  selectedEmbroideryDetail = signal<any | null>(null);

  customerSearchValue = signal('');
  suggestedCustomers = signal<CustomerResponse[]>([]);
  selectedCustomer = signal<CustomerResponse | null>(null);
  showCustomerDropdown = signal(false);

  productCategoryFilter = signal<'all' | CategoryEnum>('all');
  filteredProducts = signal<any[]>([]);
  totalElements = signal(0);
  currentPage = signal(0);
  totalPages = signal(1);
  pageSize = signal(10);

  saleSuggestions = signal<SaleResponse[]>([]);
  showSaleSuggestions = signal(false);
  activeSaleId = signal<number | null>(null);

  cart = signal<CartItem[]>([]);
  discountType = signal<'value' | 'percent'>('value');
  discountInput = signal(0);

  paymentData = signal<PaymentData | null>(null);

  subtotal = computed(() =>
    this.cart().reduce((acc, item) => acc + item.total, 0)
  );

  isCashRegisterOpen = computed(() => !!this.cashService.activeSession());

  activeSessionId = this.cashService.activeSessionId;

  calculatedDiscount = computed(() => {
    const total = this.subtotal();
    const val = this.discountInput();
    return this.discountType() === 'percent' ? (total * val) / 100 : val;
  });

  totalWithDiscount = computed(() => {
    const res = this.subtotal() - this.calculatedDiscount();
    return res > 0 ? res : 0;
  });

  ngOnInit() {
    this.setupCustomerSearch();
    this.setupProductSearch();
    this.productSearchSubject.next('');

  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  refreshSearch() {
  const currentTerm = (document.querySelector('.search-input-wrapper input') as HTMLInputElement)?.value || '';
  this.productSearchSubject.next(currentTerm);
}

  private setupCustomerSearch() {
    this.customerSearchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      switchMap(term => {
        if (term.trim().length < 2) {
          this.showCustomerDropdown.set(false);
          return of({ content: [] });
        }
        return this.customerService.searchPaged(term, 0, 8);
      }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: (result: any) => {
        this.suggestedCustomers.set(result.content || []);
        this.showCustomerDropdown.set(this.suggestedCustomers().length > 0);
      },
      error: (err) => {
        console.error('Erro na busca:', err);
        this.showCustomerDropdown.set(false);
      }
    });
  }

  onCustomerSearchInput(event: any) {
    const val = event.target.value;
    this.customerSearchValue.set(val);
    this.customerSearchSubject.next(val);
  }

  selectCustomer(c: CustomerResponse) {
    this.selectedCustomer.set(c);
    this.showCustomerDropdown.set(false);
    this.customerSearchValue.set('');
  }

  clearCustomer() {
    this.selectedCustomer.set(null);
  }

  addToCart(p: any) {
    const isEmb = p.categoryEnum === CategoryEnum.BORDADO || !!p.embroideryId;
    this.cart.update(items => {
      const existing = items.find(i => i.product.id === p.id && i.isEmbroidery === isEmb);
      if (existing) {
        return items.map(i => i === existing
          ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.product.price }
          : i
        );
      }
      return [...items, {
        product: { id: p.id, name: p.name, price: p.price, barcode: p.barcode },
        quantity: 1,
        total: p.price,
        isEmbroidery: isEmb,
        embroideryId: isEmb ? p.id : null
      }];
    });
    this.snackBar.open('Item adicionado!', '', { duration: 1000 });
  }

  updateQuantity(item: CartItem, change: number) {
    this.cart.update(prev => prev.map(i => {
      if (i === item) {
        const newQty = Math.max(1, i.quantity + change);
        return { ...i, quantity: newQty, total: newQty * i.product.price };
      }
      return i;
    }));
  }

  removeFromCart(index: number) {
  this.cart.update(items => {
    const newItems = [...items];
    newItems.splice(index, 1);
    return newItems;
  });
}

  onSearchSale(query: string) {
  console.log('--- Digitou na busca de vendas:', query); // LOG DE TESTE

  const term = query.trim();
  if (term.length < 1) {
    console.log('Termo muito curto, ignorando...');
    this.saleSuggestions.set([]);
    this.showSaleSuggestions.set(false);
    return;
  }

  console.log('Fazendo chamada para o serviço com o termo:', term);
  this.saleService.searchSales(term, 0, 10).subscribe({
    next: (response) => {
      console.log('Sucesso! Dados recebidos:', response);
      this.saleSuggestions.set(response.content || response);
      this.showSaleSuggestions.set(true);
    },
    error: (err) => {
      console.error('ERRO NA CHAMADA API:', err);
    }
  });
}

@HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {

    if (event.key === 'F2') {
    event.preventDefault();
    this.searchInput()?.nativeElement.focus();
  }
    if (event.key === 'F10') {
      event.preventDefault();
      this.handleF10Press();
    }

    if (event.key === 'Escape') {
      if (this.isPaymentModalOpen()) {
        this.closePaymentModal();
      } else if (this.isModalOpen()) {
        this.onCloseCustomerModal();
      }
    }
  }

  private handleF10Press() {
    if (this.isCashRegisterOpen() && this.cart().length > 0 && !this.isLoading()) {
      this.preparePayment();
    } else if (!this.isCashRegisterOpen()) {
      this.showWarning('Abra o caixa antes de finalizar uma venda.');
    } else if (this.cart().length === 0) {
      this.showWarning('O carrinho está vazio.');
    }
  }

  selectSaleToEdit(sale: SaleResponse) {
  this.showSaleSuggestions.set(false);
  this.activeSaleId.set(sale.id);

  if (sale.customerName) {
    this.selectedCustomer.set({
      id: (sale as any).customerId || 0,
      name: sale.customerName,
      phone: (sale as any).customerPhone || 'Não informado',
      active: true
    } as any);
  }

  this.discountInput.set(sale.discountValue || 0);
  this.discountType.set(sale.discountType === 'PERCENTAGE' ? 'percent' : 'value');

  if (sale.items && sale.items.length > 0) {
    const mappedItems: CartItem[] = sale.items.map(item => {
      const isEmbroidery = !!item.embroideryId;

      const price = item.unitPrice || 0;

      return {
        product: {
          id: item.productId || item.embroideryId || 0,
          name: item.description,
          price: price,
          stockQty: 999
        } as any,
        quantity: item.quantity,
        isEmbroidery: isEmbroidery,
        total: price * item.quantity
      };
    });

    this.cart.set(mappedItems);
    this.showSuccess(`Venda #${sale.id} carregada com sucesso!`);
  } else {
    this.showError('Esta venda não possui itens.');
  }
}

  finalizeSale(status: 'PAID' | 'PENDING') {
    if (this.cart().length === 0) return;

    const sessionId = this.activeSessionId();

    if (!sessionId) {
    this.showError('Nenhum caixa aberto encontrado!');
    return;
  }

    const saleRequest: SaleRequest = {
      customerId: this.selectedCustomer()?.id || null,
      cashSessionId: 1,
      discountType: this.discountType() === 'percent' ? 'PERCENTAGE' : 'FIXED',
      discountValue: this.discountInput(),
      items: this.cart().map(item => ({
        productId: item.isEmbroidery ? null : item.product.id,
        embroideryId: item.isEmbroidery ? item.product.id : null,
        quantity: item.quantity,
        unitPrice: item.product.price,
        description: item.product.name
      }))
    };

    this.isLoading.set(true);
    const action$ = this.activeSaleId()
      ? this.saleService.update(this.activeSaleId()!, saleRequest)
      : this.saleService.createSale(saleRequest);

    action$.pipe(take(1)).subscribe({
      next: (res) => {
        this.snackBar.open(`Venda #${res.id} processada!`, 'OK', { duration: 3000 });
        this.resetPDV();
      },
      error: (err) => {
        this.snackBar.open('Erro ao salvar venda.', 'Erro');
      },
      complete: () => this.isLoading.set(false)
    });
  }

  resetPDV() {
    this.cart.set([]);
    this.activeSaleId.set(null);
    this.discountInput.set(0);
    this.selectedCustomer.set(null);
  }

  changeDiscountType(type: 'value' | 'percent') {
    this.discountType.set(type);
  }

  updateDiscountValue(event: any) {
    this.discountInput.set(Number(event.target.value) || 0);
  }

  handleButtonClick() {
    if (!this.isCashRegisterOpen()) this.isOpeningModalOpen.set(true);
  }

onConfirmCashOpen(value: number) {
  const request: OpenSessionRequest = { value: value };

  this.cashService.openCashRegister(request).subscribe({
    next: (session) => {
      this.isOpeningModalOpen.set(false);
      this.showSuccess('Caixa aberto com sucesso!');
    },
    error: (err) => {
      console.error('Erro ao abrir caixa:', err);
      this.showError('Não foi possível abrir o caixa.');
    }
  });
}

  changePage(delta: number) {
    this.currentPage.update(p => p + delta);
    this.refreshSearch();
  }

  setProductFilter(filter: 'all' | CategoryEnum) {
  console.log('Filtro alterado para:', filter);
  this.productCategoryFilter.set(filter);
  this.currentPage.set(0);
    const currentTerm = (document.querySelector('.search-input-wrapper input') as HTMLInputElement)?.value || '';
    this.productSearchSubject.next(currentTerm);
}

  private lastSearchTerm = '';

  openCustomerModal() {
  this.isModalOpen.set(true);
}

onCloseCustomerModal() {
  this.isModalOpen.set(false);
}

handleSaveCustomer(newCustomerData: CustomerRequest) {
  this.isLoading.set(true);

  this.customerService.create(newCustomerData).pipe(
    take(1)
  ).subscribe({
    next: (customer: CustomerResponse) => {
      this.snackBar.open('Cliente cadastrado com sucesso!', 'OK', { duration: 3000 });

      this.selectedCustomer.set(customer);

      this.isModalOpen.set(false);
      this.isLoading.set(false);
    },
    error: (err) => {
      console.error('Erro ao cadastrar cliente:', err);
      this.snackBar.open('Erro ao cadastrar cliente. Verifique os dados.', 'Erro');
      this.isLoading.set(false);
    }
  });
}

onProductSearchInput(event: any) {
  const val = event.target.value;
  this.lastSearchTerm = val;
  this.productSearchSubject.next(val);
}

private setupProductSearch() {
  this.productSearchSubject.pipe(
    debounceTime(400),
    switchMap(term => {
      this.isLoading.set(true);

      if (this.productCategoryFilter() === CategoryEnum.BORDADO) {
        console.log('Buscando Bordados para:', term);
        const status = this.showDelivered() ? 'DELIVERED' : 'PENDING';

        return this.embroideryService.search(term, status, this.currentPage(), this.pageSize()).pipe(
          map(res => ({
            ...res,
            content: res.content.map(emb => ({
              ...emb,
              name: emb.customerName,
              description: emb.description,
              deliveryDate: emb.deliveryDate,
              categoryEnum: CategoryEnum.BORDADO,
              price: emb.price,
              stockQty: 0
            }))
          }))
        );
      } else {
        console.log('Buscando Produtos para:', term);
        return this.productService.findAll().pipe(
          map(products => {
            const termLower = term.toLowerCase();
            let filtered = products.filter(p =>
              p.name.toLowerCase().includes(termLower) ||
              (p.barcode && p.barcode.includes(term))
            );

            const catFilter = this.productCategoryFilter();
            if (catFilter !== 'all') {
              filtered = filtered.filter(p => p.categoryEnum === catFilter);
            }

            return {
              content: filtered,
              totalElements: filtered.length,
              totalPages: Math.ceil(filtered.length / this.pageSize())
            };
          })
        );
      }
    }),
    takeUntil(this.destroy$)
  ).subscribe({
    next: (response) => {
      console.log('Resultados encontrados:', response.content.length);
      this.filteredProducts.set(response.content || []);
      this.totalElements.set(response.totalElements || 0);
      this.totalPages.set(response.totalPages || 1);
      this.isLoading.set(false);
    },
    error: (err) => {
      console.error('Erro na busca:', err);
      this.isLoading.set(false);
      this.filteredProducts.set([]);
    }
  });
}

showDetails(emb: any) {
  this.selectedEmbroideryDetail.set(emb);
  this.isDetailVisible.set(true);
}

closeDetails() {
  this.isDetailVisible.set(false);
  setTimeout(() => this.selectedEmbroideryDetail.set(null), 200);
}

preparePayment() {
  if (!this.selectedCustomer()) {
    this.showWarning('Por favor, selecione um cliente antes de finalizar a venda.');
    return;
  }

  if (this.cart().length === 0) {
    this.snackBar.open('Carrinho vazio!', 'Aviso', { duration: 2000 });
    return;
  }

  const sessionId = this.activeSessionId();

  if (!sessionId) {
    this.showError('Nenhum caixa aberto encontrado!');
    return;
  }

  const saleRequest: SaleRequest = {
  customerId: this.selectedCustomer()?.id || null,
  cashSessionId: sessionId,
  discountType: this.discountType() === 'percent' ? 'PERCENTAGE' : 'FIXED',
  discountValue: this.discountInput(),
  items: this.cart().map(item => ({
    productId: item.isEmbroidery ? null : item.product.id,
    embroideryId: item.isEmbroidery ? item.product.id : null,
    quantity: item.quantity,
    manualPrice: item.isEmbroidery ? item.product.price : null,
    description: item.product.name
  }))
};

  this.isLoading.set(true);

  const action$ = this.activeSaleId()
    ? this.saleService.update(this.activeSaleId()!, saleRequest)
    : this.saleService.createSale(saleRequest);

  action$.pipe(take(1)).subscribe({
    next: (sale: SaleResponse) => {
      const data: PaymentData = {
        saleId: sale.id,
        totalAmount: this.totalWithDiscount(),
        customerName: this.selectedCustomer()?.name || 'Consumidor Final',
        items: this.cart().map(i => ({
          name: i.product.name,
          qty: i.quantity,
          price: i.product.price,
          total: i.total
        }))
      };

      this.paymentData.set(data);
      this.isPaymentModalOpen.set(true);
      this.isLoading.set(false);
    },
    error: (err) => {
      this.isLoading.set(false);
      this.snackBar.open('Erro ao gerar venda para pagamento.', 'Erro');
    }
  });
}

handlePaymentProcessed(response: any) {
  this.snackBar.open('Venda finalizada e paga com sucesso!', 'OK', { duration: 3000 });
  this.resetPDV();
  this.isPaymentModalOpen.set(false);
}

closePaymentModal() {
  this.isPaymentModalOpen.set(false);
  this.paymentData.set(null);
}

isOverdue(dateStr: string): boolean {
  if (!dateStr) return false;
  const delivery = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return delivery < today;
}

showSuccess(message: string) {
  this.snackBar.open(message, 'Fechar', {
    duration: 3000,
    panelClass: ['success-snackbar'],
    horizontalPosition: 'end',
    verticalPosition: 'top'
  });
}

showError(message: string) {
  this.snackBar.open(message, 'Fechar', {
    duration: 5000,
    panelClass: ['error-snackbar']
  });
}

showWarning(message: string) {
  this.snackBar.open(message, 'Fechar', {
    duration: 4000
  });
}
}
