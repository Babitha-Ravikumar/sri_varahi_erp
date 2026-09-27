/**
 * SIDEBAR NAVIGATION - the single place the main modules are listed.
 * Opened from the ☰ button in the app header (see Screen in ui.js).
 * The currently active module is highlighted; tapping a module jumps
 * straight there (dashboard stays underneath for the back button).
 */
import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet } from 'react-native';
import { C } from './ui';
import { getSession, clearSession, canAccess } from '../api';
import { MODULES, moduleOfScreen } from '../modules';

/** Returns the module key active for a given screen name (null = none). */
export const activeModuleOf = moduleOfScreen;

export default function Sidebar({ visible, ...props }) {
  if (!visible) return null;
  return <SidebarPanel {...props} />;
}

function SidebarPanel({ onClose, activeScreen, nav }) {
  const session = getSession();
  const active = activeModuleOf(activeScreen);

  // Only the modules enabled for the signed-in user are listed.
  const modules = MODULES.filter((m) => canAccess(m.key));

  function go(key) {
    onClose();
    // Sidebar module key → actual screen name in App.js's SCREENS registry.
    // "Lots" opens the lot list (LotDetailScreen in list mode).
    const target = key === 'lots' ? 'lotDetail' : key === 'sourceSelect' ? 'sourceSelect' : key;
    nav.go(target, key === 'lots' ? { list: true } : {});
  }

  return (
    <Modal transparent visible animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <TouchableOpacity style={s.scrim} activeOpacity={1} onPress={onClose} accessibilityLabel="Close menu" />
        <View style={s.panel} testID="app-sidebar">
          <View style={s.head}>
            <Text style={s.brand}>SRI VARAHI ERP</Text>
            {session ? <Text style={s.user}>{session.name} · {session.role_name || session.role}</Text> : null}
          </View>

          <ScrollView style={s.list} contentContainerStyle={{ paddingBottom: 8 }}>
            {modules.map((m) => {
              const on = active === m.key;
              return (
                <TouchableOpacity
                  key={m.key}
                  style={[s.item, on && s.itemActive]}
                  onPress={() => go(m.key)}
                  accessibilityRole="button"
                  accessibilityLabel={m.title}
                  accessibilityState={{ selected: on }}
                >
                  <Text style={s.icon}>{m.icon}</Text>
                  <Text style={[s.title, on && s.titleActive]}>{m.title}</Text>
                  {on ? <Text style={s.activeBar}>▍</Text> : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            style={s.logout}
            onPress={() => { onClose(); clearSession(); nav.reset('login'); }}
            accessibilityRole="button"
            accessibilityLabel="Logout"
          >
            <Text style={s.logoutIcon}>↩</Text>
            <Text style={s.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, flexDirection: 'row' },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  panel: {
    width: 268, maxWidth: '82%',
    backgroundColor: '#fff',
    elevation: 8,
  },
  head: {
    backgroundColor: C.primary, paddingTop: 46, paddingBottom: 14,
    paddingHorizontal: 16, borderLeftWidth: 6, borderLeftColor: C.accent,
  },
  brand: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 0.5 },
  user: { color: '#ffffffcc', fontSize: 12, marginTop: 3 },
  list: { flex: 1 },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#f0f2ee',
  },
  itemActive: { backgroundColor: C.primaryLight },
  icon: { fontSize: 17, width: 24, textAlign: 'center' },
  title: { flex: 1, fontSize: 14.5, fontWeight: '600', color: C.text },
  titleActive: { color: C.primary, fontWeight: '800' },
  activeBar: { color: C.primary, fontSize: 16 },
  logout: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 15, paddingHorizontal: 16,
    borderTopWidth: 1, borderTopColor: C.border, backgroundColor: '#fafbfa',
  },
  logoutIcon: { fontSize: 16, width: 24, textAlign: 'center', color: C.danger },
  logoutText: { fontSize: 14.5, fontWeight: '700', color: C.danger },
});
