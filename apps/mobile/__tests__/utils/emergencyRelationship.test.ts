/**
 * emergencyRelationship Utility Tests
 * Tests: relationship label mapping and contact prioritization
 */
import {
  EMERGENCY_RELATIONSHIP_OTHER,
  buildEmergencyRelationshipValue,
  getEmergencyRelationshipCustomValue,
  getEmergencyRelationshipSelectValue,
  isPresetEmergencyRelationship,
} from '../../utils/emergencyRelationship';

describe('emergencyRelationship utils', () => {
  it('detects preset relationships correctly', () => {
    expect(isPresetEmergencyRelationship('ญาติ')).toBe(true);
    expect(isPresetEmergencyRelationship('อสม.')).toBe(false);
  });

  it('maps preset relationship into select value directly', () => {
    expect(getEmergencyRelationshipSelectValue('ผู้ดูแล')).toBe('ผู้ดูแล');
  });

  it('maps custom relationship into other select value', () => {
    expect(getEmergencyRelationshipSelectValue('อสม.')).toBe(EMERGENCY_RELATIONSHIP_OTHER);
    expect(getEmergencyRelationshipCustomValue('อสม.')).toBe('อสม.');
  });

  it('builds final relationship from other + custom input', () => {
    expect(buildEmergencyRelationshipValue(EMERGENCY_RELATIONSHIP_OTHER, ' อสม. ')).toBe('อสม.');
  });
});
