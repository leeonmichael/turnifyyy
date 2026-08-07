import { Component, OnInit, AfterViewChecked, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';

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

  constructor(
    private router: Router,
    private auth:   AuthService,
    private http:   HttpClient,
    private cdr:    ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.currentUser = this.auth.getCurrentUser();
    // Mensaje de bienvenida del bot
    const name = this.currentUser?.full_name?.split(' ')[0] || 'amigo/a';
    this.addBotMessage(
      `¡Hola${name ? ', ' + name : ''}! 👋 Soy el asistente virtual de Turnify. Estoy aquí para ayudarte a:\n\n• Agendar y gestionar tu turno\n• Resolver dudas sobre el proceso\n• Orientar a personas de la tercera edad\n\n¿En qué te puedo ayudar hoy?`
    );
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

    // ── PUNTO DE INTEGRACIÓN DE IA ──────────────────────────────────────
    // Aquí se conectará el modelo de IA (Claude, GPT, Gemini, etc.)
    // Por ahora usa respuestas locales como fallback.
    // Para integrar IA, reemplaza este bloque con una llamada HTTP:
    //
    //   this.http.post('/api/chatbot/', { message: userText, user: this.currentUser })
    //     .subscribe({ next: (res: any) => { this.showBotReply(res.reply); }, error: () => { ... } });
    //
    // ────────────────────────────────────────────────────────────────────

    const delay = 900 + Math.random() * 600;
    setTimeout(() => {
      const reply = this.generateLocalResponse(userText);
      this.isTyping = false;
      this.addBotMessage(reply);
    }, delay);
  }

  // Respuestas locales de fallback (reemplazar con IA real)
  private generateLocalResponse(text: string): string {
    const t = text.toLowerCase();

    if (/(hola|buenos|buenas|hey|saludos)/.test(t))
      return '¡Hola! 😊 ¿Cómo te puedo ayudar hoy?';

    if (/(agend|pedir|sacar|solicitar|crear).*(turno|cita|número)/.test(t) || /(turno|cita).*(agend|pedir|sacar)/.test(t) || t.includes('cómo agendo'))
      return '📋 Para agendar tu turno:\n\n1. Ve a la pantalla principal (botón "Inicio")\n2. Selecciona el tipo de atención (General, Preferencial, Emergencia)\n3. Elige la modalidad: Presencial o Virtual\n4. Selecciona tu sede más cercana\n5. Presiona "Pedir mi Turno"\n\n¡Recibirás tu número de turno al instante! 🎫';

    if (/(document|papel|requisito|necesit)/.test(t))
      return '📄 Los documentos que generalmente necesitas:\n\n• Documento de identidad (CC, CE, Pasaporte)\n• Carnet de afiliación si aplica\n• Documentos específicos según el trámite\n\nTe recomiendo llegar con copias de todos tus documentos. ¿Tienes alguna duda adicional?';

    if (/(espera|tiempo|demora|cuánto|minuto|hora)/.test(t))
      return '⏱️ El tiempo de espera depende de:\n\n• Cantidad de turnos en cola\n• Tipo de atención solicitada\n• Sede seleccionada\n\nPuedes ver tu posición en tiempo real desde la pantalla de inicio. Cuando queden 2 turnos antes del tuyo, ¡sonará una alarma de aviso! 🔔';

    if (/(cancel|eliminar|borrar).*(turno|cita)/.test(t) || t.includes('puedo cancelar'))
      return '❌ Para cancelar tu turno:\n\n• Desde "Inicio": botón "Cancelar turno" bajo tu número\n• Desde "Mis Turnos": botón rojo al lado de cada turno activo\n\nRecuerda que solo puedes cancelar turnos en estado "En espera". Una vez que te llamen, ya no es posible cancelarlo.';

    if (/(preferencial|tercera.?edad|discapacidad|embarazada|adulto.?mayor|prioridad)/.test(t))
      return '💛 Atención Preferencial:\n\nTenemos turno tipo **B - Preferencial** para:\n• Adultos mayores (+60 años)\n• Personas con discapacidad\n• Mujeres embarazadas\n• Madres con bebés\n\nAl pedir turno, selecciona "Preferencial (B)" y serás atendido con prioridad. ¡Estamos para servirte! 🤝';

    if (/(horario|hora|abre|cierra|atien|cuándo)/.test(t))
      return '🕐 Horarios de atención:\n\n• Lunes a Viernes: 7:00 am - 5:00 pm\n• Sábados: 8:00 am - 12:00 pm\n• Domingos y festivos: Cerrado\n\nTe recomendamos llegar antes de las 4:00 pm para garantizar tu atención.';

    if (/(sede|oficina|dirección|dónde|ubicación)/.test(t))
      return '📍 Puedes ver las sedes disponibles al pedir tu turno en la sección "Sede". Selecciona la más cercana a ti.\n\nSi necesitas la dirección específica de alguna sede, ¡consulta con el personal de atención!';

    if (/(virtual|en.?línea|online|internet)/.test(t))
      return '💻 Turno Virtual:\n\nSelecciona "Virtual" como modalidad al pedir tu turno. Te atenderán por videollamada o chat según disponibilidad.\n\nAsegúrate de tener buena conexión a internet y estar en un lugar tranquilo. 📡';

    if (/(gracias|listo|perfecto|excelente|genial|ok)/.test(t))
      return '¡Con gusto! 😊 Estoy aquí cuando me necesites. ¿Hay algo más en lo que pueda ayudarte?';

    if (/(adiós|hasta luego|chao|bye|gracias.?nada.?más)/.test(t))
      return '¡Hasta luego! 👋 Fue un placer ayudarte. ¡Que te atiendan pronto y tengas un excelente día! 🌟';

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
    this.addBotMessage(`¡Chat reiniciado! 🔄 Hola de nuevo${name ? ', ' + name : ''}. ¿En qué te puedo ayudar?`);
  }
}
