import {sourceLocale, targetLocales} from './locale-codes.js';
import {configureLocalization} from '@lit/localize';
const localization = configureLocalization({sourceLocale, targetLocales, loadLocale: (locale) => import(`./${locale}.ts`)});
const supported = new Map([sourceLocale, ...targetLocales].map(locale => [locale.toLowerCase(), locale]));

export default {
  getLocale: localization.getLocale,
  setLocale(language) {
    const subtags = language.trim().toLowerCase().split('-');
    while (subtags.length) {
      const locale = supported.get(subtags.join('-'));
      if (locale) return localization.setLocale(locale);
      subtags.pop();
    }
    return localization.setLocale(sourceLocale);
  },
};
