import { Component, Inject, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { HttpErrorResponse } from '@angular/common/http';

import { 
  PaymentMethodResponse, 
  PaymentMethodRequest, 
  PaymentService 
} from '../../../../core/service/payment.service';

@Component({
  selector: 'payment-method-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule
  ],
  templateUrl: './payment-method-dialog.html',
  styleUrls: ['./payment-method-dialog.scss']
})
export class PaymentMethodDialog {
  private service = inject(PaymentService);
  private dialogRef = inject(MatDialogRef<PaymentMethodDialog>);

  // ✅ Signal para os dados do formulário
  method = signal<PaymentMethodRequest>({
    code: '',
    displayName: '',
    description: '',
    active: true,
    allowsChange: false,
    allowsInstallments: false
  });

  // Estados
  isLoading = signal(false);
  isEdit: boolean = false;
  private data?: PaymentMethodResponse;

  constructor(@Inject(MAT_DIALOG_DATA) data?: PaymentMethodResponse) {
    if (data) {
      this.isEdit = true;
      this.data = data;
      // Preenche o signal com os dados do cliente
      this.method.set({
        code: data.code,
        displayName: data.displayName,
        description: data.description,
        active: data.active,
        allowsChange: data.allowsChange,
        allowsInstallments: data.allowsInstallments
      });
    }
  }

  /**
   * Salva o método de pagamento (cria ou atualiza)
   */
  onSave(): void {
    const currentMethod = this.method();

    // Validações
    if (!currentMethod.code?.trim()) {
      alert('Código é obrigatório');
      return;
    }
    if (!currentMethod.displayName?.trim()) {
      alert('Nome é obrigatório');
      return;
    }

    this.isLoading.set(true);

    const obs$ = this.isEdit && this.data
      ? this.service.updateMethod(this.data.id, currentMethod)
      : this.service.createMethod(currentMethod);

    obs$.subscribe({
      next: () => {
        this.dialogRef.close(true);
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading.set(false);
        const errorMessage = err.error?.message || 'Erro ao processar operação';
        alert(errorMessage);
        console.error('Erro:', err);
      }
    });
  }

  /**
   * Cancela e fecha o modal
   */
  onCancel(): void {
    this.dialogRef.close(false);
  }

  /**
   * Atualiza um campo específico do formulário
   * ✅ Este método é essencial para o two-way binding funcionar
   */
  updateField(key: keyof PaymentMethodRequest, value: any): void {
    this.method.update(current => ({
      ...current,
      [key]: value
    }));
  }
}