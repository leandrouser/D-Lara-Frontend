import { Component, EventEmitter, Input, OnDestroy, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CustomerRequest, CustomerResponse, CustomerService } from '../../../core/service/customer.service';
import { Subject, debounceTime, distinctUntilChanged, switchMap, takeUntil } from 'rxjs';

@Component({
  selector: 'customer-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatSnackBarModule],
  templateUrl: './customer-modal.html',
  styleUrls: ['./customer-modal.scss']
})
export class CustomerModal implements OnDestroy {
  private customerService = inject(CustomerService);
  private snackBar = inject(MatSnackBar);

  @Input() isOpen: boolean = false;
  @Output() close = new EventEmitter<void>();
  @Output() customerAdded = new EventEmitter<CustomerResponse>();

  formData = signal<CustomerRequest>({ name: '', phone: '', active: true });
  isLoading = signal(false);
  errorMessage = signal('');

  // ── Sinais de validação de telefone ──────────────────────
  phoneExists   = signal(false);
  phoneChecked  = signal(false);
  checkingPhone = signal(false);

  private phoneSubject = new Subject<string>();
  private destroy$     = new Subject<void>();

  constructor() {
    this.phoneSubject.pipe(
      debounceTime(600),
      distinctUntilChanged(),
      switchMap(phone => {
        const digits = phone.replace(/\D/g, '');
        if (digits.length < 10) {
          this.phoneExists.set(false);
          this.phoneChecked.set(false);
          this.checkingPhone.set(false);
          return [];
        }
        this.checkingPhone.set(true);
        return this.customerService.checkPhoneExists(phone);
      }),
      takeUntil(this.destroy$)
    ).subscribe(exists => {
      this.phoneExists.set(exists);
      this.phoneChecked.set(true);
      this.checkingPhone.set(false);
    });
  }

  saveCustomer(): void {
    const data = this.formData();

    if (!data.name?.trim() || !data.phone?.trim()) {
      this.showTemporaryError('Por favor, preencha o nome e o telefone.');
      return;
    }

    if (this.phoneExists()) return;

    this.errorMessage.set('');
    this.isLoading.set(true);

    this.customerService.create(data).subscribe({
      next: (res) => {
        this.customerAdded.emit(res);
        this.snackBar.open(`Cliente ${res.name} cadastrado com sucesso!`, 'OK', {
          duration: 3000,
          verticalPosition: 'top',
          horizontalPosition: 'center',
        });
        this.resetForm();
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.handleError(err);
      }
    });
  }

  updateField(key: keyof CustomerRequest, value: any): void {
    let finalValue = value;

    if (key === 'phone' && typeof value === 'string') {
      finalValue = value.replace(/\D/g, '');
      if (finalValue.length > 2) finalValue = `(${finalValue.substring(0, 2)}) ${finalValue.substring(2)}`;
      if (finalValue.length > 9) finalValue = `${finalValue.substring(0, 10)}-${finalValue.substring(10, 14)}`;

      // ── dispara verificação após aplicar máscara ──
      this.phoneChecked.set(false);
      this.phoneExists.set(false);
      this.phoneSubject.next(finalValue);
    }

    this.formData.update(current => ({ ...current, [key]: finalValue }));
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private handleError(err: any): void {
    if (err.status === 409) {
      this.errorMessage.set('Este cliente ou telefone já está cadastrado.');
    } else if (err.status === 0) {
      this.errorMessage.set('Servidor offline. Verifique sua conexão.');
    } else {
      this.errorMessage.set('Erro ao salvar. Verifique os dados e tente novamente.');
    }
  }

  private showTemporaryError(msg: string): void {
    this.errorMessage.set(msg);
    setTimeout(() => this.errorMessage.set(''), 5000);
  }

  closeModal(): void {
    if (this.isLoading()) return;
    this.resetForm();
    this.close.emit();
  }

  private resetForm(): void {
    this.formData.set({ name: '', phone: '', active: true });
    this.errorMessage.set('');
    this.phoneExists.set(false);
    this.phoneChecked.set(false);
    this.checkingPhone.set(false);
  }
}
