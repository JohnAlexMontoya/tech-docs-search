import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import type { ApiError } from '@tech-docs/shared';
import { catchError, throwError } from 'rxjs';

/** Traduce el formato de error uniforme de la API a un mensaje visible para el usuario. */
export const apiErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const snackBar = inject(MatSnackBar);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        const body = error.error as Partial<ApiError> | null;
        const message = Array.isArray(body?.message)
          ? body.message.join(' · ')
          : body?.message ??
            (error.status === 0 ? 'No hay conexión con el servidor' : 'Ocurrió un error inesperado');
        snackBar.open(message, 'Cerrar', { duration: 6000, panelClass: 'snack-error' });
      }
      return throwError(() => error);
    }),
  );
};
