import React from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { ScreenContainer } from '../../components/ScreenContainer';
import { MANUAL_LOCATIONS } from '../../services/location';
import { useLocationState } from '../../state/LocationContext';
import { useAppTheme, type ThemeMode } from '../../theme/ThemeContext';
import { radii, spacing } from '../../theme/tokens';

interface OptionRowProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

function OptionRow({ label, selected, onPress }: OptionRowProps) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        minHeight: 48,
        borderRadius: radii.button,
        paddingHorizontal: spacing.lg,
        justifyContent: 'center',
        backgroundColor: selected
          ? colors.brandSoft
          : pressed
            ? colors.neutralSoft
            : colors.surface,
        borderWidth: 1,
        borderColor: selected ? colors.brand : colors.border,
      })}
    >
      <AppText variant="bodyStrong" color={selected ? colors.brand : colors.textPrimary}>
        {label}
      </AppText>
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.md }}>
      <AppText variant="section" accessibilityRole="header">
        {title}
      </AppText>
      {children}
    </View>
  );
}

export default function SettingsScreen() {
  const { mode, setMode } = useAppTheme();
  const location = useLocationState();

  const themeOptions: { value: ThemeMode; label: string }[] = [
    { value: 'system', label: 'Según el sistema' },
    { value: 'light', label: 'Modo claro' },
    { value: 'dark', label: 'Modo oscuro' },
  ];

  return (
    <ScreenContainer>
      <View style={{ gap: spacing.xxxl }}>
        <AppText variant="title" accessibilityRole="header">
          Ajustes
        </AppText>

        <Section title="Tema">
          <View style={{ gap: spacing.sm }} accessibilityRole="radiogroup">
            {themeOptions.map((option) => (
              <OptionRow
                key={option.value}
                label={option.label}
                selected={mode === option.value}
                onPress={() => setMode(option.value)}
              />
            ))}
          </View>
        </Section>

        <Section title="Ubicación manual">
          <AppText variant="body" tone="secondary">
            Si no otorgas permiso de ubicación, Locavo usa una zona de referencia en Culiacán.
          </AppText>
          <View style={{ gap: spacing.sm }} accessibilityRole="radiogroup">
            {MANUAL_LOCATIONS.map((manual) => (
              <OptionRow
                key={manual.id}
                label={manual.label}
                selected={location.source === 'manual' && location.manualLocation.id === manual.id}
                onPress={() => location.setManualLocation(manual)}
              />
            ))}
          </View>
        </Section>

        <Section title="Privacidad">
          <AppText variant="body" tone="secondary">
            Tu ubicación se lee solo cuando lo pides y únicamente para ordenar resultados; no se
            rastrea en segundo plano, no se guarda historial de recorridos y nada se envía a
            servidores. Los eventos de uso se registran solo en este dispositivo.
          </AppText>
        </Section>

        <Section title="Datos de demostración">
          <AppText variant="body" tone="secondary">
            Esta es la Fase 1 de Locavo: todos los lugares son datos simulados con el prefijo
            &ldquo;Demo&rdquo;. No representan negocios reales verificados.
          </AppText>
        </Section>
      </View>
    </ScreenContainer>
  );
}
