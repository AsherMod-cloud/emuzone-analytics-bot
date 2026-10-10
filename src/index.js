
const CF_ACCOUNT_ID = "9f81b2db36df32d2498bc22fb01c7891";
const CF_SITE_TAG = "02c7e2b7d4ba4872b6c9fe7775b9c296";

const FIRESTORE_PROJECT = "emulator-games-id-bf695";
const TELEGRAM_API = "https://api.telegram.org/bot";
const TIME_ZONE = "Asia/Jakarta";
const WIB_OFFSET = "+07:00";

export default {
    async fetch(request, env) {
        if (request.method !== "POST") {
            return new Response("OK");
        }

        let message;

        try {
            const update = await request.json();
            message = update.message;

            if (!message?.text || !message.from) {
                return new Response("OK");
            }

            const userId = String(message.from.id);

            if (userId !== String(env.TELEGRAM_ADMIN_ID || "")) {
                if (message.text.trim().startsWith("/")) {
                    await sendTelegramMessage(
                        env.TELEGRAM_BOT_TOKEN,
                        message.chat.id,
                        "Bot ini private."
                    );
                }

                return new Response("OK");
            }

            const startedAt = Date.now();
            const parts = message.text.trim().split(/\s+/);
            const command = parts[0].split("@")[0].toLowerCase();
            const argument = (parts[1] || "").toLowerCase();

            if (command === "/start") {
                await sendTelegramMessage(
                    env.TELEGRAM_BOT_TOKEN,
                    message.chat.id,
                    getStartMessage()
                );
            } else if (command === "/help") {
                await sendTelegramMessage(
                    env.TELEGRAM_BOT_TOKEN,
                    message.chat.id,
                    getHelpMessage()
                );
            } else if (command === "/stats") {
                const stats = await getStats(env, argument);
                stats.push("");
                stats.push("⚡ Response : " + (Date.now() - startedAt) + " ms");

                await sendTelegramMessage(
                    env.TELEGRAM_BOT_TOKEN,
                    message.chat.id,
                    stats.join("\n")
                );
            }

            return new Response("OK");
        } catch (error) {
            console.error("Bot error:", error);

            if (message?.chat?.id && env.TELEGRAM_BOT_TOKEN) {
                try {
                    await sendTelegramMessage(
                        env.TELEGRAM_BOT_TOKEN,
                        message.chat.id,
                        [
                            "⚠️ EmuZone.My.Id — Stats",
                            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
                            "",
                            "Gagal mengambil data. Coba lagi nanti.",
                            "Detail: " + safeError(error),
                            "",
                            "🕐 " + getJakartaTime() + " WIB"
                        ].join("\n")
                    );
                } catch (sendError) {
                    console.error("Telegram error:", sendError);
                }
            }

            return new Response("OK");
        }
    }
};

function getStartMessage() {
    return [
        "🎮 EmuZone Analytics",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "",
        "Halo, AsherMod! 👋",
        "",
        "Bot ini buat pantau performa",
        "website EmuZone.My.Id secara real-time.",
        "",
        "📊 Yang bisa lo lakuin:",
        "• Pantau kunjungan website",
        "• Bandingkan traffic dengan kemarin",
        "• Lihat statistik berdasarkan periode",
        "• Cek jumlah game di katalog",
        "",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "",
        "🚀 Mulai cepat:",
        "/stats  → Snapshot hari ini",
        "/help   → Daftar semua command",
        "",
        "💡 Bot ini dibatasi untuk akun owner.",
        "Data tetap bergantung pada sumber",
        "Analytics dan Firestore yang tersedia.",
        "",
        "🕐 " + getJakartaTime() + " WIB"
    ].join("\n");
}

function getHelpMessage() {
    return [
        "🎮 EmuZone Analytics — Help",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "",
        "📊 STATISTIK",
        "/stats",
        "   Snapshot hari ini",
        "",
        "/stats today",
        "   Statistik hari ini + tren kemarin",
        "",
        "/stats week",
        "   Statistik 7 hari terakhir",
        "",
        "/stats month",
        "   Statistik 30 hari terakhir",
        "",
        "/stats all",
        "   Seluruh data historis yang tersedia",
        "",
        "🤖 INFORMASI BOT",
        "/start",
        "   Pesan sambutan",
        "/help",
        "   Daftar command",
        "",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "🔒 Akses terbatas untuk owner",
        "🕐 " + getJakartaTime() + " WIB"
    ].join("\n");
}

async function getStats(env, period) {
    const validPeriods = ["", "today", "week", "month", "all"];

    if (!validPeriods.includes(period)) {
        return [
            "⚠️ Periode tidak dikenal.",
            "",
            "Gunakan:",
            "/stats today",
            "/stats week",
            "/stats month",
            "/stats all"
        ];
    }

    const selectedPeriod = period || "today";
    const range = getPeriodRange(selectedPeriod);

    const current = await getVisits(
        env,
        range.start,
        range.end
    );

    const games = await getGameCount();

    if (selectedPeriod === "today") {
        const yesterdayRange = getPeriodRange("yesterday");
        const yesterday = await getVisits(
            env,
            yesterdayRange.start,
            yesterdayRange.end
        );

        const trend = getTrend(current.visits, yesterday.visits);

        return [
            "📊 EmuZone.My.Id — Stats",
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
            "",
            "📅 TODAY",
            "🌐 Visits    : " + formatNumber(current.visits),
            "👁 Pageviews : " + formatNumber(current.pageViews),
            "📈 Trend     : " + trend,
            "",
            "📚 CATALOG",
            "🎮 Games     : " + formatNumber(games),
            "",
            "🕐 " + getJakartaTime() + " WIB"
        ];
    }

    const labels = {
        week: "7 HARI TERAKHIR",
        month: "30 HARI TERAKHIR",
        all: "SEMUA DATA TERSEDIA"
    };

    return [
        "📊 EmuZone.My.Id — Stats",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "",
        "📅 " + labels[selectedPeriod],
        "🌐 Visits    : " + formatNumber(current.visits),
        "👁 Pageviews : " + formatNumber(current.pageViews),
        "",
        "📚 CATALOG",
        "🎮 Games     : " + formatNumber(games),
        "",
        "🕐 " + getJakartaTime() + " WIB"
    ];
}

async function getVisits(env, start, end) {
    const query = `
        query GetVisits(
            $accountTag: string!,
            $filter: RUMPageloadEventsAdaptiveGroupsFilter_InputObject!
        ) {
            viewer {
                accounts(filter: { accountTag: $accountTag }) {
                    rumPageloadEventsAdaptiveGroups(
                        filter: $filter
                        limit: 10000
                    ) {
                        count
                        sum {
                            visits
                        }
                    }
                }
            }
        }
    `;

    const response = await fetch(
        "https://api.cloudflare.com/client/v4/graphql",
        {
            method: "POST",
            headers: {
                "Authorization": "Bearer " + env.CF_API_TOKEN,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                query,
                variables: {
                    accountTag: CF_ACCOUNT_ID,
                    filter: {
                        AND: [
                            { datetime_geq: start },
                            { datetime_leq: end },
                            { siteTag: CF_SITE_TAG }
                        ]
                    }
                }
            })
        }
    );

    const data = await response.json();

    if (!response.ok || data.errors?.length) {
        console.error("Cloudflare Analytics:", data.errors || data);
        throw new Error("Cloudflare Analytics gagal");
    }

    const groups =
        data.data?.viewer?.accounts?.[0]
            ?.rumPageloadEventsAdaptiveGroups || [];

    return groups.reduce(function (total, item) {
        total.visits += Number(item.sum?.visits || 0);
        total.pageViews += Number(item.count || 0);
        return total;
    }, {
        visits: 0,
        pageViews: 0
    });
}

async function getGameCount() {
    const url =
        "https://firestore.googleapis.com/v1/projects/" +
        FIRESTORE_PROJECT +
        "/databases/(default)/documents:runAggregationQuery";

    const body = {
        structuredAggregationQuery: {
            structuredQuery: {
                from: [{ collectionId: "games" }]
            },
            aggregations: [{
                alias: "gameCount",
                count: {}
            }]
        }
    };

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        console.error("Firestore count failed:", await response.text());
        throw new Error("Firestore gagal");
    }

    const results = await response.json();
    const value = results?.[0]?.result?.aggregateFields
        ?.gameCount?.integerValue;

    return Number(value || 0);
}

function getPeriodRange(period) {
    const now = new Date();
    const localDate = getJakartaDate(now);

    if (period === "all") {
        // Data historis yang masih tersedia dari Analytics.
        return {
            start: "2020-01-01T00:00:00" + WIB_OFFSET,
            end: now.toISOString()
        };
    }

    if (period === "yesterday") {
        const yesterday = addDays(localDate, -1);

        return {
            start: yesterday + "T00:00:00" + WIB_OFFSET,
            end: localDate + "T00:00:00" + WIB_OFFSET
        };
    }

    const days = period === "week" ? 6 : period === "month" ? 29 : 0;
    const startDate = addDays(localDate, -days);

    return {
        start: startDate + "T00:00:00" + WIB_OFFSET,
        end: now.toISOString()
    };
}

function getJakartaDate(date) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(date);

    const values = {};

    for (const part of parts) {
        values[part.type] = part.value;
    }

    return values.year + "-" + values.month + "-" + values.day;
}

function addDays(dateString, amount) {
    const date = new Date(dateString + "T12:00:00Z");
    date.setUTCDate(date.getUTCDate() + amount);

    return date.toISOString().slice(0, 10);
}

function getTrend(today, yesterday) {
    if (today === 0 && yesterday === 0) {
        return "— belum ada data";
    }

    if (yesterday === 0) {
        return "🚀 Data baru tersedia";
    }

    const percent = ((today - yesterday) / yesterday) * 100;
    const rounded = Math.round(percent * 10) / 10;
    const sign = rounded > 0 ? "+" : "";

    let emoji = "⚪";

    if (rounded >= 50) emoji = "🚀";
    else if (rounded >= 10) emoji = "🟢";
    else if (rounded > 0) emoji = "🟡";
    else if (rounded <= -50) emoji = "💀";
    else if (rounded <= -10) emoji = "🔴";
    else if (rounded < 0) emoji = "🟠";

    let result = emoji + " " + sign + rounded + "%";

    if (rounded >= 150) {
        result += " (mantap!)";
    }

    return result;
}

async function sendTelegramMessage(token, chatId, text) {
    const response = await fetch(
        TELEGRAM_API + token + "/sendMessage",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                chat_id: chatId,
                text: text
            })
        }
    );

    if (!response.ok) {
        console.error("Telegram sendMessage failed:", await response.text());
    }
}

function formatNumber(value) {
    return Number(value).toLocaleString("id-ID");
}

function getJakartaTime() {
    return new Intl.DateTimeFormat("id-ID", {
        timeZone: TIME_ZONE,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    }).format(new Date()).replace(".", ":").replace(":", ".");
}

function safeError(error) {
    const message = String(error?.message || "Unknown error");
    return message.slice(0, 120);
}
