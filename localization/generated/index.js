import {sourceLocale, targetLocales} from './locale-codes.js';
import {configureLocalization} from '@lit/localize';
const localization = configureLocalization({sourceLocale, targetLocales, loadLocale: (locale) => import(`./${locale}.ts`)});
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

export default {
  getLocale: localization.getLocale,
  setLocale(language) {
    const tag = language.trim().toLowerCase();
    const subtags = tag.split('-');
    const [base] = subtags;
    while (subtags.length) {
      const locale = supported.get(subtags.join('-'));
      if (locale) return localization.setLocale(locale);
      subtags.pop();
    }
    const fallback = regionalDefaults.get(base) ?? sourceLocale;
    if (tag === base && regionalDefaults.has(base)) return localization.setLocale(fallback);

    // Match script or region when the document has a more specific language tag.
    try {
      const { language, script, region } = new Intl.Locale(tag).maximize();
      const localeScript = script === 'Aran' ? 'arab' : script?.toLowerCase();
      const scriptLocale = supported.get(`${language}-${localeScript}`);
      const regionLocale = supported.get(`${language}-${region?.toLowerCase()}`);
      return localization.setLocale(scriptLocale ?? regionLocale ?? fallback);
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      return localization.setLocale(fallback);
    }
  },
};
