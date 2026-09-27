/** Forgot password - OTP over registered phone/email, then set a new password. */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { requestResetOtp, verifyResetOtp } from '../api';
import { Btn, Field, Screen, C } from '../components/ui';

const STEP = { CONTACT: 0, OTP: 1, DONE: 2 };
const OTP_TTL = 10 * 60; // seconds, mirrors the backend expiry

export default function ForgotPasswordScreen({ nav }) {
  const [step, setStep] = useState(STEP.CONTACT);
  const [contact, setContact] = useState('');
  const [otp, setOtp] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [secsLeft, setSecsLeft] = useState(0);
  const timer = useRef(null);

  useEffect(() => () => clearInterval(timer.current), []);

  function startCountdown() {
    clearInterval(timer.current);
    setSecsLeft(OTP_TTL);
    timer.current = setInterval(() => {
      setSecsLeft((s) => (s <= 1 ? (clearInterval(timer.current), 0) : s - 1));
    }, 1000);
  }

  async function sendOtp() {
    setErr(''); setInfo('');
    if (!contact.trim()) { setErr('Enter your registered phone number or email.'); return; }
    setBusy(true);
    try {
      const r = await requestResetOtp(contact.trim());
      setInfo(r.message || `OTP sent to your registered contact.`);
      setDevOtp(r.dev_otp || '');
      setOtp('');
      setStep(STEP.OTP);
      startCountdown();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setErr('');
    if (!/^\d{6}$/.test(otp.trim())) { setErr('Enter the 6-digit OTP.'); return; }
    if (!next || next !== confirm) { setErr('New password and confirmation do not match.'); return; }
    setBusy(true);
    try {
      const r = await verifyResetOtp(contact.trim(), otp.trim(), next);
      setInfo(r.message || 'Password reset successfully.');
      setStep(STEP.DONE);
      clearInterval(timer.current);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const mm = String(Math.floor(secsLeft / 60)).padStart(2, '0');
  const ss = String(secsLeft % 60).padStart(2, '0');

  return (
    <Screen title="Forgot Password" onBack={nav.pop} error={err}>
      {step === STEP.CONTACT && (
        <View style={s.card}>
          <Text style={s.icon}>📩</Text>
          <Text style={s.body}>
            Enter the phone number or email registered to your account.
            We will send a one-time password (OTP) to it.
          </Text>
          <Field
            label="Registered phone or email"
            value={contact}
            onChangeText={setContact}
            placeholder="e.g. 9876543210 or name@example.com"
            required
          />
          <Btn title={busy ? 'Sending OTP…' : 'Send OTP'} onPress={sendOtp} disabled={busy} />
        </View>
      )}

      {step === STEP.OTP && (
        <View style={s.card}>
          <Text style={s.icon}>🔑</Text>
          <Text style={s.body}>
            Enter the 6-digit OTP sent to{' '}
            <Text style={s.bold}>{contact.trim()}</Text>.
          </Text>
          <Field
            label="OTP"
            value={otp}
            onChangeText={(v) => setOtp(v.replace(/[^0-9]/g, '').slice(0, 6))}
            placeholder="6-digit code"
            keyboard="number-pad"
            required
          />
          {!!devOtp && (
            <Text style={s.devOtp}>Development mode OTP: {devOtp}</Text>
          )}
          <Field label="New password" value={next} onChangeText={setNext} secure required />
          <Field label="Confirm new password" value={confirm} onChangeText={setConfirm} secure required />
          <Text style={s.hint}>Minimum 8 characters with at least one letter and one number.</Text>

          <View style={s.otpMeta}>
            <Text style={secsLeft > 0 ? s.timer : s.timerExpired}>
              {secsLeft > 0 ? `OTP expires in ${mm}:${ss}` : 'OTP has expired'}
            </Text>
            <TouchableOpacity onPress={sendOtp} disabled={busy} accessibilityRole="button">
              <Text style={s.resend}>Resend OTP</Text>
            </TouchableOpacity>
          </View>

          <Btn title={busy ? 'Verifying…' : 'Verify & reset password'} onPress={verify} disabled={busy} />
        </View>
      )}

      {step === STEP.DONE && (
        <View style={s.card}>
          <Text style={s.icon}>✅</Text>
          <Text style={s.body}>{info || 'Password reset successfully.'}</Text>
          <Btn title="Back to login" onPress={() => nav.reset('login')} kind="success" />
        </View>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 18,
    borderWidth: 1, borderColor: C.border, elevation: 1,
  },
  icon: { fontSize: 34, textAlign: 'center', marginBottom: 10 },
  body: { fontSize: 14, color: C.text, lineHeight: 21, marginBottom: 16, textAlign: 'center' },
  bold: { fontWeight: '800', color: C.primary },
  devOtp: {
    color: C.accentDark, fontSize: 12.5, backgroundColor: '#fdf3e0',
    borderRadius: 8, padding: 8, marginBottom: 12, textAlign: 'center', fontWeight: '600',
  },
  hint: { color: C.muted, fontSize: 12, marginTop: -4, marginBottom: 10, lineHeight: 16 },
  otpMeta: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 8, paddingHorizontal: 2,
  },
  timer: { color: C.muted, fontSize: 12.5, fontWeight: '600' },
  timerExpired: { color: C.danger, fontSize: 12.5, fontWeight: '700' },
  resend: { color: C.accentDark, fontWeight: '700', fontSize: 13 },
});
