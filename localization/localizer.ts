import type { LocaleModule, MsgFn, MsgOptions, TemplateLike, TemplateMap } from '@lit/localize';
import { runtimeMsg } from '@lit/localize/internal/runtime-msg.js';
// @ts-expect-error The Lit localization CLI generates this module as JavaScript.
import { sourceLocale, targetLocales } from './generated/locale-codes.js';

const supported = new Map([sourceLocale, ...targetLocales].map(locale => [locale.toLowerCase(), locale]));
const regionalDefaults = new Map([
  ['bn', 'bn-BD'],
  ['de', 'de-DE'],
  ['es', 'es-ES'],
  ['fa', 'fa-IR'],
  ['fr', 'fr-FR'],
  ['no', 'nb'],
  ['pt', 'pt-PT'],
]);

function resolveLocale(language: string): string {
  const tag = language.trim().toLowerCase();
  const subtags = tag.split('-');
  const [base] = subtags;
  const exact = supported.get(tag);
  if (exact) return exact;
  while (subtags.length > 2) {
    subtags.pop();
    const locale = supported.get(subtags.join('-'));
    if (locale) return locale;
  }
  const fallback = supported.get(base) ?? regionalDefaults.get(base) ?? sourceLocale;
  if (tag === base) return fallback;

  // Match script or region when the document has a more specific language tag.
  try {
    const { language, script, region } = new Intl.Locale(tag).maximize();
    const localeScript = script === 'Aran' ? 'arab' : script?.toLowerCase();
    const scriptLocale = supported.get(`${language}-${localeScript}`);
    const regionLocale = supported.get(`${language}-${region?.toLowerCase()}`);
    return scriptLocale ?? regionLocale ?? fallback;
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return fallback;
  }
}

export const sourceMsg = ((template: TemplateLike, options?: MsgOptions) =>
  runtimeMsg(undefined, template, options)) as MsgFn;

export function createLocalizer(onLocaleChange?: () => void) {
  let activeLocale: string = sourceLocale;
  let templates: TemplateMap | undefined;
  let revision = 0;
  return {
    getLocale: () => activeLocale,
    // Reuse Lit's message IDs and template substitution with this instance's dictionary.
    msg: ((template: TemplateLike, options?: MsgOptions) => runtimeMsg(templates, template, options)) as MsgFn,
    async setLocale(language: string) {
      const locale = resolveLocale(language);
      const request = ++revision;
      if (locale === activeLocale) return;
      const next: LocaleModule | undefined = locale === sourceLocale ? undefined : await import(`./generated/${locale}.ts`);
      if (request !== revision) return;
      activeLocale = locale;
      templates = next?.templates;
      onLocaleChange?.();
    },
  };
}
