import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  StatusBar,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';

import Logo from '../assets/icons/logo.png';
import colors from '../styles/colors';

const { width } = Dimensions.get('window');

const OnboardingScreen = () => {
  const navigation = useNavigation();

  const handleGetStarted = async () => {
    await AsyncStorage.setItem('hasSeenOnboarding', 'true');
    navigation.replace('Login');
  };

  const handleSignIn = () => {
    navigation.navigate('Login');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      {/* Decorative elements */}
      <View style={[styles.decorCircle1, { backgroundColor: colors.primaryGreenLight }]} />
      <View style={[styles.decorCircle2, { backgroundColor: colors.primaryLight }]} />

      <View style={styles.contentContainer}>
        <Image source={Logo} style={styles.logo} resizeMode="contain" />

        <Text style={styles.title}>Welcome to SmartSave!</Text>
        <Text style={styles.subtitle}>
          Track your finances. Split your bills. Reach your goals — together.
        </Text>

        <View style={styles.featuresContainer}>
          <View style={styles.featureItem}>
            <View style={[styles.featureIconContainer, { backgroundColor: colors.primaryGreenLight }]}>
              <Text style={styles.featureIcon}>📊</Text>
            </View>
            <Text style={styles.featureText}>Stay on top of your spending with real-time insights</Text>
          </View>

          <View style={styles.featureItem}>
            <View style={[styles.featureIconContainer, { backgroundColor: colors.tealLight }]}>
              <Text style={styles.featureIcon}>💸</Text>
            </View>
            <Text style={styles.featureText}>Split bills fairly with friends and groups</Text>
          </View>

          <View style={styles.featureItem}>
            <View style={[styles.featureIconContainer, { backgroundColor: colors.goldLight }]}>
              <Text style={styles.featureIcon}>🎯</Text>
            </View>
            <Text style={styles.featureText}>Set savings goals and track your progress</Text>
          </View>

          <View style={styles.featureItem}>
            <View style={[styles.featureIconContainer, { backgroundColor: colors.incomeLight }]}>
              <Text style={styles.featureIcon}>📂</Text>
            </View>
            <Text style={styles.featureText}>All your transactions in one easy-to-use app</Text>
          </View>
        </View>

        <TouchableOpacity activeOpacity={0.8} onPress={handleGetStarted}>
          <LinearGradient
            colors={[colors.primaryGreen, colors.primaryGreenDark]}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 0}}
            style={styles.button}
          >
            <Text style={styles.buttonText}>Get Started</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipButton} onPress={handleSignIn}>
          <Text style={styles.skipText}>
            Already have an account? <Text style={styles.signInText}>Sign in</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    position: 'relative',
    overflow: 'hidden',
  },
  decorCircle1: {
    position: 'absolute',
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: width * 0.4,
    top: -width * 0.4,
    right: -width * 0.2,
  },
  decorCircle2: {
    position: 'absolute',
    width: width * 0.6,
    height: width * 0.6,
    borderRadius: width * 0.3,
    bottom: -width * 0.2,
    left: -width * 0.2,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
    maxWidth: '90%',
  },
  featuresContainer: {
    width: '100%',
    marginBottom: 40,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  featureIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  featureIcon: {
    fontSize: 18,
  },
  featureText: {
    fontSize: 15,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 22,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 12,
    elevation: 4,
    shadowColor: colors.primaryGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    width: width - 48,
    alignItems: 'center',
  },
  buttonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  skipButton: {
    marginTop: 20,
    padding: 8,
  },
  skipText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  signInText: {
    color: colors.primaryGreen,
    fontWeight: '600',
  },
});

export default OnboardingScreen;