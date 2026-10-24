import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { AD_REQUEST_OPTIONS, getAdsLib, unitId } from '../utils/ads';
import { colors } from '../theme';

/** Solo los pacientes del plan Gratuito ven anuncios (Premium y nutricionistas/admin, no). */
export function useShowAds() {
  const { profile } = useAuth();
  const { isPremium } = useApp();
  return profile?.role === 'USER' && !isPremium;
}

/** Banner adaptable de AdMob (tira fija). Si no carga, no ocupa lugar. */
export default function AdBanner({ style }) {
  const show = useShowAds();
  const [failed, setFailed] = useState(false);
  const g = getAdsLib();
  if (!show || !g || failed) return null;
  const { BannerAd, BannerAdSize } = g;
  return (
    <View style={[styles.wrap, style]} accessibilityLabel="Anuncio">
      <BannerAd
        unitId={unitId('banner')}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={AD_REQUEST_OPTIONS}
        onAdFailedToLoad={() => setFailed(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', backgroundColor: colors.bg },
});
