import { MatPaginatorIntl } from '@angular/material/paginator';

export function spanishPaginatorIntl(): MatPaginatorIntl {
  const intl = new MatPaginatorIntl();
  intl.itemsPerPageLabel = 'Por página';
  intl.nextPageLabel = 'Siguiente';
  intl.previousPageLabel = 'Anterior';
  intl.firstPageLabel = 'Primera';
  intl.lastPageLabel = 'Última';
  intl.getRangeLabel = (page, size, length) =>
    length === 0 ? '0 de 0' : `${page * size + 1} – ${Math.min((page + 1) * size, length)} de ${length}`;
  return intl;
}
