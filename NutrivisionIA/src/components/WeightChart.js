import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import { colors } from '../theme';

const HEIGHT = 170;
const PAD = { top: 14, right: 12, bottom: 24, left: 38 };
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const fmtKg = (v) => `${Number(v).toLocaleString('es-AR', { maximumFractionDigits: 1 })} kg`;
const fmtDate = (iso) => {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

/**
 * Evolución de peso: una sola serie, área + línea con marcadores.
 * Tocá un punto para ver el valor exacto y la fecha.
 * `logs`: [{ weightKg, loggedAt }] ordenados por fecha (GET /history/summary → weightHistory).
 */
export default function WeightChart({ logs }) {
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState(null);

  const points = logs.filter((l) => l.weightKg != null);
  const active = selected != null && points[selected] ? selected : points.length - 1;

  const values = points.map((p) => p.weightKg);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (max - min < 2) { min -= 1; max += 1; }
  const span = max - min;

  const innerW = Math.max(width - PAD.left - PAD.right, 1);
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i) => PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v) => PAD.top + (1 - (v - min) / span) * innerH;

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.weightKg).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(1)},${PAD.top + innerH} L${x(0).toFixed(1)},${PAD.top + innerH} Z`;
  const ticks = [max, (max + min) / 2, min];

  const cur = points[active];

  return (
    <View>
      {cur ? (
        <Text style={styles.readout}>
          <Text style={styles.readoutValue}>{fmtKg(cur.weightKg)}</Text>
          <Text style={styles.readoutDate}>  ·  {fmtDate(cur.loggedAt)}</Text>
        </Text>
      ) : null}

      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height: HEIGHT }}>
        {width > 0 ? (
          <>
            <Svg width={width} height={HEIGHT}>
              <Defs>
                <LinearGradient id="wfill" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={colors.primary} stopOpacity="0.22" />
                  <Stop offset="1" stopColor={colors.primary} stopOpacity="0" />
                </LinearGradient>
              </Defs>

              {ticks.map((t) => (
                <Line key={t} x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={colors.line} strokeWidth={1} strokeDasharray="3 4" />
              ))}
              {ticks.map((t) => (
                <SvgText key={`l${t}`} x={PAD.left - 6} y={y(t) + 4} fontSize={10} fill={colors.inkMuted} textAnchor="end">
                  {Math.round(t)}
                </SvgText>
              ))}

              {points.length > 1 ? <Path d={area} fill="url(#wfill)" /> : null}
              {points.length > 1 ? (
                <Path d={line} stroke={colors.primary} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
              ) : null}

              {cur ? (
                <Line x1={x(active)} x2={x(active)} y1={PAD.top} y2={PAD.top + innerH} stroke={colors.inkMuted} strokeWidth={1} strokeOpacity={0.4} />
              ) : null}

              {points.map((p, i) => (
                <Circle
                  key={p.id ?? i}
                  cx={x(i)} cy={y(p.weightKg)}
                  r={i === active ? 6 : 4}
                  fill={colors.primary}
                  stroke={colors.surface}
                  strokeWidth={2}
                />
              ))}

              <SvgText x={x(0)} y={HEIGHT - 6} fontSize={10} fill={colors.inkMuted} textAnchor={points.length === 1 ? 'middle' : 'start'}>
                {fmtDate(points[0].loggedAt)}
              </SvgText>
              {points.length > 1 ? (
                <SvgText x={x(points.length - 1)} y={HEIGHT - 6} fontSize={10} fill={colors.inkMuted} textAnchor="end">
                  {fmtDate(points[points.length - 1].loggedAt)}
                </SvgText>
              ) : null}
            </Svg>

            {/* Zonas táctiles más grandes que el punto */}
            {points.map((p, i) => {
              const w = points.length === 1 ? innerW : innerW / (points.length - 1);
              return (
                <Pressable
                  key={`hit${p.id ?? i}`}
                  onPress={() => setSelected(i)}
                  accessibilityLabel={`${fmtKg(p.weightKg)} el ${fmtDate(p.loggedAt)}`}
                  style={{ position: 'absolute', top: 0, height: HEIGHT, left: x(i) - w / 2, width: w }}
                />
              );
            })}
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { marginBottom: 6 },
  readoutValue: { fontSize: 18, fontWeight: '800', color: colors.ink },
  readoutDate: { fontSize: 13, color: colors.inkSoft },
});
