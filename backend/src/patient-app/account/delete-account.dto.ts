import { Equals } from 'class-validator';

/** The literal word is the second confirmation (the app also makes the user type it). */
export class DeleteAccountDto {
  @Equals('DELETE')
  confirm: 'DELETE';
}
