import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { PaymentMethodRequest, PaymentService } from '../../../../core/service/payment.service';

@Component({
  selector: 'app-payment-method-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, 
    MatFormFieldModule, MatInputModule, MatButtonModule, MatCheckboxModule
  ],
  templateUrl: './payment-method-dialog.html',
  styleUrls: ['./payment-method-dialog.scss']
})
export class PaymentMethodDialog implements OnInit {
  private dialogRef = inject(MatDialogRef<PaymentMethodDialog>);
  private service = inject(PaymentService);
  public data = inject(MAT_DIALOG_DATA); // Dados recebidos para edição

  isEdit = false;
  method: PaymentMethodRequest = {
    code: '', displayName: '', description: '', 
    active: true, allowsChange: false, allowsInstallments: false
  };

  ngOnInit() {
    if (this.data) {
      this.isEdit = true;
      this.method = { ...this.data }; // Clone para não editar a lista original sem salvar
    }
  }

  onSave() {
    const obs$ = this.isEdit 
      ? this.service.update(this.data.id, this.method)
      : this.service.createMethod(this.method);

    obs$.subscribe({
      next: () => this.dialogRef.close(true),
      error: (err) => alert("Erro ao processar operação")
    });
  }

  onCancel() { this.dialogRef.close(); }
}