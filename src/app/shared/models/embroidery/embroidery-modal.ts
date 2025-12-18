import { Component, Inject, inject, OnInit, signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MatDialogActions, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, NativeDateAdapter } from '@angular/material/core';
import { EmbroideryResponse, EmbroideryService } from '../../../core/service/embroidery.service';
import { CustomerResponse, CustomerService, Page } from '../../../core/service/customer.service'; // Assumindo que você tem um serviço de clientes
import { catchError, debounceTime, distinctUntilChanged, Observable, of, Subject, switchMap, tap } from 'rxjs';
import { MatSelectModule } from '@angular/material/select';
import { CustomerModal } from '../customer/customer-modal'; // Assumindo que este é o path correto
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE } from '@angular/material/core';
import { provideNativeDateAdapter } from '@angular/material/core';

@Component({
  selector: 'app-embroidery-create-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSelectModule,
    MatDialogActions,
    MatDialogModule,
    CustomerModal
],
  templateUrl: './embroidery-modal.html',
  styleUrl: './embroidery-modal.scss',
    providers: [
    // ✅ Use provideNativeDateAdapter em vez de configurações manuais
    provideNativeDateAdapter()
  ]
})


export class EmbroideryModal implements OnInit {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<EmbroideryModal>);
  private embroideryService = inject(EmbroideryService);
  private customerService = inject(CustomerService);
  private dateAdapter = inject(DateAdapter);
  

  // --- PROPRIEDADES DE BUSCA DE CLIENTE ---
    customerSearchResults: WritableSignal<CustomerResponse[]> = signal([]);
    customerSearch$: Subject<string> = new Subject<string>();
    customerSearchTerm: WritableSignal<string> = signal('');
    isSearchingCustomer: WritableSignal<boolean> = signal(false);
  
  form!: FormGroup;
  selectedFile: File | null = null;
  loading = false;
  isCustomerModalOpen: WritableSignal<boolean> = signal(false);

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: EmbroideryResponse
  ) {}

  ngOnInit(): void {
    if (this.data && this.data.id) {
      console.log('Modo Edição. Dados recebidos:', this.data);
      this.loadDataForEdit(this.data);
    } else {
      console.log('Modo Criação.');
    }
  

     // Configure a localidade do DateAdapter
    this.dateAdapter.setLocale('pt-BR');

    this.initForm();
    this.setupCustomerSearch();
    this.loadInitialCustomers();

  }

  initForm(): void {
    const today = new Date();
    this.form = this.fb.group({
      customerId: [null, Validators.required],
      description: ['', Validators.required],
      price: ['', [Validators.required, Validators.min(0.01)]],
      deliveryDate: [today],
      file: [null] 
    });
  }

  loadDataForEdit(data: EmbroideryResponse): void {
    const deliveryDate = data.deliveryDate ? new Date(data.deliveryDate) : null;

    this.form.patchValue({
      customerId: data.customerId,
      description: data.description,
      price: data.price,
      deliveryDate: deliveryDate,
    })
  }
  
  loadInitialCustomers(): void {
        // Carrega uma lista inicial (opcional, pode ser vazia)
        this.customerService.searchCustomers('', 0, 10).subscribe(result => {
             this.customerSearchResults.set(result.content);
        });
    }

  // --- LÓGICA DE UPLOAD DE ARQUIVO ---
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
    } else {
      this.selectedFile = null;
    }
  }

  // --- SUBMISSÃO ---
  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;

    const isEdit = this.data && this.data.id;
    const embroideryId = isEdit ? this.data.id : null;

    // 1. Criar o objeto FormData (Necessário para enviar arquivos Multipart)
    const formData = new FormData();
    const formValue = this.form.value;

    formData.append('customerId', formValue.customerId);
    formData.append('description', formValue.description);
    formData.append('price', formValue.price.toString());
    
    // Formatar a data para string ISO 8601 (o backend espera String ou null)
    if (formValue.deliveryDate) {
      const dateString = new Date(formValue.deliveryDate).toISOString().split('T')[0];
      formData.append('deliveryDate', dateString);
    }
    
    // Adicionar o arquivo, se existir
    if (this.selectedFile) {
      formData.append('file', this.selectedFile, this.selectedFile.name);
    }
    
    let saveUpdate$: Observable<EmbroideryResponse>;
    let successMessage: string;

    if (isEdit) {
      saveUpdate$ = this.embroideryService.updateWithFile(embroideryId!, formData);
      successMessage = 'Bordado atiualizado com sucesso!';
    } else {
      saveUpdate$ = this.embroideryService.createWithFile(formData);
      successMessage = 'Bordado cadastrado com sucesso!';
    }

    saveUpdate$.subscribe({
    next:() => {
      alert(successMessage);
      this.dialogRef.close(true);
      this.loading = false;
    },

    error: (err) => {
      console.error(`Erro ao ${isEdit ? 'atualizar' : 'cadastrar'} bordado:', err);
      alert('Erro ao ${isEdit ? 'atualizar' : 'cadastrar'} bordado. Verifique o console.`);
        this.loading = false;
    }
  });

    // 2. Chamar o serviço de criação (você precisa criar este método no EmbroideryService)
    this.embroideryService.createWithFile(formData).subscribe({
      next: () => {
        alert('Bordado cadastrado com sucesso!');
        this.dialogRef.close(true); // Fechar e indicar sucesso
        this.loading = false;
      },
      error: (err) => {
        console.error('Erro ao cadastrar bordado:', err);
        alert('Erro ao cadastrar bordado. Verifique o console.');
        this.loading = false;
      }
    });
  }
  
  onCancel(): void {
    this.dialogRef.close(false);
  }

  onCustomerSearchInput(event: Event) {
        const inputElement = event.target as HTMLInputElement;
        const value = inputElement.value;
        this.customerSearchTerm.set(value);

        if (value.trim().length < 1) {
            // Se vazio, recarrega a lista inicial ou limpa os resultados
            this.loadInitialCustomers(); 
            return;
        }
        
        // Envia o termo para o Subject, que dispara a busca após 350ms
        this.customerSearch$.next(value);
    }

  // ... (MÉTODOS DE ABERTURA E FECHAMENTO)
  openCustomerModal(): void {
    this.isCustomerModalOpen.set(true);
  }

  closeCustomerModal(): void {
    this.isCustomerModalOpen.set(false);
  }

  setupCustomerSearch() {
        this.customerSearch$
            .pipe(
                // ...
                switchMap(term =>
                    // ✅ A chamada agora retorna Page<CustomerResponse>
                    this.customerService.searchCustomers(term, 0, 10).pipe(
                        catchError(err => {
                            console.error("Erro ao buscar clientes:", err);
                            // Retorna um objeto de paginação VAZIO com a estrutura correta (Page<T>)
                            return of({ 
                                content: [], 
                                totalElements: 0, 
                                totalPages: 0, 
                                size: 10, 
                                number: 0, 
                                first: true, 
                                last: true 
                            } as Page<CustomerResponse>); // Use 'as' para garantir a tipagem do objeto vazio
                        })
                    )
                )
            )
            // ...
            .subscribe(result => {
                // ✅ 'result' é do tipo Page<CustomerResponse>, então .content funciona.
                this.customerSearchResults.set(result.content);
                this.isSearchingCustomer.set(false);
            });
    }
    
  saveNewCustomer(customerData: any): void {
        // ... (Lógica para salvar e selecionar o novo cliente)
        this.customerService.create(customerData).subscribe({
            next: (newCustomer: CustomerResponse) => {
                this.isCustomerModalOpen.set(false);
                
                // 1. Adicionar o novo cliente à lista atual de resultados
                const currentResults = this.customerSearchResults();
                this.customerSearchResults.set([newCustomer, ...currentResults]);
                
                // 2. Selecionar o novo cliente
                this.form.controls['customerId'].setValue(newCustomer.id);
                alert(`Cliente ${newCustomer.name} cadastrado com sucesso!`);
            },
            error: (err) => {
                // ... (tratamento de erro)
            }
        });
    }

  

  
  
}