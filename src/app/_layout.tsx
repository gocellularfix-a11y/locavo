import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { APP_CONFIG } from '../config/appConfig';
import { I18nProvider } from '../i18n/I18nContext';
import { PreferenceProvider } from '../preferences/PreferenceContext';
import { LocationProvider } from '../state/LocationContext';
import { AppThemeProvider, useAppTheme } from '../theme/ThemeContext';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function RootNavigator() {
  const { colors, scheme } = useAppTheme();
  return (
    <>
      <Head>
        <title>{APP_CONFIG.name}</title>
        <meta name="description" content={APP_CONFIG.description} />
        <link rel="canonical" href={APP_CONFIG.canonicalUrl} />
      </Head>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="place/[id]" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsLoaded]);

  // En web no se bloquea el render (la fuente entra por swap y el export
  // estático necesita HTML con contenido real); en nativo se espera a Inter
  // detrás del splash.
  if (!fontsLoaded && Platform.OS !== 'web') {
    return null;
  }

  return (
    <SafeAreaProvider>
      <I18nProvider>
        <AppThemeProvider>
          <LocationProvider>
            <PreferenceProvider>
              <RootNavigator />
            </PreferenceProvider>
          </LocationProvider>
        </AppThemeProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
