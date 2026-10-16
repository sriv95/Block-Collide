/** localStorage that never throws (private mode, blocked storage). */
export const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
export const put = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} };
