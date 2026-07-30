import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline, type LatLng } from 'react-native-maps';

import { Colors, Radius } from '@/constants/theme';
import type { GpsPoint } from '@/lib/store/types';

const EDGE_PADDING = { top: 28, right: 28, bottom: 28, left: 28 };

export interface RouteMapProps {
  route: GpsPoint[];
  height?: number;
  /** Allow panning and zooming. Off by default — most placements are read-only. */
  interactive?: boolean;
  /** Hide the start/end pins on small thumbnails where they'd swamp the line. */
  showEndpoints?: boolean;
}

/**
 * A recorded route over Apple Maps.
 *
 * `mutedStandard` + a forced dark interface is as close to the app's palette as
 * a real basemap gets: react-native-maps' `customMapStyle` is Google-only, and
 * Apple exposes no colour styling. The muted type exists precisely so an
 * overlay reads over it, which is what lets the lime line carry the card.
 */
export function RouteMap({ route, height = 220, interactive = false, showEndpoints = true }: RouteMapProps) {
  const mapRef = useRef<MapView>(null);
  const coordinates: LatLng[] = route.map((point) => ({ latitude: point.lat, longitude: point.lng }));
  if (coordinates.length < 2) return null;

  const start = coordinates[0];
  const end = coordinates[coordinates.length - 1];

  return (
    <MapView
      ref={mapRef}
      style={[styles.map, { height }]}
      mapType="mutedStandard"
      userInterfaceStyle="dark"
      scrollEnabled={interactive}
      zoomEnabled={interactive}
      pitchEnabled={false}
      rotateEnabled={false}
      toolbarEnabled={false}
      // Fitting on ready rather than passing a region keeps the whole route in
      // frame regardless of how far it wandered.
      onMapReady={() => mapRef.current?.fitToCoordinates(coordinates, { edgePadding: EDGE_PADDING, animated: false })}>
      <Polyline coordinates={coordinates} strokeColor={Colors.primary} strokeWidth={4} lineCap="round" lineJoin="round" />
      {showEndpoints ? (
        <>
          {/* Hollow ring where you set off, solid where you stopped. */}
          <Marker coordinate={start} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={[styles.dot, styles.dotHollow]} />
          </Marker>
          <Marker coordinate={end} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={[styles.dot, styles.dotFilled]} />
          </Marker>
        </>
      ) : null}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    width: '100%',
    borderRadius: Radius.lg,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: Radius.full,
    borderWidth: 3,
    borderColor: Colors.primary,
  },
  dotFilled: {
    backgroundColor: Colors.primary,
  },
  dotHollow: {
    backgroundColor: Colors.background,
  },
});
