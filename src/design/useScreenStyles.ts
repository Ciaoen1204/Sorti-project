import { useMemo } from 'react';
import {
  StyleSheet,
  type ViewStyle,
  type TextStyle,
  type ImageStyle,
} from 'react-native';
import type { Theme } from '../context/ThemeContext';

type NativeStyle = ViewStyle & TextStyle & ImageStyle;

/** Shared visual rules; preserve image geometry, camera controls and detection overlays. */
export function screenStyles<T extends StyleSheet.NamedStyles<T>>(
  base: T,
  theme: Theme,
): T {
  const result: Record<string, NativeStyle> = {};
  for (const [name, source] of Object.entries(base)) {
    const style = { ...StyleSheet.flatten(source as NativeStyle) };
    const media =
      /camera|fullscreen|shutter|scrim|overlay|boxLabel|resultBadge|handle|roomImg|backgroundImage/i.test(
        name,
      );
    const primaryText =
      /(?:Btn|Button|cta|pay|submit|confirm|start|send|activeTag|activeFilter).*Text$/i.test(
        name,
      ) && !/secondary|back|close|disabled|delete/i.test(name);
    if (!media) {
      if (
        typeof style.borderRadius === 'number' &&
        style.borderRadius > 16 &&
        !(style.width === style.height && typeof style.width === 'number')
      ) {
        style.borderRadius = 16;
      }
      if (style.fontSize && !/value|price|count|score/i.test(name)) {
        style.fontSize = Math.min(24, Math.max(12, style.fontSize));
        if (style.lineHeight && style.lineHeight > 34) {
          style.lineHeight = 32;
        }
      }
      if (style.fontSize) {
        style.lineHeight = Math.max(
          style.lineHeight || 0,
          Math.ceil(style.fontSize * 1.5),
        );
      }
      const textButton =
        /button|btn|cta|submit|confirm|pay/i.test(name) &&
        !/text|icon|shutter|avatar|circle|fab|back|close|handle|input/i.test(
          name,
        ) &&
        !(typeof style.width === 'number' && style.width === style.height);
      if (textButton) {
        style.minHeight = Math.max(
          typeof style.minHeight === 'number' ? style.minHeight : 0,
          typeof style.height === 'number' ? style.height : 0,
          48,
        );
        delete style.height;
        style.paddingVertical = Math.max(
          typeof style.paddingVertical === 'number' ? style.paddingVertical : 0,
          12,
        );
        style.paddingHorizontal = Math.max(
          typeof style.paddingHorizontal === 'number'
            ? style.paddingHorizontal
            : 0,
          12,
        );
      }
      if (
        /Text$/i.test(name) &&
        /button|btn|cta|submit|confirm|pay/i.test(name)
      ) {
        style.textAlign = 'center';
        style.flexShrink = 1;
      }
      if (/headerTitle|cardLink/i.test(name)) style.flexShrink = 1;
      if (/disabled/i.test(name) && typeof style.opacity === 'number') {
        style.opacity = Math.max(style.opacity, 0.75);
      }
      if (
        /footer|bottomBar|searchBar|^input$|inputBox|inputWrapper|inputContainer|header$/i.test(
          name,
        ) &&
        typeof style.height === 'number' &&
        style.height >= 40 &&
        style.height <= 100
      ) {
        style.minHeight = Math.max(
          typeof style.minHeight === 'number' ? style.minHeight : 0,
          style.height,
        );
        delete style.height;
      }
      if (style.fontWeight === '800' || style.fontWeight === '900') {
        style.fontWeight = '600';
      }
      if (style.shadowOpacity !== undefined) {
        style.shadowOpacity = 0;
      }
      if (style.elevation !== undefined) {
        style.elevation = 0;
      }
      if (
        style.backgroundColor &&
        /^#(?:fff(?:fff)?|fdfcf0|f5f5f5|f2f2f2|FFFDF2)$/i.test(
          String(style.backgroundColor),
        )
      ) {
        style.backgroundColor = /track|loading|placeholder/i.test(name)
          ? theme.background
          : theme.cardBg;
      }
      if (
        style.color &&
        /^#(?:111(?:111)?|333(?:333)?|2f2a26|1f1f1f|000(?:000)?)$/i.test(
          String(style.color),
        )
      ) {
        style.color = theme.textMain;
      }
      if (
        style.color &&
        /^#(?:555|888|a89d9d|8b7e6f|6d665c|5e5e5e|c99e93)$/i.test(
          String(style.color),
        )
      ) {
        style.color = theme.textSub;
      }
      if (
        style.borderColor &&
        /^#(?:ddd|e7dfd0|eadecc|e8e8e8)$/i.test(String(style.borderColor))
      ) {
        style.borderColor = theme.border;
      }
      if (/Card$|^card$/.test(name) && !/empty|logout/.test(name)) {
        style.borderWidth = 1;
        style.borderColor = theme.border;
      }
      if (/headerTitle|^title$|qNumber|formTitle/.test(name)) {
        style.fontSize = 20;
        style.fontWeight = '600';
      }
      if (primaryText || name === 'segmentActiveText') {
        style.color = theme.onPrimary;
      }
      if (/secondary.*Text/i.test(name)) {
        style.color = theme.textMain;
      }
      if (/userBubble|buyerBubble/.test(name)) {
        style.backgroundColor = theme.primary;
      }
      if (/aiBubble|sellerBubble/.test(name)) {
        style.backgroundColor = theme.cardBg;
        style.borderColor = theme.border;
      }
      if (/loadingBubble/.test(name)) {
        style.backgroundColor = theme.primarySoft;
      }
      if (/userTime|buyerTime/.test(name)) {
        style.color = theme.onPrimary;
      }
    }
    result[name] = style;
  }
  return StyleSheet.create(result) as T;
}

export function useScreenStyles<T extends StyleSheet.NamedStyles<T>>(
  base: T,
  theme: Theme,
): T {
  return useMemo(() => screenStyles(base, theme), [base, theme]);
}
