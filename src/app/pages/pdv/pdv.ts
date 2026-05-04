  import { Component, computed, inject, OnDestroy, OnInit, signal, HostListener, ViewChild, ElementRef, viewChild } from '@angular/core';
  import { CommonModule } from '@angular/common';
  import { MatIconModule } from '@angular/material/icon';
  import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
  import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
  import { Subject, of, take, takeUntil, debounceTime, distinctUntilChanged, switchMap, map } from 'rxjs';
  import { CartItem, PdvService } from '../../core/service/pdv.service';
  import { CustomerService, CustomerResponse, CustomerRequest } from '../../core/service/customer.service';
  import { ProductService, CategoryEnum } from '../../core/service/product.service';
  import { SaleService, SaleResponse, SaleRequest, SaleStatus, DiscountType } from '../../core/service/sale.service';
  import { CustomerModal } from "../../shared/models/customer/customer-modal";
  import { CashModalComponent } from "../../shared/models/cash/cash-modal.component";
  import { EmbroideryService } from '../../core/service/embroidery.service';
  import { PaymentData, PaymentModal } from "../../shared/models/payment/payment-modal/payment-modal";
  import { CashService, OpenSessionRequest } from '../../core/service/cash.service';
  import { BrlCurrencyPipe } from '../../shared/pipes/brl-currency.pipe';
  import { FormsModule } from '@angular/forms';

  @Component({
    selector: 'app-pdv',
    standalone: true,
    imports: [
      CommonModule,
      MatIconModule,
      MatSnackBarModule,
      FormsModule,
      MatProgressSpinnerModule,
      CustomerModal,
      CashModalComponent,
      PaymentModal,
      BrlCurrencyPipe,
    ],
    templateUrl: './pdv.html',
    styleUrls: ['./pdv.scss']
  })
  export class Pdv implements OnInit, OnDestroy {
    paymentDataForModal() {
      throw new Error('Method not implemented.');
    }

    private pdvService = inject(PdvService);
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

    cart             = signal<CartItem[]>(this.pdvService.state().cart);
    selectedCustomer = signal<CustomerResponse | null>(this.pdvService.state().selectedCustomer);
    discountType     = signal<'value' | 'percent'>(this.pdvService.state().discountType);
    discountInput    = signal<number>(this.pdvService.state().discountInput);
    activeSaleId     = signal<number | null>(this.pdvService.state().activeSaleId);
    isCopiedSale     = signal<boolean>(this.pdvService.state().isCopiedSale);

    pageTitle = signal('Frente de Caixa');
    pageSubtitle = signal('Vendas e Ordens de Serviço');
    isLoading = signal(false);
    isOpeningModalOpen = signal(false);
    isPaymentModalOpen = signal(false);
    isModalOpen = signal(false);
    isDetailVisible = signal(false);
    CategoryEnum = CategoryEnum;
    selectedEmbroideryDetail = signal<any | null>(null);
    isBordadoModalOpen = signal(false);
    bordadoPrice = signal<number | null>(null);
    bordadoDescription = signal('');

    customerSearchValue = signal('');
    suggestedCustomers = signal<CustomerResponse[]>([]);
    showCustomerDropdown = signal(false);

    productCategoryFilter = signal<'all' | CategoryEnum>('all');

    private allFilteredProducts = signal<any[]>([]);
    filteredProducts = signal<any[]>([]);
    totalElements = signal(0);
    currentPage = signal(0);
    totalPages = signal(1);
    readonly pageSize = signal(12);

    saleSuggestions = signal<SaleResponse[]>([]);
    showSaleSuggestions = signal(false);

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
      const saved = this.pdvService.state();
      if (saved.cart.length > 0 || saved.selectedCustomer) {
        this.cart.set(saved.cart);
        this.selectedCustomer.set(saved.selectedCustomer);
        this.discountType.set(saved.discountType);
        this.discountInput.set(saved.discountInput);
        this.activeSaleId.set(saved.activeSaleId);
        this.isCopiedSale.set(saved.isCopiedSale);
      }

      if (!this.selectedCustomer()) {
      this.setDefaultCustomer();
      }

      this.setupCustomerSearch();
      this.setupProductSearch();
      this.productSearchSubject.next('');

      setTimeout(() => this.searchInput()?.nativeElement.focus(), 100);
    }

      ngOnDestroy() {
        this.pdvService.patch({
          cart: this.cart(),
          selectedCustomer: this.selectedCustomer(),
          discountType: this.discountType(),
          discountInput: this.discountInput(),
          activeSaleId: this.activeSaleId(),
          isCopiedSale: this.isCopiedSale(),
        });

        this.destroy$.next();
        this.destroy$.complete();
      }

      openBordadoModal() {
        this.bordadoPrice.set(null);
        this.bordadoDescription.set('');
        this.isBordadoModalOpen.set(true);
      }
      closeBordadoModal() {
        this.isBordadoModalOpen.set(false);
        this.bordadoPrice.set(null);
        this.bordadoDescription.set('');
      }

      confirmAddBordado() {
      const price = this.bordadoPrice();
      if (!price || price <= 0) { this.showWarning('Informe um valor válido para o bordado.'); return; }
      const desc = this.bordadoDescription().trim() || 'BORDADO AVULSO';
      this.cart.update(items => [...items, {
        product: { id: 0, name: desc, price, barcode: '', stockQty: 0 },
        quantity: 1, total: price, isEmbroidery: true, embroideryId: undefined
      }]);
      this.pdvService.patch({ cart: this.cart() });
      this.snackBar.open('Bordado adicionado!', '', { duration: 1000 });
      this.closeBordadoModal();
      }

      private applyClientPagination(products: any[]) {
        const size = this.pageSize();
        const page = this.currentPage();
        const total = products.length;
        const pages = Math.max(1, Math.ceil(total / size));

        const safePage = Math.min(page, pages - 1);
        if (safePage !== page) this.currentPage.set(safePage);

        const start = safePage * size;
        const end = start + size;

        this.allFilteredProducts.set(products);
        this.filteredProducts.set(products.slice(start, end));
        this.totalElements.set(total);
        this.totalPages.set(pages);
      }

      changePage(delta: number) {
        const next = Math.max(0, Math.min(this.currentPage() + delta, this.totalPages() - 1));
        this.currentPage.set(next);
        if (this.productCategoryFilter() === CategoryEnum.BORDADO) this.refreshSearch();
        else this.applyClientPagination(this.allFilteredProducts());
      }

      goToPage(page: number) {
        this.currentPage.set(page);
        if (this.productCategoryFilter() === CategoryEnum.BORDADO) this.refreshSearch();
        else this.applyClientPagination(this.allFilteredProducts());
      }

      get pageNumbers(): number[] {
        const total = this.totalPages();
        const current = this.currentPage();

        if (total <= 7) return Array.from({ length: total }, (_, i) => i);

        const start = Math.max(0, Math.min(current - 2, total - 5));
        return Array.from({ length: Math.min(5, total) }, (_, i) => start + i);
      }

      refreshSearch() {
        const el = document.querySelector('.search-input-wrapper input') as HTMLInputElement;
        this.productSearchSubject.next(el?.value || '');
      }

      handleButtonClick() {
      if (!this.isCashRegisterOpen()) this.isOpeningModalOpen.set(true);
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
        error: () => this.showCustomerDropdown.set(false)
      });
    }

    onCustomerSearchInput(event: any) {
      const val = event.target.value;
      this.customerSearchValue.set(val);
      this.customerSearchSubject.next(val);
    }

    selectCustomer(c: CustomerResponse) {
    this.selectedCustomer.set(c);
    this.pdvService.patch({ selectedCustomer: c });
    this.showCustomerDropdown.set(false);
    this.customerSearchValue.set('');
    }

    clearCustomer() {
    this.selectedCustomer.set(null);
    this.pdvService.patch({ selectedCustomer: null });
    }

    addToCart(p: any) {
    const isEmb = p.categoryEnum === CategoryEnum.BORDADO || !!p.embroideryId;
    if (!isEmb) {
      const itemNoCarrinho = this.cart().find(i => i.product.id === p.id && !i.isEmbroidery);
      const qtdNoCarrinho = itemNoCarrinho?.quantity ?? 0;

      if (p.stockQty <= qtdNoCarrinho) {
        this.showWarning(
          `Estoque insuficiente para "${p.name}". Disponível: ${p.stockQty}, já no carrinho: ${qtdNoCarrinho}.`
        );
        return;
      }
    }

    this.cart.update(items => {
      const existing = items.find(i => i.product.id === p.id && i.isEmbroidery === isEmb);
      if (existing) {
        return items.map(i => i === existing
          ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.product.price }
          : i);
      }
      return [...items, {
        product: {
          id: p.id,
          name: p.name,
          price: p.price,
          barcode: p.barcode,
          stockQty: p.stockQty ?? 0
        },
        quantity: 1,
        total: p.price,
        isEmbroidery: isEmb,
        embroideryId: isEmb ? p.id : undefined
      }];
    });
    this.pdvService.patch({ cart: this.cart() });
    this.snackBar.open('Item adicionado!', '', { duration: 1000 });

    const input = this.searchInput()?.nativeElement;
      if (input) {
        input.value = '';
        input.dispatchEvent(new Event('input'));
        input.focus();
      }
      this.productSearchSubject.next('');
  }

  updateQuantity(item: CartItem, change: number) {
    if (change > 0 && !item.isEmbroidery) {
      const estoqueDisponivel = item.product.stockQty;
      if (item.quantity >= estoqueDisponivel) {
        this.showWarning(
          `Limite de estoque atingido para "${item.product.name}". Disponível: ${estoqueDisponivel}.`
        );
        return;
      }
    }

    this.cart.update(prev => prev.map(i => {
      if (i !== item) return i;
      const newQty = Math.max(1, i.quantity + change);
      return { ...i, quantity: newQty, total: newQty * i.product.price };
    }));

    this.pdvService.patch({ cart: this.cart() });
  }

  removeFromCart(index: number) {
    this.cart.update(items => { const n = [...items]; n.splice(index, 1); return n; });
    this.pdvService.patch({ cart: this.cart() });
  }

   onSearchSale(query: string) {
  const term = query.trim();
  if (term.length < 1) { 
    this.saleSuggestions.set([]); 
    this.showSaleSuggestions.set(false); 
    return; 
  }
  this.saleService.searchSales(term, 0, 10, 'all').subscribe({
    next: (response) => { 
      this.saleSuggestions.set(response.content || response); 
      this.showSaleSuggestions.set(true); 
    },
    error: (err) => console.error('ERRO NA CHAMADA API:', err)
  });
  }

      @HostListener('window:keydown', ['$event'])
    handleKeyboardEvent(event: KeyboardEvent) {
      if (event.key === 'F2') { event.preventDefault(); this.searchInput()?.nativeElement.focus(); }
      if (event.key === 'F10') { event.preventDefault(); this.handleF10Press(); }
      if (event.key === 'Escape') {
        if (this.isBordadoModalOpen())    this.closeBordadoModal();
        else if (this.isPaymentModalOpen()) this.closePaymentModal();
        else if (this.isModalOpen())        this.onCloseCustomerModal();
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
    const isPending = sale.saleStatus === SaleStatus.PENDING;
    const customer = sale.customerName
      ? { id: (sale as any).customerId || 0, name: sale.customerName,
          phone: sale.customerPhone || 'Não informado', active: true } as any
      : null;

    if (sale.items?.length > 0) {
      const newCart = sale.items.map(item => {
        const isEmbroidery = !!item.embroideryId;
        const price = item.manualPrice ?? item.productPrice ?? 0;
        return {
          product: { id: item.productId || item.embroideryId || 0,
                    name: item.productName || item.description || '', price, stockQty: 999 } as any,
          quantity: item.quantity, isEmbroidery, total: price * item.quantity
        };
      });
      const newDiscountType = isPending && sale.discountType === DiscountType.PERCENTAGE ? 'percent' : 'value' as 'value' | 'percent';
      const newDiscountInput = isPending ? (sale.discountValue || 0) : 0;

      this.cart.set(newCart);
      this.selectedCustomer.set(customer);
      this.activeSaleId.set(isPending ? sale.id : null);
      this.isCopiedSale.set(!isPending);
      this.discountType.set(newDiscountType);
      this.discountInput.set(newDiscountInput);

      this.pdvService.patch({
        cart: newCart, selectedCustomer: customer,
        activeSaleId: isPending ? sale.id : null, isCopiedSale: !isPending,
        discountType: newDiscountType, discountInput: newDiscountInput
      });

      this.showSuccess(isPending ? `Venda #${sale.id} carregada para edição.`
                                : `Itens da venda #${sale.id} copiados como nova venda.`);
    } else {
      this.showError('Esta venda não possui itens.');
    }
    }

  resetPDV() {
    this.cart.set([]);
    this.activeSaleId.set(null);
    this.isCopiedSale.set(false);
    this.discountInput.set(0);
    this.discountType.set('value');
    this.pdvService.reset();
    this.setDefaultCustomer();
    }

    changeDiscountType(type: 'value' | 'percent') {
    this.discountType.set(type);
    this.pdvService.patch({ discountType: type });
  }

    private setDefaultCustomer() {
      this.customerService.findById(1).subscribe({
        next: (customer) => this.selectedCustomer.set(customer),
        error: () => this.selectedCustomer.set({ id: 1, name: 'BALCÃO', phone: '99 99999-9999', active: true } as any)
      });
    }

  updateDiscountValue(event: any) {
    const val = Number(event.target.value) || 0;
    this.discountInput.set(val);
    this.pdvService.patch({ discountInput: val });
  }

    onConfirmCashOpen(value: number) {
      this.cashService.openCashRegister({ value }).subscribe({
        next: () => { this.isOpeningModalOpen.set(false); this.showSuccess('Caixa aberto com sucesso!'); },
        error: () => this.showError('Não foi possível abrir o caixa.')
      });
    }

    setProductFilter(filter: 'all' | CategoryEnum) {
      this.productCategoryFilter.set(filter);
      this.currentPage.set(0);
      const el = document.querySelector('.search-input-wrapper input') as HTMLInputElement;
      setTimeout(() => this.productSearchSubject.next(el?.value || ''), 0);
    }

    private lastSearchTerm = '';

    openCustomerModal() {
      this.isModalOpen.set(true);
    }

    onCloseCustomerModal() {
      this.isModalOpen.set(false);
    }

    onCustomerAdded(newCustomer: CustomerResponse) {
      this.isModalOpen.set(false);
      this.selectedCustomer.set(newCustomer);
      this.showSuccess(`Cliente ${newCustomer.name} selecionado!`);
    }

    onProductSearchInput(event: any) {
    const val = event.target.value;
    this.lastSearchTerm = val;
    this.currentPage.set(0);

    const qtyBarcodePattern = /^(\d+)[xX](.+)$/;
    const match = val.match(qtyBarcodePattern);

    if (match) {
      this.productSearchSubject.next(val);
    } else if (val.length >= 8 && /^\d+$/.test(val.trim())) {
      this.productSearchSubject.next(val);
    } else {
      this.productSearchSubject.next(val);
    }
    }

    private beepSuccess() {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.15);
      } catch (e) { }
    }

    private setupProductSearch() {
    this.productSearchSubject.pipe(
      switchMap(term => {
        this.isLoading.set(true);

        const qtyMatch = term.match(/^(\d+)[xX](.+)$/);
        const searchTerm = qtyMatch ? qtyMatch[2].trim() : term;
        const forcedQty  = qtyMatch ? parseInt(qtyMatch[1], 10) : null;

        if (this.productCategoryFilter() === CategoryEnum.BORDADO) {
          return this.embroideryService.search(searchTerm, 'PENDING', this.currentPage(), this.pageSize(), 'FALTA_PAGAMENTO').pipe(
            map(res => ({
              content: res.content.map((emb: any) => ({
                ...emb, name: emb.customerName, description: emb.description,
                deliveryDate: emb.deliveryDate, categoryEnum: CategoryEnum.BORDADO,
                price: emb.price, stockQty: 0
              })),
              totalElements: res.totalElements, totalPages: res.totalPages,
              serverPaged: true, exactBarcode: false, exactProduct: null, forcedQty: null
            }))
          );
        } else {
          return this.productService.findAll().pipe(
            map(products => {
              const termLower = searchTerm.toLowerCase().trim();
              let filtered = products.filter(p =>
                p.name.toLowerCase().includes(termLower) ||
                (p.barcode && p.barcode.includes(searchTerm)) ||
                p.id?.toString().includes(searchTerm)
              );
              const catFilter = this.productCategoryFilter();
              if (catFilter !== 'all') filtered = filtered.filter(p => p.categoryEnum === catFilter);

              const exactMatch = searchTerm.trim().length > 0
                ? products.find(p => p.barcode && p.barcode === searchTerm.trim())
                : null;

              return {
                content: filtered,
                totalElements: filtered.length,
                totalPages: Math.max(1, Math.ceil(filtered.length / this.pageSize())),
                serverPaged: false,
                exactBarcode: !!exactMatch,
                exactProduct: exactMatch || null,
                forcedQty      // ← passa a quantidade forçada
              };
            })
          );
        }
      }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response: any) => {
        if (response.serverPaged) {
          this.filteredProducts.set(response.content);
          this.allFilteredProducts.set(response.content);
          this.totalElements.set(response.totalElements ?? response.content.length);
          this.totalPages.set(response.totalPages ?? 1);
        } else {
          this.applyClientPagination(response.content);
        }

        if (response.exactBarcode && response.exactProduct) {
          const p = response.exactProduct;
          const qty = response.forcedQty ?? 1;

          if (p.stockQty > 0) {
            for (let i = 0; i < qty; i++) this.addToCart(p);

            this.beepSuccess();

            const input = this.searchInput()?.nativeElement;
            if (input) { input.value = ''; input.dispatchEvent(new Event('input')); }
            this.productSearchSubject.next('');

            if (qty > 1) this.snackBar.open(`${qty}x ${p.name} adicionado(s)!`, '', { duration: 1200 });
          } else {
            this.showWarning(`Produto "${p.name}" sem estoque.`);
          }
        }

        this.isLoading.set(false);
      },
      error: () => { this.isLoading.set(false); this.filteredProducts.set([]); }
    });
    }

    showDetails(emb: any) { this.selectedEmbroideryDetail.set(emb); this.isDetailVisible.set(true); }
    closeDetails() { this.isDetailVisible.set(false); setTimeout(() =>
      this.selectedEmbroideryDetail.set(null), 200); }

    preparePayment() {
      if (!this.selectedCustomer()) { this.showWarning('Por favor, selecione um cliente antes de finalizar a venda.'); return; }
      if (this.cart().length === 0)  { this.snackBar.open('Carrinho vazio!', 'Aviso', { duration: 2000 }); return; }
      const sessionId = this.activeSessionId();
      if (!sessionId) { this.showError('Nenhum caixa aberto encontrado!'); return; }

  const saleRequest: SaleRequest = {
    customerId: this.selectedCustomer()?.id || null,
    cashSessionId: sessionId,
    discountType: this.discountType() === 'percent' ? 'PERCENTAGE' : 'FIXED',
    discountValue: this.discountInput(),
    items: this.cart().map(item => ({
      productId:    item.isEmbroidery ? null : item.product.id,
      embroideryId: item.isEmbroidery ? (item.embroideryId ?? null) : null,
      quantity:     item.quantity,
      manualPrice:  item.isEmbroidery ? item.product.price : null,
      description:  item.product.name
    }))
  };

  this.isLoading.set(true);
  const action$ = this.activeSaleId()
    ? this.saleService.update(this.activeSaleId()!, saleRequest)
    : this.saleService.createSale(saleRequest);

    action$.pipe(take(1)).subscribe({
        next: (sale: SaleResponse) => {
      this.activeSaleId.set(sale.id);
      this.pdvService.patch({ activeSaleId: sale.id });

      this.paymentData.set(null);
      this.isPaymentModalOpen.set(false);

      setTimeout(() => {
        this.paymentData.set({
          saleId: sale.id,
          totalAmount: this.totalWithDiscount(),
          customerName: this.selectedCustomer()?.name || 'Consumidor Final',
          items: this.cart().map(i => ({
            name: i.product.name,
            qty: i.quantity,
            price: i.product.price,
            total: i.total
          }))
        });
        this.isPaymentModalOpen.set(true);
        this.isLoading.set(false);
      }, 50);
    },
    error: (err) => {
      this.isLoading.set(false);
      const msg = err?.error?.message;
      if (err?.status === 422 && msg) {
        this.showError(msg);
      } else {
        this.showError('Erro ao gerar venda para pagamento.');
      }
    }
  });
  }

    handlePaymentProcessed(response: any) {
    this.snackBar.open('Venda finalizada e paga com sucesso!', 'OK', { duration: 3000 });
    this.resetPDV();
    this.isPaymentModalOpen.set(false);
    this.paymentData.set(null);
    setTimeout(() => this.searchInput()?.nativeElement.focus(), 100);
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
      this.snackBar.open(message, 'Fechar', { duration: 4000 });
    }

    pageRangeEnd(): number {
    return Math.min((this.currentPage() + 1) * this.pageSize(), this.totalElements());
    }
  }
