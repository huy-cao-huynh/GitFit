import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { buildDiagramUrl, pickView, type MuscleView } from '@/lib/anatome/layers';
import { getMuscleDiagramSvg } from '@/lib/anatome/client';
import { Colors, Radius } from '@/constants/theme';

export type MuscleDiagramSize = 'compact' | 'default' | 'large';

/** width/height per size — compact for the workout-session headers, default for the dashboard card, large/dual for the finished-session summary. */
const DIMENSIONS: Record<MuscleDiagramSize, { width: number; height: number }> = {
  compact: { width: 64, height: 84 },
  default: { width: 96, height: 128 },
  large: { width: 220, height: 148 },
};

interface MuscleDiagramProps {
  primary: string[];
  secondary: string[];
  view?: MuscleView;
  size?: MuscleDiagramSize;
}

/** Renders an Anatome muscle-highlight SVG in the app's lime/grey palette. Decorative — renders nothing if there's nothing to draw or the fetch fails. */
export function MuscleDiagram({ primary, secondary, view, size = 'default' }: MuscleDiagramProps) {
  const [svg, setSvg] = useState<string | null>(null);
  const dimensions = DIMENSIONS[size];
  const hasSlugs = primary.length > 0 || secondary.length > 0;
  const primaryKey = primary.join(',');
  const secondaryKey = secondary.join(',');

  useEffect(() => {
    if (!hasSlugs) return;
    const layers = { primary: primaryKey ? primaryKey.split(',') : [], secondary: secondaryKey ? secondaryKey.split(',') : [] };
    const url = buildDiagramUrl(layers, {
      view: view ?? pickView(layers),
      width: dimensions.width * 3,
      height: dimensions.height * 3,
    });
    const controller = new AbortController();
    getMuscleDiagramSvg(url, controller.signal)
      .then((result) => setSvg(result))
      .catch(() => setSvg(null));
    return () => controller.abort();
  }, [hasSlugs, primaryKey, secondaryKey, view, dimensions.width, dimensions.height]);

  if (!hasSlugs) return null;

  if (!svg) {
    return <View style={[styles.placeholder, { width: dimensions.width, height: dimensions.height }]} />;
  }

  return (
    <View style={{ width: dimensions.width, height: dimensions.height }}>
      <SvgXml xml={svg} width={dimensions.width} height={dimensions.height} />
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
  },
});
