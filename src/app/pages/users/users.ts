import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { finalize } from 'rxjs';
import { UserService, UserRequest, UserResponse } from '../../core/service/user.service';
import { AuthService } from '../../core/service/auth.service';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatIconModule,
    MatSnackBarModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './users.html',
  styleUrls: ['./users.scss']
})
export class Users implements OnInit {
  private userService = inject(UserService);
  private snackBar = inject(MatSnackBar);
  private fb = inject(FormBuilder);
  authService = inject(AuthService);
  

  users = signal<UserResponse[]>([]);
  isLoading = signal(false);
  showForm = signal(false);
  editingId = signal<number | null>(null);
  hidePassword = signal(true);

  filterName = signal('');
  filterType = signal('all');

   filteredUsers = computed(() => {
    const name = this.filterName().toLowerCase().trim();
    const type = this.filterType();

    return this.users().filter(u => {
      const matchName = !name || u.userName.toLowerCase().includes(name);
      const matchType = type === 'all' || u.userType === type;
      return matchName && matchType;
    });
    });

  form = signal<FormGroup>(this.fb.group({
    userName: ['', Validators.required],
    phone: [''],
    password: ['', [Validators.required, Validators.minLength(4)]],
    userType: ['OPERATOR', Validators.required]
  }));

  ngOnInit() { this.loadUsers(); }

  loadUsers() {
    this.isLoading.set(true);
    this.userService.list()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({ next: users => this.users.set(users) });
  }

  clearFilters() {
    this.filterName.set('');
    this.filterType.set('all');
  }

  openForm(user?: UserResponse) {
    this.editingId.set(user?.id || null);
    this.hidePassword.set(true);

    const passwordValidators = user
    ? [Validators.minLength(4)]
    : [Validators.required, Validators.minLength(4)];

    this.form.set(this.fb.group({
      userName: [user?.userName || '', Validators.required],
      phone: [user?.phone || ''],
      password: ['', passwordValidators],
      userType: [user?.userType || 'OPERATOR', Validators.required]
    }));

  this.showForm.set(true);
  }

  closeForm() {
    this.showForm.set(false);
    this.editingId.set(null);
  }

  save() {
  if (this.form().invalid) return;
  
  const raw = this.form().value;
  const id = this.editingId();

  const value: UserRequest = {
      userName: raw.userName,
      phone: raw.phone || null,
      password: raw.password?.trim() || null,
      userType: this.authService.isAdmin()
      ? raw.userType
      : 'OPERATOR',

      };

  this.isLoading.set(true);
  const req = id
    ? this.userService.update(id, value)
    : this.userService.create(value);

  req.pipe(finalize(() => this.isLoading.set(false))).subscribe({
    next: () => {
      this.snackBar.open(
        id ? '✅ Usuário atualizado!' : '✅ Usuário criado!',
        'OK', { duration: 3000 }
      );
      this.closeForm();
      this.loadUsers();
    },
    error: err => this.snackBar.open(
      err.error?.message || 'Erro ao salvar',
      'OK', { duration: 4000 }
    )
  });
  }

  delete(id: number) {
    if (!confirm('Deseja excluir este usuário?')) return;
    this.userService.delete(id).subscribe({
      next: () => {
        this.snackBar.open('Usuário excluído', 'OK', { duration: 3000 });
        this.loadUsers();
      },
      error: err => this.snackBar.open(
        err.error?.message || 'Erro ao excluir',
        'OK', { duration: 4000 }
      )
    });
  }
}
