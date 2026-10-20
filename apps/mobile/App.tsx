import { StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { greet } from '@cook/core';

export default function App() {
  const greeting = greet('bạn');

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Trợ lý nấu ăn</Text>
      <Text style={styles.subtitle}>Cooking Assistant MVP</Text>
      <Text style={styles.badge}>{greeting}</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 24,
  },
  badge: {
    fontSize: 14,
    color: '#10b981',
    backgroundColor: '#064e3b',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
});
