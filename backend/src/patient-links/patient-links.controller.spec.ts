import 'reflect-metadata';
import { REQUIRE_FEATURE_KEY } from 'src/common/decorators/require-feature.decorator';
import { PatientLinksController } from './patient-links.controller';

const proto = PatientLinksController.prototype;
const featureOf = (fn: unknown) =>
  Reflect.getMetadata(REQUIRE_FEATURE_KEY, fn as object) as string | undefined;

describe('PatientLinksController feature gating (audit M3)', () => {
  it('a clinic can revoke a link even with patient_app switched off', () => {
    expect(featureOf(proto.revoke)).toBeUndefined();
  });

  it('creating a claim token and reading status still need patient_app', () => {
    expect(featureOf(proto.createClaimToken)).toBe('patient_app');
    expect(featureOf(proto.status)).toBe('patient_app');
  });
});
