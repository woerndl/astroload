const SHELL_LABELS: Record<string, { skipToContent: string; primaryNavigation: string }> = {
  de: { skipToContent: 'Zum Inhalt springen', primaryNavigation: 'Hauptnavigation' },
  en: { skipToContent: 'Skip to content', primaryNavigation: 'Main navigation' },
}

export const shellLabels = (lang: string) => SHELL_LABELS[lang] ?? SHELL_LABELS.en!
