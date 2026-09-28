import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import * as Speech from 'expo-speech';
import { colors } from '../theme';
import { API_BASE_URL } from '../api/config';
import { getToken } from '../api/client';
import { useAuth } from '../context/AuthContext';

// expo-speech-recognition es un módulo nativo: funciona en un development
// build / APK, pero no existe dentro de Expo Go. Se carga de forma opcional
// para que la app no se caiga; sin él se usa el micrófono del teclado.
let SpeechRecognition: any = null;
try {
  SpeechRecognition = require('expo-speech-recognition').ExpoSpeechRecognitionModule;
} catch {
  SpeechRecognition = null;
}

interface Msg {
  id: number;
  role: 'bot' | 'user';
  text: string;
}

const SUGGESTIONS = ['Pídeme un turno', '¿Cuál es mi turno?', '¿Cuántos faltan?', 'Cancela mi turno'];

async function askBot(message: string, history: Msg[]): Promise<string | null> {
  const token = await getToken();
  const res = await fetch(`${API_BASE_URL}/chatbot/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      message,
      history: history.slice(-10).map((m) => ({ role: m.role, text: m.text })),
    }),
  });
  if (res.status === 503) {
    return 'El asistente de IA no está disponible en este momento. Puedo ejecutar órdenes como "pídeme un turno", "cancela mi turno", "¿cuál es mi turno?" o "¿cuántos faltan?".';
  }
  if (!res.ok) return null;
  // La respuesta es NDJSON (una línea JSON por fragmento).
  const raw = await res.text();
  let text = '';
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      const evt = JSON.parse(line);
      if (evt.type === 'chunk') text += evt.text;
    } catch {
      // línea incompleta, se ignora
    }
  }
  return text || null;
}

const clean = (t: string) => t.replace(/\*\*/g, '');

export default function ChatbotScreen() {
  const { user } = useAuth() as any;
  const name = user?.full_name?.split(' ')[0] || '';
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: 0,
      role: 'bot',
      text: `¡Hola${name ? ', ' + name : ''}! Soy TURNITY. Puedes escribirme o hablarme con el micrófono: por ejemplo "pídeme un turno preferencial" o "cancela mi turno".`,
    },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const idRef = useRef(1);
  const listRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const heardRef = useRef('');

  const push = (role: Msg['role'], text: string) => {
    const msg = { id: idRef.current++, role, text };
    setMessages((prev) => [...prev, msg]);
    return msg;
  };

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || busy) return;
    setInput('');
    setNotice(null);
    const history = messagesRef.current;
    push('user', text);
    setBusy(true);
    try {
      const reply = (await askBot(text, history)) || 'No pude procesar tu mensaje, intenta de nuevo.';
      push('bot', clean(reply));
      if (voiceOn) {
        Speech.stop();
        Speech.speak(clean(reply).replace(/https?:\/\/\S+/g, ''), { language: 'es-ES' });
      }
    } catch {
      push('bot', 'No se pudo conectar con el servidor. Revisa tu conexión a internet.');
    } finally {
      setBusy(false);
    }
  };

  // ── Reconocimiento de voz (solo si el módulo nativo está disponible) ──
  const sendRef = useRef(send);
  sendRef.current = send;
  useEffect(() => {
    if (!SpeechRecognition) return;
    const subs = [
      SpeechRecognition.addListener('result', (e: any) => {
        const transcript = e?.results?.[0]?.transcript || '';
        heardRef.current = transcript;
        setInput(transcript);
      }),
      SpeechRecognition.addListener('end', () => {
        setListening(false);
        const heard = heardRef.current;
        heardRef.current = '';
        // Al terminar de hablar se envía solo: el asistente ejecuta la orden.
        if (heard.trim()) sendRef.current(heard);
      }),
      SpeechRecognition.addListener('error', (e: any) => {
        setListening(false);
        if (e?.error !== 'no-speech') setNotice('No se pudo usar el micrófono. Intenta de nuevo.');
      }),
    ];
    return () => subs.forEach((s: any) => s?.remove?.());
  }, []);

  const toggleMic = async () => {
    setNotice(null);
    if (!SpeechRecognition) {
      // Expo Go: no hay reconocimiento nativo; se abre el teclado para usar
      // su botón de micrófono (dictado) y luego se toca Enviar.
      inputRef.current?.focus();
      setNotice('Toca el micrófono de tu teclado para dictar y luego Enviar.');
      return;
    }
    if (listening) {
      SpeechRecognition.stop();
      return;
    }
    try {
      const perm = await SpeechRecognition.requestPermissionsAsync();
      if (!perm?.granted) {
        setNotice('Debes permitir el acceso al micrófono en los ajustes del teléfono.');
        return;
      }
      Speech.stop();
      heardRef.current = '';
      SpeechRecognition.start({ lang: 'es-CO', interimResults: true, continuous: false });
      setListening(true);
    } catch {
      setListening(false);
      setNotice('No se pudo activar el micrófono. Intenta de nuevo.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={styles.topBar}>
        <Text style={styles.topTitle}>Asistente TURNITY</Text>
        <TouchableOpacity
          onPress={() => {
            if (voiceOn) Speech.stop();
            setVoiceOn(!voiceOn);
          }}
        >
          <Text style={styles.topToggle}>{voiceOn ? '🔊 Voz activada' : '🔇 Voz apagada'}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={{ padding: 16 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.role === 'user' ? styles.bubbleUser : styles.bubbleBot]}>
            <Text style={item.role === 'user' ? styles.textUser : styles.textBot}>{item.text}</Text>
          </View>
        )}
        ListFooterComponent={
          busy ? (
            <View style={[styles.bubble, styles.bubbleBot]}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null
        }
      />

      {messages.length <= 1 && !busy && (
        <View style={styles.suggestions}>
          {SUGGESTIONS.map((s) => (
            <TouchableOpacity key={s} style={styles.chip} onPress={() => send(s)}>
              <Text style={styles.chipText}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {notice && <Text style={styles.notice}>{notice}</Text>}

      <View style={styles.inputBar}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder={listening ? 'Escuchando...' : 'Escribe o habla...'}
          placeholderTextColor={colors.textMuted}
          editable={!busy}
          onSubmitEditing={() => send(input)}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={[styles.roundBtn, listening ? styles.micActive : styles.micBtn]}
          onPress={toggleMic}
          disabled={busy}
        >
          <Text style={styles.btnIcon}>{listening ? '⏹' : '🎤'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.roundBtn, styles.sendBtn, (!input.trim() || busy) && { opacity: 0.5 }]}
          onPress={() => send(input)}
          disabled={!input.trim() || busy}
        >
          <Text style={[styles.btnIcon, { color: '#fff' }]}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card,
  },
  topTitle: { fontWeight: '800', color: colors.text },
  topToggle: { color: colors.primary, fontWeight: '600' },
  bubble: { maxWidth: '85%', padding: 12, borderRadius: 16, marginBottom: 10 },
  bubbleBot: { alignSelf: 'flex-start', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  bubbleUser: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  textBot: { color: colors.text, fontSize: 15, lineHeight: 21 },
  textUser: { color: '#fff', fontSize: 15, lineHeight: 21 },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  chip: {
    borderWidth: 1, borderColor: colors.primary, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.card,
  },
  chipText: { color: colors.primary, fontWeight: '600' },
  notice: { color: colors.warning, paddingHorizontal: 16, marginBottom: 6 },
  inputBar: {
    flexDirection: 'row', alignItems: 'center', padding: 10, gap: 8,
    borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
  },
  input: {
    flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 22,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: colors.text,
  },
  roundBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  micBtn: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  micActive: { backgroundColor: colors.dangerBg, borderWidth: 1, borderColor: colors.danger },
  sendBtn: { backgroundColor: colors.primary },
  btnIcon: { fontSize: 18 },
});
