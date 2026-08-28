import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { colors, shadow } from '../theme';
import * as turnsApi from '../api/turns';
import { ActiveTurn, Sede } from '../api/turns';
import { ApiError } from '../api/client';
import ScreenHeader from '../components/ScreenHeader';

const SERVICE_TYPES: { value: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'general', label: 'General (A)', icon: 'people-outline' },
  { value: 'preferential', label: 'Preferencial (B)', icon: 'heart-outline' },
  { value: 'emergency', label: 'Emergencia (E)', icon: 'alert-circle-outline' },
];

const STATUS_LABEL: Record<string, string> = {
  waiting: 'En espera',
  called: '¡Te están llamando!',
  finished: 'Finalizado',
  cancelled: 'Cancelado',
};

export default function HomeScreen({ navigation }: any) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTurn, setActiveTurn] = useState<ActiveTurn | null>(null);
  const [position, setPosition] = useState<{ position: number | null; turns_ahead: number } | null>(null);
  const [error, setError] = useState('');

  // ---- Request form state ----
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [selectedSedeId, setSelectedSedeId] = useState('');
  const [turnMode, setTurnMode] = useState<'presencial' | 'virtual'>('presencial');
  const [serviceType, setServiceType] = useState('general');
  const [requesting, setRequesting] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadActiveTurn = useCallback(async () => {
    try {
      const data = await turnsApi.getMyActiveTurn();
      setActiveTurn(data.turn);
      if (data.turn && data.turn.status === 'waiting') {
        const pos = await turnsApi.getPosition(data.turn.number);
        setPosition(pos);
      } else {
        setPosition(null);
      }
    } catch {
      // Si falla, se mantiene el estado anterior; el próximo poll reintenta.
    }
  }, []);

  const loadSedes = useCallback(async () => {
    try {
      const data = await turnsApi.getSedes();
      setSedes(data.sedes || []);
      setSelectedSedeId((prev) => (data.sedes?.length && !data.sedes.some((s) => s.id === prev) ? data.sedes[0].id : prev));
    } catch {
      setSedes([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      Promise.all([loadActiveTurn(), loadSedes()]).finally(() => setLoading(false));

      pollRef.current = setInterval(loadActiveTurn, 4000);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }, [loadActiveTurn, loadSedes])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadActiveTurn();
    setRefreshing(false);
  };

  const requestTurn = async () => {
    setError('');
    setRequesting(true);
    try {
      const sedeId = turnMode === 'presencial' ? selectedSedeId : 'VIRTUAL';
      const sedeName = turnMode === 'presencial'
        ? (sedes.find((s) => s.id === sedeId)?.name || '')
        : 'Virtual';
      const type = turnMode === 'virtual' ? 'virtual' : serviceType;
      const data = await turnsApi.createTurn(type, sedeId);
      setActiveTurn({
        id: '',
        number: data.number,
        status: 'waiting',
        service_type: type,
        sede: sedeName,
        sede_id: sedeId,
        created_at: new Date().toISOString(),
      });
      loadActiveTurn();
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 400 && /turno activo/i.test(e.message)) {
        loadActiveTurn();
      } else {
        setError(e instanceof ApiError ? e.message : 'Error al solicitar el turno. Intenta de nuevo.');
      }
    } finally {
      setRequesting(false);
    }
  };

  const cancelTurn = async () => {
    if (!activeTurn) return;
    try {
      await turnsApi.cancelTurn(activeTurn.number);
      setActiveTurn(null);
      setPosition(null);
    } catch {
      setError('Error al cancelar el turno');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title={`Hola, ${(user?.full_name || user?.username || '').split(' ')[0]} 👋`} subtitle="Turnify Pro" />

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {activeTurn ? (
          <View style={styles.trackingCard}>
            <View style={styles.turnBadge}>
              <Text style={styles.turnNumber}>{activeTurn.number}</Text>
            </View>
            <View
              style={[
                styles.statusPill,
                activeTurn.status === 'called' && styles.statusPillCalled,
                activeTurn.status === 'waiting' && styles.statusPillWaiting,
              ]}
            >
              <Ionicons
                name={activeTurn.status === 'called' ? 'megaphone' : 'time-outline'}
                size={14}
                color={activeTurn.status === 'called' ? colors.success : colors.warning}
              />
              <Text
                style={[
                  styles.statusPillText,
                  activeTurn.status === 'called' && { color: colors.success },
                  activeTurn.status === 'waiting' && { color: colors.warning },
                ]}
              >
                {STATUS_LABEL[activeTurn.status] || activeTurn.status}
              </Text>
            </View>
            <View style={styles.turnMetaRow}>
              <Ionicons name="location-outline" size={14} color={colors.textMuted} />
              <Text style={styles.turnMeta}>{activeTurn.sede}</Text>
            </View>

            {activeTurn.status === 'waiting' && position && (
              <View style={styles.positionBox}>
                <Text style={styles.positionNumber}>{position.turns_ahead}</Text>
                <Text style={styles.positionLabel}>
                  {position.turns_ahead === 0 ? 'Eres el siguiente' : 'turnos antes que el tuyo'}
                </Text>
              </View>
            )}

            {activeTurn.status === 'called' && (
              <View style={styles.calledBox}>
                <Ionicons name="megaphone" size={20} color={colors.success} />
                <Text style={styles.calledMsg}>¡Dirígete al módulo de atención ahora!</Text>
              </View>
            )}

            {activeTurn.status === 'waiting' && (
              <TouchableOpacity style={styles.cancelButton} onPress={cancelTurn} activeOpacity={0.8}>
                <Ionicons name="close-circle-outline" size={16} color={colors.danger} />
                <Text style={styles.cancelButtonText}>Cancelar turno</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Solicitar Turno</Text>
            {!!error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Text style={styles.label}>Modalidad</Text>
            <View style={styles.chipsRow}>
              {(['presencial', 'virtual'] as const).map((mode) => (
                <TouchableOpacity
                  key={mode}
                  style={[styles.chip, turnMode === mode && styles.chipActive]}
                  onPress={() => setTurnMode(mode)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={mode === 'presencial' ? 'business-outline' : 'videocam-outline'}
                    size={15}
                    color={turnMode === mode ? '#fff' : colors.textMuted}
                  />
                  <Text style={[styles.chipText, turnMode === mode && styles.chipTextActive]}>
                    {mode === 'presencial' ? 'Presencial' : 'Virtual'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {turnMode === 'presencial' && (
              <>
                <Text style={styles.label}>Tipo de Servicio</Text>
                <View style={styles.chipsColumn}>
                  {SERVICE_TYPES.map((s) => (
                    <TouchableOpacity
                      key={s.value}
                      style={[styles.optionRow, serviceType === s.value && styles.optionRowActive]}
                      onPress={() => setServiceType(s.value)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name={s.icon} size={18} color={serviceType === s.value ? colors.primary : colors.textMuted} />
                      <Text style={[styles.optionText, serviceType === s.value && styles.optionTextActive]}>{s.label}</Text>
                      {serviceType === s.value && <Ionicons name="checkmark-circle" size={18} color={colors.primary} style={{ marginLeft: 'auto' }} />}
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>Sede</Text>
                <View style={styles.chipsColumn}>
                  {sedes.map((s) => (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.optionRow, selectedSedeId === s.id && styles.optionRowActive]}
                      onPress={() => setSelectedSedeId(s.id)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="location-outline" size={18} color={selectedSedeId === s.id ? colors.primary : colors.textMuted} />
                      <Text style={[styles.optionText, selectedSedeId === s.id && styles.optionTextActive]}>{s.name}</Text>
                      {selectedSedeId === s.id && <Ionicons name="checkmark-circle" size={18} color={colors.primary} style={{ marginLeft: 'auto' }} />}
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <TouchableOpacity style={styles.button} onPress={requestTurn} disabled={requesting} activeOpacity={0.85}>
              {requesting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="ticket-outline" size={18} color="#fff" />
                  <Text style={styles.buttonText}>Pedir Turno</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('Chatbot')} activeOpacity={0.85}>
        <Ionicons name="chatbubble-ellipses" size={26} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  formCard: { backgroundColor: colors.card, borderRadius: 18, padding: 20, ...shadow.card },
  formTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 14, marginBottom: 8 },
  chipsRow: { flexDirection: 'row', gap: 8 },
  chipsColumn: { gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: colors.background,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: '#fff' },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.background,
  },
  optionRowActive: { borderColor: colors.primary, backgroundColor: '#eff6ff' },
  optionText: { color: colors.text, fontWeight: '600', fontSize: 14 },
  optionTextActive: { color: colors.primary },
  button: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    ...shadow.card,
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.dangerBg,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  errorText: { color: colors.danger, fontSize: 13, flex: 1 },

  trackingCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 26,
    alignItems: 'center',
    ...shadow.card,
  },
  turnBadge: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#eff6ff',
    borderWidth: 3,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  turnNumber: { fontSize: 34, fontWeight: '900', color: colors.primary, letterSpacing: 1 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusPillWaiting: { backgroundColor: '#fffbeb' },
  statusPillCalled: { backgroundColor: colors.successBg },
  statusPillText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  turnMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12 },
  turnMeta: { color: colors.textMuted, fontSize: 13 },
  positionBox: { marginTop: 22, alignItems: 'center' },
  positionNumber: { fontSize: 44, fontWeight: '800', color: colors.text },
  positionLabel: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  calledBox: { marginTop: 22, alignItems: 'center', gap: 8 },
  calledMsg: { color: colors.success, fontWeight: '700', textAlign: 'center', fontSize: 14 },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 26,
    borderWidth: 1.5,
    borderColor: colors.danger,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  cancelButtonText: { color: colors.danger, fontWeight: '700' },

  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.floating,
  },
});
