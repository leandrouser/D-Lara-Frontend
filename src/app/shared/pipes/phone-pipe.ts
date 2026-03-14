import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'phoneFormat',
  standalone: true
})
export class PhoneFormatPipe implements PipeTransform {
  transform(value: string | undefined): string {
    if (!value) return '---';

    const cleaned = value.replace(/\D/g, '');
    const len = cleaned.length;

    if (len === 11) {
      // Celular: (00) 00000-0000
      return cleaned.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
    } else if (len === 10) {
      // Fixo: (00) 0000-0000
      return cleaned.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
    }

    return value;
  }
}