import { IsBoolean, IsIn, IsInt, IsISO8601, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const PLACEMENTS = ['hero', 'strip', 'sidebar'] as const;
const FONT_STYLES = ['display', 'sans'] as const;

// Relative paths and http(s) absolute URLs only - rejects javascript:/data:/vbscript:
// etc. schemes that could turn an admin-entered "button link" into stored XSS.
const SAFE_URL_PATTERN = /^(\/|https?:\/\/)/;
const SAFE_URL_MESSAGE = 'ctaUrl must be a relative path (starting with /) or an http(s):// URL';

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;
const HEX_COLOR_MESSAGE = 'textColor must be a 6-digit hex code, e.g. #FFFFFF';

export class CreateBannerDto {
  @IsIn(PLACEMENTS)
  placement!: (typeof PLACEMENTS)[number];

  @IsString()
  @MinLength(1)
  imageUrl!: string;

  @IsOptional()
  @IsString()
  mobileImageUrl?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subtitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  badgeText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  ctaText?: string;

  @IsOptional()
  @IsString()
  @Matches(SAFE_URL_PATTERN, { message: SAFE_URL_MESSAGE })
  ctaUrl?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_PATTERN, { message: HEX_COLOR_MESSAGE })
  textColor?: string;

  @IsOptional()
  @IsIn(FONT_STYLES)
  fontStyle?: (typeof FONT_STYLES)[number];

  @IsOptional()
  @IsInt()
  order?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsISO8601()
  startAt?: string;

  @IsOptional()
  @IsISO8601()
  endAt?: string;
}

export class UpdateBannerDto {
  @IsOptional()
  @IsIn(PLACEMENTS)
  placement?: (typeof PLACEMENTS)[number];

  @IsOptional()
  @IsString()
  @MinLength(1)
  imageUrl?: string;

  @IsOptional()
  @IsString()
  mobileImageUrl?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subtitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  badgeText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  ctaText?: string;

  @IsOptional()
  @IsString()
  @Matches(SAFE_URL_PATTERN, { message: SAFE_URL_MESSAGE })
  ctaUrl?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_PATTERN, { message: HEX_COLOR_MESSAGE })
  textColor?: string;

  @IsOptional()
  @IsIn(FONT_STYLES)
  fontStyle?: (typeof FONT_STYLES)[number];

  @IsOptional()
  @IsInt()
  order?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsISO8601()
  startAt?: string;

  @IsOptional()
  @IsISO8601()
  endAt?: string;
}
