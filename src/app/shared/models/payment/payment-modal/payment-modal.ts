import {
  Component, EventEmitter, Input, Output,
  inject, signal, computed, OnChanges, OnInit,
  ViewChild, ElementRef, HostListener
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import {
  PaymentMethodResponse,
  PaymentResponse,
  PaymentService,
  PaymentMultiRequest
} from '../../../../core/service/payment.service';
import { PrintService } from '../../../../core/service/print.service';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

export interface PaymentData {
  saleId: number;
  totalAmount: number;
  customerName: string;
  items?: PaymentItemSummary[];
}

export interface PaymentItemSummary {
  name: string;
  qty: number;
  price: number;
  total: number;
}

export interface PaymentMethodSplit {
  method: string;
  amount: number;
  isChange: boolean;
}

@Component({
  selector: 'payment-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatSnackBarModule],
  templateUrl: './payment-modal.html',
  styleUrls: ['./payment-modal.scss']
})
export class PaymentModal implements OnChanges, OnInit {
  private paymentService = inject(PaymentService);
  private printService = inject(PrintService);
  private snackBar = inject(MatSnackBar);

  dbPaymentMethods = signal<PaymentMethodResponse[]>([]);

  paymentMethods = ['DINHEIRO', 'CARTAO_DE_CREDITO', 'CARTAO_DE_DEBITO', 'PIX'] as const;

  @Input() paymentData: PaymentData | null = null;
  @Input() isOpen: boolean = false;

  @Output() paymentProcessed = new EventEmitter<PaymentResponse>();
  @Output() close = new EventEmitter<void>();

  @ViewChild('amountInput') amountInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('confirmBtn') confirmBtnRef!: ElementRef<HTMLButtonElement>;

  selectedPaymentMethods = signal<PaymentMethodSplit[]>([]);
  currentPaymentMethod = signal<string>('DINHEIRO');
  currentAmount = signal<number>(0);

  isProcessing = signal(false);
  paymentSuccess = signal<PaymentResponse | null>(null);
  lastCupom = signal<any>(null);
  paymentResponses = signal<PaymentResponse[]>([]);

  totalPaid = computed(() =>
    this.selectedPaymentMethods()
      .filter(pm => !pm.isChange)
      .reduce((sum, pm) => sum + pm.amount, 0)
  );

  totalChange = computed(() =>
    this.selectedPaymentMethods()
      .filter(pm => pm.isChange)
      .reduce((sum, pm) => sum + Math.abs(pm.amount), 0)
  );

  remainingAmount = computed(() => {
    if (!this.paymentData) return 0;
    return Math.max(0, this.paymentData.totalAmount - this.totalPaid());
  });

  isFullyPaid = computed(() =>
    this.round2(this.totalPaid()) >= this.round2(this.paymentData?.totalAmount || 0)
);

  canAddMorePayments = computed(() => {
    if (this.isProcessing()) return false;
    if (this.remainingAmount() > 0) return true;
    return this.currentPaymentMethod() === 'DINHEIRO';
  });

  requiredChange = computed(() => this.totalChange());

  canProcessPayment = computed(() => {
    if (this.isProcessing()) return false;
    if (!this.isFullyPaid()) return false;
    return !this.selectedPaymentMethods().some(pm => pm.method !== 'DINHEIRO' && pm.isChange);
  });

  @HostListener('window:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent) {
    if (!this.isOpen) return;

    if (event.key === 'F2') {
      event.preventDefault();
      if (this.canProcessPayment()) {
        this.processPayments();
      }
    }
  }

  ngOnInit() {
    this.loadPaymentMethods();
  }

  ngOnChanges() {
    if (this.isOpen && this.paymentData) {
      this.resetForm();
      this.currentAmount.set(this.round2(this.paymentData.totalAmount));
      this.loadPaymentMethods();
      setTimeout(() => this.focusAmountInput(), 100);
    }
  }

  loadPaymentMethods() {
    this.paymentService.listPaymentMethods().subscribe({
      next: methods => this.dbPaymentMethods.set(methods),
      error: err => console.error('Erro ao carregar métodos', err)
    });
  }

  addPaymentMethod() {
    if (this.currentAmount() <= 0) return;

    const isCash = this.currentPaymentMethod() === 'DINHEIRO';
    const effectiveAmount = this.round2(Math.min(this.currentAmount(), this.remainingAmount()));

    if (effectiveAmount <= 0) return;

    const change = isCash
      ? this.round2(Math.max(0, this.currentAmount() - this.remainingAmount()))
      : 0;

    this.selectedPaymentMethods.update(methods => [
      ...methods.filter(pm => !pm.isChange),
      { method: this.currentPaymentMethod(), amount: effectiveAmount, isChange: false }
    ]);

    if (change > 0) {
      this.selectedPaymentMethods.update(methods => [
        ...methods,
        { method: 'DINHEIRO', amount: -change, isChange: true }
      ]);
    }

    this.currentAmount.set(this.round2(this.remainingAmount()));

    setTimeout(() => {
      if (this.isFullyPaid()) {
        this.confirmBtnRef?.nativeElement.focus();
      } else {
        this.focusAmountInput();
      }
    }, 50);
  }

  private focusAmountInput() {
    const input = this.amountInputRef?.nativeElement;
    if (input) {
      input.focus();
      input.select();
    }
  }

  addChangePayment(amount: number) {
    if (amount <= 0) return;
    this.selectedPaymentMethods.update(methods => [
      ...methods,
      { method: 'DINHEIRO', amount: -amount, isChange: true }
    ]);
  }

  removePaymentMethod(index: number) {
    const removed = this.selectedPaymentMethods()[index];

    this.selectedPaymentMethods.update(methods => {
      const withoutRemoved = methods.filter((_, i) => i !== index);
      if (removed.method === 'DINHEIRO' && !removed.isChange) {
        return withoutRemoved.filter(pm => !pm.isChange);
      }
      return withoutRemoved;
    });

    const cashEntry = this.selectedPaymentMethods().find(
      pm => pm.method === 'DINHEIRO' && !pm.isChange
    );
    if (cashEntry) {
      const newChange = this.round2(Math.max(0, cashEntry.amount - this.remainingAmount()));
      this.selectedPaymentMethods.update(methods => methods.filter(pm => !pm.isChange));
      if (newChange > 0) {
        this.addChangePayment(newChange);
      }
    }

    this.currentAmount.set(this.round2(this.remainingAmount()));
  }

  selectCurrentPaymentMethod(method: string) {
    this.currentPaymentMethod.set(method as 'DINHEIRO' | 'CARTAO_DE_CREDITO' | 'CARTAO_DE_DEBITO' | 'PIX');
    this.currentAmount.set(this.round2(this.remainingAmount()));
    setTimeout(() => this.focusAmountInput(), 50);
  }

  // Atualiza valor arredondando para 2 casas
  updateCurrentAmount(value: number) {
    this.currentAmount.set(this.round2(Math.max(0, value || 0)));
  }

  // Impede digitação de mais de 2 casas decimais no input
  onAmountInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const raw = input.value;

    const dotIndex = raw.indexOf('.');
    if (dotIndex !== -1 && raw.length - dotIndex > 3) {
      input.value = parseFloat(raw).toFixed(2);
    }

    const parsed = parseFloat(input.value) || 0;
    this.currentAmount.set(this.round2(Math.max(0, parsed)));
  }

  async processPayments() {
    if (!this.paymentData || this.isProcessing() || !this.isFullyPaid()) return;

    if (this.dbPaymentMethods().length === 0) {
      await new Promise<void>((resolve, reject) => {
        this.paymentService.listPaymentMethods().subscribe({
          next: methods => { this.dbPaymentMethods.set(methods); resolve(); },
          error: reject
        });
      });
    }

    const methodsNotFound = this.selectedPaymentMethods()
      .filter(pm => !pm.isChange)
      .filter(pm => !this.dbPaymentMethods().find(m => m.code === pm.method));

    if (methodsNotFound.length > 0) {
      alert(`Método(s) não reconhecido(s): ${methodsNotFound.map(m => m.method).join(', ')}`);
      return;
    }

    this.isProcessing.set(true);

    const requestBody: PaymentMultiRequest = {
      saleId: this.paymentData.saleId,
      payments: this.selectedPaymentMethods()
        .filter(pm => !pm.isChange)
        .map(pm => ({
          paymentMethodId: this.getPaymentMethodId(pm.method),
          amountPaid: pm.amount
        }))
    };

    try {
      const response = await new Promise<any>((resolve, reject) => {
        this.paymentService.processMultiPayment(requestBody).subscribe({ next: resolve, error: reject });
      });

      if (response.cupom) {
        this.lastCupom.set(response.cupom);
      }

      if (response.saleCompleted && response.cupom) {
        this.printService.imprimir(response.cupom).subscribe({
          next: () => console.log('Cupom enviado para impressão'),
          error: () => this.snackBar.open(
            'Venda finalizada, mas erro ao imprimir o cupom. Reimprima manualmente.',
            'Reimprimir',
            { duration: 6000, panelClass: ['warn-snackbar'] }
          ).onAction().subscribe(() => this.reimprimir())
        });
      }

      this.paymentProcessed.emit(response);
      this.paymentSuccess.set(response);
      setTimeout(() => this.closeModal(), 2000);

    } catch (e) {
      console.error('Erro ao processar pagamento múltiplo:', e);
      alert('Erro ao processar pagamento.');
    } finally {
      this.isProcessing.set(false);
    }
  }

  validatePayments(): { valid: boolean; error?: string } {
    const methods = this.selectedPaymentMethods()
      .filter(pm => !pm.isChange)
      .map(pm => pm.method);

    const hasDuplicates = methods.length !== new Set(methods).size;
    if (hasDuplicates) {
      return { valid: false, error: 'Não é permitido adicionar o mesmo método de pagamento duas vezes' };
    }

    const nonCashMethods = this.selectedPaymentMethods()
      .filter(pm => pm.method !== 'DINHEIRO' && pm.isChange);

    if (nonCashMethods.length > 0) {
      return { valid: false, error: 'Apenas dinheiro pode gerar troco' };
    }

    return { valid: true };
  }

  private getPaymentMethodId(methodCode: string): number {
    const method = this.dbPaymentMethods().find(m => m.code === methodCode);
    if (!method) {
      console.error(`Método ${methodCode} não encontrado no banco!`);
      return 0;
    }
    return method.id;
  }

  getPaymentMethodText(method: string) {
    const map: Record<string, string> = {
      'DINHEIRO': 'Dinheiro',
      'CARTAO_DE_CREDITO': 'Crédito',
      'CARTAO_DE_DEBITO': 'Débito',
      'PIX': 'PIX'
    };
    return map[method] || method;
  }

  formatPrice(price: number) {
    return isNaN(price) ? 'R$ 0,00' :
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(price));
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  closeModal() {
    this.resetForm();
    this.close.emit();
  }

  reimprimir() {
    const cupom = this.lastCupom();
    if (!cupom) return;
    this.printService.imprimir(cupom).subscribe({
      next: () => this.snackBar.open('Cupom enviado para impressão!', '', { duration: 2000 }),
      error: () => this.snackBar.open('Erro ao reimprimir. Verifique a impressora.', 'Fechar', { duration: 5000 })
    });
  }

  private resetForm() {
    this.selectedPaymentMethods.set([]);
    this.currentPaymentMethod.set('DINHEIRO');
    this.currentAmount.set(0);
    this.isProcessing.set(false);
    this.paymentSuccess.set(null);
  }
}