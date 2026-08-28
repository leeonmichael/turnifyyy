import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.getToken();
  if (token) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }
  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      // Solo forzamos logout si la petición SÍ llevaba token (evita disparar
      // esto con el 401 de credenciales inválidas en /login/, que no envía token).
      if (token && err.status === 401) {
        authService.clearSession();
        router.navigateByUrl('/login', { state: { sessionExpired: true } });
      }
      return throwError(() => err);
    })
  );
};
