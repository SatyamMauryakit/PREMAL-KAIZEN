import { IsString, MaxLength } from 'class-validator';

export class UpdateOrderNotesDto {
  // Allowed empty (clearing notes) - @IsString() alone permits '' since class-validator
  // only rejects non-string values, matching the controller's existing
  // `!body.notes && body.notes !== ''` allow-empty check.
  @IsString()
  @MaxLength(2000)
  notes!: string;
}
