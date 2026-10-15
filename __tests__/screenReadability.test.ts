import { StyleSheet } from 'react-native';
import { screenStyles } from '../src/design/useScreenStyles';
import { appearance } from '../src/design/platformAppearance';
function luminance(hex: string) {
  const values = hex.match(/\w\w/g)!.map(value => {
    const channel = parseInt(value, 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}
function contrast(first: string, second: string) {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
test.each(['light', 'dark'] as const)(
  '%s buttons have readable contrast and room for wrapped text',
  mode => {
    const theme = appearance[mode];
    const styles = screenStyles(
      StyleSheet.create({
        ctaButton: {
          height: 44 as number | undefined,
          minHeight: 0,
          borderRadius: 14,
        },
        ctaText: { color: '#111', fontSize: 15, lineHeight: 15 },
        secondaryButtonText: { color: '#fff', fontSize: 15 },
        shutterButton: { width: 68, height: 68 },
        boxLabelText: { color: '#fff', fontSize: 11 },
      }),
      theme,
    );
    expect(
      contrast(styles.ctaText.color!, theme.primary),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(styles.secondaryButtonText.color!, theme.cardBg),
    ).toBeGreaterThanOrEqual(4.5);
    expect(styles.ctaButton.height).toBeUndefined();
    expect(styles.ctaButton.minHeight).toBeGreaterThanOrEqual(48);
    expect(styles.ctaText.lineHeight).toBeGreaterThanOrEqual(23);
    expect(styles.shutterButton.height).toBe(68);
    expect(styles.boxLabelText.color).toBe('#fff');
  },
);
