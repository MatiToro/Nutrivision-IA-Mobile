import { Alert, Platform } from 'react-native';

/** Confirmación simple que funciona en Android (Alert) y en la vista web (window.confirm). */
export function confirm({ title, message, confirmLabel = 'Eliminar', onConfirm }) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
