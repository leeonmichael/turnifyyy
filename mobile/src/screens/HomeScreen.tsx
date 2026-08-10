import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';
import * as turnsApi from '../api/turns';
import { ActiveTurn, Sede } from '../api/turns';
import { ApiError } from '../api/client';

const SERVICE_TYPES = [
  { value: 'general', label: 'General (A)' },
  { value: 'preferential', label: 'Preferencial (B)' },
  { value: 'emergency', label: 'Emergencia (E)' },
];

const STATUS_LABEL: Record<string, string> = {
  waiting: 'En espera',
  called: '¡Te están llamando!',
  finished: 'Finalizado',
  cancelled: 'Cancelado',
};

export default function HomeScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTurn, setActiveTurn] = useState<ActiveTurn | null>(null);
  const [position, setPosition] = useState<{ position: number | null; turns_ahead: number } | null>(null);
  const [error, setError] = useState('');

  // ---- Request form state ----
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [selectedSede, setSelectedSede] = useState('MOSQUERA');
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
      if (data.sedes?.length && !data.sedes.some((s) => s.name === selectedSede)) {
        setSelectedSede(data.sedes[0].name);
      }
    } catch {
      setSedes([{ id: 'MOSQUERA', name: 'MOSQUERA', city: '', address: '' }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const sede = turnMode === 'presencial' ? selectedSede : 'VIRTUAL';
      const type = turnMode === 'virtual' ? 'virtual' : serviceType;
      const data = await turnsApi.createTurn(type, sede);
      setActiveTurn({
        id: '',
        number: data.number,
        status: 'waiting',
        service_type: type,
        sede,
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 20 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.greeting}>Hola, {user?.full_name || user?.username} 👋</Text>

      {activeTurn ? (
        <View style={styles.trackingCard}>
          <Text style={styles.turnNumber}>{activeTurn.number}</Text>
          <Text
            style={[
              styles.statusBadge,
              activeTurn.status === 'called' && styles.statusBadgeCalled,
              activeTurn.status === 'waiting' && styles.statusBadgeWaiting,
            ]}
          >
            {STATUS_LABEL[activeTurn.status] || activeTurn.status}
          </Text>
          <Text style={styles.turnMeta}>Sede: {activeTurn.sede}</Text>

          {activeTurn.status === 'waiting' && position && (
            <View style={styles.positionBox}>
              <Text style={styles.positionNumber}>{position.turns_ahead}</Text>
              <Text style={styles.positionLabel}>
                {position.turns_ahead === 0 ? 'Eres el siguiente' : 'turnos antes que el tuyo'}
              </Text>
            </View>
          )}

          {activeTurn.status === 'called' && (
            <Text style={styles.calledMsg}>¡Dirígete al módulo de atención ahora!</Text>
          )}

          {activeTurn.status === 'waiting' && (
            <TouchableOpacity style={styles.cancelButton} onPress={cancelTurn}>
              <Text style={styles.cancelButtonText}>Cancelar turno</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Solicitar Turno</Text>
          {!!error && (
            <View style={styles.errorBox}>
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
              >
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
                    style={[styles.chip, serviceType === s.value && styles.chipActive]}
                    onPress={() => setServiceType(s.value)}
                  >
                    <Text style={[styles.chipText, serviceType === s.value && styles.chipTextActive]}>
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Sede</Text>
              <View style={styles.chipsColumn}>
                {sedes.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.chip, selectedSede === s.name && styles.chipActive]}
                    onPress={() => setSelectedSede(s.name)}
                  >
                    <Text style={[styles.chipText, selectedSede === s.name && styles.chipTextActive]}>
                      {s.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <TouchableOpacity style={styles.button} onPress={requestTurn} disabled={requesting}>
            {requesting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Pedir Turno</Text>}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  greeting: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 16 },
  formCard: { backgroundColor: colors.card, borderRadius: 16, padding: 20 },
  formTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 14, marginBottom: 8 },
  chipsRow: { flexDirection: 'row', gap: 8 },
  chipsColumn: { gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: colors.background,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: '#fff' },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  errorBox: { backgroundColor: colors.dangerBg, borderRadius: 10, padding: 12, marginBottom: 8 },
  errorText: { color: colors.danger, fontSize: 13 },

  trackingCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  turnNumber: { fontSize: 48, fontWeight: '900', color: colors.primary, letterSpacing: 2 },
  statusBadge: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    overflow: 'hidden',
  },
  statusBadgeWaiting: { color: colors.warning, backgroundColor: '#fffbeb' },
  statusBadgeCalled: { color: colors.success, backgroundColor: colors.successBg },
  turnMeta: { marginTop: 10, color: colors.textMuted, fontSize: 13 },
  positionBox: { marginTop: 20, alignItems: 'center' },
  positionNumber: { fontSize: 40, fontWeight: '800', color: colors.text },
  positionLabel: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  calledMsg: { marginTop: 20, color: colors.success, fontWeight: '700', textAlign: 'center' },
  cancelButton: {
    marginTop: 24,
    borderWidth: 1.5,
    borderColor: colors.danger,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  cancelButtonText: { color: colors.danger, fontWeight: '700' },
});
