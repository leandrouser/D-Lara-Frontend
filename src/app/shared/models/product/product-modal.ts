import { Component, inject, ViewChild } from '@angular/core'; // Adicionei ViewChild
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms'; // Adicionei NgForm
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar'; // Opcional: para avisar que salvou
import { CategoryEnum, ProductRequest, ProductService } from '../../../core/service/product.service'; // Importe seu serviço

@Component({
  selector: 'app-product-create-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatSnackBarModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>add_box</mat-icon> Cadastrar Novo Produto
    </h2>
    <mat-dialog-content>
      <form #productForm="ngForm">

        <mat-form-field appearance="outline">
          <mat-label>Nome do Produto *</mat-label>
          <input matInput name="name" [(ngModel)]="form.name" required>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Código de Barras</mat-label>
          <input matInput name="barcode" [(ngModel)]="form.barcode">
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Descrição</mat-label>
          <textarea matInput name="description" [(ngModel)]="form.description"></textarea>
        </mat-form-field>

        <div class="form-row">
          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Preço (R$) *</mat-label>
            <input matInput name="price" type="number" [(ngModel)]="form.price" required min="0">
          </mat-form-field>

          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Estoque Inicial (un) *</mat-label>
            <input matInput name="stockQty" type="number" [(ngModel)]="form.stockQty" required min="0">
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline">
          <mat-label>Categoria *</mat-label>
          <mat-select name="categoryEnum" [(ngModel)]="form.categoryEnum" required>
            <mat-option *ngFor="let category of categories" [value]="category">
              {{ category }}
            </mat-option>
          </mat-select>
        </mat-form-field>

      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close()">Sair</button>

      <button
        mat-raised-button
        color="primary"
        [disabled]="productForm.invalid || isSaving"
        (click)="submitForm(productForm)"
      >
        <mat-icon>{{ isSaving ? 'hourglass_empty' : 'save' }}</mat-icon>
        {{ isSaving ? 'Salvando...' : 'Salvar e Continuar' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content { display: flex; flex-direction: column; gap: 10px; }
    mat-form-field { width: 100%; margin-top: 10px; }
    .form-row { display: flex; gap: 16px; }
    .half-width { flex: 1; }
    mat-dialog-title { display: flex; align-items: center; gap: 10px; font-weight: 600; color: #3f51b5; }
  `]
})
export class ProductCreateDialogComponent {
  dialogRef = inject(MatDialogRef<ProductCreateDialogComponent>);
  productService = inject(ProductService); // Injetando o serviço
  snackBar = inject(MatSnackBar); // Injetando snackbar para feedback

  isSaving = false;
  categories = Object.values(CategoryEnum);

  form: ProductRequest = this.getInitialForm();

  private getInitialForm(): ProductRequest {
    return {
      barcode: '',
      name: '',
      description: '',
      price: 0,
      stockQty: 0,
      categoryEnum: CategoryEnum.CAMA
    };
  }

  submitForm(ngForm: NgForm) {
    if (ngForm.invalid) return;

    this.isSaving = true;

    const dataToSend: ProductRequest = {
      ...this.form,
      price: Number(this.form.price),
      stockQty: Number(this.form.stockQty)
    };

    // Chamada direta ao serviço
    this.productService.create(dataToSend).subscribe({
      next: (res) => {
        this.snackBar.open('Produto cadastrado com sucesso!', 'OK', { duration: 3000 });
        this.isSaving = false;

        // RESET DO FORMULÁRIO
        ngForm.resetForm(); // Reseta as validações do HTML
        this.form = this.getInitialForm(); // Reseta os dados do objeto
      },
      error: (err) => {
        console.error(err);
        this.snackBar.open('Erro ao salvar produto.', 'Fechar', { duration: 5000 });
        this.isSaving = false;
      }
    });
  }
}
