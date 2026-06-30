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
  if (!currentRole || !allowedRoles.includes(currentRole)) {
    return router.createUrlTree(['/login']);
  }
  return true;
};
