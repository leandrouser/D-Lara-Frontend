import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

export interface SaleDetails {
  id: number;
  dateSale: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  items: Array<{
    id: number;
    productId: number;
    productName: string;
    productPrice: number;
    quantity: number;
    total: number;
  }>;
  subtotal: number;
  discount: number;
  total: number;
  saleStatus: string;
}

@Component({
  selector: 'app-sale-details-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './sale-modal.html',
  styleUrls: ['./sale-modal.scss']
})
export class SaleModal {
  @Input() title: string = 'Detalhes da Venda';
  open = signal(false);

  @Input() set isOpen(value: boolean) {
    this.open.set(value);
  }

  @Input() saleData: SaleDetails | null = null;

  @Output() close = new EventEmitter<void>();

  getStatusText(status: string): string {
    const statusMap: { [key: string]: string } = {
      'PENDING': 'Pendente',
      'PAID': 'Paga',
      'CANCELLED': 'Cancelada'
    };
    return statusMap[status] || status;
  }

  getStatusClass(status: string): string {
    const statusClassMap: { [key: string]: string } = {
      'PENDING': 'pending',
      'PAID': 'paid',
      'CANCELLED': 'cancelled'
    };
    return statusClassMap[status] || 'pending';
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }

  closeModal() {
    this.close.emit();
  }
}