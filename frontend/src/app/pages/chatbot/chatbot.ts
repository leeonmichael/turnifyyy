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
  micSupported     = false;
  speechSupported   = typeof window !== 'undefined' && 'speechSynthesis' in window;
  isListening       = false;
  voiceEnabled      = false;
  micError: string | null = null;
  private recognition: any = null;
  private speechRecognitionCtor: any = null;

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
    this.setupSpeechRecognition();

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

  private setupSpeechRecognition(): void {
    this.speechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    this.micSupported = !!this.speechRecognitionCtor;
  }

  // Chrome se pone inestable si se reutiliza la misma instancia de
  // SpeechRecognition entre varios start()/stop() (a veces "arranca" y
  // vuelve a cortar sola casi de inmediato) — por eso se crea una instancia
  // nueva cada vez que el usuario le da al micrófono.
  private createRecognition(): any {
    const recognition = new this.speechRecognitionCtor();
    recognition.lang = 'es-ES';
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      // En modo continuo, event.results va creciendo con cada frase — solo
      // se toman las entradas nuevas desde resultIndex para no repetir texto.
      let newText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          newText += event.results[i][0].transcript;
        }
      }
      if (newText) {
        this.userInput = (this.userInput ? this.userInput.trimEnd() + ' ' : '') + newText.trim();
        this.cdr.detectChanges();
      }
    };
    recognition.onerror = (event: any) => {
      this.isListening = false;
      this.micError = this.describeMicError(event?.error);
      this.cdr.detectChanges();
    };
    recognition.onend = () => {
      this.isListening = false;
      this.cdr.detectChanges();
    };
    return recognition;
  }

  private describeMicError(code: string): string | null {
    switch (code) {
      case 'not-allowed':
      case 'service-not-allowed':
        return 'No tengo permiso para usar el micrófono. Revisa el ícono de candado/cámara en la barra de direcciones de tu navegador y permite el acceso al micrófono para este sitio.';
      case 'audio-capture':
        return 'No se detectó ningún micrófono conectado en tu dispositivo.';
      case 'network':
        return 'Hubo un problema de conexión con el servicio de reconocimiento de voz. Intenta de nuevo.';
      case 'no-speech':
        return null; // No dijiste nada — no es realmente un error, no hace falta mostrar nada.
      default:
        return 'No se pudo activar el micrófono. Intenta de nuevo.';
    }
  }

  toggleListening(): void {
    if (!this.micSupported) return;
    if (this.isListening) {
      this.recognition?.stop();
      this.isListening = false;
      return;
    }
    this.micError = null;
    this.recognition = this.createRecognition();
    try {
      this.recognition.start();
      this.isListening = true;
    } catch {
      this.isListening = false;
      this.micError = 'No se pudo activar el micrófono. Intenta de nuevo.';
    }
    this.cdr.detectChanges();
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
