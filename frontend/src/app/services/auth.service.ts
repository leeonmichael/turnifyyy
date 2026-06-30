import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUser = new BehaviorSubject<any | null>(null);
  private currentRole = new BehaviorSubject<string | null>(null);

  private apiUrl = '/api';

  constructor(private http: HttpClient) {
    const stored = localStorage.getItem('turnify_user');
    const role = localStorage.getItem('turnify_role');
    if (stored) {
      try {
        const user = JSON.parse(stored);
        this.currentUser.next(user);
        this.currentRole.next(user.role || role);
      } catch {
        this.clearSession();
      }
    }
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('turnify_token');
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  login(username: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/login/`, { username, password }, { headers: this.getHeaders() });
  }

  register(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/register/`, data, { headers: this.getHeaders() });
  }

  logout(): Observable<any> {
    localStorage.removeItem('turnify_token');
    this.clearSession();
    return this.http.post(`${this.apiUrl}/logout/`, {}, { headers: this.getHeaders(), responseType: 'text' });
  }

  verifySession(): Observable<any> {
    return this.http.get(`${this.apiUrl}/verify-session/`, { headers: this.getHeaders() });
  }

  updateProfile(data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/profile/`, data, { headers: this.getHeaders() });
  }

  setSession(token: string, user: any): void {
    localStorage.setItem('turnify_token', token);
    localStorage.setItem('turnify_user', JSON.stringify(user));
    localStorage.setItem('turnify_role', user.role);
    this.currentUser.next(user);
    this.currentRole.next(user.role);
  }

  clearSession(): void {
    localStorage.removeItem('turnify_user');
    localStorage.removeItem('turnify_role');
    localStorage.removeItem('turnify_token');
    localStorage.removeItem('userTurn');
    localStorage.removeItem('turnMode');
    localStorage.removeItem('turnServiceType');
    localStorage.removeItem('turnSede');
    localStorage.removeItem('client_documents');
    this.currentUser.next(null);
    this.currentRole.next(null);
  }

  getCurrentUser(): any | null {
    return this.currentUser.value;
  }

  getCurrentRole(): string | null {
    return this.currentRole.value;
  }

  isAuthenticated(): boolean {
    const token = localStorage.getItem('turnify_token');
    return !!token && this.currentUser.value !== null;
  }

  getToken(): string | null {
    return localStorage.getItem('turnify_token');
  }
}
