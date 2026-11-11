import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateReviewDto {
  @IsOptional()
  @IsIn([1, 2, 3, 4, 5])
  rating?: number;

  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Title must be at least 3 characters' })
  @MaxLength(150, { message: 'Title must be 150 characters or fewer' })
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(10, { message: 'Review must be at least 10 characters' })
  @MaxLength(2000, { message: 'Review must be 2000 characters or fewer' })
  description?: string;
}
