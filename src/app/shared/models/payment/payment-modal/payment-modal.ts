import { Component, EventEmitter, Input, Output, inject, signal, computed, OnChanges, OnInit } from '@angular/core';
import { PdvService } from '../../../../core/service/pdv.service';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { PaymentMethodResponse, PaymentResponse, PaymentService } from '../../../../core/service/payment.service';

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
  method: 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'PIX';
  amount: number;
  isChange: boolean; // true = troco
}


@Component({
  selector: 'payment-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './payment-modal.html',
  styleUrls: ['./payment-modal.scss']
})
export class PaymentModal implements OnChanges, OnInit {
  private pvdService = inject(PdvService);
  private methodService = inject(PaymentService);


  // Armazena os métodos reais do banco
  dbPaymentMethods = signal<PaymentMethodResponse[]>([]);

  @Input() paymentData: PaymentData | null = null;
  @Input() isOpen: boolean = false;   
  
  @Output() paymentProcessed = new EventEmitter<PaymentResponse>();
  @Output() close = new EventEmitter<void>();

  // Métodos de pagamento selecionados
  selectedPaymentMethods = signal<PaymentMethodSplit[]>([]);
  
  // Método atual sendo configurado
  currentPaymentMethod = signal<'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'PIX'>('CASH');
  currentAmount = signal<number>(0);
  
  // Estados
  isProcessing = signal(false);
  paymentSuccess = signal<PaymentResponse | null>(null);
  paymentResponses = signal<PaymentResponse[]>([]);

  // Array de métodos disponíveis
  readonly paymentMethods = ['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'PIX'] as const;

  // Computed values
  totalPaid = computed(() => {
    return this.selectedPaymentMethods()
      .filter(pm => !pm.isChange)
      .reduce((sum, pm) => sum + pm.amount, 0);
  });

  totalChange = computed(() => {
    return this.selectedPaymentMethods()
      .filter(pm => pm.isChange)
      .reduce((sum, pm) => sum + Math.abs(pm.amount), 0);
  });

  netAmount = computed(() => {
    return this.totalPaid() - this.totalChange();
  });

  remainingAmount = computed(() => {
    if (!this.paymentData) return 0;
    return Math.max(0, this.paymentData.totalAmount - this.totalPaid());
  });

  isFullyPaid = computed(() => {
    return this.totalPaid() >= (this.paymentData?.totalAmount || 0);
  });

  canAddMorePayments = computed(() => {
    // Permite adicionar se ainda falta pagar OU se quer adicionar dinheiro para gerar troco
    if (this.isProcessing()) return false;
    if (this.remainingAmount() > 0) return true;
    // Se já está pago, só permite se o método atual for dinheiro (para calcular troco)
    return this.currentPaymentMethod() === 'CASH'; 
  });

  // Troco necessário para pagamentos em dinheiro
  requiredChange = computed(() => {
    if (!this.paymentData) return 0;
    
    const cashPayments = this.selectedPaymentMethods()
      .filter(pm => pm.method === 'CASH' && !pm.isChange)
      .reduce((sum, pm) => sum + pm.amount, 0);
    
    const totalCashPaid = cashPayments;
    const totalNonCashPaid = this.totalPaid() - cashPayments;
    const remainingAfterNonCash = Math.max(0, this.paymentData.totalAmount - totalNonCashPaid);
    
    return Math.max(0, totalCashPaid - remainingAfterNonCash);
  });

  ngOnInit() {
    this.loadPaymentMethods();
  }

  loadPaymentMethods() {
    this.methodService.listAll().subscribe({
      next: (methods) => {
        console.log("Métodos carregados:", methods); // Debug para conferir os IDs
        this.dbPaymentMethods.set(methods);
      },
      error: (err) => console.error("Erro ao carregar métodos", err)
    });
  }


  ngOnChanges() {
    if (this.isOpen && this.paymentData) {
      this.resetForm();
      this.currentAmount.set(this.paymentData.totalAmount);
    }
  }

  addPaymentMethod() {
    if (this.currentAmount() <= 0) return;

    const amountToAdd = this.currentAmount();
    
    // Para métodos não em dinheiro, limita ao valor restante
    if (this.currentPaymentMethod() !== 'CASH') {
      const adjustedAmount = Math.min(amountToAdd, this.remainingAmount());
      if (adjustedAmount <= 0) {
        alert('Valor deve ser maior que zero e não pode exceder o faltante');
        return;
      }
    }

    // Adiciona o pagamento
    this.selectedPaymentMethods.update(methods => [
      ...methods,
      {
        method: this.currentPaymentMethod(),
        amount: amountToAdd,
        isChange: false
      }
    ]);
    
    // Se for dinheiro e pagou a mais, calcula e adiciona troco
    if (this.currentPaymentMethod() === 'CASH' && this.requiredChange() > 0) {
      // Remove troco antigo se existir
      this.selectedPaymentMethods.update(methods => 
        methods.filter(pm => !pm.isChange)
      );
      
      // Adiciona novo troco
      this.addChangePayment(this.requiredChange());
    }

    // Atualiza o input com o valor que ainda falta (se faltar)
    this.currentAmount.set(this.remainingAmount());
  }

  addChangePayment(amount: number) {
    if (amount <= 0) return;

    this.selectedPaymentMethods.update(methods => [
      ...methods,
      {
        method: 'CASH',
        amount: -amount, // Negativo visualmente ou tratado no display
        isChange: true
      }
    ]);
  }

  removePaymentMethod(index: number) {
    const payment = this.selectedPaymentMethods()[index];
    
    this.selectedPaymentMethods.update(methods => 
      methods.filter((_, i) => i !== index)
    );
    
    // Se removeu dinheiro, remove trocos e recalcula
    if (payment.method === 'CASH' && !payment.isChange) {
       // Remove trocos antigos
       this.selectedPaymentMethods.update(methods => methods.filter(pm => !pm.isChange));
       
       // Recalcula troco se necessário com o que sobrou
       if (this.requiredChange() > 0) {
         this.addChangePayment(this.requiredChange());
       }
    }
      
    // Recalcula o valor sugerido no input
    this.currentAmount.set(this.remainingAmount());
  }

  selectCurrentPaymentMethod(method: 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'PIX') {
    this.currentPaymentMethod.set(method);
    
    if (method !== 'CASH') {
      this.currentAmount.set(this.remainingAmount());
    } else {
      if (this.currentAmount() === 0) {
        this.currentAmount.set(this.remainingAmount());
      }
    }
  }

  updateCurrentAmount(amount: number) {
    const newAmount = Math.max(0, amount || 0);
    this.currentAmount.set(newAmount);
  }

  async processPayments() {
    if (!this.paymentData || this.isProcessing() || !this.isFullyPaid()) return;

    this.isProcessing.set(true);

    try {
      const paymentsToSend = this.selectedPaymentMethods()
        .filter(pm => !pm.isChange)
        .map(pm => ({
          paymentMethodId: this.getPaymentMethodId(pm.method),
          amountPaid: pm.amount
        }));

     const requestBody = {
        saleId: Number(this.paymentData!.saleId),
        payments: this.selectedPaymentMethods()
          .filter(pm => !pm.isChange)
          .map(pm => ({
            paymentMethodId: Number(this.getPaymentMethodId(pm.method)),
            amountPaid: Number(pm.amount)
          }))
     };

      console.log("Enviando para o Back:", requestBody);

      const response = await new Promise<any>((resolve, reject) => {
        this.pvdService.processMultiPayment(requestBody).subscribe({
          next: resolve,
          error: reject
        });
      });

      this.paymentProcessed.emit(response);
      this.paymentSuccess.set(response);
      
      // Fechar modal após 2 segundos
      setTimeout(() => this.closeModal(), 2000);

    } catch (e) {
      console.error("Erro ao processar pagamento múltiplo:", e);
      alert("Erro ao processar pagamento.");
    } finally {
      this.isProcessing.set(false);
    }
  }

  private getPaymentMethodId(code: string): number {
    const method = this.dbPaymentMethods().find(m => m.code === code);
    if (!method) {
      console.warn(`Aviso: Método ${code} não encontrado no banco. Usando ID 1.`);
      return 1;
    }
    return method.id;
  }


  getPaymentMethodText(method: string): string {
    const methods = {
      'CASH': 'Dinheiro',
      'CREDIT_CARD': 'Crédito',
      'DEBIT_CARD': 'Débito',
      'PIX': 'PIX'
    };
    return methods[method as keyof typeof methods] || method;
  }

  formatPrice(price: number): string {
    if (isNaN(price)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(Math.abs(price));
  }

  closeModal() {
    this.resetForm();
    this.close.emit();
  }

  private resetForm() {
    this.selectedPaymentMethods.set([]);
    this.currentPaymentMethod.set('CASH');
    this.currentAmount.set(0);
    this.isProcessing.set(false);
    this.paymentSuccess.set(null);
  }
}