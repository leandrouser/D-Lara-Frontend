import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { CustomerService, CustomerResponse, CustomerPaymentReceiptResponse } from '../../../../core/service/customer.service';
import { PrintService } from '../../../../core/service/print.service';
import { PaymentMethodResponse, PaymentService } from '../../../../core/service/payment.service';

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

  paymentMethods = signal<PaymentMethodResponse[]>([]);
  selectedMethodId = signal<number | null>(null);
  amount = signal<number>(0);

  isLoading = signal(false);
  errorMessage = signal('');

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
        this.paymentMethods.set(methods.filter(m => m.code !== 'A_PRAZO' && m.active));
      },
      error: (err) => console.error('Erro ao carregar métodos de pagamento', err)
    });
  }

  get maxAmount(): number {
    return this.customer?.debtBalance ?? 0;
  }

  setFullAmount() {
    this.amount.set(this.maxAmount);
  }

  submitPayment() {
    if (!this.customer) return;

    const value = Number(this.amount());

    if (!this.selectedMethodId()) {
      this.errorMessage.set('Selecione uma forma de pagamento.');
      return;
    }

    if (value <= 0) {
      this.errorMessage.set('Informe um valor válido.');
      return;
    }

    if (value > this.maxAmount) {
      this.errorMessage.set('O valor não pode ser maior que o saldo devedor.');
      return;
    }

    this.errorMessage.set('');
    this.isLoading.set(true);

    this.customerService.registerPayment({
      customerId: this.customer.id,
      amount: value,
      paymentMethodId: this.selectedMethodId()!
    }).subscribe({
      next: (receipt) => {
        this.isLoading.set(false);
        this.paymentRegistered.emit();
        this.printReceipt(receipt);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err?.message || 'Erro ao registrar pagamento.');
        console.error(err);
      }
    });
  }

  private printReceipt(receipt: CustomerPaymentReceiptResponse) {
    this.printService.imprimirPagamentoFiado(receipt).subscribe({
      error: (err) => console.error('Erro ao imprimir recibo de pagamento:', err)
    });
  }

  closeModal() {
    if (this.isLoading()) return;
    this.resetForm();
    this.close.emit();
  }

  private resetForm() {
    this.selectedMethodId.set(null);
    this.amount.set(0);
    this.errorMessage.set('');
    this.isLoading.set(false);
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  }
}
