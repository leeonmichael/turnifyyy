import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme';
import * as turnsApi from '../api/turns';

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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ padding: 20 }}
      data={turns}
      keyExtractor={(item, idx) => item.id || String(idx)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.emptyText}>Todavía no has pedido ningún turno.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.number}>{item.number}</Text>
            <Text style={[styles.status, { color: STATUS_COLOR[item.status] || colors.textMuted }]}>
              {STATUS_LABEL[item.status] || item.status}
            </Text>
          </View>
          <Text style={styles.meta}>Sede: {item.sede}</Text>
          <Text style={styles.meta}>Servicio: {item.service_type}</Text>
          <Text style={styles.meta}>Creado: {item.created_at}</Text>
          {!!item.finished_at && <Text style={styles.meta}>Finalizado: {item.finished_at}</Text>}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText: { color: colors.textMuted, fontSize: 14 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  number: { fontSize: 20, fontWeight: '800', color: colors.text },
  status: { fontSize: 12, fontWeight: '700' },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
});
