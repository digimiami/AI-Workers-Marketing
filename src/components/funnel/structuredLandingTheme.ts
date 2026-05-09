import { cn } from "@/lib/utils";

/** Public funnel landing: boutique editorial (light) vs legacy growth gradient (dark). */
export type FunnelLandingVisualPreset = "editorial_light" | "growth_dark";

export function funnelMainShell(ed: boolean) {
  return ed
    ? "min-h-screen bg-[#FEFCF8] text-[#2C2A29] selection:bg-[#E9E0D3]"
    : "min-h-screen bg-[radial-gradient(1100px_700px_at_20%_-10%,rgba(34,211,238,0.10),transparent_60%),radial-gradient(900px_600px_at_95%_15%,rgba(167,139,250,0.10),transparent_55%),radial-gradient(900px_600px_at_60%_110%,rgba(16,185,129,0.10),transparent_55%)]";
}

export function funnelTopBar(ed: boolean) {
  return ed ? "text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7b6e62]" : "text-xs font-medium uppercase tracking-wide text-muted-foreground";
}

export function landingHeroWrap(ed: boolean) {
  return ed
    ? "relative overflow-hidden rounded-[2rem] border border-[#EDE6DD] bg-gradient-to-br from-[#FAF7F0] via-[#FAF7F0] to-[#F3EFE5] p-6 shadow-[0_20px_45px_-18px_rgba(44,42,41,0.12)] md:p-10"
    : "relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-b from-muted/25 via-background to-background p-6 shadow-[0_0_90px_-40px_rgba(34,211,238,0.45)] md:p-10";
}

export function landingH1(ed: boolean) {
  return ed
    ? "mt-4 font-[family-name:var(--font-funnel-display),ui-serif,Georgia,serif] text-4xl font-semibold leading-[1.12] tracking-tight text-[#2C2A29] md:text-[2.65rem]"
    : "mt-4 text-3xl font-semibold tracking-tight md:text-5xl";
}

export function landingLead(ed: boolean) {
  return ed
    ? "mt-4 max-w-2xl font-[family-name:var(--font-funnel-body),ui-sans-serif,system-ui,sans-serif] text-base leading-relaxed text-[#4a4542] md:text-lg"
    : "mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg";
}

export function landingPrimaryCta(ed: boolean, className?: string) {
  return ed
    ? cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#2C2A29] px-6 text-sm font-medium text-white shadow-sm transition hover:bg-[#4a4745] hover:shadow-md",
        className,
      )
    : cn(className);
}

export function landingSecondaryCta(ed: boolean, className?: string) {
  return ed
    ? cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#2C2A29] bg-transparent px-6 text-sm font-medium text-[#2C2A29] transition hover:bg-[#2C2A29] hover:text-white",
        className,
      )
    : cn(className);
}

export function landingBadgePill(ed: boolean) {
  return ed
    ? "inline-flex items-center gap-2 rounded-full border border-[#E2DBD2] bg-[#E9E0D3] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5a4a3a]"
    : "inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/20 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground";
}

export function landingRibbonCard(ed: boolean) {
  return ed
    ? "rounded-2xl border border-[#EDE6DD] bg-white/80 px-4 py-3 text-xs leading-snug text-[#4a4542] shadow-sm"
    : "rounded-2xl border border-border/60 bg-card/30 px-4 py-3 text-xs text-muted-foreground backdrop-blur-xl";
}

export function landingRibbonDot(ed: boolean) {
  return ed ? "mr-2 inline-block h-1.5 w-1.5 rounded-full bg-[#9b7b5c] align-middle" : "mr-2 inline-block h-1.5 w-1.5 rounded-full bg-cyan-400/90 align-middle";
}

export function landingSideCard(ed: boolean) {
  return ed
    ? "rounded-[1.5rem] border border-[#EDE6DD] bg-white p-5 shadow-[0_12px_30px_-14px_rgba(44,42,41,0.08)] md:p-6"
    : "rounded-3xl border border-border/60 bg-card/40 p-5 backdrop-blur-xl md:p-6";
}

export function landingSectionLabel(ed: boolean) {
  return ed
    ? "text-[11px] font-semibold uppercase tracking-[0.2em] text-[#9b7b5c]"
    : "text-xs font-medium uppercase tracking-wide text-muted-foreground";
}

export function landingBenefitCard(ed: boolean) {
  return ed
    ? "group rounded-[1.35rem] border border-[#f0ebe3] bg-white p-5 shadow-sm transition hover:border-[#e5d9cc] hover:shadow-md"
    : "group rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur-xl transition-colors hover:bg-card/55";
}

export function landingBenefitIconWrap(ed: boolean) {
  return ed
    ? "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#E9E0D3] bg-[#F9F6F0] text-[#9b7b5c]"
    : "mt-0.5 h-8 w-8 shrink-0 rounded-xl border border-border/60 bg-muted/15 p-2";
}

export function landingProcessCard(ed: boolean) {
  return ed
    ? "rounded-[1.35rem] border border-[#EDE6DD] bg-[#FDFAF6] p-5"
    : "rounded-2xl border border-border/60 bg-muted/10 p-5";
}

export function landingProcessStepLabel(ed: boolean) {
  return ed
    ? "text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9b7b5c]"
    : "text-xs font-semibold text-cyan-300/90";
}

export function landingFormSection(ed: boolean) {
  return ed
    ? "rounded-[1.75rem] border border-[#EDE6DD] bg-white p-6 shadow-[0_15px_40px_-20px_rgba(44,42,41,0.12)] md:p-8"
    : "rounded-3xl border border-border/60 bg-card/40 p-6 backdrop-blur-xl md:p-8";
}

export function landingInput(ed: boolean) {
  return ed
    ? "h-11 w-full rounded-xl border border-[#E2DBD2] bg-[#FEFCF8] px-3 text-sm text-[#2C2A29] outline-none transition focus:border-[#9b7b5c] focus:ring-2 focus:ring-[#9b7b5c]/20"
    : "h-11 w-full rounded-xl border border-border/60 bg-background/60 px-3 text-sm outline-none transition focus:border-cyan-400/50 focus:bg-background";
}

export function landingFloatingBar(ed: boolean) {
  return ed
    ? "pointer-events-auto mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-[#EDE6DD] bg-white/95 p-3 shadow-lg backdrop-blur"
    : "pointer-events-auto mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/90 p-3 shadow-lg backdrop-blur";
}
