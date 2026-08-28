import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  ImageBackground,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { colors, shadow } from '../theme';

export default function LoginScreen({ navigation }: any) {
  const { login, sessionExpired, clearSessionExpired } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const displayError = error || (sessionExpired ? 'Tu sesión expiró o no es válida. Inicia sesión de nuevo.' : '');

  const onSubmit = async () => {
    setError('');
    clearSessionExpired();
    if (!username.trim()) return setError('Ingresa usuario o correo electrónico');
    if (!password) return setError('Ingresa tu contraseña');

    setLoading(true);
    try {
      await login(username.trim(), password);
    } catch (e: any) {
      setError(e?.message || 'Error de conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground
      source={require('../../assets/login-bg.jpg')}
      style={styles.bg}
      resizeMode="cover"
    >
      <View style={styles.overlay} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.brandRow}>
            <Image source={require('../../assets/logo.png')} style={styles.brandLogo} />
            <View>
              <Text style={styles.brandTitle}>TURNIFY</Text>
              <Text style={styles.brandSlogan}>TU TURNO, TU TIEMPO</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>Iniciar Sesión</Text>
            <Text style={styles.subtitle}>Bienvenido a Turnify Pro</Text>

            {!!displayError && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={colors.danger} />
                <Text style={styles.errorText}>{displayError}</Text>
              </View>
            )}

            <Text style={styles.label}>Usuario o Correo</Text>
            <View style={styles.inputRow}>
              <Ionicons name="person-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Ingresa tu usuario o correo"
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
                autoCorrect={false}
                value={username}
                onChangeText={setUsername}
              />
            </View>

            <Text style={styles.label}>Contraseña</Text>
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Ingresa tu contraseña"
                placeholderTextColor="#9ca3af"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword((s) => !s)} hitSlop={10}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.button} onPress={onSubmit} disabled={loading} activeOpacity={0.85}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.buttonText}>Ingresar</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('Register')} style={{ marginTop: 20 }}>
              <Text style={styles.link}>
                ¿No tienes cuenta? <Text style={styles.linkStrong}>Regístrate aquí</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.navy },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 18, 43, 0.55)',
  },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 28, alignSelf: 'center' },
  brandLogo: { width: 44, height: 44 },
  brandTitle: { fontSize: 20, fontWeight: '800', color: colors.textOnDark, letterSpacing: 1 },
  brandSlogan: { fontSize: 10, fontWeight: '600', color: colors.textOnDarkMuted, letterSpacing: 1.5 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 28,
    ...shadow.floating,
  },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: 4, marginBottom: 22 },
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 6, marginTop: 12 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.background,
    gap: 10,
  },
  inputIcon: {},
  input: { flex: 1, paddingVertical: 13, fontSize: 15, color: colors.text },
  button: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 26,
    ...shadow.card,
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  link: { textAlign: 'center', color: colors.textMuted, fontSize: 13 },
  linkStrong: { color: colors.primary, fontWeight: '700' },
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
});
