import { Component, OnInit, OnDestroy, AfterViewChecked, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { TurnService } from '../../services/turn.service';
import { AuthService } from '../../services/auth.service';
import { WebsocketService } from '../../services/websocket.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { NgIf, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-virtual-turns',
  standalone: true,
  imports: [NgIf, NgFor, FormsModule],
  templateUrl: './virtual-turns.html',
  styleUrl: './virtual-turns.css'
})
export class VirtualTurns implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('chatMessages') private chatMessagesEl!: ElementRef;

  turns: any[] = [];
  filteredTurns: any[] = [];
  loading = false;
  currentUser: any = null;

  activeVirtualTurn: any = null;
  systemMessages: { sender: string; text: string; at: string; isSystem: boolean }[] = [];
  newMessage = '';
  finishing = false;
  sendingMessage = false;

  // Combina las notas persistidas (chat_messages, compartido con el cliente)
  // con los avisos locales de sistema (turno iniciado/finalizado...), ordenado por hora.
  get displayMessages(): any[] {
    const shared = (this.activeVirtualTurn?.chat_messages || []).map((m: any) => ({
      sender: m.sender_name,
      text: m.text,
      at: m.at,
      isSystem: false,
      isMine: m.sender_role === 'employee',
    }));
    return [...shared, ...this.systemMessages]
      .sort((a, b) => (a.at || '').localeCompare(b.at || ''))
      .map(m => ({ ...m, time: this.formatMsgTime(m.at) }));
  }

  getEmployeeName(): string {
    return this.currentUser?.full_name || this.currentUser?.username || 'Empleado';
  }

  private formatMsgTime(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  }

  private destroy$ = new Subject<void>();
  private refreshInterval: any;

  constructor(
    private turn: TurnService,
    private auth: AuthService,
    private ws: WebsocketService,
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const role = this.auth.getCurrentRole();
    if (!role) {
      this.router.navigate(['/login']);
      return;
    }
    this.currentUser = this.auth.getCurrentUser();

    this.ws.messages$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (msg) => {
        let allTurns: any[] = [];
        if (Array.isArray(msg)) {
          allTurns = msg;
        } else if (msg && msg.type === 'all_turns' && Array.isArray(msg.turns)) {
          allTurns = msg.turns;
        } else {
          return;
        }
        this.turns = allTurns.filter((t: any) => t.service_type === 'virtual');
        this.applyFilters();
        if (this.activeVirtualTurn) {
          const updated = allTurns.find((t: any) => t.number === this.activeVirtualTurn.number);
          if (updated) this.activeVirtualTurn = { ...this.activeVirtualTurn, ...updated };
        }
        this.cdr.detectChanges();
      }
    });

    if (!this.ws.isConnected()) {
      this.ws.connect();
    }

    this.loadData();
    this.refreshInterval = setInterval(() => this.loadData(), 5000);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  }

  private getHeaders(): HttpHeaders {
    const token = this.auth.getToken() || localStorage.getItem('turnify_token') || '';
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  loadData(): void {
    this.http.get('/api/all/', { headers: this.getHeaders() }).subscribe({
      next: (data: any) => {
        this.turns = (data.turns || []).filter((t: any) => t.service_type === 'virtual');
        this.applyFilters();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  applyFilters(): void {
    this.filteredTurns = this.turns.filter((t: any) => (t.status === 'waiting' && !t.scheduled_for_later) || t.status === 'called');
  }

  // ¿Ya subió todos los documentos obligatorios? (para el badge de la tabla)
  docsReady(turn: any): boolean {
    const required = (turn.required_documents || []).filter((d: any) => d.required);
    if (!required.length) return true;
    const uploaded = turn.uploaded_documents || [];
    return required.every((d: any) => uploaded.some((u: any) => u.key === d.key));
  }

  missingRequiredDocs(turn: any): any[] {
    const uploaded = turn.uploaded_documents || [];
    return (turn.required_documents || []).filter((d: any) => !uploaded.some((u: any) => u.key === d.key));
  }

  copyMeetLink(): void {
    if (!this.activeVirtualTurn?.meet_link) return;
    navigator.clipboard?.writeText(this.activeVirtualTurn.meet_link).then(
      () => this.addSystemMsg('Link de videollamada copiado al portapapeles.'),
      () => {}
    );
  }

  approveDocument(key: string): void {
    if (!this.activeVirtualTurn) return;
    this.turn.reviewVirtualDocument(this.activeVirtualTurn.number, key, 'approved').subscribe({
      next: (data: any) => {
        if (data.success) {
          this.activeVirtualTurn = { ...this.activeVirtualTurn, uploaded_documents: data.uploaded_documents };
          this.cdr.detectChanges();
        }
      },
      error: () => alert('Error al aprobar el documento')
    });
  }

  rejectDocument(key: string): void {
    if (!this.activeVirtualTurn) return;
    const note = prompt('Motivo del rechazo (opcional):') || '';
    this.turn.reviewVirtualDocument(this.activeVirtualTurn.number, key, 'rejected', note).subscribe({
      next: (data: any) => {
        if (data.success) {
          this.activeVirtualTurn = { ...this.activeVirtualTurn, uploaded_documents: data.uploaded_documents };
          this.cdr.detectChanges();
        }
      },
      error: () => alert('Error al rechazar el documento')
    });
  }

  attendVirtual(turn: any): void {
    this.turn.callSpecific(turn.number).subscribe({
      next: (data: any) => {
        if (data.success) {
          this.activeVirtualTurn = { ...turn, status: 'called' };
          this.systemMessages = [];
          this.addSystemMsg(`Turno ${turn.number} iniciado. Atendiendo al cliente ${turn.created_by || ''}.`);
          this.ws.send({ action: 'get_all' });
          this.cdr.detectChanges();
        } else {
          alert(data.message || 'Error al atender turno virtual');
        }
      },
      error: () => alert('Error al atender turno virtual')
    });
  }

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    try {
      const el = this.chatMessagesEl.nativeElement;
      el.scrollTop = el.scrollHeight;
    } catch (_) {}
  }

  resumeVirtual(turn: any): void {
    this.activeVirtualTurn = turn;
    if (this.systemMessages.length === 0) {
      this.addSystemMsg(`Retomando atención del turno ${turn.number}.`);
    }
    this.cdr.detectChanges();
  }

  sendMessage(): void {
    const text = this.newMessage.trim();
    if (!text || !this.activeVirtualTurn || this.sendingMessage) return;
    if (text.length > 150) {
      alert('El mensaje debe tener máximo 150 caracteres');
      return;
    }
    this.sendingMessage = true;
    this.turn.sendVirtualChatMessage(this.activeVirtualTurn.number, text, this.activeVirtualTurn.id || '').subscribe({
      next: (data: any) => {
        this.sendingMessage = false;
        if (data.success) {
          this.activeVirtualTurn = { ...this.activeVirtualTurn, chat_messages: data.chat_messages };
          this.newMessage = '';
        } else {
          alert(data.message || 'No se pudo enviar el mensaje');
        }
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.sendingMessage = false;
        alert(err?.error?.message || 'No se pudo enviar el mensaje. Intenta de nuevo.');
        this.cdr.detectChanges();
      }
    });
  }

  private addSystemMsg(text: string): void {
    this.systemMessages.push({
      sender: 'Sistema',
      text,
      at: new Date().toISOString(),
      isSystem: true
    });
  }

  finishVirtual(): void {
    if (!this.activeVirtualTurn || this.finishing) return;
    this.finishing = true;
    this.turn.finishCurrent().subscribe({
      next: () => {
        this.addSystemMsg('Turno finalizado exitosamente. ✓');
        this.ws.send({ action: 'get_all' });
        this.cdr.detectChanges();
        setTimeout(() => {
          this.activeVirtualTurn = null;
          this.systemMessages = [];
          this.finishing = false;
          this.loadData();
          this.cdr.detectChanges();
        }, 1500);
      },
      error: () => {
        this.finishing = false;
        alert('Error al finalizar turno');
      }
    });
  }

  rescheduleVirtual(): void {
    if (!this.activeVirtualTurn) return;
    this.turn.rescheduleCurrent().subscribe({
      next: () => {
        this.addSystemMsg('Turno reagendado. Volverá al final de la cola.');
        this.ws.send({ action: 'get_all' });
        this.cdr.detectChanges();
        setTimeout(() => {
          this.activeVirtualTurn = null;
          this.systemMessages = [];
          this.loadData();
          this.cdr.detectChanges();
        }, 1500);
      },
      error: (err: any) => alert(err?.error?.message || 'Error al reagendar turno')
    });
  }

  cancelVirtual(): void {
    if (!this.activeVirtualTurn) return;
    const number = this.activeVirtualTurn.number;
    this.http.delete(`/api/cancel-turn/${number}/`, { headers: this.getHeaders() }).subscribe({
      next: () => {
        this.addSystemMsg('Turno cancelado por inasistencia.');
        this.ws.send({ action: 'get_all' });
        this.cdr.detectChanges();
        setTimeout(() => {
          this.activeVirtualTurn = null;
          this.systemMessages = [];
          this.loadData();
          this.cdr.detectChanges();
        }, 1500);
      },
      error: () => alert('Error al cancelar turno')
    });
  }

  closeChat(): void {
    this.activeVirtualTurn = null;
    this.systemMessages = [];
    this.cdr.detectChanges();
  }
}
