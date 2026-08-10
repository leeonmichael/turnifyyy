import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';
import { updateProfile } from '../api/auth';
import { ApiError } from '../api/client';

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
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <View style={styles.card}>
        <Text style={styles.title}>Mi Perfil</Text>

        <Text style={styles.readonlyLabel}>Usuario</Text>
        <Text style={styles.readonlyValue}>{user?.username}</Text>

        <Text style={styles.readonlyLabel}>Documento</Text>
        <Text style={styles.readonlyValue}>{user?.cedula || '—'}</Text>

        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        {!!success && (
          <View style={styles.successBox}>
            <Text style={styles.successText}>{success}</Text>
          </View>
        )}

        <Text style={styles.label}>Nombre Completo</Text>
        <TextInput style={styles.input} value={fullName} onChangeText={setFullName} />

        <Text style={styles.label}>Correo Electrónico</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text style={styles.label}>Teléfono</Text>
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="number-pad" />

        <Text style={styles.label}>Nueva Contraseña</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Deja en blanco para no cambiarla"
        />

        <TouchableOpacity style={styles.button} onPress={onSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Guardar Cambios</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
          <Text style={styles.logoutButtonText}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 20 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 16 },
  readonlyLabel: { fontSize: 12, color: colors.textMuted, marginTop: 8 },
  readonlyValue: { fontSize: 15, fontWeight: '600', color: colors.text },
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 14, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: colors.background,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  logoutButton: {
    borderWidth: 1.5,
    borderColor: colors.danger,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 14,
  },
  logoutButtonText: { color: colors.danger, fontWeight: '700', fontSize: 15 },
  errorBox: { backgroundColor: colors.dangerBg, borderRadius: 10, padding: 12, marginTop: 12 },
  errorText: { color: colors.danger, fontSize: 13 },
  successBox: { backgroundColor: colors.successBg, borderRadius: 10, padding: 12, marginTop: 12 },
  successText: { color: colors.success, fontSize: 13 },
});
