import type { SVGProps } from "react";

/**
 * Flat vector illustrations (Corporate Memphis / Storyset style).
 * Teal-accented, theme-friendly via currentColor + brand token.
 */

type IllusProps = SVGProps<SVGSVGElement> & { className?: string };

const base = "text-brand";

export function IllusTeamwork(props: IllusProps) {
  return (
    <svg
      viewBox="0 0 400 300"
      className={props.className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="30" y="220" width="340" height="10" rx="5" className="fill-muted" />
      {/* screen */}
      <rect
        x="140"
        y="60"
        width="120"
        height="90"
        rx="8"
        className={`${base} fill-current opacity-20`}
      />
      <rect x="150" y="72" width="100" height="8" rx="4" className={`${base} fill-current`} />
      <rect
        x="150"
        y="88"
        width="70"
        height="6"
        rx="3"
        className="fill-muted-foreground opacity-60"
      />
      <rect
        x="150"
        y="102"
        width="90"
        height="6"
        rx="3"
        className="fill-muted-foreground opacity-40"
      />
      <rect
        x="150"
        y="116"
        width="55"
        height="6"
        rx="3"
        className="fill-muted-foreground opacity-40"
      />
      {/* left person */}
      <circle cx="90" cy="150" r="18" className={`${base} fill-current`} />
      <path
        d="M60 220c0-18 14-32 30-32s30 14 30 32"
        className={`${base} fill-current opacity-70`}
      />
      {/* right person */}
      <circle cx="310" cy="150" r="18" className="fill-muted-foreground" />
      <path
        d="M280 220c0-18 14-32 30-32s30 14 30 32"
        className="fill-muted-foreground opacity-70"
      />
      {/* dots */}
      <circle cx="60" cy="70" r="4" className={`${base} fill-current opacity-60`} />
      <circle cx="340" cy="90" r="6" className={`${base} fill-current opacity-40`} />
      <circle cx="360" cy="50" r="3" className={`${base} fill-current opacity-60`} />
    </svg>
  );
}

export function IllusEnterprise(props: IllusProps) {
  return (
    <svg
      viewBox="0 0 200 160"
      className={props.className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="30"
        y="60"
        width="60"
        height="80"
        rx="4"
        className={`${base} fill-current opacity-20`}
      />
      <rect
        x="110"
        y="40"
        width="60"
        height="100"
        rx="4"
        className={`${base} fill-current opacity-40`}
      />
      {Array.from({ length: 3 }).map((_, r) =>
        Array.from({ length: 2 }).map((__, c) => (
          <rect
            key={`a${r}${c}`}
            x={40 + c * 22}
            y={72 + r * 20}
            width={14}
            height={10}
            rx={2}
            className={`${base} fill-current`}
          />
        )),
      )}
      {Array.from({ length: 4 }).map((_, r) =>
        Array.from({ length: 2 }).map((__, c) => (
          <rect
            key={`b${r}${c}`}
            x={120 + c * 22}
            y={54 + r * 18}
            width={14}
            height={8}
            rx={2}
            className={`${base} fill-current`}
          />
        )),
      )}
      <rect x="10" y="140" width="180" height="4" rx="2" className="fill-muted" />
    </svg>
  );
}

export function IllusStartup(props: IllusProps) {
  return (
    <svg
      viewBox="0 0 200 160"
      className={props.className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M100 20c25 15 40 42 40 70 0 12-4 22-10 30H70c-6-8-10-18-10-30 0-28 15-55 40-70z"
        className={`${base} fill-current opacity-30`}
      />
      <circle cx="100" cy="70" r="10" className={`${base} fill-current`} />
      <path
        d="M70 120l-15 25 25-10zM130 120l15 25-25-10z"
        className={`${base} fill-current opacity-70`}
      />
      <path d="M85 140h30l-4 12h-22z" className="fill-muted-foreground" />
    </svg>
  );
}

export function IllusEcommerce(props: IllusProps) {
  return (
    <svg
      viewBox="0 0 200 160"
      className={props.className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M40 50h120l-14 70H54z" className={`${base} fill-current opacity-25`} />
      <path
        d="M40 50l-8-20H20"
        className={`${base} stroke-current`}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <circle cx="70" cy="140" r="10" className={`${base} fill-current`} />
      <circle cx="140" cy="140" r="10" className={`${base} fill-current`} />
      <rect x="60" y="60" width="80" height="6" rx="3" className={`${base} fill-current`} />
      <rect
        x="60"
        y="76"
        width="60"
        height="6"
        rx="3"
        className="fill-muted-foreground opacity-60"
      />
      <rect
        x="60"
        y="92"
        width="70"
        height="6"
        rx="3"
        className="fill-muted-foreground opacity-40"
      />
    </svg>
  );
}

export function IllusVision(props: IllusProps) {
  return (
    <svg
      viewBox="0 0 400 300"
      className={props.className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="300" cy="90" r="50" className={`${base} fill-current opacity-25`} />
      <circle cx="300" cy="90" r="30" className={`${base} fill-current opacity-60`} />
      <path
        d="M40 230c40-20 80-20 120 0s80 20 120 0 80-20 120 0"
        className={`${base} stroke-current`}
        strokeWidth={4}
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M40 250c40-15 80-15 120 0s80 15 120 0 80-15 120 0"
        className="stroke-muted-foreground opacity-60"
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
      />
      {/* person */}
      <circle cx="120" cy="150" r="18" className="fill-muted-foreground" />
      <path d="M90 220c0-18 14-32 30-32s30 14 30 32" className="fill-muted-foreground opacity-70" />
      <path
        d="M138 158l60-30"
        className={`${base} stroke-current`}
        strokeWidth={4}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IllusMission(props: IllusProps) {
  return (
    <svg
      viewBox="0 0 400 300"
      className={props.className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* target */}
      <circle cx="120" cy="150" r="80" className={`${base} fill-current opacity-15`} />
      <circle cx="120" cy="150" r="55" className={`${base} fill-current opacity-30`} />
      <circle cx="120" cy="150" r="30" className={`${base} fill-current opacity-60`} />
      <circle cx="120" cy="150" r="10" className={`${base} fill-current`} />
      {/* arrow */}
      <path
        d="M280 40l-140 90"
        className={`${base} stroke-current`}
        strokeWidth={5}
        strokeLinecap="round"
      />
      <path d="M280 40l-30 8 22 22z" className={`${base} fill-current`} />
      <rect x="40" y="255" width="320" height="6" rx="3" className="fill-muted" />
    </svg>
  );
}

export function IllusCareers(props: IllusProps) {
  return (
    <svg
      viewBox="0 0 400 300"
      className={props.className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Illustration of a developer at a workstation reviewing code during a technical interview"
    >
      {/* desk */}
      <rect x="30" y="230" width="340" height="10" rx="5" className="fill-muted" />
      <rect
        x="60"
        y="240"
        width="10"
        height="40"
        rx="3"
        className="fill-muted-foreground opacity-50"
      />
      <rect
        x="330"
        y="240"
        width="10"
        height="40"
        rx="3"
        className="fill-muted-foreground opacity-50"
      />

      {/* monitor with code */}
      <rect
        x="100"
        y="70"
        width="200"
        height="130"
        rx="10"
        className={`${base} fill-current opacity-15`}
      />
      <rect
        x="110"
        y="80"
        width="180"
        height="110"
        rx="6"
        className="fill-card stroke-border"
        strokeWidth={2}
      />
      {/* window chrome */}
      <circle cx="122" cy="92" r="3" className={`${base} fill-current`} />
      <circle cx="132" cy="92" r="3" className={`${base} fill-current opacity-70`} />
      <circle cx="142" cy="92" r="3" className={`${base} fill-current opacity-40`} />
      {/* code lines */}
      <rect x="120" y="108" width="50" height="5" rx="2" className={`${base} fill-current`} />
      <rect
        x="175"
        y="108"
        width="70"
        height="5"
        rx="2"
        className="fill-muted-foreground opacity-60"
      />
      <rect
        x="130"
        y="122"
        width="40"
        height="5"
        rx="2"
        className={`${base} fill-current opacity-70`}
      />
      <rect
        x="175"
        y="122"
        width="90"
        height="5"
        rx="2"
        className="fill-muted-foreground opacity-50"
      />
      <rect
        x="130"
        y="136"
        width="60"
        height="5"
        rx="2"
        className="fill-muted-foreground opacity-40"
      />
      <rect
        x="195"
        y="136"
        width="55"
        height="5"
        rx="2"
        className={`${base} fill-current opacity-60`}
      />
      <rect x="120" y="150" width="45" height="5" rx="2" className={`${base} fill-current`} />
      <rect
        x="170"
        y="150"
        width="80"
        height="5"
        rx="2"
        className="fill-muted-foreground opacity-50"
      />
      <rect
        x="130"
        y="164"
        width="55"
        height="5"
        rx="2"
        className="fill-muted-foreground opacity-40"
      />
      <rect
        x="120"
        y="178"
        width="90"
        height="5"
        rx="2"
        className={`${base} fill-current opacity-70`}
      />
      {/* monitor stand */}
      <rect x="190" y="200" width="20" height="16" className="fill-muted-foreground opacity-60" />
      <rect
        x="170"
        y="214"
        width="60"
        height="6"
        rx="3"
        className="fill-muted-foreground opacity-80"
      />

      {/* developer silhouette (back of head + shoulders) */}
      <circle cx="200" cy="258" r="18" className={`${base} fill-current`} />
      <path
        d="M162 300c0-22 17-38 38-38s38 16 38 38"
        className={`${base} fill-current opacity-70`}
      />

      {/* coffee + notepad */}
      <rect
        x="70"
        y="205"
        width="18"
        height="22"
        rx="2"
        className={`${base} fill-current opacity-70`}
      />
      <path
        d="M88 210h6a4 4 0 010 8h-6"
        className={`${base} stroke-current`}
        strokeWidth={2}
        fill="none"
      />
      <rect
        x="310"
        y="200"
        width="34"
        height="24"
        rx="2"
        className="fill-card stroke-border"
        strokeWidth={2}
      />
      <path
        d="M316 208h22M316 214h18M316 220h14"
        className="stroke-muted-foreground opacity-70"
        strokeWidth={1.5}
        strokeLinecap="round"
      />

      {/* accents */}
      <circle cx="60" cy="60" r="4" className={`${base} fill-current opacity-60`} />
      <circle cx="350" cy="60" r="6" className={`${base} fill-current opacity-40`} />
      <circle cx="370" cy="120" r="3" className={`${base} fill-current opacity-70`} />
    </svg>
  );
}

export function IllusHero(props: IllusProps) {
  return (
    <svg
      viewBox="0 0 480 360"
      className={props.className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* backdrop grid */}
      <rect
        x="20"
        y="30"
        width="440"
        height="260"
        rx="18"
        className={`${base} fill-current opacity-10`}
      />
      {/* main dashboard window */}
      <rect
        x="60"
        y="70"
        width="260"
        height="180"
        rx="12"
        className="fill-card stroke-border"
        strokeWidth={2}
      />
      <rect
        x="60"
        y="70"
        width="260"
        height="26"
        rx="12"
        className={`${base} fill-current opacity-30`}
      />
      <circle cx="76" cy="83" r="3" className={`${base} fill-current`} />
      <circle cx="88" cy="83" r="3" className={`${base} fill-current opacity-70`} />
      <circle cx="100" cy="83" r="3" className={`${base} fill-current opacity-40`} />
      {/* chart bars */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect
          key={i}
          x={80 + i * 30}
          y={220 - (i % 3) * 30 - 20}
          width={18}
          height={30 + (i % 3) * 30}
          rx={3}
          className={`${base} fill-current opacity-${60 + (i % 3) * 10}`}
        />
      ))}
      {/* line chart */}
      <path
        d="M80 140 L120 120 L160 130 L200 100 L240 110 L280 90"
        className={`${base} stroke-current`}
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* floating cloud/server card */}
      <rect
        x="300"
        y="120"
        width="140"
        height="90"
        rx="12"
        className="fill-card stroke-border"
        strokeWidth={2}
      />
      <rect x="316" y="138" width="108" height="8" rx="4" className={`${base} fill-current`} />
      <rect
        x="316"
        y="154"
        width="80"
        height="6"
        rx="3"
        className="fill-muted-foreground opacity-60"
      />
      <rect
        x="316"
        y="168"
        width="90"
        height="6"
        rx="3"
        className="fill-muted-foreground opacity-40"
      />
      <rect
        x="316"
        y="182"
        width="70"
        height="6"
        rx="3"
        className="fill-muted-foreground opacity-40"
      />
      {/* server rack */}
      <rect
        x="330"
        y="230"
        width="90"
        height="60"
        rx="8"
        className={`${base} fill-current opacity-25`}
      />
      {[0, 1, 2].map((r) => (
        <rect
          key={r}
          x={340}
          y={240 + r * 16}
          width={70}
          height={8}
          rx={2}
          className={`${base} fill-current`}
        />
      ))}
      {/* orbits/dots */}
      <circle cx="60" cy="290" r="14" className={`${base} fill-current opacity-60`} />
      <circle cx="440" cy="70" r="10" className={`${base} fill-current opacity-40`} />
      <circle cx="410" cy="50" r="5" className={`${base} fill-current`} />
      <path d="M40 320h420" className="stroke-muted" strokeWidth={4} strokeLinecap="round" />
    </svg>
  );
}

export function IllusProfessional(props: IllusProps) {
  return (
    <svg
      viewBox="0 0 200 160"
      className={props.className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="30"
        y="40"
        width="140"
        height="90"
        rx="8"
        className={`${base} fill-current opacity-20`}
      />
      <circle cx="70" cy="80" r="14" className={`${base} fill-current`} />
      <circle cx="130" cy="80" r="14" className="fill-muted-foreground" />
      <path
        d="M78 92l14 10 14-10"
        className={`${base} stroke-current`}
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
      />
      <rect
        x="50"
        y="110"
        width="100"
        height="6"
        rx="3"
        className={`${base} fill-current opacity-60`}
      />
      <rect x="10" y="140" width="180" height="4" rx="2" className="fill-muted" />
    </svg>
  );
}

export function IllusB2B(props: IllusProps) {
  return (
    <svg
      viewBox="0 0 200 160"
      className={props.className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="20"
        y="60"
        width="60"
        height="70"
        rx="6"
        className={`${base} fill-current opacity-30`}
      />
      <rect
        x="120"
        y="60"
        width="60"
        height="70"
        rx="6"
        className={`${base} fill-current opacity-30`}
      />
      <path
        d="M80 95h40"
        className={`${base} stroke-current`}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <path
        d="M110 88l14 7-14 7"
        className={`${base} stroke-current`}
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="30" y="72" width="40" height="6" rx="3" className={`${base} fill-current`} />
      <rect x="130" y="72" width="40" height="6" rx="3" className={`${base} fill-current`} />
      <rect x="10" y="140" width="180" height="4" rx="2" className="fill-muted" />
    </svg>
  );
}

export function IllusGaming(props: IllusProps) {
  return (
    <svg
      viewBox="0 0 200 160"
      className={props.className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="30"
        y="50"
        width="140"
        height="70"
        rx="26"
        className={`${base} fill-current opacity-25`}
      />
      <circle cx="70" cy="85" r="14" className={`${base} fill-current opacity-60`} />
      <circle cx="140" cy="85" r="8" className={`${base} fill-current`} />
      <circle cx="130" cy="70" r="6" className={`${base} fill-current opacity-70`} />
      <rect x="62" y="83" width="16" height="4" rx="2" className="fill-card" />
      <rect x="68" y="77" width="4" height="16" rx="2" className="fill-card" />
      <rect x="10" y="140" width="180" height="4" rx="2" className="fill-muted" />
    </svg>
  );
}
