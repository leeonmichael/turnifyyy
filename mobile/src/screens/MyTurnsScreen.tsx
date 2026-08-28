import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, shadow } from '../theme';
import * as turnsApi from '../api/turns';
import ScreenHeader from '../components/ScreenHeader';

const STATUS_LABEL: Record<string, string> = {
  waiting: 'En espera',
  called: 'Llamado',
  finished: 'Finalizado',
  cancelled: 'Cancelado',
};

const STATUS_COLOR: Record<string, string> = {
  waiting: colors.warning,
  called: colors.primary,
  finished: colors.success,
  cancelled: colors.danger,
};

const STATUS_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  waiting: 'time-outline',
  called: 'megaphone-outline',
  finished: 'checkmark-circle-outline',
  cancelled: 'close-circle-outline',
};

export default function MyTurnsScreen() {
  const [turns, setTurns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await turnsApi.getMyTurns();
      setTurns(data.turns || []);
    } catch {
      // deja la lista anterior si falla
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Mis Turnos" subtitle="Historial completo" />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          data={turns}
          keyExtractor={(item, idx) => item.id || String(idx)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="file-tray-outline" size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>Todavía no has pedido ningún turno.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.number}>{item.number}</Text>
                <View style={[styles.statusPill, { backgroundColor: `${STATUS_COLOR[item.status] || colors.textMuted}1A` }]}>
                  <Ionicons name={STATUS_ICON[item.status] || 'ellipse-outline'} size={13} color={STATUS_COLOR[item.status] || colors.textMuted} />
                  <Text style={[styles.status, { color: STATUS_COLOR[item.status] || colors.textMuted }]}>
                    {STATUS_LABEL[item.status] || item.status}
                  </Text>
                </View>
              </View>
              <View style={styles.metaRow}>
                <Ionicons name="location-outline" size={13} color={colors.textMuted} />
                <Text style={styles.meta}>{item.sede}</Text>
              </View>
              <View style={styles.metaRow}>
                <Ionicons name="pricetag-outline" size={13} color={colors.textMuted} />
                <Text style={styles.meta}>{item.service_type}</Text>
              </View>
              <View style={styles.metaRow}>
                <Ionicons name="calendar-outline" size={13} color={colors.textMuted} />
                <Text style={styles.meta}>{item.created_at}</Text>
              </View>
              {!!item.finished_at && (
                <View style={styles.metaRow}>
                  <Ionicons name="flag-outline" size={13} color={colors.textMuted} />
                  <Text style={styles.meta}>Finalizado: {item.finished_at}</Text>
                </View>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 10 },
  emptyText: { color: colors.textMuted, fontSize: 14 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    ...shadow.card,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  number: { fontSize: 20, fontWeight: '800', color: colors.text },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  status: { fontSize: 11, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  meta: { fontSize: 13, color: colors.textMuted },
});
