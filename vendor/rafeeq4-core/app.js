/* ==========================================================
   الرفيق | app.js
   الإصدار: 3.0.0

   التطبيق الرئيسي
   ----------------------------------------------------------
   المسؤوليات:
   - تشغيل واجهة الرفيق بعد تحميل المحركات.
   - ربط locations.js / LocationManager / PrayerEngine.
   - إدارة الولاية و GPS.
   - عرض مواقيت الصلاة والصلاة القادمة والعد التنازلي.
   - إنشاء واجهة رئيسية مستقرة ومتوافقة مع البنية الحالية.
   - توفير نقاط جاهزة للقرآن والتفسير والأذكار.
   - لا يحتوي على بيانات القرآن أو التفسير أو الأذان نفسها.
   - يعمل Offline ولا يعتمد على API.
========================================================== */

"use strict";

(() => {

    const APP_VERSION = "3.0.0";

    const PRAYER_KEYS = Object.freeze([
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

    const state = {
        initialized: false,
        currentView: "home",
        location: null,
        source: "default",
        prayerTimes: null,
        nextPrayer: null,
        countdownTimer: null,
        clockTimer: null,
        selectedWilaya: null,
        settings: {},
        lastError: null
    };

    const $ = (selector, root = document) => root.querySelector(selector);

    const $$ = (selector, root = document) =>
        Array.from(root.querySelectorAll(selector));

    function escapeHTML(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function pad(value) {
        return String(value).padStart(2, "0");
    }

    function todayKey(date = new Date()) {
        return [
            date.getFullYear(),
            pad(date.getMonth() + 1),
            pad(date.getDate())
        ].join("-");
    }

    function formatArabicDate(date = new Date()) {
        try {
            return new Intl.DateTimeFormat("ar-DZ", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric"
            }).format(date);
        } catch {
            return date.toLocaleDateString("ar-DZ");
        }
    }

    function formatCountdown(minutes) {
        if (!Number.isFinite(Number(minutes))) {
            return "--:--";
        }

        const total = Math.max(0, Math.round(Number(minutes) * 60));
        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        const s = total % 60;

        return h > 0
            ? `${pad(h)}:${pad(m)}:${pad(s)}`
            : `${pad(m)}:${pad(s)}`;
    }

    function notify(message, type = "info") {
        const root = $("#toast-root");

        if (!root) {
            console.log(`[${type}] ${message}`);
            return;
        }

        root.innerHTML = `
            <div class="glass-toast toast toast--${escapeHTML(type)}" role="status">
                ${escapeHTML(message)}
            </div>
        `;

        window.setTimeout(() => {
            if (root.firstElementChild) {
                root.firstElementChild.remove();
            }
        }, 3500);
    }

    function setLoader(active, message = "جارٍ التحميل...") {
        const root = $("#loader-root");
        if (!root) return;

        root.setAttribute("aria-busy", active ? "true" : "false");

        if (!active) {
            root.innerHTML = "";
            return;
        }

        root.innerHTML = `
            <div class="app-loader" role="status">
                <div class="app-loader__spinner" aria-hidden="true"></div>
                <span>${escapeHTML(message)}</span>
            </div>
        `;
    }

    /* ======================================================
       الوصول إلى بيانات الولايات
    ====================================================== */

    function getWilayas() {
        if (
            window.Locations &&
            typeof window.Locations.all === "function"
        ) {
            return window.Locations.all();
        }

        if (Array.isArray(window.ALGERIA_WILAYAS)) {
            return window.ALGERIA_WILAYAS;
        }

        return [];
    }

    function getDefaultWilaya() {
        const list = getWilayas();

        if (
            window.Locations &&
            typeof window.Locations.getDefault === "function"
        ) {
            return window.Locations.getDefault();
        }

        return list.find(item => String(item.code) === "16") || list[0] || null;
    }

    function normalizeLocation(item) {
        if (!item) return null;

        const latitude = Number(
            item.latitude ?? item.lat
        );

        const longitude = Number(
            item.longitude ?? item.lng
        );

        if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude)
        ) {
            return null;
        }

        return {
            latitude,
            longitude,
            lat: latitude,
            lng: longitude,
            name: item.name || item.nameAr || "الجزائر",
            nameFr: item.nameFr || "",
            code: item.code || null,
            timezone: Number.isFinite(Number(item.timezone))
                ? Number(item.timezone)
                : 1,
            source: item.source || "wilaya"
        };
    }

    function findWilaya(code) {
        if (!code) return null;

        if (
            window.Locations &&
            typeof window.Locations.getByCode === "function"
        ) {
            return window.Locations.getByCode(code);
        }

        return getWilayas().find(
            item => String(item.code).padStart(2, "0") === String(code).padStart(2, "0")
        ) || null;
    }

    /* ======================================================
       إدارة الموقع
    ====================================================== */

    async function selectWilaya(code, silent = false) {
        const wilaya = findWilaya(code);

        if (!wilaya) {
            notify("الولاية المطلوبة غير موجودة", "error");
            return false;
        }

        const location = normalizeLocation(wilaya);

        if (!location) {
            notify("إحداثيات الولاية غير صحيحة", "error");
            return false;
        }

        state.location = location;
        state.selectedWilaya = wilaya;
        state.source = "wilaya";

        persistLocation();

        calculatePrayerTimes();

        if (!silent) {
            notify(`تم اختيار ولاية ${wilaya.name}`, "success");
        }

        renderLocation();
        renderPrayerCard();
        renderPrayerList();

        return true;
    }

    async function useGPS() {
        if (
            window.PrayerEngine &&
            typeof window.PrayerEngine.getGPSLocation === "function"
        ) {
            try {
                setLoader(true, "جارٍ تحديد موقعك...");

                const gps = await window.PrayerEngine.getGPSLocation({
                    enableHighAccuracy: true,
                    timeout: 15000,
                    maximumAge: 300000
                });

                state.location = normalizeLocation({
                    ...gps,
                    name: "موقعك الحالي",
                    source: "gps"
                });

                state.selectedWilaya = null;
                state.source = "gps";

                persistLocation();
                calculatePrayerTimes();

                renderLocation();
                renderPrayerCard();
                renderPrayerList();

                notify("تم تحديد موقعك بنجاح", "success");
                return true;

            } catch (error) {
                console.warn("GPS error:", error);
                notify("تعذر تحديد الموقع. استخدم الولاية يدويًا.", "error");
                return false;

            } finally {
                setLoader(false);
            }
        }

        notify("خدمة GPS غير متاحة، اختر ولايتك يدويًا.", "error");
        return false;
    }

    function persistLocation() {
        try {
            localStorage.setItem(
                "rafeeq.location",
                JSON.stringify(state.location)
            );

            localStorage.setItem(
                "rafeeq.location.source",
                state.source
            );
        } catch (error) {
            console.warn("Could not persist location:", error);
        }
    }

    function restoreLocation() {
        try {
            const saved = localStorage.getItem("rafeeq.location");

            if (saved) {
                const parsed = JSON.parse(saved);
                const location = normalizeLocation(parsed);

                if (location) {
                    state.location = location;
                    state.source =
                        localStorage.getItem("rafeeq.location.source") ||
                        "saved";

                    if (location.code) {
                        state.selectedWilaya = findWilaya(location.code);
                    }

                    return true;
                }
            }
        } catch (error) {
            console.warn("Could not restore location:", error);
        }

        return false;
    }

    /* ======================================================
       مواقيت الصلاة
    ====================================================== */

    function calculatePrayerTimes() {
        if (!state.location) return null;

        if (
            !window.PrayerEngine ||
            typeof window.PrayerEngine.calculate !== "function"
        ) {
            state.lastError = "PrayerEngine غير محمل";
            console.error(state.lastError);
            return null;
        }

        try {
            state.prayerTimes = window.PrayerEngine.calculate(
                new Date(),
                state.location,
                state.settings
            );

            state.nextPrayer =
                window.PrayerEngine.getNextPrayer(
                    state.prayerTimes
                );

            state.lastError = null;
            return state.prayerTimes;

        } catch (error) {
            state.lastError = error;
            console.error("Prayer calculation failed:", error);
            notify("تعذر حساب مواقيت الصلاة.", "error");
            return null;
        }
    }

    function refreshPrayerState() {
        if (!state.prayerTimes) {
            calculatePrayerTimes();
        }

        if (
            state.prayerTimes &&
            window.PrayerEngine &&
            typeof window.PrayerEngine.getNextPrayer === "function"
        ) {
            state.nextPrayer =
                window.PrayerEngine.getNextPrayer(
                    state.prayerTimes
                );
        }

        renderPrayerCard();
        renderPrayerList();
    }

    /* ======================================================
       الواجهة
    ====================================================== */

    function renderHeader() {
        const root = $("#app-header");
        if (!root) return;

        root.innerHTML = `
            <header class="app-header glass">
                <div class="brand">
                    <div class="brand__mark" aria-hidden="true">
                        ☾
                    </div>
                    <div class="brand__text">
                        <strong>الرفيق</strong>
                        <span>رفيقك إلى الطمأنينة</span>
                    </div>
                </div>

                <button
                    class="glass glass-btn"
                    type="button"
                    id="settings-button"
                    aria-label="الإعدادات"
                    title="الإعدادات">
                    ⚙
                </button>
            </header>
        `;

        $("#settings-button")?.addEventListener("click", () => {
            notify("الإعدادات ستكون في المرحلة التالية.", "info");
        });
    }

    function renderHome() {
        const main = $("#main-content");
        if (!main) return;

        main.innerHTML = `
            <section class="page page--home" aria-labelledby="welcome-title">

                <section class="hero glass">
                    <div class="hero__top">
                        <span class="hero__greeting">
                            السلام عليكم ورحمة الله وبركاته
                        </span>
                    </div>

                    <h1 id="welcome-title" class="hero__title">
                        أهلاً بك في <span>الرفيق</span>
                    </h1>

                    <p class="hero__sub">
                        اجعل يومك عامرًا بالقرآن والذكر والصلاة.
                    </p>
                </section>

                <section class="location-bar glass" aria-label="الموقع والتاريخ">
                    <div class="location-bar__item">
                        <span class="location-bar__icon" aria-hidden="true">⌖</span>
                        <div>
                            <small>الموقع</small>
                            <strong id="location-name">...</strong>
                        </div>
                    </div>

                    <div class="location-bar__divider" aria-hidden="true"></div>

                    <div class="location-bar__item">
                        <span class="location-bar__icon" aria-hidden="true">☾</span>
                        <div>
                            <small>التاريخ</small>
                            <strong id="date-name">...</strong>
                        </div>
                    </div>
                </section>

                <section id="prayer-card-root"></section>

                <section class="quick-section" aria-labelledby="quick-title">
                    <h2 id="quick-title">الوصول السريع</h2>

                    <div class="quick-grid">

                        <button class="quick-card glass" data-action="quran" type="button">
                            <span class="quick-card__icon" aria-hidden="true">▤</span>
                            <strong>القرآن الكريم</strong>
                            <small>اقرأ وتدبر كلام الله</small>
                        </button>

                        <button class="quick-card glass" data-action="tafsir" type="button">
                            <span class="quick-card__icon" aria-hidden="true">📖</span>
                            <strong>تفسير القرآن</strong>
                            <small>تفسير السعدي</small>
                        </button>

                        <button class="quick-card glass" data-action="adhkar" type="button">
                            <span class="quick-card__icon" aria-hidden="true">☝</span>
                            <strong>الأذكار</strong>
                            <small>حصّن يومك بالذكر</small>
                        </button>

                        <button class="quick-card glass" data-action="adhan" type="button">
                            <span class="quick-card__icon" aria-hidden="true">◉</span>
                            <strong>الأذان</strong>
                            <small>تنبيهات مواقيت الصلاة</small>
                        </button>

                    </div>
                </section>

                <section class="location-actions glass">
                    <button type="button" id="choose-wilaya">
                        اختيار الولاية
                    </button>

                    <button type="button" id="use-gps">
                        استخدام GPS
                    </button>

                    <div id="wilaya-selector" hidden></div>
                </section>

            </section>
        `;

        bindHomeActions();
        renderLocation();
        renderPrayerCard();
        renderPrayerList();
    }

    function renderLocation() {
        const locationNode = $("#location-name");
        const dateNode = $("#date-name");

        if (locationNode) {
            locationNode.textContent =
                state.location?.name || "الجزائر";
        }

        if (dateNode) {
            dateNode.textContent =
                formatArabicDate(new Date());
        }
    }

    function renderPrayerCard() {
        const root = $("#prayer-card-root");
        if (!root) return;

        const next = state.nextPrayer;
        const formatted =
            state.prayerTimes?.formatted || {};

        const nextTitle =
            next?.title || "جارٍ الحساب...";

        const nextTime =
            next?.formatted || "--:--";

        const countdown =
            next
                ? formatCountdown(next.minutesRemaining)
                : "--:--";

        root.innerHTML = `
            <section class="prayer-card glass" aria-labelledby="next-prayer-title">

                <div class="prayer-card__head">
                    <div>
                        <small>الصلاة القادمة</small>
                        <h2 id="next-prayer-title">
                            ${escapeHTML(nextTitle)}
                        </h2>
                    </div>

                    <div class="prayer-card__icon" aria-hidden="true">
                        ☪
                    </div>
                </div>

                <div class="prayer-card__main">

                    <div class="prayer-card__time">
                        ${escapeHTML(nextTime)}
                    </div>

                    <div class="prayer-card__countdown">
                        <small>متبقي على الصلاة</small>
                        <strong id="prayer-countdown">
                            ${escapeHTML(countdown)}
                        </strong>
                    </div>

                </div>

                <div class="prayer-card__footer">
                    <span>مواقيت الصلاة</span>
                    <button
                        type="button"
                        id="show-all-prayers">
                        عرض جميع الأوقات ←
                    </button>
                </div>

            </section>

            <section id="all-prayers" class="prayer-list glass" hidden>
                ${buildPrayerRows(formatted)}
            </section>
        `;

        $("#show-all-prayers")?.addEventListener("click", () => {
            const list = $("#all-prayers");
            if (!list) return;

            list.hidden = !list.hidden;
        });
    }

    function buildPrayerRows(formatted) {
        return PRAYER_KEYS.map(key => `
            <div class="prayer-row">
                <span>${escapeHTML(PRAYER_NAMES[key])}</span>
                <strong>${escapeHTML(formatted[key] || "--:--")}</strong>
            </div>
        `).join("");
    }

    function renderPrayerList() {
        const list = $("#all-prayers");
        if (!list) return;

        list.innerHTML =
            buildPrayerRows(
                state.prayerTimes?.formatted || {}
            );
    }

    function bindHomeActions() {
        $("#choose-wilaya")?.addEventListener(
            "click",
            openWilayaSelector
        );

        $("#use-gps")?.addEventListener(
            "click",
            useGPS
        );

        $$("[data-action]").forEach(button => {
            button.addEventListener("click", () => {
                handleQuickAction(button.dataset.action);
            });
        });
    }

    function openWilayaSelector() {
        const root = $("#wilaya-selector");
        if (!root) return;

        const list = getWilayas();

        if (!list.length) {
            notify("بيانات الولايات غير محملة.", "error");
            return;
        }

        root.hidden = !root.hidden;

        if (root.hidden) return;

        root.innerHTML = `
            <div class="wilaya-selector__inner">
                <label for="wilaya-select">
                    اختر الولاية
                </label>

                <select id="wilaya-select">
                    ${list.map(item => `
                        <option
                            value="${escapeHTML(item.code)}"
                            ${state.location?.code === item.code ? "selected" : ""}>
                            ${escapeHTML(item.name)}
                        </option>
                    `).join("")}
                </select>

                <button type="button" id="apply-wilaya">
                    تطبيق
                </button>
            </div>
        `;

        $("#apply-wilaya")?.addEventListener(
            "click",
            async () => {
                const code = $("#wilaya-select")?.value;
                await selectWilaya(code);
                root.hidden = true;
            }
        );
    }

    /* ======================================================
       الوصول إلى القرآن والتفسير والأذكار والأذان
       ====================================================== */

    function handleQuickAction(action) {
        switch (action) {
            case "quran":
                navigateToResource(
                    "القرآن الكريم",
                    [
                        "pages/quran.html",
                        "quran.html"
                    ]
                );
                break;

            case "tafsir":
                navigateToResource(
                    "تفسير القرآن",
                    [
                        "pages/tafsir.html",
                        "tafsir.html"
                    ]
                );
                break;

            case "adhkar":
                navigateToResource(
                    "الأذكار",
                    [
                        "pages/adhkar.html",
                        "adhkar.html"
                    ]
                );
                break;

            case "adhan":
                notify(
                    "محرك الأذان سيُربط بمواقيت الصلاة بعد تثبيت المحرك.",
                    "info"
                );
                break;

            default:
                break;
        }
    }

    function navigateToResource(title, candidates) {
        const first = candidates[0];

        /*
         * لا نفترض أن كل الصفحات موجودة.
         * نستخدم المسار الأول مباشرة، مع الحفاظ على router.js
         * إن كان يوفر واجهة تنقل عامة.
         */

        if (
            window.RafeeqRouter &&
            typeof window.RafeeqRouter.navigate === "function"
        ) {
            try {
                window.RafeeqRouter.navigate(first);
                return;
            } catch (error) {
                console.warn("Router navigation failed:", error);
            }
        }

        window.location.href = first;

        void title;
    }

    /* ======================================================
       المؤقتات
    ====================================================== */

    function startTimers() {
        stopTimers();

        state.clockTimer = window.setInterval(() => {
            const currentDate = new Date();

            if (
                currentDate.getHours() === 0 &&
                currentDate.getMinutes() === 0 &&
                currentDate.getSeconds() < 2
            ) {
                calculatePrayerTimes();
                renderLocation();
                renderPrayerCard();
            }

            refreshCountdownOnly();
        }, 1000);
    }

    function stopTimers() {
        if (state.clockTimer) {
            clearInterval(state.clockTimer);
            state.clockTimer = null;
        }

        if (state.countdownTimer) {
            clearInterval(state.countdownTimer);
            state.countdownTimer = null;
        }
    }

    function refreshCountdownOnly() {
        if (!state.nextPrayer) {
            refreshPrayerState();
            return;
        }

        if (
            window.PrayerEngine &&
            typeof window.PrayerEngine.getNextPrayer === "function"
        ) {
            state.nextPrayer =
                window.PrayerEngine.getNextPrayer(
                    state.prayerTimes
                );
        }

        const node = $("#prayer-countdown");

        if (node && state.nextPrayer) {
            node.textContent =
                formatCountdown(
                    state.nextPrayer.minutesRemaining
                );
        }
    }

    /* ======================================================
       تشغيل التطبيق
    ====================================================== */

    function initializeLocation() {
        if (restoreLocation()) {
            calculatePrayerTimes();
            return;
        }

        const defaultWilaya = getDefaultWilaya();

        if (defaultWilaya) {
            state.location =
                normalizeLocation(defaultWilaya);

            state.selectedWilaya = defaultWilaya;
            state.source = "default";

            calculatePrayerTimes();
            persistLocation();
        }
    }

    function verifyDependencies() {
        const missing = [];

        if (!window.PrayerEngine) {
            missing.push("PrayerEngine");
        }

        if (
            !window.Locations &&
            !Array.isArray(window.ALGERIA_WILAYAS)
        ) {
            missing.push("Locations");
        }

        if (missing.length) {
            console.warn(
                "الرفيق: محركات لم تُحمّل بعد:",
                missing
            );
        }

        return missing;
    }

    function boot() {
        if (state.initialized) return;

        state.initialized = true;

        verifyDependencies();

        renderHeader();
        initializeLocation();
        renderHome();
        startTimers();

        document.documentElement.dataset.rafeeqReady = "true";

        console.log(
            `Al-Rafeeq App v${APP_VERSION} ready`
        );
    }

    /* ======================================================
       API عامة
    ====================================================== */

    const RafeeqApp = Object.freeze({

        VERSION: APP_VERSION,

        state,

        boot,

        selectWilaya,

        useGPS,

        calculatePrayerTimes,

        refreshPrayerState,

        getWilayas,

        getDefaultWilaya
    });

    window.RafeeqApp = RafeeqApp;

    /*
     * app.js محمّل بـ defer، لذلك DOMContentLoaded آمن.
     */
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot, {
            once: true
        });
    } else {
        boot();
    }

})();