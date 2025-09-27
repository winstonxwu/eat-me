import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { Button } from '../components/Button';
import { Colors, Spacing } from '../constants';

export const HomeScreen = ({ navigation }) => {
  const handleGetStarted = () => {
    // Navigation logic will be added when navigation is set up
    console.log('Get Started pressed');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Welcome to Eat Me</Text>
        <Text style={styles.subtitle}>
          Your food discovery and sharing app
        </Text>
        <Text style={styles.description}>
          Discover amazing restaurants, share your favorite meals, and connect with fellow food lovers.
        </Text>
        
        <View style={styles.buttonContainer}>
          <Button
            title="Get Started"
            onPress={handleGetStarted}
            variant="primary"
            size="lg"
            style={styles.button}
          />
          <Button
            title="Learn More"
            onPress={() => console.log('Learn More pressed')}
            variant="secondary"
            size="md"
            style={styles.button}
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: 18,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  description: {
    fontSize: 16,
    color: Colors.textLight,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Spacing.xxl,
  },
  buttonContainer: {
    gap: Spacing.md,
  },
  button: {
    width: '100%',
  },
});
