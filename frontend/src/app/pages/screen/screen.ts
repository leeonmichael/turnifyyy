import { Component, OnInit, OnDestroy } from '@angular/core';
import { WebsocketService } from '../../services/websocket.service';
import { HttpClient } from '@angular/common/http';
import { NgIf, NgFor } from '@angular/common';

@Component({
  selector: 'app-screen',
  standalone: true,
  imports: [NgIf, NgFor],
  templateUrl: './screen.html',
  styleUrl: './screen.css'
})
export class Screen implements OnInit, OnDestroy {
  turns: any[] = [];
  currentTurn: any = null;
  nextTurns: any[] = [];
  waitingCount = 0;
  timer = '--:--:--';
  
  private clockInterval: any;

  constructor(
    private ws: WebsocketService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.updateClock();
    this.clockInterval = setInterval(() => this.updateClock(), 1000);

    this.http.get('/api/all/').subscribe({
      next: (data: any) => {
        if (Array.isArray(data.turns)) {
          this.turns = data.turns;
          this.currentTurn = this.turns.find((t: any) => t.status === 'called');
          this.nextTurns = this.turns.filter((t: any) => t.status === 'waiting').slice(0, 5);
          this.waitingCount = this.turns.filter((t: any) => t.status === 'waiting').length;
        }
      },
      error: () => {}
    });

    this.ws.messages$.subscribe({
      next: (msg) => {
        if (Array.isArray(msg)) {
          this.turns = msg;
          this.currentTurn = this.turns.find((t: any) => t.status === 'called');
          this.nextTurns = this.turns.filter((t: any) => t.status === 'waiting').slice(0, 5);
          this.waitingCount = this.turns.filter((t: any) => t.status === 'waiting').length;
        }
      }
    });

    if (!this.ws.isConnected()) {
      this.ws.connect();
    }
    this.ws.send({ action: 'get_all' });
  }

  ngOnDestroy(): void {
    if (this.clockInterval) clearInterval(this.clockInterval);
  }

  updateClock(): void {
    const now = new Date();
    this.timer = now.toLocaleTimeString('es-ES');
  }
}