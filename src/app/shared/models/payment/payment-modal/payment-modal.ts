import {
  Component, EventEmitter, Input, Output,
  inject, signal, computed, OnChanges, OnInit,
  ViewChild, ElementRef, AfterViewInit
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
  currentPaymentMethod = signal<string>('DINHEIRO');  currentAmount = signal<number>(0);

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
    this.totalPaid() >= (this.paymentData?.totalAmount || 0)
  );

  canAddMorePayments = computed(() => {
    if (this.isProcessing()) return false;
    if (this.remainingAmount() > 0) return true;
    return this.currentPaymentMethod() === 'DINHEIRO';
  });

  requiredChange = computed(() => {
    if (!this.paymentData) return 0;
    const cashPaid = this.selectedPaymentMethods()
      .filter(pm => pm.method === 'DINHEIRO' && !pm.isChange)
      .reduce((sum, pm) => sum + pm.amount, 0);
    const nonCashPaid = this.totalPaid() - cashPaid;
    return Math.max(0, cashPaid - (this.paymentData.totalAmount - nonCashPaid));
  });

  ngOnInit() {
    this.loadPaymentMethods();
  }

  ngOnChanges() {
    if (this.isOpen && this.paymentData) {
      this.resetForm();
      this.currentAmount.set(this.paymentData.totalAmount);
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

    const amountToAdd = this.currentPaymentMethod() !== 'DINHEIRO'
      ? Math.min(this.currentAmount(), this.remainingAmount())
      : this.currentAmount();

    if (amountToAdd <= 0) return;

    this.selectedPaymentMethods.update(methods => [
      ...methods,
      { method: this.currentPaymentMethod(), amount: amountToAdd, isChange: false }
    ]);

    if (this.currentPaymentMethod() === 'DINHEIRO' && this.requiredChange() > 0) {
      this.selectedPaymentMethods.update(methods => methods.filter(pm => !pm.isChange));
      this.addChangePayment(this.requiredChange());
    }

    this.currentAmount.set(this.remainingAmount());

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
    this.selectedPaymentMethods.update(methods => methods.filter((_, i) => i !== index));

    if (removed.method === 'DINHEIRO' && !removed.isChange) {
      this.selectedPaymentMethods.update(methods => methods.filter(pm => !pm.isChange));
      if (this.requiredChange() > 0) this.addChangePayment(this.requiredChange());
    }

    this.currentAmount.set(this.remainingAmount());
  }

  selectCurrentPaymentMethod(method: string) {
  this.currentPaymentMethod.set(method as 'DINHEIRO' | 'CARTAO_DE_CREDITO' | 'CARTAO_DE_DEBITO' | 'PIX');
  this.currentAmount.set(this.remainingAmount());
  setTimeout(() => this.focusAmountInput(), 50);
  }

  updateCurrentAmount(amount: number) {
    this.currentAmount.set(Math.max(0, amount || 0));
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

  canProcessPayment = computed(() => {
    if (this.isProcessing()) return false;
    if (!this.isFullyPaid()) return false;

    const hasCashWithChange = this.selectedPaymentMethods().some(pm =>
      pm.method !== 'DINHEIRO' && pm.isChange
    );

    return !hasCashWithChange;
  });

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