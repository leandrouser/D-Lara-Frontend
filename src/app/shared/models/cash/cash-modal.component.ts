import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

interface PaymentMethod {
  id: number;
  name: string;
  physicalAmount: number;
}

interface ClosingDetail {
  paymentMethodId: number;
  methodName: string;
  expectedAmount: number;
  reportedAmount: number;
  difference: number;
}

interface ClosingResult {
  sessionId: number;
  closedAt: string;
  details: ClosingDetail[];
  totalSystemExpected: number;
  totalUserReported: number;
  totalDiscrepancy: number;
  status: string;
}

@Component({
  selector: 'app-cash-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './cash-modal.component.html',
  styleUrls: ['./cash-modal.component.scss']
})
export class CashModalComponent implements OnInit, OnChanges {

  @Input() isOpen = false;
  @Input() modalType: 'OPENING' | 'CLOSING' = 'OPENING';

  @Input() session: any = null;

  @Input() paymentMethods: { id: number; name: string }[] = [];

  @Output() close = new EventEmitter<void>();

  @Output() confirm = new EventEmitter<any>();

  initialValue = 0;
  closingCounts: PaymentMethod[] = [];
  closingResult: ClosingResult | null = null;
  isClosingConfirmed = false;
  isLoading = false;

  protected Math = Math;

  ngOnInit(): void {
    if (this.modalType === 'CLOSING') {
      this.initializeClosingCounts();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']?.currentValue === true && this.modalType === 'CLOSING') {
      this.resetModal();
      this.initializeClosingCounts();
    }

    if (changes['paymentMethods'] && this.modalType === 'CLOSING' && !this.isClosingConfirmed) {
      this.initializeClosingCounts();
    }
  }

  confirmOpen(): void {
    if (this.initialValue >= 0) {
      this.confirm.emit(this.initialValue);
      this.initialValue = 0;
    }
  }

  private initializeClosingCounts(): void {
    this.closingCounts = this.paymentMethods.map(m => ({
      id: m.id,
      name: m.name,
      physicalAmount: 0
    }));
  }

  updateCount(methodId: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseFloat(input.value) || 0;
    const method = this.closingCounts.find(m => m.id === methodId);
    if (method) {
      method.physicalAmount = value;
    }
  }

  submitClosing(): void {
    const counts = this.closingCounts.map(m => ({
      paymentMethodId: m.id,
      physicalAmount: m.physicalAmount ?? 0
    }));

    this.isLoading = true;
    this.confirm.emit({ type: 'CLOSING', counts });
  }

  setClosingResult(result: ClosingResult): void {
    this.closingResult = result;
    this.isClosingConfirmed = true;
    this.isLoading = false;
  }

  closeModal(): void {
    this.resetModal();
    this.close.emit();
  }

  private resetModal(): void {
    this.initialValue = 0;
    this.closingCounts = [];
    this.closingResult = null;
    this.isClosingConfirmed = false;
    this.isLoading = false;
  }

  diffClass(difference: number): string {
    if (difference > 0) return 'positive';
    if (difference < 0) return 'negative';
    return '';
  }
}
