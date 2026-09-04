import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TurnService {
  private turns = new BehaviorSubject<any[]>([]);
  private currentTurn = new BehaviorSubject<any | null>(null);
  private stats = new BehaviorSubject({ waiting: 0, totalToday: 0, processed: 0 });

  private apiUrl = '/api';

  getBaseUrl(): string {
    return this.apiUrl;
  }

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('turnify_token');
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  getAllTurns(): Observable<any> {
    return this.http.get(`${this.apiUrl}/all/`, { headers: this.getHeaders() });
  }

  createTurn(service_type: string = 'general', sede_id: string = ''): Observable<any> {
    return this.http.post(`${this.apiUrl}/create/`, { service_type, sede_id }, { headers: this.getHeaders() });
  }

  callNext(): Observable<any> {
    return this.http.post(`${this.apiUrl}/call/`, {}, { headers: this.getHeaders() });
  }

  callSpecific(turn_number: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/call-specific/`, { turn_number }, { headers: this.getHeaders() });
  }

  finishCurrent(): Observable<any> {
    return this.http.post(`${this.apiUrl}/finish/`, {}, { headers: this.getHeaders() });
  }

  rescheduleCurrent(): Observable<any> {
    return this.http.post(`${this.apiUrl}/reschedule/`, {}, { headers: this.getHeaders() });
  }

  rescheduleSpecificTurn(turn_number: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/reschedule-turn/${turn_number}/`, {}, { headers: this.getHeaders() });
  }

  cancelCurrent(): Observable<any> {
    return this.http.post(`${this.apiUrl}/cancel/`, {}, { headers: this.getHeaders() });
  }

  getPosition(turn_number: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/position/?turn_number=${turn_number}`, { headers: this.getHeaders() });
  }

  getVirtualDocumentRequirements(): Observable<any> {
    return this.http.get(`${this.apiUrl}/virtual/document-requirements/`);
  }

  uploadVirtualDocument(turn_number: string, document_key: string, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('turn_number', turn_number);
    formData.append('document_key', document_key);
    formData.append('file', file);
    const token = localStorage.getItem('turnify_token');
    let headers = new HttpHeaders();
    if (token) headers = headers.set('Authorization', `Bearer ${token}`);
    return this.http.post(`${this.apiUrl}/virtual/upload-document/`, formData, { headers });
  }

  reviewVirtualDocument(turn_number: string, document_key: string, status: string, note: string = ''): Observable<any> {
    return this.http.post(`${this.apiUrl}/virtual/review-document/`, { turn_number, document_key, status, note }, { headers: this.getHeaders() });
  }

  // turn_id identifica el turno sin ambigüedad; turn_number se envía como
  // respaldo para el cliente, que solo conoce el número de su turno.
  sendVirtualChatMessage(turn_number: string, text: string, turn_id: string = ''): Observable<any> {
    return this.http.post(`${this.apiUrl}/virtual/send-message/`, { turn_number, text, turn_id }, { headers: this.getHeaders() });
  }

  getStatistics(): Observable<any> {
    return this.http.get(`${this.apiUrl}/statistics/`, { headers: this.getHeaders() });
  }

  getReports(): Observable<any> {
    return this.http.get(`${this.apiUrl}/reports/`, { headers: this.getHeaders() });
  }

  getAdminStatistics(): Observable<any> {
    return this.http.get(`${this.apiUrl}/statistics-admin/`, { headers: this.getHeaders() });
  }

  getEmployees(): Observable<any> {
    return this.http.get(`${this.apiUrl}/get-employees/`, { headers: this.getHeaders() });
  }

  createEmployee(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/create-employee/`, data, { headers: this.getHeaders() });
  }

  updateEmployee(username: string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/update-employee/${username}/`, data, { headers: this.getHeaders() });
  }

  deactivateEmployee(username: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/deactivate-employee/${username}/`, {}, { headers: this.getHeaders() });
  }

  exportCSV(): void {
    window.location.href = `${this.apiUrl}/export/csv/`;
  }

  exportExcel(): void {
    window.location.href = `${this.apiUrl}/export/excel/`;
  }

  getTurns(): any[] {
    return this.turns.value;
  }

  setTurns(turns: any[]): void {
    this.turns.next(turns);
    this.updateStats();
  }

  updateStats(): void {
    const turns = this.turns.value;
    this.stats.next({
      waiting: turns.filter((t: any) => t.status === 'waiting' && !t.scheduled_for_later).length,
      totalToday: turns.length,
        processed: turns.filter((t: any) => t.status === 'finished').length
    });
  }

  getCurrentTurn(): any | null {
    return this.currentTurn.value;
  }

  setCurrentTurn(turn: any | null): void {
    this.currentTurn.next(turn);
  }
}
