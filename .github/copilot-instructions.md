# Dlara Frontend - Copilot Instructions

## Architecture Overview

This is an **Angular 20 standalone components frontend** for a retail/embroidery business management system. The application uses a modular feature-based architecture with lazy-loaded pages and centralized services for API communication.

### Core Stack
- **Framework**: Angular 20 (standalone, no NgModules)
- **State Management**: Angular signals (`signal()`)
- **Styling**: SCSS with component-scoped styles
- **HTTP**: HttpClient with centralized `ApiService`
- **Routing**: Lazy-loaded standalone components via `app.routes.ts`

### Project Structure
```
src/app/
├── app.ts                 # Root component with sidebar state
├── app.routes.ts          # Route definitions (lazy-loaded pages)
├── app.config.ts          # Angular config (providers, HTTP)
├── core/
│   ├── service/           # API services (customer, sale, api)
│   └── sidebar/           # Navigation sidebar component
├── pages/                 # Feature modules (dashboard, sales, customer, etc.)
└── shared/                # Shared models & components (currently empty)
```

## Key Patterns & Conventions

### 1. Signals-Based Reactive State
All components use Angular **signals** for reactive state management:
```typescript
export class Customers implements OnInit {
  customers = signal<CustomerResponse[]>([]);
  isLoading = signal<boolean>(false);
  selectedFilter = signal<string>('all');

  loadCustomers(): void {
    this.isLoading.set(true);
    this.customerService.getAllCustomers().subscribe({
      next: (customers) => {
        this.customers.set(customers);
        this.isLoading.set(false);
      }
    });
  }
}
```
**Pattern**: Use `signal()` for state, `signal.set()` to update, `signal()` in templates for reactivity.

### 2. Standalone Components with Dependency Injection
All components are **standalone** with explicit imports. Services use constructor injection with `inject()`:
```typescript
@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './customer.html',
  styleUrls: ['./customer.scss']
})
export class Customers implements OnInit {
  private customerService = inject(CustomerService);
}
```
**Pattern**: Import required modules in `imports: []`, use `inject()` for services (not constructor params).

### 3. Centralized API Services in `core/service/`
Services define interfaces, handle HTTP calls, and are provided at root:
- `ApiService`: Generic HTTP helpers (`get<T>()`, `post<T>()`)
- `CustomerService`: Customer CRUD + search/status filters
- `SaleService`: Sales queries and stats
- Each service: manages endpoint URLs, request/response types, business logic

**API Base URL**: `http://localhost:8080/api` (hardcoded in services)

### 4. Page Components with Lifecycle Patterns
Pages (`src/app/pages/*/`) follow a consistent pattern:
1. Inject service with `inject()`
2. Define signals for data, filters, loading states
3. In `ngOnInit()`: call `loadData()` and `loadStatistics()`
4. Subscribe to observables, update signals in callbacks
5. Implement filter/search logic methods

Example: `customer.ts` loads customers, statistics, handles search filters.

### 5. Lazy Loading Routes
Routes in `app.routes.ts` use dynamic imports with `loadComponent`:
```typescript
{ 
  path: 'customers', 
  loadComponent: () => import('./pages/customer/customer').then((m: any) => m.Customers)
}
```
**Convention**: Export component as named export matching the class name (e.g., `export class Customers`).

### 6. Responsive Sidebar State Management
`Sidebar` component (`core/sidebar/sidebar.ts`) emits events for state changes:
- `collapsed` signal: desktop collapse state
- `open` signal: mobile overlay state
- Emits `@Output() collapsedChange` and `openChange` events
- Parent component (`app.ts`) receives and maintains state

**Pattern**: Use `@Output() EventEmitter` for parent-child communication.

### 7. Testing Structure
- Components have `.spec.ts` files generated with Karma/Jasmine
- Build system configured for Chrome testing
- Scripts: `npm test` runs Karma with coverage
- Test files: typically mirror component structure

## Critical Developer Workflows

### Build & Serve
```bash
npm start          # Runs ng serve on http://localhost:4200
ng build           # Production build to dist/
ng build --watch   # Watch mode for development
```

### Testing
```bash
npm test           # Karma test runner with watch mode
```

### Code Generation
Angular CLI schematics configured for SCSS styles:
```bash
ng generate component pages/my-feature/my-feature  # Creates component with .scss
ng generate service core/service/my-service         # Creates service
```

### Prettier Formatting
- **Config** in `package.json`
- **HTML**: Angular parser, 100 char line width
- **TS**: Single quotes, 100 char line width
- Run: Format on save (should be configured in VS Code)

## Cross-Component Communication

### App State (Sidebar Collapse)
```
app.ts
  ├─ sidebarCollapsed = signal()
  ├─ [collapsed]="sidebarCollapsed()" → Sidebar
  ├─ [class.sidebar-collapsed]="sidebarCollapsed()" → main content
```
Template binding in `app.html` receives toggle events from Sidebar component.

### Service-Based Data Sharing
All page components independently call services. Services can be extended to use RxJS replay subjects for cross-component state if needed (currently not implemented).

## Import Conventions
- **Angular core**: `@angular/core`, `@angular/common`, `@angular/forms`, `@angular/router`
- **Local paths**: Use relative paths from component file (e.g., `../../core/service/customer.service`)
- **Modules in imports**: `CommonModule`, `FormsModule`, `RouterModule`, specific components

## Common Gotchas & Considerations

1. **API Base URL**: Hardcoded to `http://localhost:8080/api` in each service. Update if API changes.
2. **No Global Error Handling**: Each subscribe block has its own error handler. Consider adding interceptor for centralized errors.
3. **No Pagination UI**: Pagination params exist in services but not fully integrated in components.
4. **No Auth Service**: No auth/login guards currently wired. Login page exists but not enforced.
5. **Empty Shared Dir**: `shared/models/` and `shared/components/` are empty—extend here for reusable types & components.
6. **Sidebar Auto-Hide**: Sidebar has incomplete auto-hide logic (`startAutoHide()` called but implementation partial).

## Next Steps for New Features
1. **Add new page**: `ng generate component pages/feature-name`, add route to `app.routes.ts`
2. **Add new service**: Create in `core/service/`, define interfaces, provide at root
3. **Reusable components**: Add to `shared/components/` and import in features
4. **Shared types**: Define in `shared/models/`, import in services
