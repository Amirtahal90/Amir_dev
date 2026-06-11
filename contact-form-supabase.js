// contact-form-supabase.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

/*
  1) این دو مقدار را از داشبورد Supabase خودت جایگزین کن
  2) نام جدول پیش‌فرض: messages
  3) پیشنهاد ستون‌ها:
     - name (text)
     - email (text)
     - subject (text)
     - message (text)
     - ip (text)
     - sent_at (timestamptz یا text)
     - user_agent (text)
     - referrer (text)
     - page_url (text)
     - log_json (jsonb)
     - spam_flag (boolean)
*/

const SUPABASE_URL = "https://xummpxixorqrtjddbzbr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_xAxSH6n6HdgpQPAD4mEPtw_vtDLzv25";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

const form = document.querySelector(".contact-form");
if (!form) {
  console.warn("Contact form not found.");
} else {
  const submitButton = form.querySelector('button[type="submit"]');
  const textInputs = form.querySelectorAll('input[type="text"]');
  const nameInput = textInputs[0] || null;
  const subjectInput = textInputs[1] || null;
  const emailInput = form.querySelector('input[type="email"]');
  const messageInput = form.querySelector("textarea");

  const pageOpenedAt = Date.now();
  const COOLDOWN_MS = 30_000;
  const MIN_HUMAN_TIME_MS = 2500;
  const LAST_SUBMIT_KEY = "amir_dev_contact_last_submit";

  const STATUS_ID = "contact-form-status-toast";
  const HONEYPOT_NAME = "website";

  ensureHoneypot();
  ensureStatusToast();

  function ensureHoneypot() {
    let honeypot = form.querySelector(`input[name="${HONEYPOT_NAME}"]`);
    if (honeypot) return honeypot;

    honeypot = document.createElement("input");
    honeypot.type = "text";
    honeypot.name = HONEYPOT_NAME;
    honeypot.autocomplete = "off";
    honeypot.tabIndex = -1;
    honeypot.setAttribute("aria-hidden", "true");
    honeypot.style.position = "absolute";
    honeypot.style.left = "-9999px";
    honeypot.style.width = "1px";
    honeypot.style.height = "1px";
    honeypot.style.opacity = "0";
    honeypot.value = "";
    form.appendChild(honeypot);
    return honeypot;
  }

  function ensureStatusToast() {
    if (document.getElementById(STATUS_ID)) return;

    const toast = document.createElement("div");
    toast.id = STATUS_ID;
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.style.position = "fixed";
    toast.style.insetInlineEnd = "20px";
    toast.style.insetBlockEnd = "20px";
    toast.style.zIndex = "99999";
    toast.style.padding = "12px 16px";
    toast.style.borderRadius = "12px";
    toast.style.fontFamily = "Vazirmatn, system-ui, sans-serif";
    toast.style.fontSize = "14px";
    toast.style.lineHeight = "1.7";
    toast.style.color = "#fff";
    toast.style.background = "#111827";
    toast.style.boxShadow = "0 14px 40px rgba(0,0,0,.28)";
    toast.style.transform = "translateY(20px)";
    toast.style.opacity = "0";
    toast.style.pointerEvents = "none";
    toast.style.transition = "opacity .22s ease, transform .22s ease";
    document.body.appendChild(toast);
  }

  function showToast(message, type = "success") {
    const toast = document.getElementById(STATUS_ID);
    if (!toast) return;

    toast.textContent = message;
    toast.style.background = type === "success" ? "#16a34a" : "#dc2626";
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";

    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(20px)";
    }, 3200);
  }

  function setLoading(isLoading) {
    if (!submitButton) return;
    submitButton.disabled = isLoading;
    submitButton.textContent = isLoading ? "در حال ارسال..." : "ارسال پیام";
    submitButton.style.opacity = isLoading ? "0.8" : "1";
    submitButton.style.cursor = isLoading ? "not-allowed" : "pointer";
  }

  function normalizeText(value = "") {
    return String(value)
      .replace(/\u200c/g, " ")
      .replace(/[<>]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function looksMalicious(text) {
    const t = String(text).toLowerCase();
    const patterns = [
      "<script",
      "javascript:",
      "data:text/html",
      "onerror=",
      "onload=",
      "iframe",
      "object",
      "embed",
      "eval(",
      "document.cookie",
      "window.location",
      "fetch(",
      "xmlhttprequest",
      "base64,",
    ];
    return patterns.some((p) => t.includes(p));
  }

  function cooldownActive() {
    const last = Number(localStorage.getItem(LAST_SUBMIT_KEY) || 0);
    return Date.now() - last < COOLDOWN_MS;
  }

  async function getPublicIP() {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4500);

      const res = await fetch("https://api.ipify.org?format=json", {
        signal: controller.signal,
        cache: "no-store",
      });

      clearTimeout(timer);

      if (!res.ok) return "unknown";
      const data = await res.json();
      return data?.ip || "unknown";
    } catch {
      return "unknown";
    }
  }

  function buildLog({ ip, spamFlag, name, email, subject }) {
    return {
      page_url: window.location.href,
      referrer: document.referrer || "",
      user_agent: navigator.userAgent || "",
      language: navigator.language || "",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      sent_at_iso: new Date().toISOString(),
      sent_at_local: new Date().toLocaleString("fa-IR"),
      ip,
      spam_flag: spamFlag,
      form_name: name,
      form_email: email,
      form_subject: subject,
    };
  }

  async function submitToSupabase(payload) {
    const { error } = await supabase.from("messages").insert([payload]);
    if (error) throw error;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const honeypot = form.querySelector(`input[name="${HONEYPOT_NAME}"]`);
    const name = normalizeText(nameInput?.value || "");
    const email = normalizeText(emailInput?.value || "");
    const subject = normalizeText(subjectInput?.value || "");
    const message = normalizeText(messageInput?.value || "");
    const humanDelay = Date.now() - pageOpenedAt;

    if (honeypot && honeypot.value.trim() !== "") {
      showToast("ارسال ناموفق بود.", "error");
      return;
    }

    if (cooldownActive()) {
      showToast("لطفاً کمی صبر کن و دوباره تلاش کن.", "error");
      return;
    }

    if (humanDelay < MIN_HUMAN_TIME_MS) {
      showToast("فرم خیلی سریع ارسال شد.", "error");
      return;
    }

    if (!name || !email || !subject || !message) {
      showToast("همه فیلدها باید پر شوند.", "error");
      return;
    }

    if (name.length < 2 || name.length > 60) {
      showToast("نام وارد شده معتبر نیست.", "error");
      return;
    }

    if (!isValidEmail(email)) {
      showToast("ایمیل معتبر نیست.", "error");
      return;
    }

    if (subject.length < 3 || subject.length > 120) {
      showToast("موضوع پیام معتبر نیست.", "error");
      return;
    }

    if (message.length < 10 || message.length > 2500) {
      showToast("متن پیام باید بین 10 تا 2500 کاراکتر باشد.", "error");
      return;
    }

    if (
      looksMalicious(name) ||
      looksMalicious(email) ||
      looksMalicious(subject) ||
      looksMalicious(message)
    ) {
      showToast("محتوای پیام مشکوک تشخیص داده شد.", "error");
      return;
    }

    setLoading(true);

    try {
      const ip = await getPublicIP();
      const spamFlag =
        /http(s)?:\/\/|www\./i.test(message) && message.length < 40;

      const payload = {
        name,
        email,
        subject,
        message,
        ip,
        sent_at: new Date().toISOString(),
        user_agent: navigator.userAgent || "",
        referrer: document.referrer || "",
        page_url: window.location.href,
        spam_flag: spamFlag,
        log_json: buildLog({ ip, spamFlag, name, email, subject }),
      };

      await submitToSupabase(payload);

      localStorage.setItem(LAST_SUBMIT_KEY, String(Date.now()));
      form.reset();
      if (honeypot) honeypot.value = "";
      showToast("پیام با موفقیت ارسال شد ✅", "success");
    } catch (error) {
      console.error("Supabase insert error:", error);
      showToast("ارسال پیام انجام نشد. دوباره تلاش کن.", "error");
    } finally {
      setLoading(false);
    }
  });
}