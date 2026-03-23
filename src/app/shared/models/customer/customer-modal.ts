import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { CustomerRequest, CustomerService } from '../../../core/service/customer.service';

@Component({
  selector: 'customer-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule],
  templateUrl: './customer-modal.html',
  styleUrls: ['./customer-modal.scss']
})
export class CustomerModal {
  private customerService = inject(CustomerService);

  @Input() isOpen: boolean = false;
  @Output() save = new EventEmitter<CustomerRequest>();
  @Output() close = new EventEmitter<void>();

  formData = signal<CustomerRequest>({
    name: '',
    phone: '',
    active: true
  });

  isLoading = signal(false);
  errorMessage = signal('');

  updateField(key: keyof CustomerRequest, value: any): void {
    this.formData.update(current => ({
      ...current,
      [key]: value
    }));
  }

  saveCustomer(): void {
    const data = this.formData();

    if (!data.name?.trim()) {
      this.errorMessage.set('Nome é obrigatório');
      return;
    }
    if (!data.phone?.trim()) {
      this.errorMessage.set('Telefone é obrigatório');
      return;
    }

    this.errorMessage.set('');
    this.isLoading.set(true);

    this.save.emit(data);

    // Limpa o formulário após enviar
    setTimeout(() => {
      this.resetForm();
      this.isLoading.set(false);
    }, 500);
  }


  closeModal(): void {
    this.resetForm();
    this.close.emit();
  }
  
  private resetForm(): void {
    this.formData.set({
      name: '',
      phone: '',
      active: true
    });
    this.errorMessage.set('');
  }
}
