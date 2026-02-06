import { Component, EventEmitter, Input, Output, inject, signal, computed, OnChanges, OnInit } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { 
  PaymentMethodResponse, 
  PaymentResponse, 
  PaymentService, 
  PaymentMultiRequest 
} from '../../../../core/service/payment.service';

// Dados que o PDV envia para o modal
export interface PaymentData {
  saleId: number;
  totalAmount: number;
  customerName: string;
  items?: PaymentItemSummary[];
}

// Resumo dos itens (somente exibição)
export interface PaymentItemSummary {
  name: string;
  qty: number;
  price: number;
  total: number;
}

// Controle interno de split de pagamento
export interface PaymentMethodSplit {
  method: 'DINHEIRO' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO' | 'PIX';
  amount: number;
  isChange: boolean;
}

@Component({
  selector: 'payment-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './payment-modal.html',
  styleUrls: ['./payment-modal.scss']
})
export class PaymentModal implements OnChanges, OnInit {
  private paymentService = inject(PaymentService);

  // Armazena os métodos reais do banco
  dbPaymentMethods = signal<PaymentMethodResponse[]>([]);
paymentMethods = ['DINHEIRO', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'PIX'] as const;

  @Input() paymentData: PaymentData | null = null;
  @Input() isOpen: boolean = false;   
  
  @Output() paymentProcessed = new EventEmitter<PaymentResponse>();
  @Output() close = new EventEmitter<void>();

  // Métodos de pagamento selecionados
  selectedPaymentMethods = signal<PaymentMethodSplit[]>([]);
  
  // Método atual sendo configurado
currentPaymentMethod = signal<'DINHEIRO' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO' | 'PIX'>('DINHEIRO');
  currentAmount = signal<number>(0);
  
  // Estados
  isProcessing = signal(false);
  paymentSuccess = signal<PaymentResponse | null>(null);
  paymentResponses = signal<PaymentResponse[]>([]);

  // Computed values
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

    // Troco
    if (this.currentPaymentMethod() === 'DINHEIRO' && this.requiredChange() > 0) {
      this.selectedPaymentMethods.update(methods => methods.filter(pm => !pm.isChange));
      this.addChangePayment(this.requiredChange());
    }

    this.currentAmount.set(this.remainingAmount());
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

  selectCurrentPaymentMethod(method: 'DINHEIRO' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO' | 'PIX') {
    this.currentPaymentMethod.set(method);
    this.currentAmount.set(this.remainingAmount());
  }

  updateCurrentAmount(amount: number) {
    this.currentAmount.set(Math.max(0, amount || 0));
  }

  async processPayments() {
    if (!this.paymentData || this.isProcessing() || !this.isFullyPaid()) return;

    this.isProcessing.set(true);

    const requestBody: PaymentMultiRequest = {
    saleId: this.paymentData.saleId,
    totalAmount: this.paymentData.totalAmount,
    changeAmount: this.totalChange(),
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
  
  // Validar que métodos que não permitem troco não gerem troco
  const hasCashWithChange = this.selectedPaymentMethods().some(pm => 
    pm.method !== 'DINHEIRO' && pm.isChange
  );
  
  return !hasCashWithChange;
});

validatePayments(): { valid: boolean; error?: string } {
  // Validar duplicatas de método
  const methods = this.selectedPaymentMethods()
    .filter(pm => !pm.isChange)
    .map(pm => pm.method);
  
  const hasDuplicates = methods.length !== new Set(methods).size;
  if (hasDuplicates) {
    return { valid: false, error: 'Não é permitido adicionar o mesmo método de pagamento duas vezes' };
  }

  // Validar que crédito/débito/PIX não geram troco
  const nonCashMethods = this.selectedPaymentMethods()
    .filter(pm => pm.method !== 'DINHEIRO' && pm.isChange);
  
  if (nonCashMethods.length > 0) {
    return { valid: false, error: 'Apenas dinheiro pode gerar troco' };
  }

  return { valid: true };
}

  private getPaymentMethodId(methodCode: string): number {
  const manualMap: Record<string, number> = {
    'DINHEIRO': 1,
    'PIX': 2,
    'CARTAO_CREDITO': 3,
    'CARTAO_DEBITO': 4
  };
  const id = manualMap[methodCode];
  if (!id) {
    console.error(`Método ${methodCode} não mapeado no frontend!`);
    return 1;
  }
  return id;
}

  getPaymentMethodText(method: string) {
  const map: Record<string, string> = { 
    'DINHEIRO': 'Dinheiro', 
    'CARTAO_CREDITO': 'Crédito', 
    'CARTAO_DEBITO': 'Débito', 
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

  private resetForm() {
    this.selectedPaymentMethods.set([]);
    this.currentPaymentMethod.set('DINHEIRO');
    this.currentAmount.set(0);
    this.isProcessing.set(false);
    this.paymentSuccess.set(null);
  }
}
