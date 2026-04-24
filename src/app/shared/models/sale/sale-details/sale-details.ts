import { Component, signal, input, output, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PhoneFormatPipe } from '../../../pipes/phone-pipe';
import { SaleItemResponse, SaleResponse } from '../../../../core/service/sale.service';
import { PaymentService, PaymentResponse } from '../../../../core/service/payment.service';
import { PrintService, CupomRequest } from '../../../../core/service/print.service';

@Component({
  selector: 'app-sale-details-modal',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatSnackBarModule, PhoneFormatPipe],
  templateUrl: './sale-details.html',
  styleUrls: ['./sale-details.scss'],
})
export class SaleDetailsModalComponent implements OnInit {
  sale = input.required<SaleResponse>();
  onClose = output<void>();

  private paymentService = inject(PaymentService);
  private printService = inject(PrintService);
  private snackBar = inject(MatSnackBar);

  payments = signal<PaymentResponse[]>([]);
  loadingPayments = signal(true);
  isPrinting = signal(false);

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

  reimprimir() {
    if (this.isPrinting()) return;

    const sale = this.sale();
    const payments = this.payments();

    if (payments.length === 0) {
      this.snackBar.open('Nenhum pagamento encontrado para reimprimir.', 'Fechar', { duration: 3000 });
      return;
    }

    // Calcular troco (soma dos changeAmount dos pagamentos em dinheiro)
    const troco = payments.reduce((acc, p) => acc + (p.changeAmount || 0), 0);

    const cupom: CupomRequest = {
      numeroVenda: sale.id,
      dataHora: sale.dateSale,
      cliente: {
        nome: sale.customerName || 'Consumidor Final',
        telefone: sale.customerPhone || '',
      },
      itens: sale.items.map((item, index) => ({
        sequencia: index + 1,
        descricao: item.productName || item.description || 'Item',
        nomeBordado: null,
        quantidade: item.quantity,
        valorTotal: this.getItemTotal(item),
      })),
      subtotal: sale.subtotal,
      desconto: sale.discount || 0,
      total: sale.total,
      pagamentos: payments.map(p => ({
        forma: p.paymentMethod.code,
        valor: p.amountPaid,
      })),
      troco,
    };

    this.isPrinting.set(true);
    this.printService.imprimir(cupom).subscribe({
      next: () => {
        this.snackBar.open('✅ Cupom enviado para impressão!', '', { duration: 2500 });
        this.isPrinting.set(false);
      },
      error: () => {
        this.snackBar.open('❌ Erro ao imprimir. Verifique a impressora.', 'Fechar', { duration: 5000 });
        this.isPrinting.set(false);
      }
    });
  }

  closeModal() { this.onClose.emit(); }

  handleBackdropClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closeModal();
    }
  }

  formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(value || 0);
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