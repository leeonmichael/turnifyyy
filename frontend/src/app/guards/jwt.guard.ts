import { inject } from '@angular/core';
import { Router, CanActivateFn, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | UrlTree => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }
  return true;
};

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | UrlTree => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const allowedRoles: string[] = route.data['roles'] || [];
  const currentRole = auth.getCurrentRole();
  console.log('Role guard check - allowed:', allowedRoles, 'current:', currentRole);
  if (!currentRole || !allowedRoles.includes(currentRole)) {
    return router.createUrlTree(['/login']);
  }
  return true;
};

// Bloquea al empleado especializado en turnos virtuales del panel presencial
// (y del resto de rutas de empleado normal) — para él solo existe /virtual-turns.
export const nonVirtualEmployeeGuard: CanActivateFn = (): boolean | UrlTree => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isVirtualEmployee()) {
    return router.createUrlTree(['/virtual-turns']);
  }
  return true;
};
