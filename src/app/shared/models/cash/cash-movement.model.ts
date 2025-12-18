import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-cash-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  template: `
    <div class="modal-overlay" *ngIf="isOpen" (click)="closeModal()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        
        <div class="modal-header">
          <h2><mat-icon>point_of_sale</mat-icon> Abertura de Caixa</h2>
          <button class="close-btn" (click)="closeModal()">
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <div class="modal-body">
          <p>O caixa está fechado. Informe o valor inicial (Fundo de Troco) para começar a operar.</p>
          
          <div class="form-group">
            <label>Valor Inicial (R$)</label>
            <input 
              type="number" 
              [(ngModel)]="initialValue" 
              placeholder="0.00" 
              min="0"
              step="0.01"
              autofocus
              (keyup.enter)="confirmOpen()"
            >
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-cancel" (click)="closeModal()">Cancelar</button>
          <button class="btn-confirm" (click)="confirmOpen()" [disabled]="initialValue < 0">
            Abrir Caixa
          </button>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.6);
      display: flex; justify-content: center; align-items: center;
      z-index: 1000;
    }
    .modal-content {
      background: white; padding: 24px; border-radius: 8px;
      width: 400px; max-width: 90%;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .modal-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 20px;
    }
    .modal-header h2 { margin: 0; display: flex; align-items: center; gap: 10px; font-size: 1.2rem; }
    .close-btn { background: none; border: none; cursor: pointer; }
    
    .form-group { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
    .form-group input {
      padding: 10px; font-size: 1.2rem; border: 1px solid #ccc; border-radius: 4px;
    }

    .modal-footer { display: flex; justify-content: flex-end; gap: 10px; }
    button { padding: 10px 20px; border-radius: 4px; border: none; cursor: pointer; font-weight: 500; }
    .btn-cancel { background: #f5f5f5; color: #333; }
    .btn-confirm { background: #4CAF50; color: white; }
    .btn-confirm:disabled { background: #ccc; cursor: not-allowed; }
  `]
})
export class CashModalComponent {
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<number>();

  initialValue: number = 0;

  closeModal() {
    this.close.emit();
  }

  confirmOpen() {
    if (this.initialValue >= 0) {
      this.confirm.emit(this.initialValue);
      this.initialValue = 0; // Resetar após emitir
    }
  }
}