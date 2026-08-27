import { Component, OnInit, AfterViewChecked, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
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
  // Botones de respuesta rápida que TURNITY ofrece para preguntas cerradas
  // (ver herramienta "mostrar_opciones" en el backend). Se vacía una vez
  // que el usuario elige una, para no dejar botones "viejos" clicables.
  options?:  string[];
}

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chatbot.html',
  styleUrl:    './chatbot.css'
})
export class Chatbot implements OnInit, AfterViewChecked {
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
  // Se graba el audio con MediaRecorder y se envía tal cual al backend
  // (/api/chatbot/voice/), donde Gemini lo transcribe y ejecuta la acción
  // pedida en el mismo paso. Así se evita el SpeechRecognition nativo del
  // navegador, que depende de un servicio de voz de Google aparte y puede
  // fallar por restricciones de red ajenas a esta app.
  micSupported     = false;
  speechSupported   = typeof window !== 'undefined' && 'speechSynthesis' in window;
  isListening       = false;
  isSpeaking        = false;
  voiceEnabled      = false;
  micError: string | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private mediaStream: MediaStream | null = null;
  private recordingTimeout: any = null;
  private recordingStartedAt = 0;
  private static readonly MAX_RECORDING_MS = 20000;
  private static readonly MIN_RECORDING_MS = 500;

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
    this.setupMicSupport();
    // Chrome carga la lista de voces de forma asíncrona — se "calienta" acá
    // para que ya esté disponible la primera vez que el bot tenga que hablar.
    if (this.speechSupported) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }

    // Si ya había una conversación guardada (p. ej. el usuario salió del
    // chat y volvió), se restaura tal cual en vez de mostrar el saludo
    // inicial de nuevo.
    if (!this.restoreHistory()) {
      const name = this.currentUser?.full_name?.split(' ')[0] || 'amigo/a';
      this.addBotMessage(
        `¡Hola${name ? ', ' + name : ''}! Soy TURNITY, tu asistente virtual. Estoy aquí para ayudarte a:\n\n• Agendar y gestionar tu turno\n• Resolver dudas sobre el proceso\n• Orientar a personas de la tercera edad\n\n¿En qué te puedo ayudar hoy?`
      );
    }

    // Avisos proactivos generados mientras el usuario no tenía el chat abierto
    // (ver home.ts, se disparan cuando el turno está por ser llamado).
    for (const pending of this.chatNotify.takePending()) {
      this.addBotMessage(pending.text);
    }
  }

  private setupMicSupport(): void {
    this.micSupported = typeof window !== 'undefined'
      && !!navigator.mediaDevices?.getUserMedia
      && !!(window as any).MediaRecorder;
  }

  private pickSupportedMimeType(): string | undefined {
    const MR: any = (window as any).MediaRecorder;
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
    return candidates.find(c => MR?.isTypeSupported?.(c));
  }

  private describeMicError(code: string | undefined): string | null {
    switch (code) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
      case 'SecurityError':
        return 'No tengo permiso para usar el micrófono. Revisa el ícono de candado/cámara en la barra de direcciones de tu navegador y permite el acceso al micrófono para este sitio.';
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return 'No se detectó ningún micrófono conectado en tu dispositivo.';
      case 'NotReadableError':
      case 'TrackStartError':
        return 'No se pudo acceder al micrófono. Puede estar siendo usado por otra aplicación.';
      default:
        return 'No se pudo activar el micrófono. Intenta de nuevo.';
    }
  }

  // Al soltar/tocar de nuevo el micrófono se detiene la grabación y el audio
  // se envía automáticamente al asistente (ver sendVoiceMessage) — no hace
  // falta escribir ni presionar "Enviar", como en una conversación real.
  async toggleListening(): Promise<void> {
    if (!this.micSupported || this.isTyping) return;
    if (this.isListening) {
      this.mediaRecorder?.stop();
      return;
    }
    // Evita iniciar una segunda grabación mientras la anterior sigue
    // arrancando (p. ej. un doble toque accidental) — eso producía
    // grabaciones casi vacías que Gemini transcribía como ruido sin sentido.
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') return;

    this.micError = null;
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      this.audioChunks = [];
      const mimeType = this.pickSupportedMimeType();
      this.mediaRecorder = mimeType ? new MediaRecorder(this.mediaStream, { mimeType }) : new MediaRecorder(this.mediaStream);

      this.mediaRecorder.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) this.audioChunks.push(e.data);
      };
      this.mediaRecorder.onstop = () => {
        clearTimeout(this.recordingTimeout);
        this.mediaStream?.getTracks().forEach(t => t.stop());
        this.mediaStream = null;
        this.isListening = false;
        const durationMs = Date.now() - this.recordingStartedAt;
        const blob = new Blob(this.audioChunks, { type: this.mediaRecorder?.mimeType || 'audio/webm' });
        this.audioChunks = [];
        // Toque accidental o soltado casi al instante: no hay suficiente
        // audio real para transcribir (antes esto se enviaba igual y
        // Gemini "inventaba" una transcripción sin sentido a partir de
        // silencio/ruido, lo que confundía al asistente).
        if (durationMs < Chatbot.MIN_RECORDING_MS || blob.size < 1000) {
          this.micError = 'No alcancé a grabar nada. Toca el micrófono, espera el "Grabando..." y habla con calma.';
          this.cdr.detectChanges();
          return;
        }
        this.cdr.detectChanges();
        this.sendVoiceMessage(blob);
      };

      this.mediaRecorder.start();
      this.isListening = true;
      this.recordingStartedAt = Date.now();
      // Corte de seguridad por si el usuario olvida detener la grabación.
      this.recordingTimeout = setTimeout(() => this.mediaRecorder?.stop(), Chatbot.MAX_RECORDING_MS);
    } catch (err: any) {
      this.isListening = false;
      this.micError = this.describeMicError(err?.name);
    }
    this.cdr.detectChanges();
  }

  private sendVoiceMessage(blob: Blob): void {
    this.isTyping = true;
    this.cdr.detectChanges();

    const history = this.messages
      .filter(m => !m.typing)
      .slice(-10)
      .map(m => ({ role: m.role, text: m.text }));

    const form = new FormData();
    form.append('audio', blob, 'voice-message.webm');
    form.append('history', JSON.stringify(history));

    let userMsg: ChatMessage | null = null;
    let botMsg: ChatMessage | null = null;
    let pendingOptions: string[] | null = null;
    let processedLength = 0;
    let hadStreamError = false;

    this.http.post('/api/chatbot/voice/', form, {
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

            if (evt.type === 'transcript') {
              this.isTyping = false;
              userMsg = { id: ++this.msgId, role: 'user', text: evt.text, time: this.now() };
              this.messages.push(userMsg);
              this.isTyping = true;
              this.cdr.detectChanges();
            } else if (evt.type === 'chunk') {
              if (!botMsg) {
                this.isTyping = false;
                botMsg = { id: ++this.msgId, role: 'bot', text: '', time: this.now(), options: pendingOptions || undefined };
                this.messages.push(botMsg);
              }
              botMsg.text += evt.text;
              this.cdr.detectChanges();
            } else if (evt.type === 'options') {
              pendingOptions = Array.isArray(evt.options) ? evt.options : null;
              if (botMsg && pendingOptions) botMsg.options = pendingOptions;
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
              this.addBotMessage(this.generateLocalResponse(userMsg?.text || ''));
            } else {
              if (hadStreamError) finalMsg.text += '\n\n_(se interrumpió la conexión con el asistente)_';
              // En un mensaje de voz siempre se responde en voz, independiente
              // del interruptor de lectura (el usuario está hablando, no escribiendo).
              this.speak(finalMsg.text);
            }
          } else if (!userMsg) {
            this.addBotMessage(this.generateLocalResponse(''));
          }
          this.persistHistory();
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        this.isTyping = false;
        let message = '';
        try { message = JSON.parse(err?.error)?.message || ''; } catch {}
        setTimeout(() => {
          this.addBotMessage(message || this.generateLocalResponse(''));
          this.cdr.detectChanges();
        }, 300);
      }
    });
  }

  toggleVoice(): void {
    this.voiceEnabled = !this.voiceEnabled;
    localStorage.setItem('turnify_voice_enabled', String(this.voiceEnabled));
    if (!this.voiceEnabled) {
      window.speechSynthesis?.cancel();
      this.isSpeaking = false;
    }
  }

  // Prioriza voces LOCALES (no dependen de un servicio en la nube, a
  // diferencia de las voces "en línea" tipo Google que algunos navegadores
  // ofrecen) — así la lectura en voz alta no hereda los mismos problemas de
  // red que ya tuvimos con el reconocimiento de voz. Entre las locales,
  // prioriza español de España y luego cualquier español disponible.
  private pickBestVoice(): SpeechSynthesisVoice | null {
    const voices = window.speechSynthesis.getVoices();
    const esVoices = voices.filter(v => v.lang?.toLowerCase().startsWith('es'));
    if (!esVoices.length) return null;
    const candidates = [
      ...esVoices.filter(v => v.localService && /es-es/i.test(v.lang)),
      ...esVoices.filter(v => v.localService && /es-(419|mx|us|co|ar)/i.test(v.lang)),
      ...esVoices.filter(v => v.localService),
      ...esVoices,
    ];
    return candidates[0] ?? null;
  }

  // Quita marcas de Markdown y normaliza saltos de línea a pausas, para que
  // no se lean símbolos sueltos ("asterisco", "numeral") ni se atropelle
  // todo el texto como un único bloque corrido.
  private sanitizeForSpeech(text: string): string {
    return text
      .replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g, '$1')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/[*_#>`~]/g, '')
      .replace(/^\s*[-•]\s+/gm, '')
      .replace(/\n{2,}/g, '. ')
      .replace(/\n/g, ', ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  private speak(text: string): void {
    if (!this.voiceEnabled || !this.speechSupported) return;
    try {
      window.speechSynthesis.cancel();
      const clean = this.sanitizeForSpeech(text);
      if (!clean) return;

      const voice = this.pickBestVoice();
      // Se divide en oraciones y se encolan una a una (en vez de un único
      // SpeechSynthesisUtterance gigante) para que la voz respete pausas
      // naturales entre ideas y no suene como un bloque de texto corrido.
      const sentences = (clean.match(/[^.!?]+[.!?]*/g) || [clean]).map(s => s.trim()).filter(Boolean);

      this.isSpeaking = true;
      const speakNext = (i: number) => {
        if (i >= sentences.length) {
          this.isSpeaking = false;
          this.cdr.detectChanges();
          return;
        }
        const utterance = new SpeechSynthesisUtterance(sentences[i]);
        utterance.lang = voice?.lang || 'es-ES';
        if (voice) utterance.voice = voice;
        utterance.rate = 0.95;
        utterance.pitch = 1;
        utterance.onend = () => speakNext(i + 1);
        utterance.onerror = () => { this.isSpeaking = false; this.cdr.detectChanges(); };
        window.speechSynthesis.speak(utterance);
      };
      speakNext(0);
    } catch {
      this.isSpeaking = false;
      // Si falla la síntesis de voz, simplemente no se lee en voz alta.
    }
  }

  stopSpeaking(): void {
    window.speechSynthesis?.cancel();
    this.isSpeaking = false;
    this.cdr.detectChanges();
  }

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    try { this.chatBody.nativeElement.scrollTop = this.chatBody.nativeElement.scrollHeight; }
    catch (_) {}
  }

  private now(): string {
    return new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }

  private addBotMessage(text: string): void {
    this.messages.push({ id: ++this.msgId, role: 'bot', text, time: this.now() });
    this.cdr.detectChanges();
    this.speak(text);
    this.persistHistory();
  }

  private addUserMessage(text: string): void {
    this.messages.push({ id: ++this.msgId, role: 'user', text, time: this.now() });
    this.cdr.detectChanges();
    this.persistHistory();
  }

  // La conversación se guarda por usuario (Angular destruye este componente
  // al salir de la página, así que sin esto se perdía todo el historial al
  // volver al chat). Se limita a los últimos 60 mensajes para no acumular
  // indefinidamente en localStorage.
  private historyKey(): string {
    const username = this.currentUser?.username || 'anon';
    return `turnify_chat_history_${username}`;
  }

  private persistHistory(): void {
    try {
      const toSave = this.messages.filter(m => !m.typing).slice(-60);
      localStorage.setItem(this.historyKey(), JSON.stringify({ msgId: this.msgId, messages: toSave }));
    } catch {
      // localStorage lleno o no disponible (modo privado, etc.) — no es crítico.
    }
  }

  private restoreHistory(): boolean {
    try {
      const raw = localStorage.getItem(this.historyKey());
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed?.messages) || !parsed.messages.length) return false;
      this.messages = parsed.messages;
      this.msgId = parsed.msgId || this.messages[this.messages.length - 1].id || 0;
      return true;
    } catch {
      return false;
    }
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

  // Botón de respuesta rápida (ver herramienta "mostrar_opciones"): se
  // limpian las opciones de ese mensaje para que no queden clicables una
  // vez respondidas, y se envía la opción elegida como si el usuario la
  // hubiera escrito.
  chooseOption(msg: ChatMessage, option: string): void {
    if (this.isTyping) return;
    msg.options = undefined;
    this.persistHistory();
    this.sendSuggestion(option);
  }

  private getBotResponse(userText: string): void {
    this.isTyping = true;
    this.cdr.detectChanges();

    const history = this.messages
      .filter(m => !m.typing)
      .slice(-10)
      .map(m => ({ role: m.role, text: m.text }));

    let botMsg: ChatMessage | null = null;
    let pendingOptions: string[] | null = null;
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
                botMsg = { id: ++this.msgId, role: 'bot', text: '', time: this.now(), options: pendingOptions || undefined };
                this.messages.push(botMsg);
              }
              botMsg.text += evt.text;
              this.cdr.detectChanges();
            } else if (evt.type === 'options') {
              pendingOptions = Array.isArray(evt.options) ? evt.options : null;
              if (botMsg && pendingOptions) botMsg.options = pendingOptions;
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
          this.persistHistory();
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

    // Respuesta por defecto cuando no se reconoce la pregunta (o el asistente
    // con IA no está disponible en este momento). Mantiene el mismo alcance
    // que TURNITY: solo temas del sistema de gestión de turnos.
    return `En este momento puedo ayudarte con estos temas del sistema de gestión de turnos:\n\n• Agendar un turno\n• Documentos requeridos\n• Tiempos de espera y posición en la fila\n• Cancelar un turno\n• Atención preferencial\n• Horarios y sedes\n• Turnos virtuales\n\n¿Sobre cuál de estos te puedo orientar?`;
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
