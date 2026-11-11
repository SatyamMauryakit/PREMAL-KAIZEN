import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ModerateReviewDto {
  @IsIn(['approved', 'rejected'])
  status!: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  moderationNote?: string;
}
