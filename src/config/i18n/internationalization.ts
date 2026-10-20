import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { uiTranslations } from "@solaria.network/web-lib";
void i18n
  .use(initReactI18next)
  .init({
    lng: "pt-BR",
    fallbackLng: "pt-BR",
    resources: uiTranslations,
    interpolation: { escapeValue: false },
  });
export default i18n;
