/**
 * session-toast.ts
 * ─────────────────
 * แจ้งเตือน user เมื่อเกิดปัญหา session/token
 * แสดง Toast บนหน้าจอ 3 วินาทีก่อนเด้งไปหน้า login
 */

export type SessionProblem =
  | "token_expired"
  | "session_idle_timeout"
  | "refresh_token_expired"
  | "not_authenticated"
  | "network_error"
  | "unknown";

const MESSAGES: Record<SessionProblem, { th: string; en: string; icon: string }> = {
  token_expired: {
    th: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่",
    en: "Session expired. Please log in again.",
    icon: "⏰",
  },
  session_idle_timeout: {
    th: "ไม่มีการใช้งานเป็นเวลานาน กรุณาเข้าสู่ระบบใหม่",
    en: "Inactive for too long. Please log in again.",
    icon: "💤",
  },
  refresh_token_expired: {
    th: "เซสชันหมดอายุถาวร กรุณาเข้าสู่ระบบใหม่",
    en: "Session fully expired. Please log in again.",
    icon: "🔒",
  },
  not_authenticated: {
    th: "กรุณาเข้าสู่ระบบก่อนใช้งาน",
    en: "Please log in to continue.",
    icon: "🔑",
  },
  network_error: {
    th: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่",
    en: "Cannot connect to server. Please try again.",
    icon: "🌐",
  },
  unknown: {
    th: "เกิดข้อผิดพลาด กรุณาเข้าสู่ระบบใหม่",
    en: "Something went wrong. Please log in again.",
    icon: "⚠️",
  },
};

/** แปลง detail จาก backend เป็น SessionProblem */
export function detailToProblem(detail: string): SessionProblem {
  switch (detail) {
    case "token_expired":
    case "invalid_token":
      return "token_expired";
    case "session_idle_timeout":
      return "session_idle_timeout";
    case "refresh_token_expired":
      return "refresh_token_expired";
    case "Not authenticated":
      return "not_authenticated";
    default:
      return "unknown";
  }
}

/** ดึงภาษาจาก localStorage หรือ default เป็น th */
function getLang(): "th" | "en" {
  try {
    const lang = localStorage.getItem("lang") || localStorage.getItem("language") || "th";
    return lang.startsWith("en") ? "en" : "th";
  } catch {
    return "th";
  }
}

/** แสดง Toast แจ้งเตือนบนหน้าจอ */
export function showSessionToast(
  problem: SessionProblem,
  options: { duration?: number; onDone?: () => void } = {}
) {
  if (typeof window === "undefined") return;

  const { duration = 3000, onDone } = options;
  const lang = getLang();
  const msg = MESSAGES[problem];

  // ลบ toast เก่าถ้ามี
  const existing = document.getElementById("session-toast");
  if (existing) existing.remove();

  // สร้าง toast element
  const toast = document.createElement("div");
  toast.id = "session-toast";
  toast.setAttribute("role", "alert");
  toast.innerHTML = `
    <div style="
      position: fixed;
      top: 24px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 99999;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 24px;
      background: #1e293b;
      color: #fff;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 15px;
      font-weight: 500;
      max-width: 90vw;
      animation: toast-slide-in 0.3s ease-out;
      line-height: 1.4;
    ">
      <span style="font-size: 24px; flex-shrink: 0;">${msg.icon}</span>
      <div>
        <div>${msg[lang]}</div>
        <div style="font-size: 12px; opacity: 0.6; margin-top: 4px;">
          ${lang === "th" ? "กำลังนำไปหน้าเข้าสู่ระบบ..." : "Redirecting to login..."}
        </div>
      </div>
      <div style="
        position: absolute;
        bottom: 0;
        left: 0;
        height: 3px;
        background: #3b82f6;
        border-radius: 0 0 12px 12px;
        animation: toast-progress ${duration}ms linear;
      "></div>
    </div>
    <style>
      @keyframes toast-slide-in {
        from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
        to   { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
      @keyframes toast-progress {
        from { width: 100%; }
        to   { width: 0%; }
      }
    </style>
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
    onDone?.();
  }, duration);
}

/**
 * แสดง toast แจ้งเตือน network error (ไม่เด้ง login)
 * ใช้ตอน fetch ล้มเหลวเพราะ network
 */
export function showNetworkError() {
  showSessionToast("network_error", { duration: 4000 });
}