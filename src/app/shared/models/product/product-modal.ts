import { Component, inject, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CategoryEnum, ProductRequest, ProductService } from '../../../core/service/product.service';
import { Subject, debounceTime, distinctUntilChanged, switchMap, takeUntil } from 'rxjs';

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
    MatSnackBarModule,
  ],
  templateUrl: './product-modal.html',
  styleUrls: ['./product-modal.scss'],
})
export class ProductCreateDialogComponent implements OnDestroy {
  dialogRef       = inject(MatDialogRef<ProductCreateDialogComponent>);
  productService  = inject(ProductService);
  snackBar        = inject(MatSnackBar);

  isSaving   = false;
  categories = Object.values(CategoryEnum);

  barcodeExists   = signal(false);
  barcodeChecked  = signal(false);
  checkingBarcode = signal(false);
  nextProductId   = signal<number | null>(null);
  loadingNextId   = signal(true);

  private barcodeSubject = new Subject<string>();
  private destroy$       = new Subject<void>();

  constructor() {
    this.barcodeSubject.pipe(
      debounceTime(600),
      distinctUntilChanged(),
      switchMap(barcode => {
        if (!barcode.trim()) {
          this.barcodeExists.set(false);
          this.barcodeChecked.set(false);
          this.checkingBarcode.set(false);
          return [];
        }
        this.checkingBarcode.set(true);
        return this.productService.checkBarcodeExists(barcode);
      }),
      takeUntil(this.destroy$)
    ).subscribe(exists => {
      this.barcodeExists.set(exists);
      this.barcodeChecked.set(true);
      this.checkingBarcode.set(false);
    });

    this.loadNextId();
  }

  onBarcodeInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.barcodeChecked.set(false);
    this.barcodeExists.set(false);
    this.barcodeSubject.next(value);
  }

  submitForm(ngForm: NgForm) {
    if (ngForm.invalid || this.barcodeExists()) return;

    this.isSaving = true;

    const dataToSend: ProductRequest = {
      ...this.form,
      price:    Number(this.form.price),
      stockQty: Number(this.form.stockQty),
    };

    this.productService.create(dataToSend).subscribe({
      next: () => {
        this.snackBar.open('Produto cadastrado com sucesso!', 'OK', {
          duration: 3000,
          verticalPosition: 'top',
          horizontalPosition: 'center',
          panelClass: ['snack-success'],
        });

        this.isSaving = false;
        this.barcodeExists.set(false);
        this.barcodeChecked.set(false);
        ngForm.resetForm();
        this.form = this.getInitialForm();
        this.loadNextId();

        setTimeout(() => {
          document.querySelector<HTMLInputElement>('input[name="name"]')?.focus();
        }, 100);
      },
      error: (err) => {
        console.error(err);
        this.snackBar.open('Erro ao salvar produto.', 'Fechar', {
          duration: 5000,
          verticalPosition: 'top',
          horizontalPosition: 'center',
          panelClass: ['snack-error'],
        });
        this.isSaving = false;
      },
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }


  form: ProductRequest = this.getInitialForm();

  private getInitialForm(): ProductRequest {
    return {
      barcode:      '',
      name:         '',
      description:  '',
      price:        0,
      stockQty:     0,
      categoryEnum: CategoryEnum.CAMA,
    };
  }

  private loadNextId() {
    this.loadingNextId.set(true);
    this.productService.getNextProductId().subscribe(id => {
      this.nextProductId.set(id);
      this.loadingNextId.set(false);
    });
  }
}
