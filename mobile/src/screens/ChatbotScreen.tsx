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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, shadow } from '../theme';
import { useAuth } from '../context/AuthContext';
import { sendChatMessage, ChatHistoryItem } from '../api/chatbot';

interface Message {
  id: number;
  role: 'bot' | 'user';
  text: string;
}

const SUGGESTIONS = [
  '¿Cómo pido un turno?',
  '¿Qué documentos necesito?',
  '¿Cuánto debo esperar?',
  '¿Puedo cancelar mi turno?',
];

function localFallback(text: string): string {
  const t = text.toLowerCase();
  if (/(hola|buenos|buenas|hey|saludos)/.test(t)) return '¡Hola! 😊 ¿Cómo te puedo ayudar hoy?';
  if (/(pedir|sacar|solicitar|crear|agend).*(turno|cita|número)/.test(t) || t.includes('cómo pido'))
    return '📋 Para pedir tu turno:\n\n1. Ve a la pestaña "Inicio"\n2. Elige modalidad (presencial o virtual)\n3. Si es presencial, elige tipo de servicio y sede\n4. Presiona "Pedir Turno"\n\n¡Recibirás tu número al instante! 🎫';
  if (/(document|papel|requisito|necesit)/.test(t))
    return '📄 Generalmente necesitas:\n\n• Documento de identidad (CC, CE, Pasaporte)\n• Carnet de afiliación si aplica\n\nTe recomiendo llevar copias.';
  if (/(espera|tiempo|demora|cuánto|minuto|hora)/.test(t))
    return '⏱️ Puedes ver tu posición en tiempo real desde "Inicio". Cuando te queden 2 turnos o menos, tu celular vibrará y te avisará. 🔔';
  if (/(cancel|eliminar|borrar).*(turno|cita)/.test(t) || t.includes('puedo cancelar'))
    return '❌ Desde "Inicio", con tu turno activo, verás el botón "Cancelar turno". Solo puedes cancelar mientras está "En espera".';
  if (/(gracias|listo|perfecto|excelente|genial|ok)/.test(t)) return '¡Con gusto! 😊 ¿Algo más en lo que pueda ayudarte?';
  return `Por ahora el asistente con IA no está disponible, pero puedo ayudarte con:\n\n• Pedir un turno\n• Documentos necesarios\n• Tiempos de espera\n• Cancelar un turno\n\n¿Sobre cuál quieres saber más?`;
}

export default function ChatbotScreen({ navigation }: any) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList>(null);
  const [messages, setMessages] = useState<Message[]>(() => {
    const name = user?.full_name?.split(' ')[0] || 'amigo/a';
    return [
      {
        id: 0,
        role: 'bot',
        text: `¡Hola, ${name}! 👋 Soy el asistente virtual de Turnify. Puedo ayudarte a pedir tu turno, resolver dudas sobre el proceso y avisarte cuando se acerque. ¿En qué te ayudo?`,
      },
    ];
  });
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const idRef = useRef(1);

  const scrollToEnd = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  const send = async (text: string) => {
    if (!text.trim() || typing) return;
    const userMsg: Message = { id: idRef.current++, role: 'user', text: text.trim() };
    const history: ChatHistoryItem[] = messages.slice(-10).map((m) => ({ role: m.role, text: m.text }));
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setTyping(true);
    scrollToEnd();

    try {
      const reply = await sendChatMessage(userMsg.text, history);
      setMessages((prev) => [...prev, { id: idRef.current++, role: 'bot', text: reply }]);
    } catch {
      setMessages((prev) => [...prev, { id: idRef.current++, role: 'bot', text: localFallback(userMsg.text) }]);
    } finally {
      setTyping(false);
      scrollToEnd();
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.textOnDark} />
        </TouchableOpacity>
        <View style={styles.headerIconWrap}>
          <Ionicons name="sparkles" size={16} color={colors.textOnDark} />
        </View>
        <View>
          <Text style={styles.headerTitle}>Asistente Turnify</Text>
          <Text style={styles.headerSubtitle}>{typing ? 'Escribiendo…' : 'En línea'}</Text>
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        renderItem={({ item }) => (
          <View style={[styles.bubbleRow, item.role === 'user' && styles.bubbleRowUser]}>
            <View style={[styles.bubble, item.role === 'user' ? styles.bubbleUser : styles.bubbleBot]}>
              <Text style={[styles.bubbleText, item.role === 'user' && styles.bubbleTextUser]}>{item.text}</Text>
            </View>
          </View>
        )}
        ListFooterComponent={
          typing ? (
            <View style={styles.bubbleRow}>
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
          placeholder="Escribe tu mensaje…"
          placeholderTextColor="#9ca3af"
          value={input}
          onChangeText={setInput}
          multiline
          onSubmitEditing={() => send(input)}
        />
        <TouchableOpacity style={styles.sendBtn} onPress={() => send(input)} disabled={!input.trim() || typing}>
          <Ionicons name="send" size={18} color="#fff" />
        </TouchableOpacity>
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
  headerIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: colors.textOnDark, fontWeight: '800', fontSize: 15 },
  headerSubtitle: { color: colors.textOnDarkMuted, fontSize: 11, marginTop: 1 },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '82%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, ...shadow.card },
  bubbleBot: { backgroundColor: colors.card, borderBottomLeftRadius: 4 },
  bubbleUser: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  bubbleTextUser: { color: '#fff' },
  typingBubble: { paddingVertical: 12, paddingHorizontal: 18 },
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
});
