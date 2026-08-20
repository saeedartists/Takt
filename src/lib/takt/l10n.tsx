import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { de } from './locales/de';
import { en } from './locales/en';

export type Locale = 'de' | 'en';

const STORAGE_KEY = 'takt:locale';
const messages = { en, de } as const;

type MessageKey = keyof typeof en;

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => Promise<void>;
  t: (key: MessageKey) => string;
  formatDate: (value: Date, options?: Intl.DateTimeFormatOptions) => string;
  formatTime: (value: Date, options?: Intl.DateTimeFormatOptions) => string;
  formatDateTime: (value: Date, options?: Intl.DateTimeFormatOptions) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

const localeTag = (locale: Locale): string => (locale === 'de' ? 'de-DE' : 'en-US');

export const LocaleProvider = ({ children }: { children: ReactNode }) => {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY).then((value) => {
      if (value === 'de' || value === 'en') {
        setLocaleState(value);
      }
    });
  }, []);

  const setLocale = async (next: Locale): Promise<void> => {
    setLocaleState(next);
    await AsyncStorage.setItem(STORAGE_KEY, next);
  };

  const value = useMemo<LocaleContextValue>(() => {
    const tag = localeTag(locale);

    return {
      locale,
      setLocale,
      t: (key) => messages[locale][key] ?? messages.en[key],
      formatDate: (date, options) => new Intl.DateTimeFormat(tag, options).format(date),
      formatTime: (date, options) =>
        new Intl.DateTimeFormat(tag, { hour: '2-digit', minute: '2-digit', ...(options ?? {}) }).format(date),
      formatDateTime: (date, options) =>
        new Intl.DateTimeFormat(tag, {
          year: 'numeric',
          month: 'short',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          ...(options ?? {}),
        }).format(date),
    };
  }, [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
};

export const useLocale = (): LocaleContextValue => {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used inside LocaleProvider');
  return ctx;
};
