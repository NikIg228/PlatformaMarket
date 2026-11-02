import { forwardRef, useEffect, useRef, useState, type ComponentRef, type ReactNode } from "react";
import { AccessibilityInfo, ActivityIndicator, Platform, Pressable, StyleSheet, Text as NativeText, TextInput, View, type TextInputProps } from "react-native";
import { palette, theme } from "./theme";

export function Text({ children, kind = "body", strong = false, secondary = false, selectable }: { children: ReactNode; selectable?: boolean; kind?: "body" | "title" | "subtitle" | "caption"; strong?: boolean; secondary?: boolean }) {
  const size = theme.type[kind];
  return <NativeText selectable={selectable} accessibilityRole={kind === "title" || kind === "subtitle" ? "header" : undefined} style={{ color: secondary ? palette["text.secondary"] : palette["text.primary"], fontSize: size, lineHeight: size * theme.type.line, fontWeight: strong || kind === "title" ? "600" : "400" }}>{children}</NativeText>;
}

export function Button({ label, onPress, disabled = false, selected = false, tone = "neutral", accessibilityLabel, role }: { label: string; onPress: () => void; disabled?: boolean; selected?: boolean; tone?: "neutral" | "primary" | "tab"; accessibilityLabel?: string; role?: "button" | "tab" | "radio" }) {
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const accessibilityRole = role ?? (tone === "tab" ? "tab" : "button");
  return <Pressable accessibilityRole={accessibilityRole} accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ disabled, ...(accessibilityRole === "radio" ? { checked: selected } : accessibilityRole === "tab" ? { selected } : {}) }} disabled={disabled} onPress={onPress} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)} style={({ pressed }) => [styles.button, {
    borderBottomWidth: tone === "tab" ? 3 : 0,
    borderBottomColor: selected ? palette["brand.default"] : hovered ? palette["text.secondary"] : "transparent",
    borderRadius: tone === "tab" ? 0 : theme.radius.control,
    backgroundColor: disabled ? palette["disabled.surface"] : tone === "tab" ? "transparent" : tone === "primary" ? palette[pressed ? "brand.pressed" : hovered ? "brand.hover" : "brand.default"] : palette[pressed ? "brand.soft" : hovered ? "surface.hover" : "surface.subtle"],
    outlineWidth: focused ? 1 : 0, outlineColor: palette["focus.ring"], outlineOffset: 2,
  }]}>
    <NativeText style={[styles.buttonText, { color: disabled ? palette["disabled.content"] : tone === "primary" ? palette["text.inverse"] : selected ? palette["brand.content"] : palette["text.primary"] }]}>{label}</NativeText>
  </Pressable>;
}

export function Surface({ children }: { children: ReactNode }) { return <View style={styles.card}>{children}</View>; }
export function Stack({ children, row = false }: { children: ReactNode; row?: boolean }) { return <View style={[styles.stack, row && styles.row]}>{children}</View>; }
export function Notice({ title, body, action, kind = "status" }: { title: string; body?: string; action?: ReactNode; kind?: "status" | "error" }) {
  const message = body ? `${title}. ${body}` : title;
  const announced = useRef<string | undefined>(undefined);
  useEffect(() => {
    // Android uses the live region. iOS needs an explicit, queued announcement.
    // Remember the message across StrictMode effect replay, without timers/listeners.
    if (Platform.OS === "ios" && announced.current !== message) {
      announced.current = message;
      AccessibilityInfo.announceForAccessibilityWithOptions(message, { queue: true });
    }
  }, [message]);
  return <View style={styles.notice}>
    <View accessible accessibilityLabel={message} accessibilityRole={kind === "error" ? "alert" : "text"} accessibilityLiveRegion="polite" style={styles.stack}>
      <Text kind="subtitle" strong>{title}</Text>{body && <Text secondary>{body}</Text>}
    </View>
    {action}
  </View>;
}
export function Loading({ label }: { label: string }) { return <View accessible accessibilityLabel={label} accessibilityRole="progressbar" accessibilityState={{ busy: true }} accessibilityLiveRegion="polite" style={styles.loading}><ActivityIndicator accessible={false} color={palette["brand.default"]} /><Text>{label}</Text></View>; }

export type FormInputHandle = ComponentRef<typeof TextInput>;
export const FormInput = forwardRef<FormInputHandle, TextInputProps & { accessibilityLabel: string }>(({ style, onFocus, onBlur, ...props }, ref) => {
  const [focused, setFocused] = useState(false);
  return <TextInput {...props} ref={ref} onFocus={(event) => { setFocused(true); onFocus?.(event); }} onBlur={(event) => { setFocused(false); onBlur?.(event); }}
    style={[styles.formInput, { outlineWidth: focused ? 1 : 0, outlineColor: palette["focus.ring"], outlineOffset: 2 }, style]} />;
});
FormInput.displayName = "FormInput";

export function Search({ value, appliedValue, onChange, onSearch, label, submitLabel, clearLabel, appliedLabel, draftLabel, pending, maxLength }: { value: string; appliedValue: string; onChange: (text: string) => void; onSearch: (text: string) => void; label: string; submitLabel: string; clearLabel: string; appliedLabel: string; draftLabel: string; pending: boolean; maxLength?: number }) {
  const [focused, setFocused] = useState(false);
  return <Stack><View style={[styles.search, { backgroundColor: palette[focused ? "brand.soft" : "surface.subtle"], outlineWidth: focused ? 1 : 0, outlineColor: palette["focus.ring"], outlineOffset: 2 }]}>
    <TextInput accessibilityLabel={label} maxLength={maxLength} placeholder={label} placeholderTextColor={palette["text.muted"]} value={value} onChangeText={onChange} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} returnKeyType="search" onSubmitEditing={() => { if (!pending && value.trim()) onSearch(value.trim()); }} style={styles.input} />
    {(!!value || !!appliedValue) && <><Button label={clearLabel} onPress={() => { onChange(""); onSearch(""); }} disabled={pending} /><Button label={submitLabel} onPress={() => onSearch(value.trim())} disabled={pending || !value.trim()} /></>}
  </View>
    {!!appliedValue && <Text kind="caption" secondary>{appliedLabel}: {appliedValue}</Text>}
    {value.trim() !== appliedValue && <Text kind="caption" secondary>{draftLabel}</Text>}
  </Stack>;
}

const styles = StyleSheet.create({
  button: { alignSelf: "flex-start", minHeight: theme.height, paddingHorizontal: theme.space.page, paddingVertical: theme.space.small, justifyContent: "center", maxWidth: "100%" },
  buttonText: { fontSize: theme.type.body, lineHeight: theme.type.body * theme.type.line, fontWeight: "600", textAlign: "center" },
  stack: { gap: theme.space.medium }, row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center" },
  card: { borderWidth: 1, borderColor: palette["border.default"], borderRadius: theme.radius.card, backgroundColor: palette["surface.default"], padding: theme.space.page, gap: theme.space.medium },
  notice: { padding: theme.space.page, borderRadius: theme.radius.card, borderWidth: 1, borderColor: palette["border.default"], gap: theme.space.medium },
  loading: { padding: theme.space.section, gap: theme.space.medium, alignItems: "center" },
  formInput: { minHeight: theme.height, borderWidth: 1, borderColor: palette["border.default"], borderRadius: theme.radius.control, padding: theme.space.small, color: palette["text.primary"], backgroundColor: palette["surface.default"], fontSize: theme.type.body },
  search: { minHeight: theme.height, borderRadius: theme.radius.control, paddingHorizontal: theme.space.small, flexDirection: "row", flexWrap: "wrap", alignItems: "center" },
  input: { flexGrow: 1, flexShrink: 1, minHeight: theme.height, minWidth: theme.height, padding: theme.space.small, fontSize: theme.type.body, lineHeight: theme.type.body * theme.type.line, color: palette["text.primary"] },
});
