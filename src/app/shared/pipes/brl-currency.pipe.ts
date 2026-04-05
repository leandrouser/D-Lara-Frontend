import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'brlCurrency',
  standalone: true,
  pure: true,
})
export class BrlCurrencyPipe implements PipeTransform {
  private static readonly FORMATTER = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  transform(value: number | string | null | undefined): string {
    if (value === null || value === undefined || value === '') return '—';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '—';
    return BrlCurrencyPipe.FORMATTER.format(num);
  }
}
