import { Component, Inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { EmbroideryResponse, EmbroideryService } from '../../../core/service/embroidery.service';
import { CommonModule, DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, MAT_DATE_LOCALE, MAT_DATE_FORMATS } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CustomerResponse, CustomerService } from '../../../core/service/customer.service';
import { debounceTime, distinctUntilChanged, Subject, switchMap, of } from 'rxjs';
import { CustomerModal } from '../customer/customer-modal';

export const BR_DATE_FORMATS = {
  parse: { dateInput: 'DD/MM/YYYY' },
  display: {
    dateInput: 'DD/MM/YYYY',
    monthYearLabel: 'MMM YYYY',
    dateA11yLabel: 'DD/MM/YYYY',
    monthYearA11yLabel: 'MMMM YYYY',
  },
};

@Component({
  selector: 'app-embroidery-modal',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatDialogModule, MatButtonModule,
    MatInputModule, MatDatepickerModule, MatNativeDateModule, MatIconModule,
    MatSnackBarModule, MatCardModule, MatChipsModule, MatListModule,
    MatTooltipModule, CustomerModal
  ],
  templateUrl: './embroidery-modal.html',
  styleUrls: ['./embroidery-modal.scss'],
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'pt-BR' },
    { provide: MAT_DATE_FORMATS, useValue: BR_DATE_FORMATS },
    DatePipe
  ]
})
export class EmbroideryModal implements OnInit {
  form!: FormGroup;
  selectedFile: File | null = null;
  isEditMode = false;
  loading = signal(false);
  isCustomerModalOpen = false;
  
  minDate = new Date();
  maxDate = new Date();

  customerSearchTerm = signal('');
  customerSearchResults = signal<CustomerResponse[]>([]);
  selectedCustomer = signal<CustomerResponse | null>(null);
  showCustomerResults = signal(false);
  isSearchingCustomer = signal(false);
  
  private customerSearch$ = new Subject<string>();

  constructor(
    private fb: FormBuilder,
    private embroideryService: EmbroideryService,
    private customerService: CustomerService,
    private dialogRef: MatDialogRef<EmbroideryModal>,
    private snackBar: MatSnackBar,
    @Inject(MAT_DIALOG_DATA) public data?: EmbroideryResponse
  ) {
    this.maxDate.setFullYear(this.maxDate.getFullYear() + 2); // Aumentado para 2 anos de prazo
    this.setupCustomerSearch();
  }

  ngOnInit(): void {
    this.isEditMode = !!this.data;
    this.initializeForm();
    // Se for edição, carregamos os dados do cliente para o card azul
    if (this.isEditMode && this.data?.customerId) {
      this.loadCustomerById(this.data.customerId);
    }
  }

  private setupCustomerSearch(): void {
    this.customerSearch$.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      switchMap(term => {
        if (!term || term.trim().length < 2) {
          this.customerSearchResults.set([]);
          this.isSearchingCustomer.set(false);
          return of({ 
          content: [], 
          totalElements: 0, 
          totalPages: 0, 
          size: 10, 
          number: 0 
        } as any);
        }
        this.isSearchingCustomer.set(true);
        return this.customerService.searchPaged(term, 0, 10);
      })
    ).subscribe({
      next: (response: any) => {
        this.customerSearchResults.set(response?.content || []);
        this.isSearchingCustomer.set(false);
      },
      error: () => {
        this.isSearchingCustomer.set(false);
        this.showError('Erro ao buscar clientes');
      }
    });
  }

  private loadCustomerById(customerId: number): void {
    this.customerService.getById(customerId).subscribe({
      next: (customer) => {
        this.selectedCustomer.set(customer);
        this.customerSearchTerm.set(customer.name);
      }
    });
  }

  onCustomerSearchInput(value: string): void {
    this.customerSearchTerm.set(value);
    this.customerSearch$.next(value);
    this.showCustomerResults.set(!!value && value.trim().length > 0);
  }

  selectCustomer(customer: CustomerResponse): void {
    this.selectedCustomer.set(customer);
    this.customerSearchTerm.set(customer.name);
    this.showCustomerResults.set(false);
  }

  clearCustomer(): void {
    this.selectedCustomer.set(null);
    this.customerSearchTerm.set('');
    this.showCustomerResults.set(false);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const isPesFile = fileName.endsWith('.pes') || fileName.endsWith('.dst');
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    
    if (file.size > 15 * 1024 * 1024) { // Aumentado para 15MB
      this.showError('Arquivo muito grande. Máximo: 15MB');
      return;
    }
    
    if (!allowedTypes.includes(file.type) && !isPesFile) {
      this.showError('Formato inválido. Use JPG, PNG, PDF, PES ou DST');
      return;
    }
    this.selectedFile = file;
    this.form.get('fileName')?.setValue(file.name);
  }

  save(): void {
    const customer = this.selectedCustomer();
    
    // Validação de Cliente
    if (!customer?.id) {
      this.showError('Selecione um cliente antes de salvar.');
      return;
    }

    this.markFormGroupTouched(this.form);
    if (this.form.invalid || this.loading()) return;

    this.loading.set(true);
    const formData = new FormData();
    const formValue = this.form.getRawValue();

    // 1. Parâmetros individuais esperados pelo Controller Java
    formData.append('customerId', customer.id.toString());
    formData.append('description', formValue.description);
    formData.append('price', String(formValue.price));
    
    // 2. Data formatada para yyyy-MM-dd (LocalDate)
    if (formValue.deliveryDate) {
      formData.append('deliveryDate', this.formatDateForBackend(formValue.deliveryDate));
    }

    // 3. Arquivo
    if (this.selectedFile) {
      formData.append('file', this.selectedFile);
    }

    const request$ = this.isEditMode && this.data?.id
      ? this.embroideryService.updateWithFile(this.data.id, formData)
      : this.embroideryService.createWithFile(formData);

    request$.subscribe({
      next: () => {
        this.loading.set(false);
        this.showSuccess(this.isEditMode ? 'Bordado atualizado!' : 'Bordado cadastrado!');
        this.dialogRef.close(true);
      },
      error: (err) => {
        this.loading.set(false);
        this.showError(err.error?.message || 'Erro ao salvar bordado no servidor.');
      }
    });
  }

  onSearchInputChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  this.onCustomerSearchInput(input.value);
}

openNewCustomerModal(): void {
  this.isCustomerModalOpen = true; 
}

trackByCustomerId(index: number, customer: CustomerResponse): number {
  return customer.id;
}

downloadCurrentFile(): void {
  // 1. Validação básica: só baixa se tiver um ID e um nome de arquivo
  if (!this.data?.id || !this.data?.fileName) {
    this.showError('Não há arquivo disponível para download.');
    return;
  }

  this.loading.set(true);
  
  // 2. Chama o service que retorna o Blob (binário do arquivo)
  this.embroideryService.downloadFile(this.data.id).subscribe({
    next: (blob: Blob) => {
      // 3. Cria um link temporário na memória do navegador para disparar o download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = this.data?.fileName || 'arquivo-bordado';
      
      // 4. Simula o clique e limpa a memória
      link.click();
      window.URL.revokeObjectURL(url);
      
      this.loading.set(false);
      this.showSuccess('Download iniciado!');
    },
    error: (err) => {
      console.error('Erro ao baixar arquivo:', err);
      this.showError('Erro ao baixar arquivo do servidor.');
      this.loading.set(false);
    }
  });
}

removeCurrentFile(): void {
  // 1. Limpa o arquivo selecionado no input (se houver)
  this.selectedFile = null;

  // 2. Limpa o valor no formulário para que o HTML entenda que não há mais arquivo
  this.form.get('fileName')?.setValue(null);

  // 3. Opcional: Se você quiser garantir que o input de arquivo seja resetado 
  // para permitir selecionar o mesmo arquivo novamente:
  const fileInput = document.getElementById('fileUpload') as HTMLInputElement;
  if (fileInput) {
    fileInput.value = '';
  }

  this.showSuccess('Arquivo removido da seleção.');
}

onQuickCustomerSave(customerData: any): void {
  this.loading.set(true);
  this.isCustomerModalOpen = false;

  this.customerService.create(customerData).subscribe({
    next: (newCustomer: CustomerResponse) => {
      this.loading.set(false);
      if (newCustomer?.id) {
        this.selectCustomer(newCustomer); // Seleciona automaticamente o cliente recém-criado
        this.showSuccess('Cliente cadastrado e selecionado!');
      }
    },
    error: (err) => {
      this.loading.set(false);
      this.showError('Erro ao cadastrar cliente: ' + (err.error?.message || err.message));
    }
  });
}

  // MÉTODOS AUXILIARES
  private parseBackendDate(dateString?: string): Date | null {
    if (!dateString) return null;
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private formatDateForBackend(date: Date): string {
    const d = new Date(date);
    const month = '' + (d.getMonth() + 1);
    const day = '' + d.getDate();
    const year = d.getFullYear();
    return [year, month.padStart(2, '0'), day.padStart(2, '0')].join('-');
  }

  private initializeForm(): void {
    this.form = this.fb.group({
      description: [this.data?.description || '', [Validators.required, Validators.maxLength(500)]],
      price: [this.data?.price || 0, [Validators.required, Validators.min(0.01)]],
      deliveryDate: [this.parseBackendDate(this.data?.deliveryDate), [Validators.required]],
      fileName: [this.data?.fileName || null],
      status: [this.data?.status || 'PENDING'] 
    });
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if (control instanceof FormGroup) this.markFormGroupTouched(control);
    });
  }

  private showError(message: string): void {
    this.snackBar.open(message, 'Fechar', { duration: 4000, panelClass: ['error-snackbar'] });
  }

  private showSuccess(message: string): void {
    this.snackBar.open(message, 'OK', { duration: 3000, panelClass: ['success-snackbar'] });
  }

  cancel(): void {
    if (!this.loading()) this.dialogRef.close(false);
  }
}