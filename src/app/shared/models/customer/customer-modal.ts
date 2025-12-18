
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'customer-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './customer-modal.html',
  styleUrls: ['./customer-modal.scss']
})
export class CustomerModal {
  @Input() title: string = 'Cadastrar Novo Cliente'; // Valor padrão
  open = signal(false);

  @Input() set isOpen(value: boolean) {
    this.open.set(value);
    if (value) {
      this.resetForm();
    }
  }

  @Output() save = new EventEmitter<any>();
  @Output() close = new EventEmitter<void>();

  // Dados do formulário
  form = {
    name: '',
    phone: '',
    active: true
  };

  // Método para enviar o formulário
  submit() {
    if (this.validateForm()) {
      this.save.emit({ ...this.form });
      this.resetForm();
    }
  }

  // Validar formulário
  private validateForm(): boolean {
    if (!this.form.name.trim()) {
      alert('Por favor, informe o nome do cliente');
      return false;
    }
    return true;
  }

  // Resetar formulário
  private resetForm() {
    this.form = {
      name: '',
      phone: '',
      active: true
    };
  }

  // Fechar modal
  closeModal() {
    this.resetForm();
    this.close.emit();
  }
}