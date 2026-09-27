/**
 * Shared UI kit - professional ERP design system.
 * Same exported API as before (Colors, Card, Row, Title, Sub, Btn, Field,
 * Picker, Screen, Loading, alertError) so all screens keep working unchanged.
 */
import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, StatusBar, Platform, Modal,
} from 'react-native';

/**
 * Sri Varahi approved logo palette:
 *   Primary Green #22650f · Primary Red #7d1606 · Tomato Red #d22803
 *   Gold #e3af18 · Dark Gold #ca7a11
 * (Neutrals - backgrounds, text, borders - stay subtle greys.)
 */
export const Colors = {
  primary: '#22650f',      // Primary Green
  primaryDark: '#194b0b',  // deep shade of Primary Green
  primaryLight: '#eaf3e6', // light tint of Primary Green
  accent: '#e3af18',       // Gold
  accentDark: '#ca7a11',   // Dark Gold
  tomato: '#d22803',       // Tomato Red (attention / balance due)
  danger: '#7d1606',       // Primary Red (destructive / errors)
  dangerBg: '#fbeae8',     // light tint of Tomato Red
  ok: '#22650f',           // Primary Green
  bg: '#f4f6f4',
  card: '#ffffff',
  text: '#1c1c1a',
  muted: '#6b7268',
  border: '#e2e5e0',
};

export const C = Colors;

/**
 * Display form of a lot number: EXACTLY 3 digits (001, 010, 999).
 * The backend stores L-YYYYMMDD-NNN; the app always shows just the
 * zero-padded 3-digit sequence everywhere.
 */
export function lotSeq(lotNumber) {
  const s = String(lotNumber || '');
  const tail = s.split('-').pop();
  return /^\d{3}$/.test(tail) ? tail : s;
}

/* ---------- Buttons ---------- */

const BTN_KINDS = {
  primary: { bg: Colors.primary, text: '#fff' },
  secondary: { bg: '#ffffff', text: Colors.primary, border: Colors.primary },
  accent: { bg: Colors.accent, text: '#fff' },
  danger: { bg: Colors.danger, text: '#fff' },
  success: { bg: Colors.ok, text: '#fff' },
};

export function Btn({ title, onPress, kind = 'primary', disabled, style }) {
  const k = BTN_KINDS[kind] || BTN_KINDS.primary;
  return (
    <TouchableOpacity
      activeOpacity={disabled ? 1 : 0.75}
      style={[
        s.btn,
        { backgroundColor: k.bg, borderColor: k.border || k.bg },
        !!k.border && s.btnOutlined,
        disabled && s.btnDisabled,
        style,
      ]}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
    >
      <Text style={[s.btnText, { color: k.text }]} numberOfLines={1}>{title}</Text>
    </TouchableOpacity>
  );
}

/* ---------- Cards / typography ---------- */

export function Card({ children, style }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function SectionTitle({ children, action }) {
  return (
    <View style={s.sectionHead}>
      <Text style={s.sectionTitle}>{children}</Text>
      {action || null}
    </View>
  );
}

export function Row({ label, value, strong }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel} numberOfLines={2}>{label}</Text>
      <Text style={[s.rowValue, strong && s.strong]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

export function Badge({ children, tone = 'neutral' }) {
  const tones = {
    neutral: { bg: '#eef0ec', fg: Colors.muted },
    success: { bg: Colors.primaryLight, fg: Colors.primary },
    warning: { bg: '#fdf3e0', fg: Colors.accentDark },
    danger: { bg: Colors.dangerBg, fg: Colors.tomato },
  };
  const t = tones[tone] || tones.neutral;
  return (
    <View style={[s.badge, { backgroundColor: t.bg }]}>
      <Text style={[s.badgeText, { color: t.fg }]} numberOfLines={1}>{children}</Text>
    </View>
  );
}

/** Filter chip (tap to activate) - shared by all filter sections. */
export function Chip({ label, active, onPress }) {
  return (
    <TouchableOpacity
      style={[s.chip, active && s.chipActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active }}
    >
      <Text style={[s.chipText, active && s.chipTextActive]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

/**
 * FILTER TOOLBAR - a slim horizontal strip directly below the page header.
 * All filter controls sit in ONE line (scrolls horizontally if needed);
 * no separate filter card/box.
 */
export function Toolbar({ children }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={s.toolbarWrap}
      contentContainerStyle={s.toolbar}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

/** Compact search input used inside the filter Toolbar. */
export function ToolInput({ value, onChangeText, placeholder, icon = '🔍' }) {
  return (
    <View style={s.toolInputWrap}>
      <Text style={s.toolInputIcon}>{icon}</Text>
      <TextInput
        style={s.toolInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9aa096"
        autoCorrect={false}
        underlineColorAndroid="transparent"
      />
    </View>
  );
}

/**
 * Date picker field. Shows 📅 + the selected date (or the all-dates label);
 * tapping opens a compact calendar popup (DatePickerModal).
 */
export function DateField({ value, onChange, allLabel = 'All Dates' }) {
  const [open, setOpen] = React.useState(false);
  return (
    <View>
      <TouchableOpacity
        style={[s.dateBtn, value ? s.dateBtnActive : null]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Pick date filter"
      >
        <Text style={s.dateIcon}>📅</Text>
        <Text style={[s.dateText, value ? s.dateTextActive : null]} numberOfLines={1}>
          {value || allLabel}
        </Text>
        {value ? (
          <TouchableOpacity
            style={s.dateClear}
            onPress={() => onChange('')}
            accessibilityRole="button"
            accessibilityLabel="Clear date filter"
          >
            <Text style={s.dateClearText}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>
      <DatePickerModal
        visible={open}
        value={value}
        onPick={(d) => { onChange(d); setOpen(false); }}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Compact calendar popup - the shared date picker for all filters. */
export function DatePickerModal({ visible, value, onPick, onClose }) {
  const initial = value ? new Date(value + 'T00:00:00') : new Date();
  const [cur, setCur] = React.useState({ y: initial.getFullYear(), m: initial.getMonth() });
  const [mountedVisible, setMountedVisible] = React.useState(false);

  React.useEffect(() => {
    if (visible) {
      const d = value ? new Date(value + 'T00:00:00') : new Date();
      setCur({ y: d.getFullYear(), m: d.getMonth() });
      setMountedVisible(true);
    }
  }, [visible]);

  if (!visible || !mountedVisible) return null;

  const firstDow = new Date(cur.y, cur.m, 1).getDay();
  const daysInMonth = new Date(cur.y, cur.m + 1, 0).getDate();
  const cells = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const iso = (day) => `${cur.y}-${String(cur.m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const shift = (n) => {
    const d = new Date(cur.y, cur.m + n, 1);
    setCur({ y: d.getFullYear(), m: d.getMonth() });
  };

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <View style={s.calOverlay}>
        <View style={s.calCard}>
          <View style={s.calHead}>
            <TouchableOpacity onPress={() => shift(-1)} style={s.calNav} accessibilityRole="button" accessibilityLabel="Previous month">
              <Text style={s.calNavText}>‹</Text>
            </TouchableOpacity>
            <Text style={s.calTitle}>{MONTH_NAMES[cur.m]} {cur.y}</Text>
            <TouchableOpacity onPress={() => shift(1)} style={s.calNav} accessibilityRole="button" accessibilityLabel="Next month">
              <Text style={s.calNavText}>›</Text>
            </TouchableOpacity>
          </View>
          <View style={s.calGrid}>
            {DOW.map((d, i) => (
              <Text key={'dow' + i} style={s.calDow}>{d}</Text>
            ))}
            {cells.map((day, i) => (
              day == null
                ? <View key={'e' + i} style={s.calCell} />
                : (
                  <TouchableOpacity
                    key={'d' + i}
                    style={[s.calCell, s.calDay, value === iso(day) && s.calDayActive]}
                    onPress={() => onPick(iso(day))}
                    accessibilityRole="button"
                    accessibilityLabel={iso(day)}
                  >
                    <Text style={[s.calDayText, value === iso(day) && s.calDayTextActive]}>{day}</Text>
                  </TouchableOpacity>
                )
            ))}
          </View>
          <View style={s.calFoot}>
            <TouchableOpacity style={s.calBtn} onPress={onClose} accessibilityRole="button">
              <Text style={s.calBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.calBtn, s.calBtnPrimary]} onPress={() => onPick('')} accessibilityRole="button">
              <Text style={s.calBtnTextPrimary}>All Dates</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function Title({ children }) {
  return <Text style={s.title}>{children}</Text>;
}

export function Sub({ children }) {
  return <Text style={s.sub}>{children}</Text>;
}

export function Empty({ children }) {
  return (
    <View style={s.empty}>
      <Text style={s.emptyIcon} accessibilityElementsHidden>◻</Text>
      <Text style={s.emptyText}>{children}</Text>
    </View>
  );
}

/* ---------- Form fields ---------- */

/**
 * Combined existing/new searchable picker (single field).
 * Typing filters existing items; tapping a suggestion selects it
 * (onSelect(item.id)). If nothing matches, the typed text itself is the
 * value - the caller treats it as a NEW entry (onSelect(null) is kept).
 */
export function ComboPicker({ label, items, value, onChangeText, selectedId, selectedLabel, onSelect, placeholder, renderLabel }) {
  const [focused, setFocused] = React.useState(false);
  const selected = items.find((i) => String(i.id) === String(selectedId));
  const text = (value || '').trim().toLowerCase();
  const exactMatch = text && items.some((i) => (renderLabel ? renderLabel(i) : i.name).toLowerCase() === text);
  const suggestions = text
    ? items.filter((i) => (renderLabel ? renderLabel(i) : i.name).toLowerCase().includes(text)).slice(0, 10)
    : [];
  return (
    <View style={s.fieldWrap}>
      {label ? <Text style={s.fieldLabel}>{label}</Text> : null}
      {selected ? (
        <View style={s.picked}>
          <Text style={s.pickedText} numberOfLines={1}>{selectedLabel || (renderLabel ? renderLabel(selected) : selected.name)}</Text>
          <TouchableOpacity
            style={s.pickedChangeBtn}
            onPress={() => { onSelect(null); if (onChangeText) onChangeText(''); }}
            accessibilityRole="button"
            accessibilityLabel="Change selection"
          >
            <Text style={s.pickedChange}>Change</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TextInput
          style={[s.input, focused && s.inputFocused]}
          value={value}
          onChangeText={(t) => { if (onChangeText) onChangeText(t); onSelect(null); }}
          placeholder={placeholder}
          placeholderTextColor="#9aa096"
          autoCorrect={false}
          underlineColorAndroid="transparent"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      )}
      {focused && !selected && text && suggestions.length > 0 && (
        <View style={s.pickList}>
          <ScrollView style={{ maxHeight: 170 }} nestedScrollEnabled keyboardShouldPersistTaps="always">
            {suggestions.map((i) => (
              <TouchableOpacity
                key={i.id}
                style={s.pickItem}
                onPress={() => {
                  onSelect(i.id);
                  if (onChangeText) onChangeText(renderLabel ? renderLabel(i) : i.name);
                  setFocused(false);
                }}
              >
                <Text style={s.pickItemText} numberOfLines={1}>{renderLabel ? renderLabel(i) : i.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
      {focused && !selected && text && !exactMatch && suggestions.length === 0 && (
        <Text style={s.mutedSmall}>&ldquo;{value.trim()}&rdquo; is not an existing entry — it will be created as new.</Text>
      )}
    </View>
  );
}

/**
 * Live searchable dropdown: ONE field. Typing filters items immediately
 * (by rendered label); matching items are listed below the input; tapping
 * one selects it. With an empty query the first items are listed.
 */
export function SearchSelect({ label, items, selectedId, onSelect, placeholder, renderLabel, emptyHint, maxItems = 30 }) {
  const [q, setQ] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const selected = items.find((i) => String(i.id) === String(selectedId));
  const text = q.trim().toLowerCase();
  const matches = (text
    ? items.filter((i) => (renderLabel ? renderLabel(i) : i.name).toLowerCase().includes(text))
    : items
  ).slice(0, maxItems);
  return (
    <View style={s.fieldWrap}>
      {label ? <Text style={s.fieldLabel}>{label}</Text> : null}
      {selected ? (
        <View style={s.picked}>
          <Text style={s.pickedText} numberOfLines={1}>{renderLabel ? renderLabel(selected) : selected.name}</Text>
          <TouchableOpacity
            style={s.pickedChangeBtn}
            onPress={() => { onSelect(null); setQ(''); setOpen(true); }}
            accessibilityRole="button"
            accessibilityLabel="Change selection"
          >
            <Text style={s.pickedChange}>Change</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <TextInput
            style={[s.input, open && s.inputFocused]}
            value={q}
            onChangeText={setQ}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            placeholderTextColor="#9aa096"
            autoCorrect={false}
            underlineColorAndroid="transparent"
            accessibilityLabel={label || 'search dropdown'}
          />
          {open && (
            <View style={s.pickList}>
              <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                {matches.map((i) => (
                  <TouchableOpacity
                    key={i.id}
                    style={s.pickItem}
                    onPress={() => { onSelect(i.id); setOpen(false); setQ(''); }}
                  >
                    <Text style={s.pickItemText} numberOfLines={1}>{renderLabel ? renderLabel(i) : i.name}</Text>
                  </TouchableOpacity>
                ))}
                {matches.length === 0 && (
                  <Text style={s.mutedSmall}>{emptyHint || 'No matching items.'}</Text>
                )}
              </ScrollView>
            </View>
          )}
        </>
      )}
    </View>
  );
}

export function Field({ label, value, onChangeText, placeholder, keyboard = 'default', multiline, required, secure, autoCapitalize = 'none' }) {
  const [focused, setFocused] = React.useState(false);
  const [reveal, setReveal] = React.useState(false);
  return (
    <View style={s.fieldWrap}>
      {label ? (
        <Text style={s.fieldLabel}>
          {label}
          {required ? <Text style={s.required}> *</Text> : null}
        </Text>
      ) : null}
      <View style={s.inputRow}>
        <TextInput
          style={[s.input, s.inputFlex, multiline && { height: 84, textAlignVertical: 'top' }, focused && s.inputFocused]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          keyboardType={keyboard}
          multiline={multiline}
          secureTextEntry={secure && !reveal}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          placeholderTextColor="#9aa096"
          underlineColorAndroid="transparent"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {secure ? (
          <TouchableOpacity
            style={s.revealBtn}
            onPress={() => setReveal(!reveal)}
            accessibilityRole="button"
            accessibilityLabel={reveal ? 'Hide password' : 'Show password'}
          >
            <Text style={s.revealText}>{reveal ? '🙈' : '👁'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

/** Searchable picker: type to filter, tap to select. */
export function Picker({ label, items, selectedId, onSelect, placeholder, renderLabel }) {
  const [q, setQ] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const selected = items.find((i) => String(i.id) === String(selectedId));
  const filtered = q
    ? items.filter((i) => (renderLabel ? renderLabel(i) : i.name).toLowerCase().includes(q.toLowerCase()))
    : items;
  return (
    <View style={s.fieldWrap}>
      {label ? <Text style={s.fieldLabel}>{label}</Text> : null}
      {selected ? (
        <View style={s.picked}>
          <Text style={s.pickedText} numberOfLines={1}>{renderLabel ? renderLabel(selected) : selected.name}</Text>
          <TouchableOpacity
            style={s.pickedChangeBtn}
            onPress={() => onSelect(null)}
            accessibilityRole="button"
            accessibilityLabel="Change selection"
          >
            <Text style={s.pickedChange}>Change</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={[s.inputTouchable, open && s.inputFocused]}
          onPress={() => setOpen(!open)}
          accessibilityRole="button"
        >
          <Text style={{ color: Colors.muted, fontSize: 15 }} numberOfLines={1}>
            {open ? 'Type below to search…' : placeholder}
          </Text>
          <Text style={s.pickerCaret}>▾</Text>
        </TouchableOpacity>
      )}
      {open && !selected && (
        <View style={s.pickList}>
          <TextInput
            style={s.input}
            value={q}
            onChangeText={setQ}
            placeholder={`Search ${label || 'item'}…`}
            placeholderTextColor="#9aa096"
          />
          {/* keyboardShouldPersistTaps: without it the first tap on an item
              only dismisses the keyboard and the selection is lost (Android). */}
          <ScrollView style={{ maxHeight: 170 }} nestedScrollEnabled keyboardShouldPersistTaps="always">
            {filtered.slice(0, 30).map((i) => (
              <TouchableOpacity
                key={i.id}
                style={s.pickItem}
                onPress={() => { onSelect(i.id); setOpen(false); setQ(''); }}
              >
                <Text style={s.pickItemText} numberOfLines={1}>{renderLabel ? renderLabel(i) : i.name}</Text>
              </TouchableOpacity>
            ))}
            {filtered.length === 0 && (
              <Text style={s.mutedSmall}>No match — the name you type on save will be created.</Text>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

/* ---------- Screen shell ---------- */

/**
 * Screen shell with the FIXED Sri Varahi ERP header (stays visible while
 * scrolling - it sits above the ScrollView). Header layout:
 *   LEFT column  : Back button (top), menu ☰ button (below)
 *   CENTER       : "SRI VARAHI ERP" brand line over the screen title
 * Pass `nav` to show the ☰ sidebar-navigation button (main module screens).
 */
export function Screen({ children, onBack, title, error, nav }) {
  return (
    <View style={s.screen}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />
      <View style={s.header}>
        <View style={s.headerLeft}>
          {onBack ? (
            <TouchableOpacity
              onPress={onBack}
              style={s.backBtn}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Text style={s.backIcon}>←</Text>
            </TouchableOpacity>
          ) : <View style={s.navBtnPlaceholder} />}
          {nav && nav.openMenu ? (
            <TouchableOpacity
              onPress={nav.openMenu}
              style={s.menuBtn}
              accessibilityRole="button"
              accessibilityLabel="Open navigation menu"
              testID="open-sidebar"
            >
              <Text style={s.menuIcon}>☰</Text>
            </TouchableOpacity>
          ) : <View style={s.navBtnPlaceholder} />}
        </View>
        <View style={s.headerTitles}>
          <Text style={s.brandLine}>SRI VARAHI ERP</Text>
          <Text style={s.headerTitle} numberOfLines={1} ellipsizeMode="tail">{title}</Text>
        </View>
        <View style={s.headerRight} />
      </View>
      {error ? (
        <View style={s.errorBar} accessibilityLiveRegion="polite">
          <Text style={s.errorIcon}>⚠</Text>
          <Text style={s.errorText}>{error}</Text>
        </View>
      ) : null}
      <ScrollView
        style={s.body}
        contentContainerStyle={{ padding: 14, paddingBottom: 44 }}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </View>
  );
}

export function Loading({ label = 'Loading…' }) {
  return (
    <View style={{ padding: 24, alignItems: 'center' }}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={s.loadingText}>{label}</Text>
    </View>
  );
}

export function alertError(e) {
  Alert.alert('Something went wrong', e.message || String(e));
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 6 : 44,
    paddingBottom: 8,
    paddingHorizontal: 10,
    elevation: 4,
  },
  headerLeft: { width: 46, alignItems: 'center', justifyContent: 'center' },
  headerRight: { width: 8 },
  headerTitles: { flex: 1, marginLeft: 4 },
  brandLine: { color: Colors.accent, fontSize: 9.5, fontWeight: '800', letterSpacing: 1.6 },
  headerTitle: {
    color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3,
  },
  backBtn: { alignItems: 'center', justifyContent: 'center', width: 44, height: 34 },
  menuBtn: { alignItems: 'center', justifyContent: 'center', width: 44, height: 30 },
  navBtnPlaceholder: { width: 44, height: 34 },
  backIcon: { color: '#fff', fontSize: 22, fontWeight: '700', lineHeight: 24 },
  menuIcon: { color: '#fff', fontSize: 19, fontWeight: '800', lineHeight: 21 },
  body: { flex: 1 },

  card: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    elevation: 1,
  },
  title: { fontSize: 17, fontWeight: '700', color: Colors.text, marginBottom: 6 },
  sub: { fontSize: 13, color: Colors.muted, marginBottom: 8, lineHeight: 18 },
  sectionHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 10, marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: Colors.muted,
    textTransform: 'uppercase', letterSpacing: 1,
  },

  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6, gap: 12,
  },
  rowLabel: { color: Colors.muted, fontSize: 14, flexShrink: 1 },
  rowValue: { color: Colors.text, fontSize: 14, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  strong: { fontSize: 15, fontWeight: '800', color: Colors.primary },

  badge: {
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3,
    alignSelf: 'flex-start', overflow: 'hidden',
  },
  badgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  chip: {
    borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7,
    backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary, elevation: 1 },
  chipText: { fontSize: 12.5, fontWeight: '700', color: Colors.muted },
  chipTextActive: { color: '#fff' },

  /* filter toolbar (slim single-line strip below the header) */
  toolbarWrap: { flexGrow: 0, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: Colors.border },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 8 },
  toolInputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.bg, borderRadius: 999, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 10, height: 36, minWidth: 150,
  },
  toolInputIcon: { fontSize: 13 },
  toolInput: { flex: 1, padding: 0, fontSize: 13, color: Colors.text, height: 34 },
  dateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, height: 36,
    backgroundColor: '#fff', borderRadius: 999, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 11,
  },
  dateBtnActive: { backgroundColor: Colors.primaryLight, borderColor: '#cfe4d1' },
  dateIcon: { fontSize: 14 },
  dateText: { fontSize: 12.5, fontWeight: '700', color: Colors.muted },
  dateTextActive: { color: Colors.primary },
  dateClear: { paddingLeft: 6 },
  dateClearText: { fontSize: 12, color: Colors.muted, fontWeight: '800' },

  /* calendar popup */
  calOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  calCard: { width: '100%', maxWidth: 330, backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', elevation: 6 },
  calHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.primary, paddingHorizontal: 8, paddingVertical: 10,
  },
  calTitle: { color: '#fff', fontSize: 15, fontWeight: '800' },
  calNav: { alignItems: 'center', justifyContent: 'center', width: 38, height: 34 },
  calNavText: { color: '#fff', fontSize: 24, fontWeight: '800', lineHeight: 28 },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 8 },
  calDow: { width: '14.28%', textAlign: 'center', fontSize: 11, fontWeight: '800', color: Colors.accentDark, paddingVertical: 4 },
  calCell: { width: '14.28%', alignItems: 'center', justifyContent: 'center' },
  calDay: { paddingVertical: 7 },
  calDayActive: { backgroundColor: Colors.primary, borderRadius: 999 },
  calDayText: { fontSize: 13.5, color: Colors.text, fontWeight: '600' },
  calDayTextActive: { color: '#fff', fontWeight: '800' },
  calFoot: { flexDirection: 'row', gap: 8, padding: 12, paddingTop: 4 },
  calBtn: {
    flex: 1, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.primary,
    paddingVertical: 11, alignItems: 'center',
  },
  calBtnPrimary: { backgroundColor: Colors.primary, elevation: 1 },
  calBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 13.5 },
  calBtnTextPrimary: { color: '#fff', fontWeight: '700', fontSize: 13.5 },

  empty: {
    alignItems: 'center', padding: 22, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed',
    backgroundColor: '#fafbfa',
  },
  emptyIcon: { fontSize: 22, color: Colors.muted, marginBottom: 6 },
  emptyText: { color: Colors.muted, fontSize: 14, textAlign: 'center' },

  btn: {
    borderRadius: 10,
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    borderWidth: 1,
    elevation: 1,
  },
  btnOutlined: { elevation: 0 },
  btnDisabled: { opacity: 0.45, elevation: 0 },
  btnText: { fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },

  fieldWrap: { marginBottom: 12 },
  fieldLabel: { fontSize: 13, color: Colors.text, marginBottom: 6, fontWeight: '600' },
  required: { color: Colors.danger, fontWeight: '800' },
  input: {
    backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 12, height: 48, fontSize: 15, color: Colors.text,
  },
  inputFocused: { borderColor: Colors.primary, borderWidth: 1.5 },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  inputFlex: { flex: 1 },
  revealBtn: { position: 'absolute', right: 6, padding: 10 },
  revealText: { fontSize: 17 },
  inputTouchable: {
    backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 12, height: 48,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  pickerCaret: { color: Colors.muted, fontSize: 16, marginLeft: 8 },
  pickList: {
    marginTop: 8, borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: '#fff', padding: 8, overflow: 'hidden',
  },
  picked: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primaryLight,
    borderRadius: 10, paddingHorizontal: 12, height: 48,
    justifyContent: 'space-between', borderWidth: 1, borderColor: '#cfe4d1',
  },
  pickedText: { color: Colors.primary, fontWeight: '700', fontSize: 15, flexShrink: 1, marginRight: 8 },
  pickedChangeBtn: { paddingVertical: 8, paddingLeft: 8 },
  pickedChange: { color: Colors.accentDark, fontWeight: '700', fontSize: 13 },
  pickItem: {
    padding: 13, borderBottomWidth: 1, borderBottomColor: '#f0f2ee', backgroundColor: '#fff',
  },
  pickItemText: { fontSize: 15, color: Colors.text },
  mutedSmall: { padding: 10, color: Colors.muted, fontSize: 12, lineHeight: 16 },

  errorBar: {
    backgroundColor: Colors.dangerBg, padding: 10, paddingHorizontal: 14,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderBottomWidth: 1, borderBottomColor: '#f5c6c0',
  },
  errorIcon: { color: Colors.danger, fontSize: 15, fontWeight: '800' },
  errorText: { color: Colors.danger, fontSize: 13, flex: 1, lineHeight: 18 },
  loadingText: { color: Colors.muted, marginTop: 8, fontSize: 13 },
});
