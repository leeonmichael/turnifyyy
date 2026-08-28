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
import { ApiError } from '../api/client';

const DOCUMENT_TYPES = ['CC', 'CE', 'PA', 'NIT'];
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{12,64}$/;
const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export default function RegisterScreen({ navigation }: any) {
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [documentType, setDocumentType] = useState('CC');
  const [cedula, setCedula] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validate = (): string | null => {
    if (!username) return 'El nombre de usuario es requerido';
    if (username.length < 3) return 'El usuario debe tener mínimo 3 caracteres';
    if (!password) return 'La contraseña es requerida';
    if (!PASSWORD_PATTERN.test(password)) {
      return 'La contraseña debe tener mínimo 12 caracteres e incluir al menos 1 letra, 1 número y 1 símbolo';
    }
    if (!confirmPassword) return 'Confirme su contraseña';
    if (password !== confirmPassword) return 'Las contraseñas no coinciden';
    if (!fullName) return 'El nombre completo es requerido';
    if (!cedula) return 'El número de documento es requerido';
    if (!/^\d+$/.test(cedula)) return 'El documento debe contener solo números';
    if (cedula.length < 10) return 'El documento debe tener mínimo 10 dígitos';
    if (!email) return 'El correo electrónico es requerido';
    if (!EMAIL_PATTERN.test(email)) return 'Ingrese un correo electrónico válido';
    if (!phone) return 'El teléfono es requerido';
    if (!/^\d+$/.test(phone)) return 'El teléfono debe contener solo números';
    if (phone.length < 10) return 'El teléfono debe tener mínimo 10 dígitos';
    if (!acceptTerms) return 'Debe aceptar términos y condiciones';
    return null;
  };

  const onSubmit = async () => {
    setError('');
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      await register({
        username,
        password,
        confirm_password: confirmPassword,
        full_name: fullName,
        document_type: documentType,
        cedula,
        email,
        phone,
        accept_terms: acceptTerms,
      });
      // El AuthContext ya guarda la sesión y navega automáticamente al área de cliente.
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : 'Error de conexión. Intenta de nuevo.');
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
            <Text style={styles.brandTitle}>TURNIFY</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>Crear Cuenta</Text>
            <Text style={styles.subtitle}>Regístrate como cliente en Turnify Pro</Text>

            {!!error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Text style={styles.label}>Nombre Completo</Text>
            <View style={styles.inputRow}>
              <Ionicons name="person-outline" size={18} color={colors.textMuted} />
              <TextInput style={styles.input} placeholder="Nombre completo" placeholderTextColor="#9ca3af" value={fullName} onChangeText={setFullName} />
            </View>

            <Text style={styles.label}>Tipo de Documento</Text>
            <View style={styles.chipsRow}>
              {DOCUMENT_TYPES.map((dt) => (
                <TouchableOpacity
                  key={dt}
                  style={[styles.chip, documentType === dt && styles.chipActive]}
                  onPress={() => setDocumentType(dt)}
                >
                  <Text style={[styles.chipText, documentType === dt && styles.chipTextActive]}>{dt}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Número de Documento</Text>
            <View style={styles.inputRow}>
              <Ionicons name="card-outline" size={18} color={colors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="Mínimo 10 dígitos"
                placeholderTextColor="#9ca3af"
                keyboardType="number-pad"
                value={cedula}
                onChangeText={setCedula}
              />
            </View>

            <Text style={styles.label}>Teléfono</Text>
            <View style={styles.inputRow}>
              <Ionicons name="call-outline" size={18} color={colors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="Mínimo 10 dígitos"
                placeholderTextColor="#9ca3af"
                keyboardType="number-pad"
                value={phone}
                onChangeText={setPhone}
              />
            </View>

            <Text style={styles.label}>Correo Electrónico</Text>
            <View style={styles.inputRow}>
              <Ionicons name="mail-outline" size={18} color={colors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="correo@ejemplo.com"
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <Text style={styles.label}>Nombre de Usuario</Text>
            <View style={styles.inputRow}>
              <Ionicons name="at-outline" size={18} color={colors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="Mínimo 3 caracteres"
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
                value={username}
                onChangeText={setUsername}
              />
            </View>

            <Text style={styles.label}>Contraseña</Text>
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="Mínimo 12 caracteres"
                placeholderTextColor="#9ca3af"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>
            <Text style={styles.hint}>Mínimo 12 caracteres, incluye 1 letra, 1 número y 1 símbolo (ej: !@#)</Text>

            <Text style={styles.label}>Confirmar Contraseña</Text>
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="Repite tu contraseña"
                placeholderTextColor="#9ca3af"
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
            </View>

            <TouchableOpacity style={styles.checkboxRow} onPress={() => setAcceptTerms((v) => !v)}>
              <View style={[styles.checkbox, acceptTerms && styles.checkboxChecked]}>
                {acceptTerms && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <Text style={styles.checkboxLabel}>Acepto términos y condiciones</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.button} onPress={onSubmit} disabled={loading} activeOpacity={0.85}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="person-add-outline" size={18} color="#fff" />
                  <Text style={styles.buttonText}>Crear Cuenta</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('Login')} style={{ marginTop: 18 }}>
              <Text style={styles.link}>
                ¿Ya tienes cuenta? <Text style={styles.linkStrong}>Inicia Sesión aquí</Text>
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
    backgroundColor: 'rgba(8, 18, 43, 0.6)',
  },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingVertical: 40 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20, alignSelf: 'center' },
  brandLogo: { width: 34, height: 34 },
  brandTitle: { fontSize: 18, fontWeight: '800', color: colors.textOnDark, letterSpacing: 1 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 28,
    ...shadow.floating,
  },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: 4, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 6, marginTop: 12 },
  hint: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
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
  input: { flex: 1, paddingVertical: 12, fontSize: 15, color: colors.text },
  chipsRow: { flexDirection: 'row', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: colors.background,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: '#fff' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18, gap: 10 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxLabel: { color: colors.text, fontSize: 13 },
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
