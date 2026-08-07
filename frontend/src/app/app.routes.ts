import { Routes } from '@angular/router';

import { Login } from './pages/login/login';
import { Dashboard } from './pages/dashboard/dashboard';
import { Employee } from './pages/employee/employee';
import { Home } from './pages/home/home';
import { Screen } from './pages/screen/screen';
import { Register } from './pages/register/register';
import { Profile } from './pages/profile/profile';
import { VirtualTurns } from './pages/virtual-turns/virtual-turns';
import { MyTurns } from './pages/my-turns/my-turns';
import { ManageUsers } from './pages/manage-users/manage-users';
import { RescheduleTurns } from './pages/reschedule-turns/reschedule-turns';
import { Chatbot } from './pages/chatbot/chatbot';
import { authGuard, roleGuard } from './guards/jwt.guard';

export const routes: Routes = [
  { path: 'login', component: Login },
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'register', component: Register },
  { path: 'home', component: Home, canActivate: [authGuard] },
  { path: 'profile', component: Profile, canActivate: [authGuard, roleGuard], data: { roles: ['client'] } },
  { path: 'virtual-turns', component: VirtualTurns, canActivate: [authGuard, roleGuard], data: { roles: ['client', 'employee'] } },
  { path: 'my-turns', component: MyTurns, canActivate: [authGuard, roleGuard], data: { roles: ['client'] } },
  { path: 'dashboard', component: Dashboard, canActivate: [authGuard, roleGuard], data: { roles: ['admin'] } },
  { path: 'employee', component: Employee, canActivate: [authGuard, roleGuard], data: { roles: ['employee'] } },
  { path: 'manage-users', component: ManageUsers, canActivate: [authGuard, roleGuard], data: { roles: ['employee', 'admin'] } },
  { path: 'reschedule-turns', component: RescheduleTurns, canActivate: [authGuard, roleGuard], data: { roles: ['employee', 'admin'] } },
  { path: 'screen', component: Screen },
  { path: 'chatbot', component: Chatbot, canActivate: [authGuard] },
  { path: '**', redirectTo: '/login' },
];
