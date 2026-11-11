import { IsIn, IsInt, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * A real class-validator DTO (not a plain `any` body) - the global ValidationPipe
 * in main.ts has been a no-op against every existing endpoint (see
 * validation-pipe.spec.ts) precisely because none of them used one yet. This is
 * the endpoint that most needs it: public, user-authored content, security-
 * sensitive. `productId`/`orderItemId` are only used to look up records that are
 * then cross-checked server-side (ownership, delivery status) - never trusted as
 * the final word on eligibility by themselves.
 */
export class CreateReviewDto {
  @IsString()
  productId!: string;

  @IsString()
  orderItemId!: string;

  @IsIn([1, 2, 3, 4, 5])
  rating!: number;

  @IsString()
  @MinLength(3, { message: 'Title must be at least 3 characters' })
  @MaxLength(150, { message: 'Title must be 150 characters or fewer' })
  title!: string;

  @IsString()
  @MinLength(10, { message: 'Review must be at least 10 characters' })
  @MaxLength(2000, { message: 'Review must be 2000 characters or fewer' })
  description!: string;
}
