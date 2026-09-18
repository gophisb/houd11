/* ==========================================================================
   الرفيق | prayer.js
   الإصدار: 2.0.0

   محرك مواقيت الصلاة الفلكي — Offline First
   --------------------------------------------------------------------------
   المسؤوليات:
   - حساب المواقيت فلكيًا دون API.
   - العمل مع locations.js مباشرة (lat/lng).
   - قبول latitude/longitude أيضًا للتوافق.
   - دعم الولاية المختارة أو GPS.
   - حساب: الفجر، الشروق، الظهر، العصر، المغرب، العشاء.
   - تحديد الصلاة القادمة والعد التنازلي.
   - حساب اليوم التالي.
   - تصحيحات اختيارية بالدقائق.
   - تحقق صارم من الموقع والإعدادات.

   مبدأ معماري:
   هذا الملف لا يحتوي على أسماء الولايات ولا محتوى ديني.
   مصدر الولايات يبقى locations.js.
   ========================================================================== */

"use strict";

const PrayerEngine = (() => {

    /* ======================================================================
       الإصدار والثوابت
       ====================================================================== */

    const VERSION = "2.0.0";
    const MINUTES_PER_DAY = 1440;

    const PRAYER_ORDER = Object.freeze([
        "fajr",
        "sunrise",
        "dhuhr",
        "asr",
        "maghrib",
        "isha"
    ]);

    const PRAYER_NAMES = Object.freeze({
        fajr: "الفجر",
        sunrise: "الشروق",
        dhuhr: "الظهر",
        asr: "العصر",
        maghrib: "المغرب",
        isha: "العشاء"
    });

    /*
     * إعداد افتراضي مناسب كبداية للجزائر.
     *
     * ملاحظة:
     * طريقة الحساب وزاويتا الفجر والعشاء يجب مقارنتهما لاحقًا
     * مع الرزنامة الرسمية المحلية، ثم يمكن ضبط adjustments.
     */
    const DEFAULT_SETTINGS = Object.freeze({
        fajrAngle: 18,
        ishaAngle: 17,

        /*
         * 1 = ظل مساوٍ لطول الجسم.
         * يمكن تغييره إلى 2 عند الحاجة.
         */
        asrFactor: 1,

        /*
         * المنطقة الزمنية الافتراضية للجزائر: UTC+1.
         */
        timezone: 1,

        /*
         * الارتفاع بالمتر.
         */
        elevation: 0,

        /*
         * تصحيح يدوي اختياري بالدقائق.
         */
        adjustments: Object.freeze({
            fajr: 0,
            sunrise: 0,
            dhuhr: 0,
            asr: 0,
            maghrib: 0,
            isha: 0
        })
    });


    /* ======================================================================
       أدوات رياضية
       ====================================================================== */

    function degToRad(degrees) {
        return degrees * Math.PI / 180;
    }

    function radToDeg(radians) {
        return radians * 180 / Math.PI;
    }

    function sin(degrees) {
        return Math.sin(degToRad(degrees));
    }

    function cos(degrees) {
        return Math.cos(degToRad(degrees));
    }

    function tan(degrees) {
        return Math.tan(degToRad(degrees));
    }

    function asin(value) {
        return radToDeg(Math.asin(value));
    }

    function acos(value) {
        return radToDeg(Math.acos(value));
    }

    function atan(value) {
        return radToDeg(Math.atan(value));
    }

    function normalizeDegrees(value) {
        value %= 360;
        return value < 0 ? value + 360 : value;
    }


    /* ======================================================================
       Julian Day
       ====================================================================== */

    function julian(year, month, day) {

        let y = year;
        let m = month;

        if (m <= 2) {
            y -= 1;
            m += 12;
        }

        const A = Math.floor(y / 100);
        const B = 2 - A + Math.floor(A / 4);

        return (
            Math.floor(365.25 * (y + 4716)) +
            Math.floor(30.6001 * (m + 1)) +
            day +
            B -
            1524.5
        );
    }


    /* ======================================================================
       موقع الشمس
       ----------------------------------------------------------------------
       خوارزمية فلكية عملية مناسبة لحساب مواقيت الصلاة.
       ====================================================================== */

    function solarPosition(jd) {

        const D = jd - 2451545.0;

        const meanAnomaly =
            normalizeDegrees(
                357.529 +
                0.98560028 * D
            );

        const meanLongitude =
            normalizeDegrees(
                280.459 +
                0.98564736 * D
            );

        const eclipticLongitude =
            normalizeDegrees(
                meanLongitude +
                1.9148 * sin(meanAnomaly) +
                0.0200 * sin(2 * meanAnomaly)
            );

        const obliquity =
            23.439 -
            0.00000036 * D;

        let rightAscension =
            radToDeg(
                Math.atan2(
                    cos(obliquity) * sin(eclipticLongitude),
                    cos(eclipticLongitude)
                )
            );

        rightAscension =
            normalizeDegrees(rightAscension) / 15;

        const declination =
            asin(
                sin(obliquity) *
                sin(eclipticLongitude)
            );

        let equationOfTime =
            meanLongitude / 15 -
            rightAscension;

        /*
         * إبقاء Equation of Time في مجال عملي حول الصفر.
         */
        if (equationOfTime > 12) {
            equationOfTime -= 24;
        }

        if (equationOfTime < -12) {
            equationOfTime += 24;
        }

        return {
            declination,
            equationOfTime
        };
    }


    /* ======================================================================
       زاوية/وقت الشمس
       ----------------------------------------------------------------------
       altitude:
       ارتفاع الشمس بالدرجات فوق/تحت الأفق.
       مثال:
       -0.833 للشروق والغروب.
       -18 للفجر.
       -17 للعشاء.
       ====================================================================== */

    function sunAngleTime(
        altitude,
        declination,
        latitude
    ) {

        const denominator =
            cos(latitude) *
            cos(declination);

        if (Math.abs(denominator) < 1e-12) {
            return null;
        }

        const cosHourAngle =
            (
                sin(altitude) -
                sin(latitude) *
                sin(declination)
            ) /
            denominator;

        /*
         * هامش صغير للتعامل مع أخطاء الفاصلة العائمة.
         */
        if (cosHourAngle > 1.0000001 ||
            cosHourAngle < -1.0000001) {
            return null;
        }

        const bounded =
            Math.max(
                -1,
                Math.min(1, cosHourAngle)
            );

        return acos(bounded) / 15;
    }


    /* ======================================================================
       ارتفاع الشمس للعصر
       ====================================================================== */

    function asrAltitude(
        factor,
        declination,
        latitude
    ) {

        const solarDeclination =
            Math.abs(
                latitude -
                declination
            );

        const denominator =
            factor +
            tan(solarDeclination);

        if (!Number.isFinite(denominator) ||
            denominator <= 0) {
            return null;
        }

        /*
         * ارتفاع الشمس عندما يصبح طول الظل:
         * factor × طول الجسم تقريبًا.
         */
        return atan(1 / denominator);
    }


    /* ======================================================================
       تطبيع التاريخ
       ====================================================================== */

    function normalizeDate(date) {

        if (date instanceof Date &&
            !Number.isNaN(date.getTime())) {

            return new Date(
                date.getFullYear(),
                date.getMonth(),
                date.getDate()
            );
        }

        if (typeof date === "string") {

            /*
             * التعامل الآمن مع YYYY-MM-DD دون UTC shift.
             */
            const match =
                date.match(
                    /^(\d{4})-(\d{1,2})-(\d{1,2})$/
                );

            if (match) {

                const year = Number(match[1]);
                const month = Number(match[2]);
                const day = Number(match[3]);

                const parsed =
                    new Date(
                        year,
                        month - 1,
                        day
                    );

                if (
                    parsed.getFullYear() === year &&
                    parsed.getMonth() === month - 1 &&
                    parsed.getDate() === day
                ) {
                    return parsed;
                }
            }

            const parsed = new Date(date);

            if (!Number.isNaN(parsed.getTime())) {
                return new Date(
                    parsed.getFullYear(),
                    parsed.getMonth(),
                    parsed.getDate()
                );
            }
        }

        const now = new Date();

        return new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
        );
    }


    /* ======================================================================
       تطبيع الموقع
       ----------------------------------------------------------------------
       يقبل مباشرة بيانات locations.js:
       { lat, lng, name }

       ويقبل أيضًا:
       { latitude, longitude, name }
       ====================================================================== */

    function normalizeLocation(location) {

        if (!location || typeof location !== "object") {
            return null;
        }

        const latitude =
            Number(
                location.latitude ??
                location.lat
            );

        const longitude =
            Number(
                location.longitude ??
                location.lng
            );

        if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude)
        ) {
            return null;
        }

        const timezoneValue =
            Number(
                location.timezone ??
                DEFAULT_SETTINGS.timezone
            );

        const timezone =
            Number.isFinite(timezoneValue)
                ? timezoneValue
                : DEFAULT_SETTINGS.timezone;

        const elevationValue =
            Number(location.elevation ?? 0);

        const elevation =
            Number.isFinite(elevationValue) &&
            elevationValue >= 0
                ? elevationValue
                : 0;

        return {
            latitude,
            longitude,
            name:
                location.name ||
                location.nameAr ||
                "الموقع الحالي",
            nameFr:
                location.nameFr || "",
            code:
                location.code || null,
            timezone,
            elevation
        };
    }


    /* ======================================================================
       دمج الإعدادات
       ====================================================================== */

    function mergeSettings(customSettings = {}, location = null) {

        const source =
            customSettings &&
            typeof customSettings === "object"
                ? customSettings
                : {};

        const adjustments = {
            ...DEFAULT_SETTINGS.adjustments,
            ...(source.adjustments || {})
        };

        const timezone =
            Number.isFinite(Number(source.timezone))
                ? Number(source.timezone)
                : (
                    location &&
                    Number.isFinite(
                        Number(location.timezone)
                    )
                        ? Number(location.timezone)
                        : DEFAULT_SETTINGS.timezone
                );

        const elevation =
            Number.isFinite(Number(source.elevation))
                ? Math.max(0, Number(source.elevation))
                : (
                    location &&
                    Number.isFinite(
                        Number(location.elevation)
                    )
                        ? Math.max(0, Number(location.elevation))
                        : DEFAULT_SETTINGS.elevation
                );

        return {
            fajrAngle:
                Number.isFinite(Number(source.fajrAngle))
                    ? Number(source.fajrAngle)
                    : DEFAULT_SETTINGS.fajrAngle,

            ishaAngle:
                Number.isFinite(Number(source.ishaAngle))
                    ? Number(source.ishaAngle)
                    : DEFAULT_SETTINGS.ishaAngle,

            asrFactor:
                Number.isFinite(Number(source.asrFactor))
                    ? Number(source.asrFactor)
                    : DEFAULT_SETTINGS.asrFactor,

            timezone,
            elevation,
            adjustments
        };
    }


    /* ======================================================================
       التحقق من الإعدادات
       ====================================================================== */

    function validateSettings(settings) {

        if (
            !Number.isFinite(settings.fajrAngle) ||
            settings.fajrAngle <= 0 ||
            settings.fajrAngle >= 30
        ) {
            return {
                valid: false,
                reason: "زاوية الفجر غير صحيحة"
            };
        }

        if (
            !Number.isFinite(settings.ishaAngle) ||
            settings.ishaAngle <= 0 ||
            settings.ishaAngle >= 30
        ) {
            return {
                valid: false,
                reason: "زاوية العشاء غير صحيحة"
            };
        }

        if (
            !Number.isFinite(settings.asrFactor) ||
            settings.asrFactor <= 0
        ) {
            return {
                valid: false,
                reason: "معامل العصر غير صحيح"
            };
        }

        if (
            !Number.isFinite(settings.timezone) ||
            settings.timezone < -14 ||
            settings.timezone > 14
        ) {
            return {
                valid: false,
                reason: "المنطقة الزمنية غير صحيحة"
            };
        }

        return {
            valid: true,
            reason: null
        };
    }


    /* ======================================================================
       وقت الشروق والغروب مع الارتفاع
       ====================================================================== */

    function horizonAltitude(elevation) {

        /*
         * الانخفاض الناتج عن ارتفاع الموقع.
         * 0.833° قيمة شائعة لحساب الشروق/الغروب مع الانكسار الشمسي.
         */
        const dip =
            elevation > 0
                ? 1.76 * Math.sqrt(elevation) / 60
                : 0;

        return -(0.833 + dip);
    }


    /* ======================================================================
       تحويل الساعات إلى دقائق
       ====================================================================== */

    function hoursToMinutes(hours) {

        if (
            hours === null ||
            !Number.isFinite(hours)
        ) {
            return null;
        }

        return hours * 60;
    }


    /* ======================================================================
       تطبيع الدقائق
       ====================================================================== */

    function normalizeMinutes(minutes) {

        if (
            minutes === null ||
            !Number.isFinite(minutes)
        ) {
            return null;
        }

        let value = minutes % MINUTES_PER_DAY;

        if (value < 0) {
            value += MINUTES_PER_DAY;
        }

        return value;
    }


    /* ======================================================================
       تقريب الوقت
       ====================================================================== */

    function roundMinute(minutes) {

        if (minutes === null) {
            return null;
        }

        return Math.round(
            normalizeMinutes(minutes)
        );
    }


    /* ======================================================================
       تنسيق الوقت
       ====================================================================== */

    function formatTime(minutes) {

        if (
            minutes === null ||
            !Number.isFinite(minutes)
        ) {
            return "--:--";
        }

        const value =
            Math.round(
                normalizeMinutes(minutes)
            );

        const hours =
            Math.floor(value / 60);

        const mins =
            value % 60;

        return (
            String(hours).padStart(2, "0") +
            ":" +
            String(mins).padStart(2, "0")
        );
    }


    /* ======================================================================
       حساب مواقيت اليوم
       ====================================================================== */

    function calculate(
        date = new Date(),
        location,
        customSettings = {}
    ) {

        const day =
            normalizeDate(date);

        const normalizedLocation =
            normalizeLocation(location);

        if (!normalizedLocation) {
            throw new Error(
                "موقع الصلاة غير محدد أو إحداثياته غير صحيحة"
            );
        }

        const settings =
            mergeSettings(
                customSettings,
                normalizedLocation
            );

        const settingsValidation =
            validateSettings(settings);

        if (!settingsValidation.valid) {
            throw new Error(
                settingsValidation.reason
            );
        }

        const {
            latitude,
            longitude
        } = normalizedLocation;

        if (
            latitude < -90 ||
            latitude > 90
        ) {
            throw new Error(
                "خط العرض خارج النطاق"
            );
        }

        if (
            longitude < -180 ||
            longitude > 180
        ) {
            throw new Error(
                "خط الطول خارج النطاق"
            );
        }

        const jd =
            julian(
                day.getFullYear(),
                day.getMonth() + 1,
                day.getDate()
            );

        /*
         * نستخدم منتصف اليوم الفلكي تقريبًا.
         */
        const solar =
            solarPosition(jd + 0.5);

        const declination =
            solar.declination;

        const equationOfTime =
            solar.equationOfTime;

        /*
         * الظهر الشمسي بالدقائق المحلية.
         */
        const noon =
            720 -
            (4 * longitude) -
            (equationOfTime * 60) +
            (settings.timezone * 60);

        /*
         * الشروق والغروب.
         */
        const horizon =
            horizonAltitude(
                settings.elevation
            );

        const sunriseHourAngle =
            sunAngleTime(
                horizon,
                declination,
                latitude
            );

        const sunrise =
            sunriseHourAngle === null
                ? null
                : noon -
                  hoursToMinutes(
                      sunriseHourAngle
                  );

        const sunset =
            sunriseHourAngle === null
                ? null
                : noon +
                  hoursToMinutes(
                      sunriseHourAngle
                  );

        /*
         * الفجر.
         */
        const fajrHourAngle =
            sunAngleTime(
                -settings.fajrAngle,
                declination,
                latitude
            );

        const fajr =
            fajrHourAngle === null
                ? null
                : noon -
                  hoursToMinutes(
                      fajrHourAngle
                  );

        /*
         * العشاء.
         */
        const ishaHourAngle =
            sunAngleTime(
                -settings.ishaAngle,
                declination,
                latitude
            );

        const isha =
            ishaHourAngle === null
                ? null
                : noon +
                  hoursToMinutes(
                      ishaHourAngle
                  );

        /*
         * العصر.
         */
        const asrAltitudeValue =
            asrAltitude(
                settings.asrFactor,
                declination,
                latitude
            );

        const asrHourAngle =
            asrAltitudeValue === null
                ? null
                : sunAngleTime(
                    asrAltitudeValue,
                    declination,
                    latitude
                );

        const asr =
            asrHourAngle === null
                ? null
                : noon +
                  hoursToMinutes(
                      asrHourAngle
                  );

        const raw = {
            fajr,
            sunrise,
            dhuhr: noon,
            asr,
            maghrib: sunset,
            isha
        };

        /*
         * التصحيحات اليدوية.
         */
        for (const prayer of PRAYER_ORDER) {

            if (raw[prayer] !== null) {

                const adjustment =
                    Number(
                        settings
                            .adjustments
                            [prayer]
                    );

                if (Number.isFinite(adjustment)) {
                    raw[prayer] += adjustment;
                }
            }
        }

        /*
         * الدقائق النهائية.
         */
        const minutes = {};

        for (const prayer of PRAYER_ORDER) {
            minutes[prayer] =
                roundMinute(
                    raw[prayer]
                );
        }

        const formatted = {};

        for (const prayer of PRAYER_ORDER) {
            formatted[prayer] =
                formatTime(
                    minutes[prayer]
                );
        }

        return {
            version: VERSION,

            date: new Date(day.getTime()),

            location: {
                code:
                    normalizedLocation.code,
                name:
                    normalizedLocation.name,
                nameFr:
                    normalizedLocation.nameFr,
                latitude,
                longitude,
                timezone:
                    settings.timezone,
                elevation:
                    settings.elevation
            },

            astronomical: {
                declination,
                equationOfTime,
                solarNoon: noon
            },

            settings,

            raw,

            minutes,

            formatted
        };
    }


    /* ======================================================================
       الوقت الحالي بالدقائق
       ====================================================================== */

    function currentMinutes(date = new Date()) {

        return (
            date.getHours() * 60 +
            date.getMinutes() +
            date.getSeconds() / 60
        );
    }


    /* ======================================================================
       الصلاة القادمة
       ====================================================================== */

    function getNextPrayer(
        prayerTimes,
        nowMinutes =
            currentMinutes()
    ) {

        if (
            !prayerTimes ||
            !prayerTimes.minutes
        ) {
            return null;
        }

        const now =
            Number(nowMinutes);

        if (
            !Number.isFinite(now)
        ) {
            return null;
        }

        for (const name of PRAYER_ORDER) {

            const time =
                prayerTimes.minutes[name];

            if (