import { z } from 'zod';

// ─── Primitives ───────────────────────────────────────────────────────────────

const HexColor = z
  .string()
  .regex(/^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/, 'hex 색상값이어야 합니다 (#RRGGBB 또는 #RRGGBBAA)');

const CssValue = z.string().min(1);

const TokenValueOrRef = z
  .string()
  .min(1)
  .refine(
    (v) => !v.includes('#') || /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(v),
    'component 토큰 값에 임의의 hex를 직접 쓸 수 없습니다. 토큰 참조({colors.primary.500})를 사용하세요.',
  );

// ─── Color Shade Scale (50~950) ───────────────────────────────────────────────

export const SHADE_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
export type ShadeStep = (typeof SHADE_STEPS)[number];

const ShadeScaleSchema = z
  .record(z.coerce.string(), HexColor)
  .refine(
    (s) => SHADE_STEPS.every((step) => String(step) in s),
    `50~950 전체 셰이드(${SHADE_STEPS.join(', ')})가 모두 있어야 합니다.`,
  );

export type ShadeScale = Record<string, string>;

// ─── Colors ──────────────────────────────────────────────────────────────────

// 회사 표준 semantic 변수 (shadcn 19 + 회사 추가 6 = 25). 스케일 참조 또는 hex.
const SemanticColorsSchema = z.object({
  background: z.string(),
  foreground: z.string(),
  card: z.string(),
  'card-foreground': z.string(),
  popover: z.string(),
  'popover-foreground': z.string(),
  primary: z.string(),
  'primary-foreground': z.string(),
  secondary: z.string(),
  'secondary-foreground': z.string(),
  muted: z.string(),
  'muted-foreground': z.string(),
  accent: z.string(),
  'accent-foreground': z.string(),
  border: z.string(),
  input: z.string(),
  ring: z.string(),
  destructive: z.string(),
  'destructive-foreground': z.string(),
  success: z.string(),
  'success-foreground': z.string(),
  warning: z.string(),
  'warning-foreground': z.string(),
  info: z.string(),
  'info-foreground': z.string(),
});

export const ColorsSchema = z.object({
  primary: ShadeScaleSchema,
  gray: ShadeScaleSchema,
  semantic: SemanticColorsSchema,
}).catchall(ShadeScaleSchema); // 추가 팔레트 컬러 허용 (red, orange 등)

export type Colors = z.infer<typeof ColorsSchema>;

// ─── Typography ───────────────────────────────────────────────────────────────

const TypographyScaleEntry = z.object({
  size: CssValue,
  lineHeight: CssValue,
  weight: z.enum(['regular', 'medium', 'semibold', 'bold']),
  letterSpacing: CssValue.optional(),
});

export const TypographySchema = z.object({
  fontFamily: z.object({
    sans: z
      .array(z.string())
      .min(1)
      .refine(
        (arr) => {
          const first = arr[0] ?? '';
          return first.includes('Pretendard');
        },
        'fontFamily.sans 첫 번째 항목은 Pretendard로 고정',
      ),
    mono: z.array(z.string()).optional(),
  }),
  scale: z
    .record(z.string(), TypographyScaleEntry)
    .refine((s) => Object.keys(s).length >= 9, '타이포그래피 스케일은 최소 9레벨 이상이어야 합니다'),
  weight: z
    .object({
      normal: z.literal(400),
      medium: z.literal(500),
      semibold: z.literal(600),
      bold: z.literal(700),
    })
    .catchall(z.number().int().min(100).max(900)),
});

export type Typography = z.infer<typeof TypographySchema>;

// ─── Rounded ─────────────────────────────────────────────────────────────────

export const RoundedSchema = z
  .record(z.string(), CssValue)
  .refine((r) => 'none' in r, '`rounded.none` 필수')
  .refine((r) => 'full' in r, '`rounded.full` 필수')
  .refine((r) => Object.keys(r).length >= 5, 'rounded는 최소 5단계 이상이어야 합니다');

export type Rounded = z.infer<typeof RoundedSchema>;

// ─── Spacing ─────────────────────────────────────────────────────────────────

const Breakpoints = z.object({
  sm: CssValue,
  md: CssValue,
  lg: CssValue,
  xl: CssValue,
  '2xl': CssValue,
});

export const SpacingSchema = z
  .record(z.string(), z.union([CssValue, Breakpoints]))
  .refine((s) => 'breakpoints' in s, '`spacing.breakpoints` 필수');

export type Spacing = z.infer<typeof SpacingSchema>;

// ─── Icons ───────────────────────────────────────────────────────────────────

// flaticon UIcons 6 variants (weight × shape). 부트스트랩이 design.md의 style 값을
// 그대로 폴더 이름(`assets/icons/{style}/`)으로 사용하므로 enum 값과 폴더 이름이 1:1.
export const IconStyleSchema = z.enum([
  'regular_straight',
  'regular_rounded',
  'bold_straight',
  'bold_rounded',
  'solid_straight',
  'solid_rounded',
]);
export type IconStyle = z.infer<typeof IconStyleSchema>;

export const IconsSchema = z.object({
  style: IconStyleSchema,
  source: z.literal('flaticon-uicons'),
  rationale: z.string().min(10),
});

export type Icons = z.infer<typeof IconsSchema>;

// ─── Components ──────────────────────────────────────────────────────────────

const RequiredComponents = z.object({
  'button-primary': z.record(z.string(), TokenValueOrRef),
  'button-secondary': z.record(z.string(), TokenValueOrRef),
  input: z.record(z.string(), TokenValueOrRef),
  card: z.record(z.string(), TokenValueOrRef),
  alert: z.record(z.string(), TokenValueOrRef),
});

export const ComponentsSchema = RequiredComponents.catchall(
  z.record(z.string(), TokenValueOrRef),
);

export type Components = z.infer<typeof ComponentsSchema>;

// ─── Motion ──────────────────────────────────────────────────────────────────

export const MotionSchema = z.object({
  duration: z.object({
    fast: CssValue,
    normal: CssValue,
    slow: CssValue,
  }),
  ease: z.object({
    standard: CssValue,
    in: CssValue,
    out: CssValue,
    'in-out': CssValue,
  }),
});

export type Motion = z.infer<typeof MotionSchema>;

// ─── Root ─────────────────────────────────────────────────────────────────────

export const DesignTokensSchema = z.object({
  colors: ColorsSchema,
  typography: TypographySchema,
  rounded: RoundedSchema,
  spacing: SpacingSchema,
  icons: IconsSchema,
  components: ComponentsSchema,
  motion: MotionSchema,
});

export type DesignTokens = z.infer<typeof DesignTokensSchema>;

export function parseDesignTokens(raw: unknown): DesignTokens {
  return DesignTokensSchema.parse(raw);
}

export function safeParseDesignTokens(raw: unknown) {
  return DesignTokensSchema.safeParse(raw);
}
