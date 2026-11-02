import { useState, type ReactNode } from "react";
import { StatusBar, StyleSheet, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { MarketReadApplication } from "./src/MarketReadApplication";
import type { MarketSession } from "./src/read-controller";
import type { Locale } from "./src/format-wire";
import { copy } from "./src/i18n";
import { Button, Notice, Stack, Text } from "./src/ui/controls";
import { palette, theme } from "./src/ui/theme";

/** The approved platform session is injected; there is no default fake/live client. */
export default function App({ session, onSessionRequired, authContent, sessionActions, locale: controlledLocale, onLocaleChange }: { session?: MarketSession; onSessionRequired?: () => void; authContent?: ReactNode; sessionActions?: ReactNode; locale?: Locale; onLocaleChange?: (locale: Locale) => void } = {}) {
  const [internalLocale, setInternalLocale] = useState<Locale>("ru");
  const locale = controlledLocale ?? internalLocale;
  const setLocale = (value: Locale) => { setInternalLocale(value); onLocaleChange?.(value); };
  const t = copy[locale];
  return <SafeAreaProvider><StatusBar barStyle="dark-content" /><SafeAreaView edges={["top"]} style={styles.root}>
    <View style={styles.brand}><Text kind="title">Platforma Market</Text><Stack row><Button label="RU" tone="tab" selected={locale === "ru"} onPress={() => setLocale("ru")} /><Button label="ҚАЗ" tone="tab" selected={locale === "kk"} onPress={() => setLocale("kk")} /></Stack></View>
    {session && sessionActions}
    {session ? <MarketReadApplication session={session} locale={locale} onSessionRequired={onSessionRequired} /> : authContent ?? <View style={styles.unavailable}><Notice title={t.auth} body={t.authBody} action={onSessionRequired ? <Button label={t.signIn} onPress={onSessionRequired} /> : undefined} /></View>}
  </SafeAreaView></SafeAreaProvider>;
}
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: palette["surface.canvas"] }, brand: { paddingHorizontal: theme.space.page, paddingTop: theme.space.small, gap: theme.space.small }, unavailable: { padding: theme.space.page } });
