import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Linking, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { colors, shadow } from '../theme';
import { ActiveTurn, uploadVirtualDocument, sendVirtualChatMessage } from '../api/turns';

const STATUS_META: Record<string, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  pending: { label: 'En revisión', color: colors.warning, icon: 'time-outline' },
  approved: { label: 'Aprobado', color: colors.success, icon: 'checkmark-circle-outline' },
  rejected: { label: 'Rechazado', color: colors.danger, icon: 'close-circle-outline' },
};

export default function VirtualTurnPanel({ turn, onChanged }: { turn: ActiveTurn; onChanged: () => void }) {
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [chatText, setChatText] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [error, setError] = useState('');

  const uploaded = turn.uploaded_documents || [];
  const required = turn.required_documents || [];
  const chat = turn.chat_messages || [];

  const uploadedFor = (key: string) => uploaded.find((d) => d.key === key);

  const pickAndUpload = async (key: string) => {
    setError('');
    const result = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'], copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.length) return;
    const file = result.assets[0];
    setUploadingKey(key);
    try {
      await uploadVirtualDocument(turn.number, key, { uri: file.uri, name: file.name, mimeType: file.mimeType });
      onChanged();
    } catch (e: any) {
      setError(e?.message || 'Error al subir el documento');
    } finally {
      setUploadingKey(null);
    }
  };

  const sendMessage = async () => {
    const text = chatText.trim();
    if (!text) return;
    setChatText('');
    setSendingChat(true);
    try {
      await sendVirtualChatMessage(turn.number, text);
      onChanged();
    } catch {
      setError('No se pudo enviar el mensaje');
    } finally {
      setSendingChat(false);
    }
  };

  return (
    <View style={{ gap: 14, marginTop: 14, width: '100%' }}>
      {!!error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={16} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {!!turn.meet_link && (
        <TouchableOpacity style={styles.meetButton} onPress={() => Linking.openURL(turn.meet_link!)} activeOpacity={0.85}>
          <Ionicons name="videocam" size={18} color="#fff" />
          <Text style={styles.meetButtonText}>Unirse a la videollamada</Text>
        </TouchableOpacity>
      )}

      {required.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Documentos requeridos</Text>
          {required.map((doc) => {
            const up = uploadedFor(doc.key);
            const meta = up ? STATUS_META[up.status] : null;
            return (
              <View key={doc.key} style={styles.docRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.docLabel}>{doc.label}</Text>
                  {meta && (
                    <View style={styles.docStatusRow}>
                      <Ionicons name={meta.icon} size={13} color={meta.color} />
                      <Text style={[styles.docStatusText, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                  )}
                  {up?.review_note ? <Text style={styles.docNote}>{up.review_note}</Text> : null}
                </View>
                <TouchableOpacity
                  style={[styles.docUploadBtn, up && styles.docUploadBtnSecondary]}
                  onPress={() => pickAndUpload(doc.key)}
                  disabled={uploadingKey === doc.key}
                >
                  {uploadingKey === doc.key ? (
                    <ActivityIndicator size="small" color={up ? colors.primary : '#fff'} />
                  ) : (
                    <Ionicons name={up ? 'refresh' : 'cloud-upload-outline'} size={16} color={up ? colors.primary : '#fff'} />
                  )}
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Chat con el asesor</Text>
        <ScrollView style={styles.chatList} nestedScrollEnabled>
          {chat.length === 0 ? (
            <Text style={styles.chatEmpty}>Aún no hay mensajes.</Text>
          ) : (
            chat.map((m, i) => (
              <View key={i} style={[styles.chatBubbleRow, m.sender_role === 'client' && styles.chatBubbleRowMine]}>
                <View style={[styles.chatBubble, m.sender_role === 'client' ? styles.chatBubbleMine : styles.chatBubbleTheirs]}>
                  <Text style={[styles.chatSender, m.sender_role === 'client' && styles.chatSenderMine]}>{m.sender_name}</Text>
                  <Text style={[styles.chatText, m.sender_role === 'client' && styles.chatTextMine]}>{m.text}</Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
        <View style={styles.chatInputRow}>
          <TextInput
            style={styles.chatInput}
            placeholder="Escribe un mensaje…"
            placeholderTextColor="#9ca3af"
            value={chatText}
            onChangeText={setChatText}
            onSubmitEditing={sendMessage}
          />
          <TouchableOpacity style={styles.chatSendBtn} onPress={sendMessage} disabled={sendingChat || !chatText.trim()}>
            <Ionicons name="send" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  meetButton: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.success,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  meetButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  card: { backgroundColor: colors.background, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border },
  cardTitle: { fontSize: 13, fontWeight: '800', color: colors.text, marginBottom: 10 },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
  docLabel: { fontSize: 13, color: colors.text, fontWeight: '600' },
  docStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  docStatusText: { fontSize: 11, fontWeight: '700' },
  docNote: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  docUploadBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docUploadBtnSecondary: { backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.primary },
  chatList: { maxHeight: 180, marginBottom: 8 },
  chatEmpty: { fontSize: 12, color: colors.textMuted, fontStyle: 'italic', paddingVertical: 6 },
  chatBubbleRow: { flexDirection: 'row', marginBottom: 6 },
  chatBubbleRowMine: { justifyContent: 'flex-end' },
  chatBubble: { maxWidth: '82%', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7 },
  chatBubbleTheirs: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  chatBubbleMine: { backgroundColor: colors.primary },
  chatSender: { fontSize: 10, fontWeight: '700', color: colors.textMuted, marginBottom: 1 },
  chatSenderMine: { color: 'rgba(255,255,255,0.8)' },
  chatText: { fontSize: 13, color: colors.text },
  chatTextMine: { color: '#fff' },
  chatInputRow: { flexDirection: 'row', gap: 8 },
  chatInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 13,
    color: colors.text,
    backgroundColor: colors.card,
  },
  chatSendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.dangerBg, borderRadius: 10, padding: 12 },
  errorText: { color: colors.danger, fontSize: 13, flex: 1 },
});
