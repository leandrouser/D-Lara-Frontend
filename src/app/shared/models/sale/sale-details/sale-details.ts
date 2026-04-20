import { Component, signal, input, output, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { PhoneFormatPipe } from '../../../pipes/phone-pipe';
import { SaleItemResponse, SaleResponse } from '../../../../core/service/sale.service';
import { PaymentService, PaymentResponse } from '../../../../core/service/payment.service';

@Component({
  selector: 'app-sale-details-modal',
  standalone: true,
  imports: [CommonModule, MatIconModule, PhoneFormatPipe],
  templateUrl: './sale-details.html',
  styleUrls: ['./sale-details.scss'],
})
export class SaleDetailsModalComponent implements OnInit {
  sale = input.required<SaleResponse>();
  onClose = output<void>();

  private paymentService = inject(PaymentService);

  payments = signal<PaymentResponse[]>([]);
  loadingPayments = signal(true);

  ngOnInit() {
    this.loadingPayments.set(true);
    this.paymentService.listPaymentsBySale(this.sale().id).subscribe({
      next: payments => {
        this.payments.set(payments);
        this.loadingPayments.set(false);
      },
      error: () => this.loadingPayments.set(false)
    });
  }

  closeModal() { this.onClose.emit(); }

  handleBackdropClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closeModal();
    }
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '---';
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(dateStr));
  }

  getStatusClass(status: string): string { return status?.toLowerCase() || 'pending'; }

  getStatusIcon(status: string): string {
    const icons: any = { 'PAID': 'check_circle', 'PENDING': 'schedule', 'CANCELLED': 'cancel' };
    return icons[status] || 'help_outline';
  }

  getStatusText(status: string): string {
    const texts: any = { 'PAID': 'Paga', 'PENDING': 'Pendente', 'CANCELLED': 'Cancelada' };
    return texts[status] || status;
  }

  getDiscountTypeText(type: string): string {
    const types: any = { 'FIXED': 'Valor Fixo', 'PERCENTAGE': 'Porcentagem' };
    return types[type] || type;
  }

  getTotalItems(): number {
    return this.sale().items?.reduce((acc, item) => acc + item.quantity, 0) || 0;
  }

  getTotalQuantity(): number { return this.getTotalItems(); }

  getItemTotal(item: SaleItemResponse): number { return item.quantity * item.productPrice; }

  getPaymentIcon(code: string): string {
    const icons: any = {
      'DINHEIRO': 'payments', 'CARTAO_CREDITO': 'credit_card',
      'CARTAO_DEBITO': 'credit_card', 'PIX': 'pix', 'CHEQUE': 'receipt',
    };
    return icons[code?.toUpperCase()] || 'attach_money';
  }
}