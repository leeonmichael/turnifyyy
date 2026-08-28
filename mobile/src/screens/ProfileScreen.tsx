import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { colors, shadow } from '../theme';
import { updateProfile } from '../api/auth';
import { ApiError } from '../api/client';
import ScreenHeader from '../components/ScreenHeader';

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || '?';
}

export default function ProfileScreen() {
  const { user, logout, refreshUser } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const onSave = async () => {
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const payload: Record<string, any> = { full_name: fullName, email, phone };
      if (password) payload.password = password;
      const data = await updateProfile(payload);
      await refreshUser(data.user);
      setPassword('');
      setSuccess('Perfil actualizado correctamente');
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : 'Error al actualizar el perfil');
    } finally {
      setSaving(false);
    }
  };

  const onLogout = () => {
    Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: () => logout() },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Mi Perfil" subtitle="Datos de tu cuenta" />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(user?.full_name || user?.username || '?')}</Text>
          </View>
          <Text style={styles.avatarName}>{user?.full_name || user?.username}</Text>
          <Text style={styles.avatarUsername}>@{user?.username}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.readonlyRow}>
            <Ionicons name="card-outline" size={16} color={colors.textMuted} />
            <View>
              <Text style={styles.readonlyLabel}>Documento</Text>
              <Text style={styles.readonlyValue}>{user?.cedula || '—'}</Text>
            </View>
          </View>

          {!!error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          {!!success && (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={styles.successText}>{success}</Text>
            </View>
          )}

          <Text style={styles.label}>Nombre Completo</Text>
          <View style={styles.inputRow}>
            <Ionicons name="person-outline" size={18} color={colors.textMuted} />
            <TextInput style={styles.input} value={fullName} onChangeText={setFullName} />
          </View>

          <Text style={styles.label}>Correo Electrónico</Text>
          <View style={styles.inputRow}>
            <Ionicons name="mail-outline" size={18} color={colors.textMuted} />
            <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          </View>

          <Text style={styles.label}>Teléfono</Text>
          <View style={styles.inputRow}>
            <Ionicons name="call-outline" size={18} color={colors.textMuted} />
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="number-pad" />
          </View>

          <Text style={styles.label}>Nueva Contraseña</Text>
          <View style={styles.inputRow}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} />
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Deja en blanco para no cambiarla"
              placeholderTextColor="#9ca3af"
            />
          </View>

          <TouchableOpacity style={styles.button} onPress={onSave} disabled={saving} activeOpacity={0.85}>
            {saving ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="save-outline" size={18} color="#fff" />
                <Text style={styles.buttonText}>Guardar Cambios</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutButton} onPress={onLogout} activeOpacity={0.85}>
            <Ionicons name="log-out-outline" size={18} color={colors.danger} />
            <Text style={styles.logoutButtonText}>Cerrar Sesión</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  avatarWrap: { alignItems: 'center', marginBottom: 20 },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '800' },
  avatarName: { marginTop: 10, fontSize: 17, fontWeight: '800', color: colors.text },
  avatarUsername: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  card: { backgroundColor: colors.card, borderRadius: 18, padding: 20, ...shadow.card },
  readonlyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  readonlyLabel: { fontSize: 11, color: colors.textMuted },
  readonlyValue: { fontSize: 15, fontWeight: '600', color: colors.text },
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 14, marginBottom: 6 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.background,
  },
  input: { flex: 1, paddingVertical: 12, fontSize: 15, color: colors.text },
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
  logoutButton: {
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1.5,
    borderColor: colors.danger,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  logoutButtonText: { color: colors.danger, fontWeight: '700', fontSize: 15 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.dangerBg,
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  errorText: { color: colors.danger, fontSize: 13, flex: 1 },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.successBg,
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  successText: { color: colors.success, fontSize: 13, flex: 1 },
});
