import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { TurnService } from '../../services/turn.service';
import { WebsocketService } from '../../services/websocket.service';
import { ChatNotificationService } from '../../services/chat-notification.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

type View = 'request' | 'tracking';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home implements OnInit, OnDestroy {
  // ---- Form state ----
  serviceType = 'general';
  selectedSede = 'MOSQUERA';
  turnMode = 'presencial';
  sedeOptions: string[] = [];
  currentUser: any = null;
  documents: string[] = [];
  requestingTurn = false;
  errorMsg = '';

  // ---- View ----
  view: View = 'request';
  showTurnModal = false;
  showChatbotModal = false;

  // ---- Active turn ----
  userTurn: string | null = null;
  userTurnSede = '';
  userTurnStatus = '';        // 'waiting' | 'called' | 'finished' | 'cancelled'
  positionNum = 0;
  turnsAhead = 0;

  // ---- Staff (admin/employee panel) ----
  turns: any[] = [];
  filterSede = '';

  // ---- Alarm dedup flags ----
  private warnAlarmPlayed = false;
  private calledAlarmPlayed = false;
  // Guard: only auto-reset if we've confirmed the turn at least once from the server
  private turnConfirmed = false;

  // ---- Aviso proactivo del asistente ----
  proactiveToastText: string | null = null;
  private proactiveToastTimer: any;

  private destroy$ = new Subject<void>();
  private wsInterval: any;
  private httpPollInterval: any;

  // ---- Computed getters ----
  get isCalled(): boolean    { return this.userTurnStatus === 'called'; }
  get isNext(): boolean      { return this.userTurnStatus === 'waiting' && this.turnsAhead === 0 && this.positionNum === 1; }
  get isCloseSoon(): boolean { return this.userTurnStatus === 'waiting' && this.turnsAhead > 0 && this.turnsAhead <= 2; }
  get isWaitingFar(): boolean{ return this.userTurnStatus === 'waiting' && this.turnsAhead > 2; }
  get isFinished(): boolean  { return this.userTurnStatus === 'finished'; }

  get waitingCount(): number {
    const base = this.turns.filter((t: any) => t.status === 'waiting');
    return this.filterSede ? base.filter((t: any) => t.sede === this.filterSede).length : base.length;
  }
  get callingCount(): number {
    const base = this.turns.filter((t: any) => t.status === 'called');
    return this.filterSede ? base.filter((t: any) => t.sede === this.filterSede).length : base.length;
  }
  get finishedCount(): number {
    const base = this.turns.filter((t: any) => t.status === 'finished');
    return this.filterSede ? base.filter((t: any) => t.sede === this.filterSede).length : base.length;
  }

  constructor(
    private auth: AuthService,
    private turn: TurnService,
    private ws: WebsocketService,
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private chatNotify: ChatNotificationService
  ) {}

  ngOnInit(): void {
    this.currentUser = this.auth.getCurrentUser();
    const role = this.auth.getCurrentRole();
    if (!role) { localStorage.clear(); this.router.navigate(['/login']); return; }

    this.http.get('/api/sedes/').subscribe({
      next: (data: any) => {
        this.sedeOptions = (data.sedes || []).map((s: any) => s.name);
        if (this.sedeOptions.length && !this.sedeOptions.includes(this.selectedSede)) {
          this.selectedSede = this.sedeOptions[0];
        }
        this.cdr.detectChanges();
      },
      error: () => { this.sedeOptions = ['MOSQUERA', 'MADRID']; }
    });

    this.documents = JSON.parse(localStorage.getItem('client_documents') || '[]');

    // WebSocket subscription
    this.ws.messages$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (msg) => {
        let allTurns: any[] = [];
        if (Array.isArray(msg)) allTurns = msg;
        else if (msg?.type === 'all_turns' && Array.isArray(msg.turns)) allTurns = msg.turns;
        else return;

        if (role === 'client' && this.userTurn) {
          this.syncTurnStatus(allTurns);
        } else if (role === 'admin' || role === 'employee') {
          this.turns = allTurns;
        }
        this.cdr.detectChanges();
      }
    });

    if (!this.ws.isConnected()) this.ws.connect();
    this.ws.send({ action: 'get_all' });

    if (role === 'client') {
      this.loadActiveTurn();
      this.wsInterval      = setInterval(() => this.ws.send({ action: 'get_all' }), 3000);
      this.httpPollInterval = setInterval(() => { if (this.userTurn) this.pollPosition(); }, 4000);
    }

    if (role === 'admin' || role === 'employee') {
      this.loadStaffTurns();
      this.wsInterval = setInterval(() => this.loadStaffTurns(), 5000);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.wsInterval) clearInterval(this.wsInterval);
    if (this.httpPollInterval) clearInterval(this.httpPollInterval);
    if (this.proactiveToastTimer) clearTimeout(this.proactiveToastTimer);
  }

  private getHeaders(): HttpHeaders {
    const token = this.auth.getToken() || localStorage.getItem('turnify_token') || '';
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  // Check backend for any active (waiting/called) turn belonging to this user
  loadActiveTurn(): void {
    this.http.get('/api/my-active-turn/', { headers: this.getHeaders() }).subscribe({
      next: (data: any) => {
        const t = data.turn;
        if (t) {
          this.userTurn      = t.number;
          this.userTurnSede  = t.sede || '';
          this.userTurnStatus = t.status;
          localStorage.setItem('userTurn', t.number);
          if (t.sede) localStorage.setItem('turnSede', t.sede);
          this.view = 'tracking';
          this.ws.send({ action: 'get_all' });
          setTimeout(() => this.pollPosition(), 800); // calcula posición rápido
        } else {
          // No active turn → clear any stale localStorage
          localStorage.removeItem('userTurn');
          localStorage.removeItem('turnSede');
          this.view = 'request';
        }
        this.cdr.detectChanges();
      },
      error: () => {
        // If auth fails or network error, fall back to localStorage
        const stored = localStorage.getItem('userTurn');
        if (stored) { this.userTurn = stored; this.userTurnSede = localStorage.getItem('turnSede') || ''; this.view = 'tracking'; }
        this.cdr.detectChanges();
      }
    });
  }

  loadStaffTurns(): void {
    this.http.get('/api/all/').subscribe({
      next: (data: any) => { this.turns = data.turns || []; this.cdr.detectChanges(); },
      error: () => {}
    });
  }

  private pollPosition(): void {
    this.http.get('/api/all/', { headers: this.getHeaders() }).subscribe({
      next: (data: any) => { this.syncTurnStatus(data.turns || []); this.cdr.detectChanges(); },
      error: () => {}
    });
  }

  syncTurnStatus(allTurns: any[]): void {
    if (!this.userTurn) return;

    const sede = this.userTurnSede;

    // Find turn: try with sede first, fall back to number-only to handle any casing/mismatch
    let mine = allTurns.find((t: any) =>
      t.number === this.userTurn && (sede ? t.sede === sede : true)
    );
    if (!mine) {
      mine = allTurns.find((t: any) => t.number === this.userTurn);
    }

    if (!mine) {
      if (this.turnConfirmed) this.resetTurnState();
      return;
    }

    this.turnConfirmed  = true;
    this.userTurnStatus = mine.status;
    // Keep sede in sync with what the server says
    if (mine.sede) this.userTurnSede = mine.sede;

    if (mine.status === 'finished' || mine.status === 'cancelled') {
      this.positionNum = 0;
      this.turnsAhead  = 0;
      return;
    }

    if (mine.status === 'called') {
      this.positionNum = 0;
      this.turnsAhead  = 0;
      if (!this.calledAlarmPlayed) {
        this.calledAlarmPlayed = true;
        this.playUrgentAlarm();
      }
      return;
    }

    // status === 'waiting' — compute position within the same sede queue
    this.calledAlarmPlayed = false;
    const effectiveSede = mine.sede || sede;

    const waiting = allTurns
      .filter((t: any) => t.status === 'waiting' && (!effectiveSede || t.sede === effectiveSede))
      .sort((a: any, b: any) => (a.created_at || '').localeCompare(b.created_at || ''));

    let idx = waiting.findIndex((t: any) => t.number === this.userTurn);
    // If not found with sede filter, try without (safety fallback)
    if (idx === -1) {
      const allWaiting = allTurns
        .filter((t: any) => t.status === 'waiting')
        .sort((a: any, b: any) => (a.created_at || '').localeCompare(b.created_at || ''));
      idx = allWaiting.findIndex((t: any) => t.number === this.userTurn);
    }

    this.positionNum = idx >= 0 ? idx + 1 : 0;
    this.turnsAhead  = idx >= 0 ? idx : 0;

    if (this.positionNum > 0 && this.turnsAhead <= 2) {
      if (!this.warnAlarmPlayed) {
        this.warnAlarmPlayed = true;
        this.playWarningAlarm();
        if (this.userTurn) this.triggerProactiveAssistant(this.userTurn, this.positionNum);
      }
    } else if (this.turnsAhead > 2) {
      this.warnAlarmPlayed = false;
    }
  }

  // Le pide al asistente de IA un aviso proactivo (una sola vez por turno)
  // cuando quedan pocos turnos antes del propio, y lo deja tanto en un
  // toast aquí como pendiente para cuando el usuario abra el chat.
  private triggerProactiveAssistant(turnNumber: string, position: number): void {
    if (this.chatNotify.hasNotifiedForTurn(turnNumber)) return;
    this.chatNotify.markNotifiedForTurn(turnNumber);

    this.http.post<{ message: string }>('/api/chatbot/proactive/', { turn_number: turnNumber, position }, { headers: this.getHeaders() })
      .subscribe({
        next: (res) => {
          if (!res?.message) return;
          this.chatNotify.addMessage(res.message);
          this.showProactiveToast(res.message);
        },
        error: () => {} // No es crítico: si el asistente no está disponible, simplemente no hay aviso.
      });
  }

  private showProactiveToast(text: string): void {
    this.proactiveToastText = text;
    this.cdr.detectChanges();
    if (this.proactiveToastTimer) clearTimeout(this.proactiveToastTimer);
    this.proactiveToastTimer = setTimeout(() => {
      this.proactiveToastText = null;
      this.cdr.detectChanges();
    }, 8000);
  }

  private resetTurnState(): void {
    this.userTurn          = null;
    this.userTurnSede      = '';
    this.userTurnStatus    = '';
    this.positionNum       = 0;
    this.turnsAhead        = 0;
    this.warnAlarmPlayed   = false;
    this.calledAlarmPlayed = false;
    this.turnConfirmed     = false;
    this.view              = 'request';   // ← fix: siempre vuelve al formulario
    localStorage.removeItem('userTurn');
    localStorage.removeItem('turnSede');
    localStorage.removeItem('turnMode');
    localStorage.removeItem('turnServiceType');
  }

  goBackToRequest(): void {
    this.resetTurnState();
    this.view = 'request';
    this.cdr.detectChanges();
  }

  getTurn(): void {
    if (this.requestingTurn) return;
    this.requestingTurn = true;
    this.errorMsg = '';
    this.cdr.detectChanges();

    const sede        = this.turnMode === 'presencial' ? this.selectedSede : 'VIRTUAL';
    const serviceType = this.turnMode === 'virtual' ? 'virtual' : this.serviceType;

    this.turn.createTurn(serviceType, sede).subscribe({
      next: (data: any) => {
        this.requestingTurn    = false;
        this.userTurn          = data.number;
        this.userTurnSede      = sede;
        this.userTurnStatus    = 'waiting';
        this.positionNum       = 0;
        this.turnsAhead        = 0;
        this.warnAlarmPlayed   = false;
        this.calledAlarmPlayed = false;
        this.turnConfirmed     = false;
        localStorage.setItem('userTurn', data.number);
        localStorage.setItem('turnSede', sede);
        localStorage.setItem('turnMode', this.turnMode);
        this.view          = 'tracking';
        this.showTurnModal = true;
        this.ws.send({ action: 'get_all' });
        setTimeout(() => this.pollPosition(), 800);
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.requestingTurn = false;
        const msg = err?.error?.error || '';
        if (msg.includes('Ya tienes un turno')) {
          // Backend already has an active turn — sync it
          this.errorMsg = '';
          this.loadActiveTurn();
        } else {
          this.errorMsg = 'Error al solicitar el turno. Intenta de nuevo.';
        }
        this.cdr.detectChanges();
      }
    });
  }

  cancelTurn(): void {
    if (!this.userTurn) return;
    const num = this.userTurn;
    this.http.delete(`${this.turn.getBaseUrl()}/cancel-turn/${num}/`, { headers: this.getHeaders() }).subscribe({
      next: () => {
        this.resetTurnState();
        this.view = 'request';
        this.cdr.detectChanges();
      },
      error: () => { this.errorMsg = 'Error al cancelar el turno'; this.cdr.detectChanges(); }
    });
  }

  closeModal(): void { this.showTurnModal = false; }

  openChatbotModal(): void  { this.showChatbotModal = true; }
  closeChatbotModal(): void { this.showChatbotModal = false; }
  goToChatbot(): void {
    this.showChatbotModal = false;
    this.router.navigate(['/chatbot']);
  }

  logout(): void {
    this.auth.clearSession();
    this.auth.logout().subscribe({ next: () => {}, error: () => {} });
    this.router.navigate(['/login']);
  }

  // ---- Alarms ----
  private playWarningAlarm(): void {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const beep = (t: number, freq: number) => {
        const osc = ctx.createOscillator(), g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.frequency.value = freq; osc.type = 'sine';
        g.gain.setValueAtTime(0.4, ctx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.25);
        osc.start(ctx.currentTime + t); osc.stop(ctx.currentTime + t + 0.25);
      };
      beep(0, 880); beep(0.35, 880); beep(0.7, 1100);
    } catch (e) {}
  }

  private playUrgentAlarm(): void {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const beep = (t: number, freq: number, dur: number) => {
        const osc = ctx.createOscillator(), g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.frequency.value = freq; osc.type = 'square';
        g.gain.setValueAtTime(0.35, ctx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + dur);
        osc.start(ctx.currentTime + t); osc.stop(ctx.currentTime + t + dur);
      };
      beep(0.0, 800, 0.15); beep(0.2, 900, 0.15);
      beep(0.4, 1000, 0.15); beep(0.6, 1100, 0.15);
      beep(0.8, 1300, 0.5);
    } catch (e) {}
  }
}
