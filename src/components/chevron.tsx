import Svg, { Path } from 'react-native-svg';

export function Chevron({ color = '#ccc' }: { color?: string }) {
  return (
    <Svg width={8} height={14} viewBox="0 0 8 14">
      <Path
        d="M1 1l6 6-6 6"
        stroke={color}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
