import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, inject, signal, computed, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { CustomerService, CustomerResponse, CustomerPaymentReceiptResponse, PaymentSplitRequest } from '../../../../core/service/customer.service';
import { PrintService } from '../../../../core/service/print.service';
import { PaymentMethodResponse, PaymentService } from '../../../../core/service/payment.service';

interface FiadoPaymentItem {
  methodId: number;
  methodCode: string;
  methodName: string;
  amount: number;
  isChange?: boolean;
}

@Component({
  selector: 'fiado-payment-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './fiado-payment.modal.html',
  styleUrls: ['./fiado-payment.modal.scss']
})
export class FiadoPaymentModal implements OnChanges {
  private customerService = inject(CustomerService);
  private paymentService = inject(PaymentService);
  private printService = inject(PrintService);

  @Input() isOpen = false;
  @Input() customer: CustomerResponse | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() paymentRegistered = new EventEmitter<void>();
  @ViewChild('amountInput') amountInputRef?: ElementRef<HTMLInputElement>;

  paymentMethods = signal<PaymentMethodResponse[]>([]);
  currentPaymentMethodId = signal<number | null>(null);
  currentAmount = signal<number>(0);
  paymentItems = signal<FiadoPaymentItem[]>([]);

  isProcessing = signal(false);
  paymentSuccess = signal(false);
  errorMessage = signal('');
  lastReceipt = signal<CustomerPaymentReceiptResponse | null>(null);

  get maxAmount(): number {
    return this.customer?.debtBalance ?? 0;
  }

  totalPaid = computed(() =>
    this.paymentItems().reduce((sum, i) => sum + i.amount, 0)
  );

  remainingAmount = computed(() => {
    const remaining = this.maxAmount - this.totalPaid();
    return remaining > 0 ? remaining : 0;
  });

  totalChange = computed(() => {
    const excess = this.totalPaid() - this.maxAmount;
    return excess > 0 ? excess : 0;
  });

  displayItems = computed(() => {
    const items: FiadoPaymentItem[] = [...this.paymentItems()];
    const change = this.totalChange();
    if (change > 0) {
      items.push({ methodId: -1, methodCode: '', methodName: 'Troco', amount: change, isChange: true });
    }
    return items;
  });

  isFullyPaid = computed(() =>
    this.paymentItems().length > 0 && this.totalPaid() >= this.maxAmount
  );

  canProcessPayment = computed(() =>
    this.paymentItems().length > 0 && this.totalPaid() > 0 && !this.isProcessing() && !this.paymentSuccess()
  );

  currentPaymentMethodCode(): string | null {
    const id = this.currentPaymentMethodId();
    return this.paymentMethods().find(m => m.id === id)?.code ?? null;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']?.currentValue === true) {
      this.resetForm();
      this.loadPaymentMethods();
    }
  }

  private loadPaymentMethods() {
    this.paymentService.listPaymentMethods().subscribe({
      next: (methods) => {
        // Fiado não paga fiado: remove A_PRAZO das opções de recebimento
        const available = methods.filter(m => m.code !== 'A_PRAZO' && m.active);
        this.paymentMethods.set(available);

        // Pré-seleciona Dinheiro (ou o primeiro disponível) e preenche com o saldo devedor
        const defaultMethod = available.find(m => m.code === 'DINHEIRO') ?? available[0] ?? null;
        this.currentPaymentMethodId.set(defaultMethod?.id ?? null);
        this.currentAmount.set(this.maxAmount);

        this.focusAndSelectAmount();
      },
      error: (err) => console.error('Erro ao carregar métodos de pagamento', err)
    });
  }

  onAmountEnter() {
    if (this.currentAmount() <= 0 || !this.currentPaymentMethodId()) return;

    this.addPaymentMethod();

    if (this.isFullyPaid() && !this.isProcessing()) {
      this.submitPayment();
    }
  }

  selectCurrentPaymentMethod(methodId: number) {
    this.currentPaymentMethodId.set(methodId);
    this.focusAndSelectAmount();
  }

  updateCurrentAmount(rawValue: string | number) {
    const normalized = String(rawValue).replace(',', '.').replace(/[^\d.]/g, '');
    const amount = normalized === '' ? 0 : parseFloat(normalized);
    this.currentAmount.set(isNaN(amount) ? 0 : amount);
  }

  addPaymentMethod() {
    const methodId = this.currentPaymentMethodId();
    const amount = this.currentAmount();

    if (!methodId || amount <= 0) return;

    const method = this.paymentMethods().find(m => m.id === methodId);
    if (!method) return;

    this.paymentItems.update(items => [...items, {
      methodId: method.id,
      methodCode: method.code,
      methodName: method.displayName,
      amount
    }]);

    this.currentAmount.set(0);
    this.errorMessage.set('');
  }

  removePaymentMethod(index: number) {
    this.paymentItems.update(items => items.filter((_, i) => i !== index));
  }

  getPaymentMethodText(method: PaymentMethodResponse): string {
    return method.displayName;
  }

  submitPayment() {
    if (!this.customer) return;

    if (this.paymentItems().length === 0) {
      this.errorMessage.set('Adicione ao menos uma forma de pagamento.');
      return;
    }

    this.errorMessage.set('');
    this.isProcessing.set(true);

    const payments: PaymentSplitRequest[] = this.paymentItems().map(i => ({
      paymentMethodId: i.methodId,
      amountPaid: i.amount
    }));

    this.customerService.registerPayment({
      customerId: this.customer.id,
      payments
    }).subscribe({
      next: (receipt) => {
        this.isProcessing.set(false);
        this.paymentSuccess.set(true);
        this.lastReceipt.set(receipt);
        this.paymentRegistered.emit();
        this.printReceipt(receipt);
      },
      error: (err) => {
        this.isProcessing.set(false);
        this.errorMessage.set(err?.message || 'Erro ao registrar pagamento.');
        console.error(err);
      }
    });
  }

  reimprimir() {
    const receipt = this.lastReceipt();
    if (receipt) this.printReceipt(receipt);
  }

  private printReceipt(receipt: CustomerPaymentReceiptResponse) {
    this.printService.imprimirPagamentoFiado(receipt).subscribe({
      error: (err) => console.error('Erro ao imprimir recibo de pagamento:', err)
    });
  }

  closeModal() {
    if (this.isProcessing()) return;
    this.resetForm();
    this.close.emit();
  }

  private resetForm() {
    this.currentPaymentMethodId.set(null);
    this.currentAmount.set(0);
    this.paymentItems.set([]);
    this.errorMessage.set('');
    this.isProcessing.set(false);
    this.paymentSuccess.set(false);
    this.lastReceipt.set(null);
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  }
  private focusAndSelectAmount() {
    setTimeout(() => {
      const input = this.amountInputRef?.nativeElement;
      if (input) {
        input.focus();
        input.select();
      }
    });
  }
}