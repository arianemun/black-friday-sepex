/**
 * "What can we bring?" A wall of category tiles drifting in alternating directions,
 * with the title sitting in a dark pool in the middle. Pure CSS motion.
 */

const ITEMS = [
  "موبایل و تبلت",
  "لپ‌تاپ و کامپیوتر",
  "هدفون و گجت",
  "ساعت هوشمند",
  "لوازم خانگی",
  "آشپزخانه",
  "مد و پوشاک",
  "کفش و اسنیکر",
  "کیف و اکسسوری",
  "عطر و آرایشی",
  "مکمل و سلامت",
  "اسباب‌بازی و کودک",
  "ورزش و کمپینگ",
  "قطعات خودرو",
  "ابزار و یراق",
  "قطعات الکترونیک",
  "دکوراسیون",
  "سفارش عمده و صنعتی",
];

// Warm, brand-friendly tints (glow from one corner, like light on a box).
const TINTS = [
  "from-[#a07600] via-[#3d3008]",
  "from-[#a8520f] via-[#3b1e0a]",
  "from-[#962c2c] via-[#3a1414]",
  "from-[#56627a] via-[#1e232b]",
  "from-[#79751a] via-[#2c2a0c]",
  "from-[#8a5a2c] via-[#332010]",
];

function Row({ offset, reverse, speed }: { offset: number; reverse?: boolean; speed: number }) {
  const items = [...ITEMS.slice(offset), ...ITEMS.slice(0, offset)];
  const row = (hidden?: boolean) => (
    <ul className="flex shrink-0 gap-3 pl-3" aria-hidden={hidden || undefined}>
      {items.map((label, i) => (
        <li
          key={label}
          className={`chamfer-sm flex h-[4.5rem] shrink-0 items-center justify-center bg-gradient-to-br ${TINTS[(i + offset) % TINTS.length]} to-[#141414] px-7 text-base font-black text-white sm:h-24 sm:px-11 sm:text-xl`}
        >
          {label}
        </li>
      ))}
    </ul>
  );
  return (
    <div className="flex overflow-hidden" dir="ltr">
      <div className={`wall-row flex w-max ${reverse ? "wall-row-rev" : ""}`} style={{ animationDuration: `${speed}s` }} dir="rtl">
        {row()}
        {row(true)}
      </div>
    </div>
  );
}

export function CategoryWall() {
  return (
    <section id="categories" className="relative isolate scroll-mt-4 overflow-hidden bg-black py-28 sm:py-40" aria-labelledby="cat-title">
      <div className="flex flex-col gap-3 [mask-image:linear-gradient(to_bottom,transparent,#000_12%,#000_88%,transparent)]">
        <Row offset={0} speed={70} />
        <Row offset={5} reverse speed={85} />
        <Row offset={10} speed={75} />
        <Row offset={14} reverse speed={90} />
      </div>
      {/* dark pool for the title */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_210px_170px_at_50%_50%,#000_55%,rgb(0_0_0/0.75)_75%,transparent_100%)] sm:bg-[radial-gradient(ellipse_400px_190px_at_50%_50%,#000_55%,rgb(0_0_0/0.75)_75%,transparent_100%)]" aria-hidden />
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-black sm:w-48" aria-hidden />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-black sm:w-48" aria-hidden />
      <div className="absolute inset-0 flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <h2 id="cat-title" className="text-3xl font-black leading-snug text-white sm:text-5xl">
            هر چی بخوای،
            <br />
            از هر جای دنیا
          </h2>
          <p className="mt-4 text-sm leading-7 text-white/60 sm:text-base">از یک قاب گوشی تا سفارش عمده‌ی کارخانه؛ اگر در فروشگاهی خارجی هست، می‌توانیم برایتان بیاوریم.</p>
        </div>
      </div>
    </section>
  );
}
