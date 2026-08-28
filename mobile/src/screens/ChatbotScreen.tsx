import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { colors, shadow } from '../theme';
import { useAuth } from '../context/AuthContext';
import { sendChatMessage, sendVoiceMessage, ChatHistoryItem, ChatUnavailableError } from '../api/chatbot';

interface Message {
  id: number;
  role: 'bot' | 'user';
  text: string;
  options?: string[];
}

const SUGGESTIONS = [
  '¿Cómo pido un turno?',
  '¿Qué documentos necesito para un turno virtual?',
  '¿Cuánto debo esperar?',
  '¿Puedo cancelar mi turno?',
];

function localFallback(text: string): string {
  const t = text.toLowerCase();
  if (/(hola|buenos|buenas|hey|saludos)/.test(t)) return 'Hola, ¿cómo te puedo ayudar hoy?';
  if (/(pedir|sacar|solicitar|crear|agend).*(turno|cita|número)/.test(t) || t.includes('cómo pido'))
    return 'Para pedir tu turno: ve a la pestaña Inicio, elige modalidad (presencial o virtual) y, si es presencial, el tipo de servicio y la sede. Al confirmar recibes tu número al instante.';
  if (/(document|papel|requisito|necesit)/.test(t))
    return 'Para un turno virtual necesitas: documento de identidad, carné o certificado de afiliación EPS, y si aplica, la orden médica. Puedes subirlos desde la pantalla de tu turno activo.';
  if (/(espera|tiempo|demora|cuánto|minuto|hora)/.test(t))
    return 'Puedes ver tu posición en tiempo real desde Inicio. Cuando te queden 2 turnos o menos, tu celular vibrará y te avisará.';
  if (/(cancel|eliminar|borrar).*(turno|cita)/.test(t) || t.includes('puedo cancelar'))
    return 'Desde Inicio, con tu turno activo, verás el botón "Cancelar turno". Solo puedes cancelar mientras está en espera.';
  if (/(gracias|listo|perfecto|excelente|genial|ok)/.test(t)) return 'Con gusto. ¿Algo más en lo que pueda ayudarte?';
  return 'Por ahora no logro conectarme con la IA, pero puedo ayudarte con: pedir un turno, documentos necesarios, tiempos de espera o cancelar un turno. ¿Sobre cuál quieres saber más?';
}

export default function ChatbotScreen({ navigation }: any) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList>(null);
  const [messages, setMessages] = useState<Message[]>(() => {
    const name = user?.full_name?.split(' ')[0] || '';
    return [
      {
        id: 0,
        role: 'bot',
        text: `Hola${name ? ', ' + name : ''}. Soy TURNITY, el asistente virtual de Turnify. Puedo ayudarte a pedir tu turno, resolver dudas sobre el proceso y avisarte cuando se acerque. ¿En qué te ayudo?`,
      },
    ];
  });
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const idRef = useRef(1);

  const scrollToEnd = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  const historyOf = (msgs: Message[]): ChatHistoryItem[] => msgs.slice(-10).map((m) => ({ role: m.role, text: m.text }));

  const send = async (text: string) => {
    if (!text.trim() || typing) return;
    const userMsg: Message = { id: idRef.current++, role: 'user', text: text.trim() };
    let history: ChatHistoryItem[] = [];
    setMessages((prev) => {
      history = historyOf(prev);
      return [...prev, userMsg];
    });
    setInput('');
    setTyping(true);
    scrollToEnd();

    try {
      const reply = await sendChatMessage(userMsg.text, history);
      setMessages((prev) => [...prev, { id: idRef.current++, role: 'bot', text: reply.text, options: reply.options }]);
    } catch {
      setMessages((prev) => [...prev, { id: idRef.current++, role: 'bot', text: localFallback(userMsg.text) }]);
    } finally {
      setTyping(false);
      scrollToEnd();
    }
  };

  const startRecording = async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) return;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(rec);
      setIsRecording(true);
    } catch {
      setIsRecording(false);
    }
  };

  const stopRecordingAndSend = async () => {
    if (!recording) return;
    setIsRecording(false);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      if (!uri) return;

      let history: ChatHistoryItem[] = [];
      setMessages((prev) => {
        history = historyOf(prev);
        return prev;
      });
      setTyping(true);
      scrollToEnd();

      try {
        const reply = await sendVoiceMessage(uri, history);
        setMessages((prev) => [
          ...prev,
          { id: idRef.current++, role: 'user', text: reply.transcript || '(nota de voz)' },
          { id: idRef.current++, role: 'bot', text: reply.text, options: reply.options },
        ]);
      } catch (e: any) {
        const msg = e instanceof ChatUnavailableError ? e.message : 'No se pudo procesar el audio.';
        setMessages((prev) => [...prev, { id: idRef.current++, role: 'bot', text: msg }]);
      } finally {
        setTyping(false);
        scrollToEnd();
      }
    } catch {
      setRecording(null);
    }
  };

  const onMicPress = () => {
    if (typing) return;
    if (isRecording) stopRecordingAndSend();
    else startRecording();
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.textOnDark} />
        </TouchableOpacity>
        <Image source={require('../../assets/avatar-ia.jpg')} style={styles.headerAvatar} />
        <View>
          <Text style={styles.headerTitle}>TURNITY</Text>
          <Text style={styles.headerSubtitle}>{typing ? 'Escribiendo…' : 'En línea'}</Text>
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        renderItem={({ item }) => (
          <View>
            <View style={[styles.bubbleRow, item.role === 'user' && styles.bubbleRowUser]}>
              {item.role === 'bot' && <Image source={require('../../assets/avatar-ia.jpg')} style={styles.bubbleAvatar} />}
              <View style={[styles.bubble, item.role === 'user' ? styles.bubbleUser : styles.bubbleBot]}>
                <Text style={[styles.bubbleText, item.role === 'user' && styles.bubbleTextUser]}>{item.text}</Text>
              </View>
            </View>
            {!!item.options?.length && (
              <View style={styles.optionsWrap}>
                {item.options.map((opt: string) => (
                  <TouchableOpacity key={opt} style={styles.optionBtn} onPress={() => send(opt)} disabled={typing}>
                    <Text style={styles.optionBtnText}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
        ListFooterComponent={
          typing ? (
            <View style={styles.bubbleRow}>
              <Image source={require('../../assets/avatar-ia.jpg')} style={styles.bubbleAvatar} />
              <View style={[styles.bubble, styles.bubbleBot, styles.typingBubble]}>
                <ActivityIndicator size="small" color={colors.textMuted} />
              </View>
            </View>
          ) : null
        }
      />

      {messages.length <= 1 && (
        <View style={styles.suggestionsWrap}>
          {SUGGESTIONS.map((s) => (
            <TouchableOpacity key={s} style={styles.suggestionChip} onPress={() => send(s)}>
              <Text style={styles.suggestionText}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 10 }]}>
        <TextInput
          style={styles.input}
          placeholder={isRecording ? 'Grabando…' : 'Escribe tu mensaje…'}
          placeholderTextColor="#9ca3af"
          value={input}
          onChangeText={setInput}
          editable={!isRecording}
          multiline
          onSubmitEditing={() => send(input)}
        />
        {input.trim() ? (
          <TouchableOpacity style={styles.sendBtn} onPress={() => send(input)} disabled={typing}>
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.sendBtn, isRecording && styles.sendBtnRecording]}
            onPress={onMicPress}
            disabled={typing}
          >
            <Ionicons name={isRecording ? 'stop' : 'mic'} size={18} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: colors.navy,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  backBtn: { padding: 2 },
  headerAvatar: { width: 36, height: 36, borderRadius: 18 },
  headerTitle: { color: colors.textOnDark, fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },
  headerSubtitle: { color: colors.textOnDarkMuted, fontSize: 11, marginTop: 1 },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubbleAvatar: { width: 26, height: 26, borderRadius: 13 },
  bubble: { maxWidth: '78%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, ...shadow.card },
  bubbleBot: { backgroundColor: colors.card, borderBottomLeftRadius: 4 },
  bubbleUser: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  bubbleTextUser: { color: '#fff' },
  typingBubble: { paddingVertical: 12, paddingHorizontal: 18 },
  optionsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginLeft: 34 },
  optionBtn: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 7,
    paddingHorizontal: 13,
  },
  optionBtnText: { fontSize: 12.5, color: colors.primary, fontWeight: '700' },
  suggestionsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
  suggestionChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  suggestionText: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.background,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnRecording: { backgroundColor: colors.danger },
});
