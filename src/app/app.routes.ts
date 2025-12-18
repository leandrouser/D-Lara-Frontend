import { Routes } from '@angular/router';
import { authGuard } from './core/interceptors/auth.guard';

export const routes: Routes = [

    { path: '', redirectTo: 'login', pathMatch: 'full' },

{ 
    path: 'login', 
    loadComponent: () => import('./pages/login/login').then(m => m.Login) 
  },
  
  { 
    path: 'dashboard', 
    loadComponent: () => import('./pages/dashboard/dashboard').then((m: any) => m.Dashboard)
  },
  { 
    path: 'cash', 
    loadComponent: () => import('./pages/cash/cash-movement').then((m: any) => m.CashMovement)
  },
  { 
    path: 'sales', 
    loadComponent: () => import('./pages/sales/sales').then((m: any) => m.Sales)
  },
  { 
    path: 'embroidery', 
    loadComponent: () => import('./pages/embroidery/embroidery').then((m: any) => m.Embroidery)
  },
  {
    path: 'products',
    loadComponent: () => import('./pages/product/product').then((m: any) => m.Product)
  },
  { 
    path: 'customers', 
    loadComponent: () => import('./pages/customer/customer').then((m: any) => m.Customer)
  },
  { 
    path: 'pdv', 
    loadComponent: () => import('./pages/pdv/pdv').then((m: any) => m.Pdv),
    canActivate: [authGuard]
  },
  { 
    path: 'payment', 
    loadComponent: () => import('./pages/payment/payment').then((m: any) => m.Payment)
  },

];
