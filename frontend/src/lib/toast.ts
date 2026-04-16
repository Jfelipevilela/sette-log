export type ToastTone = "success" | "error" | "info";

export type ToastPayload = {
  title: string;
  description?: string;
  tone?: ToastTone;
};

export const TOAST_EVENT = "sette-log-toast";

export function notify(payload: ToastPayload) {
  window.dispatchEvent(
    new CustomEvent<ToastPayload>(TOAST_EVENT, {
      detail: payload,
    }),
  );
}
