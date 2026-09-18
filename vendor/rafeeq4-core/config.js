/* ==========================================================
   الرفيق | config.js
   الإصدار: 2.0.0

   المسؤولية:
   - الإعدادات المركزية للتطبيق.
   - مسارات الصفحات والميزات.
   - إعدادات اللغة والثيم والتخزين.
   - إعدادات الموقع ومواقيت الصلاة والأذان.
   - لا يحتوي على المحتوى الديني نفسه؛ المحتوى يبقى في ملفاته المحلية.
========================================================== */

"use strict";

const CONFIG = Object.freeze({

    /* معلومات التطبيق */
    APP_NAME: "الرفيق",
    APP_SLOGAN: "رفيقك إلى الطمأنينة",
    VERSION: "2.0.0",
    AUTHOR: "فريق الرفيق",

    /* اللغة والاتجاه */
    LANG: "ar",
    DIR: "rtl",

    /* الثيم */
    DEFAULT_THEME: "dark",

    THEME: Object.freeze({
        DARK: "dark",
        LIGHT: "light",
        AUTO: "auto"
    }),

    /* الواجهة */
    UI: Object.freeze({
        MAX_APP_WIDTH: 480,
        BORDER_RADIUS: 22,
        REDUCED_MOTION: false
    }),

    /* التخزين المحلي */
    STORAGE_KEYS: Object.freeze({
        THEME: "ar_rafeeq_theme",
        FONT_SIZE: "ar_rafeeq_font_size",
        LAST_PAGE: "ar_rafeeq_last_page",
        LOCATION: "ar_rafeeq_location",
        LOCATION_MODE: "ar_rafeeq_location_mode",
        SELECTED_WILAYA: "ar_rafeeq_selected_wilaya",
        PRAYER_SETTINGS: "ar_rafeeq_prayer_settings",
        PRAYER_ADJUSTMENTS: "ar_rafeeq_prayer_adjustments",
        ADHAN_SETTINGS: "ar_rafeeq_adhan_settings",
        QURAN_PROGRESS: "ar_rafeeq_quran_progress",
        BOOKMARKS: "ar_rafeeq_bookmarks",
        AZKAR_PROGRESS: "ar_rafeeq_azkar_progress",
        NAWAWI_PROGRESS: "ar_rafeeq_nawawi_progress",
        APP_SETTINGS: "ar_rafeeq_app_settings"
    }),

    /* الصفحات */
    PAGES: Object.freeze({
        HOME: "home",
        QURAN: "quran",
        TAFSIR: "tafsir",
        PRAYER: "prayer",
        ADHAN: "adhan",
        AZKAR: "azkar",
        QIBLA: "qibla",
        NAWAWI: "nawawi",
        NAWAWI_SHARH: "nawawi-sharh",
        SETTINGS: "settings"
    }),

    /* الجزائر والموقع */
    LOCATION: Object.freeze({
        COUNTRY: "DZ",
        COUNTRY_NAME: "الجزائر",
        WILAYAS_COUNT: 69,
        DEFAULT_WILAYA_CODE: "16",
        DEFAULT_TIMEZONE: 1,
        USE_GPS_FIRST: true,
        ALLOW_MANUAL_WILAYA: true,
        GPS_TIMEOUT: 15000,
        GPS_MAXIMUM_AGE: 300000,
        GPS_HIGH_ACCURACY: true
    }),

    /* مواقيت الصلاة */
    PRAYER: Object.freeze({
        ENABLED: true,
        OFFLINE: true,
        CALCULATION_MODE: "astronomical",
        FAJR_ANGLE: 18,
        ISHA_ANGLE: 17,
        ASR_FACTOR: 1,
        DEFAULT_ELEVATION: 0,
        DEFAULT_PRESSURE: 1010,
        DEFAULT_TEMPERATURE: 10,
        USE_GPS_COORDINATES: true,
        USE_WILAYA_COORDINATES: true,
        ROUNDING: "nearest-minute",
        SHOW_SUNRISE: true,
        SHOW_SUNSET: true,
        SHOW_NEXT_PRAYER: true,
        SHOW_COUNTDOWN: true,
        ADJUSTMENTS: Object.freeze({
            fajr: 0,
            sunrise: 0,
            dhuhr: 0,
            asr: 0,
            maghrib: 0,
            isha: 0
        })
    }),

    /* الأذان */
    ADHAN: Object.freeze({
        ENABLED: true,
        NOTIFICATIONS: true,
        AUDIO: true,
        VIBRATION: true,
        FAJR: true,
        DHUHR: true,
        ASR: true,
        MAGHRIB: true,
        ISHA: true,
        PRE_ALERT_MINUTES: 0
    }),

    /* الملفات المحلية */
    CONTENT: Object.freeze({
        QURAN_LOCAL: "data/quran-local.json",
        TAFSIR_SAADI: "data/tafsir-saadi.json",
        AZKAR: "data/azkar.json",
        NAWAWI: "data/nawawi.json",
        NAWAWI_SHARH: "data/nawawi-sharh.json"
    }),

    /* PWA / Offline */
    PWA: Object.freeze({
        ENABLED: true,
        OFFLINE_SUPPORT: true,
        SERVICE_WORKER: "sw.js",
        MANIFEST: "manifest.json",
        CACHE_CONTENT: true
    }),

    /* الميزات */
    FEATURES: Object.freeze({
        PWA: true,
        OFFLINE_SUPPORT: true,
        PRAYER_TIMES: true,
        PRAYER_NOTIFICATIONS: true,
        ADHAN: true,
        QURAN: true,
        TAFSIR_SAADI: true,
        AZKAR: true,
        QIBLA: true,
        NAWAWI: true,
        NAWAWI_SHARH: true,
        GPS: true,
        WILAYAS_69: true,
        DARK_MODE_TOGGLE: true,
        AUDIO_PLAYER: true
    })
});

/* فحص أساسي */
if (CONFIG.LOCATION.WILAYAS_COUNT !== 69) {
    console.error("الرفيق: إعداد الولايات يجب أن يكون 69.");
}

console.log(`Rafeeq CONFIG v${CONFIG.VERSION} loaded`);