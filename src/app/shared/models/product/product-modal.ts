// src/app/pages/product/product-create-dialog/product-create-dialog.component.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CategoryEnum, ProductRequest } from '../../../core/service/product.service';

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
    MatDialogModule // Importado para usar os elementos do diálogo
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
          <mat-error *ngIf="productForm.controls['name']?.errors?.['required']">
            O nome é obrigatório
          </mat-error>
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
            <mat-icon matSuffix>attach_money</mat-icon>
            <mat-error *ngIf="productForm.controls['price']?.errors?.['required']">
                O preço é obrigatório
            </mat-error>
            <mat-error *ngIf="productForm.controls['price']?.errors?.['min']">
                O preço deve ser positivo
            </mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Estoque Inicial (un) *</mat-label>
            <input matInput name="stockQty" type="number" [(ngModel)]="form.stockQty" required min="0">
            <mat-error *ngIf="productForm.controls['stockQty']?.errors?.['required']">
                O estoque é obrigatório
            </mat-error>
            <mat-error *ngIf="productForm.controls['stockQty']?.errors?.['min']">
                A quantidade deve ser positiva
            </mat-error>
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline">
          <mat-label>Categoria *</mat-label>
          <mat-select name="categoryEnum" [(ngModel)]="form.categoryEnum" required>
            <mat-option *ngFor="let category of categories" [value]="category">
              {{ category }}
            </mat-option>
          </mat-select>
          <mat-error *ngIf="productForm.controls['categoryEnum']?.errors?.['required']">
            A categoria é obrigatória
          </mat-error>
        </mat-form-field>
        
      </form>
    </mat-dialog-content>
    
    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close()">Cancelar</button>
      <button 
        mat-raised-button 
        color="primary" 
        [disabled]="productForm.invalid" 
        (click)="submitForm()"
      >
        <mat-icon>save</mat-icon> Salvar Produto
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    mat-dialog-content {
      display: flex;
      flex-direction: column;
      gap: 10px;
      
    }
    mat-form-field {
      width: 100%;
      margin-top: 10px;
    }
    .form-row {
      display: flex;
      gap: 16px;
    }
    .half-width {
      flex: 1;
    }
    mat-dialog-title {
        display: flex;
        align-items: center;
        gap: 10px;
        font-weight: 600;
        color: #3f51b5;
        margin-bottom: 10px;
    }
    mat-dialog-actions button {
        margin-left: 8px;
    }
  `
})
export class ProductCreateDialogComponent {
  
  // Referência injetada para fechar o próprio diálogo
  dialogRef = inject(MatDialogRef<ProductCreateDialogComponent>);
  
  form: ProductRequest = {
    barcode: '',
    name: '',
    description: '',
    price: 0,
    stockQty: 0,
    categoryEnum: CategoryEnum.CAMA
  };
  
  categories = Object.values(CategoryEnum);

  /**
   * Envia os dados do formulário e fecha o dialog, retornando os dados para o componente pai.
   */
  submitForm() {
    // Garante a tipagem correta antes de fechar
    const dataToSend: ProductRequest = {
      ...this.form,
      price: Number(this.form.price),
      stockQty: Number(this.form.stockQty)
    };
    
    // Fecha o dialog, retornando os dados (result)
    this.dialogRef.close(dataToSend);
  }
}