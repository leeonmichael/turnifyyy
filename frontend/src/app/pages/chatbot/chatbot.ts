import { Component, OnInit, OnDestroy, AfterViewChecked, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ChatNotificationService } from '../../services/chat-notification.service';
import { HttpClient, HttpHeaders, HttpEventType, HttpDownloadProgressEvent } from '@angular/common/http';

interface ChatMessage {
  id:        number;
  role:      'bot' | 'user';
  text:      string;
  time:      string;
  typing?:   boolean;
}

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chatbot.html',
  styleUrl:    './chatbot.css'
})
export class Chatbot implements OnInit, AfterViewChecked, OnDestroy {
  @ViewChild('chatBody') private chatBody!: ElementRef;

  messages:    ChatMessage[] = [];
  userInput    = '';
  isTyping     = false;
  private msgId = 0;

  // Sugerencias rápidas para el usuario
  suggestions = [
    '¿Cómo agendo un turno?',
    '¿Qué documentos necesito?',
    '¿Cuánto tiempo debo esperar?',
    '¿Puedo cancelar mi turno?',
    '¿Hay atención preferencial?',
    '¿Cuáles son los horarios?',
  ];

  currentUser: any = null;

  // ── Voz ──────────────────────────────────────────────────────────────
  micSupported     = false;
  speechSupported   = typeof window !== 'undefined' && 'speechSynthesis' in window;
  isListening       = false;
  voiceEnabled      = false;
  micError: string | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null;
  private audioChunks: Blob[] = [];
  private silenceCtx: AudioContext | null = null;

  constructor(
    private router: Router,
    private auth:   AuthService,
    private http:   HttpClient,
    private cdr:    ChangeDetectorRef,
    private chatNotify: ChatNotificationService
  ) {}

  ngOnInit(): void {
    this.currentUser = this.auth.getCurrentUser();
    this.voiceEnabled = localStorage.getItem('turnify_voice_enabled') === 'true';
    this.setupMicrophone();

    // Mensaje de bienvenida del bot
    const name = this.currentUser?.full_name?.split(' ')[0] || 'amigo/a';
    this.addBotMessage(
      `¡Hola${name ? ', ' + name : ''}! Soy TURNITY, tu asistente virtual. Estoy aquí para ayudarte a:\n\n• Agendar y gestionar tu turno\n• Resolver dudas sobre el proceso\n• Orientar a personas de la tercera edad\n\n¿En qué te puedo ayudar hoy?`
    );

    // Avisos proactivos generados mientras el usuario no tenía el chat abierto
    // (ver home.ts, se disparan cuando el turno está por ser llamado).
    for (const pending of this.chatNotify.takePending()) {
      this.addBotMessage(pending.text);
    }
  }

  // ── Micrófono ──────────────────────────────────────────────────────────
  // Se graba el audio en el navegador y se envía a /api/chatbot/voice/,
  // donde el servidor lo transcribe con Gemini y ejecuta la orden (igual que
  // la app móvil). No se usa la Web Speech API del navegador porque depende
  // de los servidores de Google y falla con "network" en Brave, Opera,
  // algunas redes o antivirus, y no existe en Firefox.
  private setupMicrophone(): void {
    this.micSupported =
      typeof window !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof (window as any).MediaRecorder !== 'undefined';
  }

  private describeMicError(err: any): string {
    const name = err?.name || '';
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      return 'No tengo permiso para usar el micrófono. Revisa el ícono de candado en la barra de direcciones y permite el micrófono para este sitio.';
    }
    if (name === 'NotFoundError' || name === 'OverconstrainedError') {
      return 'No se detectó ningún micrófono conectado en tu dispositivo.';
    }
    if (name === 'NotReadableError') {
      return 'El micrófono está siendo usado por otra aplicación. Ciérrala e intenta de nuevo.';
    }
    return 'No se pudo activar el micrófono. Intenta de nuevo.';
  }

  async toggleListening(): Promise<void> {
    if (!this.micSupported || this.isTyping) return;
    if (this.isListening) {
      this.stopRecording();
      return;
    }
    this.micError = null;
    window.speechSynthesis?.cancel();
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      this.micError = this.describeMicError(err);
      this.cdr.detectChanges();
      return;
    }

    this.audioChunks = [];
    this.mediaRecorder = new MediaRecorder(this.mediaStream);
    this.mediaRecorder.ondataavailable = (e: BlobEvent) => {
      if (e.data.size > 0) this.audioChunks.push(e.data);
    };
    this.mediaRecorder.onstop = () => this.onRecordingStopped();
    this.mediaRecorder.start();
    this.isListening = true;
    this.watchSilence(this.mediaStream);
    this.cdr.detectChanges();
  }

  // Corta sola la grabación cuando el usuario deja de hablar (~1,5 s de
  // silencio después de haber hablado), para que la orden se ejecute sin
  // tener que tocar el botón otra vez. Máximo 20 s por nota.
  private watchSilence(stream: MediaStream): void {
    try {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      const startedAt = Date.now();
      let spoke = false;
      let lastVoiceAt = Date.now();
      this.silenceCtx = ctx;

      const tick = () => {
        if (!this.isListening) return;
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const v of data) sum += (v - 128) * (v - 128);
        const rms = Math.sqrt(sum / data.length);
        const now = Date.now();
        if (rms > 6) { spoke = true; lastVoiceAt = now; }
        if ((spoke && now - lastVoiceAt > 1500) || (!spoke && now - startedAt > 8000) || now - startedAt > 20000) {
          this.stopRecording();
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    } catch {
      // Sin AudioContext: el usuario detiene la grabación con el botón.
    }
  }

  private stopRecording(): void {
    this.isListening = false;
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.mediaStream?.getTracks().forEach(t => t.stop());
    this.mediaStream = null;
    this.silenceCtx?.close().catch(() => {});
    this.silenceCtx = null;
    this.cdr.detectChanges();
  }

  private async onRecordingStopped(): Promise<void> {
    const blob = new Blob(this.audioChunks, { type: this.mediaRecorder?.mimeType || 'audio/webm' });
    this.audioChunks = [];
    this.mediaRecorder = null;
    if (blob.size < 2000) return; // grabación vacía

    this.isTyping = true;
    this.cdr.detectChanges();

    let audio: Blob;
    try {
      // Se convierte a WAV porque es el formato que Gemini acepta en todos
      // los casos (Chrome graba en webm, que no siempre lo acepta).
      audio = await this.toWav(blob);
    } catch {
      audio = blob;
    }

    const history = this.messages
      .filter(m => !m.typing)
      .slice(-10)
      .map(m => ({ role: m.role, text: m.text }));

    const form = new FormData();
    form.append('audio', audio, audio.type === 'audio/wav' ? 'voice.wav' : 'voice.webm');
    form.append('history', JSON.stringify(history));

    this.http.post('/api/chatbot/voice/', form, { responseType: 'text' }).subscribe({
      next: (raw) => {
        this.isTyping = false;
        let transcript = '';
        let reply = '';
        for (const line of raw.split('\n')) {
          if (!line.trim()) continue;
          try {
            const evt = JSON.parse(line);
            if (evt.type === 'transcript') transcript = evt.text;
            if (evt.type === 'chunk') reply += evt.text;
          } catch { /* línea incompleta */ }
        }
        if (transcript) this.addUserMessage(transcript);
        this.addBotMessage(
          reply ||
          (transcript ? this.generateLocalResponse(transcript)
                      : 'No logré entender el audio. Intenta de nuevo hablando un poco más claro.')
        );
      },
      error: (err) => {
        this.isTyping = false;
        if (err?.status === 422) {
          this.micError = 'No logré entender el audio. Intenta de nuevo hablando un poco más claro y cerca del micrófono.';
        } else if (err?.status === 401) {
          this.micError = 'Tu sesión expiró. Vuelve a iniciar sesión.';
        } else {
          // Se muestra el motivo que devuelve el servidor (cuota de Gemini,
          // API key...) para poder diagnosticar el problema.
          let detail = '';
          try {
            const body = typeof err?.error === 'string' ? JSON.parse(err.error) : err?.error;
            detail = body?.detail || body?.message || '';
          } catch { /* respuesta no JSON */ }
          this.micError = `El asistente de voz no está disponible en este momento (código ${err?.status ?? '?'}` +
            `${detail ? ': ' + detail.slice(0, 160) : ''}). Escribe tu mensaje, por favor.`;
        }
        this.cdr.detectChanges();
      },
    });
  }

  private async toWav(blob: Blob): Promise<Blob> {
    const ctx = new AudioContext();
    try {
      const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
      const rate = 16000;
      const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * rate), rate);
      const src = offline.createBufferSource();
      src.buffer = decoded;
      src.connect(offline.destination);
      src.start();
      const samples = (await offline.startRendering()).getChannelData(0);

      const buffer = new ArrayBuffer(44 + samples.length * 2);
      const view = new DataView(buffer);
      const writeStr = (o: number, s: string) => {
        for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
      };
      writeStr(0, 'RIFF');
      view.setUint32(4, 36 + samples.length * 2, true);
      writeStr(8, 'WAVE');
      writeStr(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);        // PCM
      view.setUint16(22, 1, true);        // mono
      view.setUint32(24, rate, true);
      view.setUint32(28, rate * 2, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      writeStr(36, 'data');
      view.setUint32(40, samples.length * 2, true);
      for (let i = 0; i < samples.length; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      }
      return new Blob([buffer], { type: 'audio/wav' });
    } finally {
      ctx.close().catch(() => {});
    }
  }

  toggleVoice(): void {
    this.voiceEnabled = !this.voiceEnabled;
    localStorage.setItem('turnify_voice_enabled', String(this.voiceEnabled));
    if (!this.voiceEnabled) {
      window.speechSynthesis?.cancel();
    }
  }

  private speak(text: string): void {
    if (!this.voiceEnabled || !this.speechSupported) return;
    try {
      window.speechSynthesis.cancel();
      const clean = text.replace(/[*_#•\[\]]/g, '').replace(/https?:\/\/\S+/g, '');
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = 'es-ES';
      utterance.rate = 1;
      window.speechSynthesis.speak(utterance);
    } catch {
      // Si falla la síntesis de voz, simplemente no se lee en voz alta.
    }
  }

  ngOnDestroy(): void {
    if (this.isListening) this.stopRecording();
  }

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    try {
      const el = this.chatBody.nativeElement;
      el.scrollTop = el.scrollHeight;
      // Segundo intento tras el próximo frame por si una imagen (ej. avatar)
      // aún no había terminado de cargar y cambió la altura del contenido.
      requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
    } catch (_) {}
  }

  private now(): string {
    return new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }

  private addBotMessage(text: string): void {
    this.messages.push({ id: ++this.msgId, role: 'bot', text, time: this.now() });
    this.cdr.detectChanges();
    this.speak(text);
  }

  private addUserMessage(text: string): void {
    this.messages.push({ id: ++this.msgId, role: 'user', text, time: this.now() });
    this.cdr.detectChanges();
  }

  sendMessage(): void {
    const text = this.userInput.trim();
    if (!text || this.isTyping) return;
    this.userInput = '';
    this.addUserMessage(text);
    this.getBotResponse(text);
  }

  sendSuggestion(text: string): void {
    if (this.isTyping) return;
    this.addUserMessage(text);
    this.getBotResponse(text);
  }

  private getBotResponse(userText: string): void {
    this.isTyping = true;
    this.cdr.detectChanges();

    const history = this.messages
      .filter(m => !m.typing)
      .slice(-10)
      .map(m => ({ role: m.role, text: m.text }));

    let botMsg: ChatMessage | null = null;
    let processedLength = 0;
    let hadStreamError = false;

    this.http.post('/api/chatbot/', { message: userText, history }, {
      observe: 'events',
      responseType: 'text',
      reportProgress: true,
    }).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.DownloadProgress) {
          const partial = (event as HttpDownloadProgressEvent).partialText || '';
          const newText = partial.slice(processedLength);
          processedLength = partial.length;
          if (!newText) return;

          for (const line of newText.split('\n')) {
            if (!line.trim()) continue;
            let evt: any;
            try { evt = JSON.parse(line); } catch { continue; }

            if (evt.type === 'chunk') {
              if (!botMsg) {
                this.isTyping = false;
                botMsg = { id: ++this.msgId, role: 'bot', text: '', time: this.now() };
                this.messages.push(botMsg);
              }
              botMsg.text += evt.text;
              this.cdr.detectChanges();
            } else if (evt.type === 'error') {
              hadStreamError = true;
            }
          }
        } else if (event.type === HttpEventType.Response) {
          this.isTyping = false;
          if (botMsg) {
            const finalMsg = botMsg;
            if (hadStreamError && !finalMsg.text) {
              this.messages = this.messages.filter(m => m !== finalMsg);
              this.addBotMessage(this.generateLocalResponse(userText));
            } else {
              if (hadStreamError) finalMsg.text += '\n\n_(se interrumpió la conexión con el asistente)_';
              this.speak(finalMsg.text);
            }
          } else {
            this.addBotMessage(this.generateLocalResponse(userText));
          }
          this.cdr.detectChanges();
        }
      },
      error: () => {
        // Asistente de IA no disponible (sin GEMINI_API_KEY configurada, red caída, etc.)
        // -> usar respuestas locales como respaldo.
        const delay = 500 + Math.random() * 400;
        setTimeout(() => {
          this.isTyping = false;
          if (!botMsg) this.addBotMessage(this.generateLocalResponse(userText));
          this.cdr.detectChanges();
        }, delay);
      }
    });
  }

  // Respuestas locales de fallback (reemplazar con IA real)
  private generateLocalResponse(text: string): string {
    const t = text.toLowerCase();

    if (/(hola|buenos|buenas|hey|saludos)/.test(t))
      return '¡Hola! ¿Cómo te puedo ayudar hoy?';

    if (/(agend|pedir|sacar|solicitar|crear).*(turno|cita|número)/.test(t) || /(turno|cita).*(agend|pedir|sacar)/.test(t) || t.includes('cómo agendo'))
      return 'Para agendar tu turno:\n\n1. Ve a la pantalla principal (botón "Inicio")\n2. Selecciona el tipo de atención (General, Preferencial, Emergencia)\n3. Elige la modalidad: Presencial o Virtual\n4. Selecciona tu sede más cercana\n5. Presiona "Pedir mi Turno"\n\nRecibirás tu número de turno al instante.';

    if (/(document|papel|requisito|necesit)/.test(t))
      return 'Los documentos que generalmente necesitas:\n\n• Documento de identidad (CC, CE, Pasaporte)\n• Carnet de afiliación si aplica\n• Documentos específicos según el trámite\n\nTe recomiendo llegar con copias de todos tus documentos. ¿Tienes alguna duda adicional?';

    if (/(espera|tiempo|demora|cuánto|minuto|hora)/.test(t))
      return 'El tiempo de espera depende de:\n\n• Cantidad de turnos en cola\n• Tipo de atención solicitada\n• Sede seleccionada\n\nPuedes ver tu posición en tiempo real desde la pantalla de inicio. Cuando queden 2 turnos antes del tuyo, sonará una alarma de aviso.';

    if (/(cancel|eliminar|borrar).*(turno|cita)/.test(t) || t.includes('puedo cancelar'))
      return 'Para cancelar tu turno:\n\n• Desde "Inicio": botón "Cancelar turno" bajo tu número\n• Desde "Mis Turnos": botón rojo al lado de cada turno activo\n\nRecuerda que solo puedes cancelar turnos en estado "En espera". Una vez que te llamen, ya no es posible cancelarlo.';

    if (/(preferencial|tercera.?edad|discapacidad|embarazada|adulto.?mayor|prioridad)/.test(t))
      return 'Atención Preferencial:\n\nTenemos turno tipo **B - Preferencial** para:\n• Adultos mayores (+60 años)\n• Personas con discapacidad\n• Mujeres embarazadas\n• Madres con bebés\n\nAl pedir turno, selecciona "Preferencial (B)" y serás atendido con prioridad.';

    if (/(horario|hora|abre|cierra|atien|cuándo)/.test(t))
      return 'Horarios de atención:\n\n• Lunes a Viernes: 7:00 am - 5:00 pm\n• Sábados: 8:00 am - 12:00 pm\n• Domingos y festivos: Cerrado\n\nTe recomendamos llegar antes de las 4:00 pm para garantizar tu atención.';

    if (/(sede|oficina|dirección|dónde|ubicación)/.test(t))
      return 'Puedes ver las sedes disponibles al pedir tu turno en la sección "Sede". Selecciona la más cercana a ti.\n\nSi necesitas la dirección específica de alguna sede, consulta con el personal de atención.';

    if (/(virtual|en.?línea|online|internet)/.test(t))
      return 'Turno Virtual:\n\nSelecciona "Virtual" como modalidad al pedir tu turno. Te atenderán por videollamada o chat según disponibilidad.\n\nAsegúrate de tener buena conexión a internet y estar en un lugar tranquilo.';

    if (/(gracias|listo|perfecto|excelente|genial|ok)/.test(t))
      return 'Con gusto. Estoy aquí cuando me necesites. ¿Hay algo más en lo que pueda ayudarte?';

    if (/(adiós|hasta luego|chao|bye|gracias.?nada.?más)/.test(t))
      return 'Hasta luego. Fue un placer ayudarte. Que te atiendan pronto y tengas un excelente día.';

    // Respuesta por defecto cuando no se reconoce la pregunta
    return `Entendí tu mensaje: "${text}"\n\nPor ahora estoy en fase de configuración con IA. Pronto podré responder preguntas más complejas. Mientras tanto, puedo ayudarte con:\n\n• Agendar un turno\n• Información sobre documentos\n• Tiempos de espera\n• Cancelar un turno\n\n¿Sobre cuál de estos temas quieres saber más?`;
  }

  goBack(): void {
    this.router.navigate(['/home']);
  }

  clearChat(): void {
    this.messages = [];
    this.msgId    = 0;
    const name    = this.currentUser?.full_name?.split(' ')[0] || 'amigo/a';
    this.addBotMessage(`Chat reiniciado. Hola de nuevo${name ? ', ' + name : ''}. ¿En qué te puedo ayudar?`);
  }
}
