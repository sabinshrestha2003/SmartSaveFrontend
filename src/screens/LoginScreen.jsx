import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
  Animated,
  StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth } from '../context/AuthContext'; 
import colors from '../styles/colors';

const { width } = Dimensions.get('window');

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth(); // Use login from AuthContext

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const logoAnim = useRef(new Animated.Value(0.8)).current;
  const buttonAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
      Animated.spring(logoAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleLogin = async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      Alert.alert('Missing Fields', 'Please fill in all required fields.');
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Invalid Password', 'Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    Animated.sequence([
      Animated.timing(buttonAnim, { toValue: 0.95, duration: 100, useNativeDriver: true }),
      Animated.timing(buttonAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();

    try {
      await login(trimmedEmail.toLowerCase(), password); // Use AuthContext login
      // No need to navigate manually; AppNavigator will handle it
    } catch (error) {
      Alert.alert('Error', 'Login failed. Please try again.');
      console.error('Login error in LoginScreen:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <LinearGradient colors={[colors.background, colors.incomeLight]} style={styles.gradientBackground}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Animated.View style={[styles.logoContainer, { opacity: fadeAnim, transform: [{ scale: logoAnim }] }]}>
            <Image source={require('../assets/icons/original.png')} style={styles.logo} resizeMode="contain" />
          </Animated.View>

          <Animated.View
            style={[styles.contentContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
          >
            <Text style={styles.title}>Welcome Back!</Text>
            <Text style={styles.subtitle}>Log in to continue managing your finances</Text>

            <View style={styles.formContainer}>
              <View style={styles.inputContainer}>
                <Icon name="mail-outline" size={20} color={colors.primaryGreen} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor={colors.mediumGray}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputContainer}>
                <Icon name="lock-closed-outline" size={20} color={colors.primaryGreen} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor={colors.mediumGray}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity style={styles.passwordToggle} onPress={() => setShowPassword(!showPassword)}>
                  <Icon
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.darkGray}
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.forgotPasswordContainer}
                onPress={() => navigation.navigate('ForgotPassword')}
              >
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>

              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primaryGreen} />
                </View>
              ) : (
                <Animated.View style={{ transform: [{ scale: buttonAnim }] }}>
                  <TouchableOpacity
                    style={[styles.button, (!email || !password) && styles.disabledButton]}
                    onPress={handleLogin}
                    disabled={loading || !email || !password}
                    activeOpacity={0.9}
                  >
                    <LinearGradient
                      colors={[colors.primaryGreen, colors.primaryGreenDark]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.buttonGradient}
                    >
                      <Text style={styles.buttonText}>Log In</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </Animated.View>
              )}
            </View>

            <View style={styles.footerContainer}>
              <Text style={styles.footerText}>
                Don't have an account?{' '}
                <Text style={styles.link} onPress={() => navigation.navigate('Signup')}>
                  Sign Up
                </Text>
              </Text>
            </View>
          </Animated.View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradientBackground: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logo: {
    width: 140,
    height: 120,
  },
  contentContainer: {
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primaryGreen,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.darkGray,
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  formContainer: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.incomeLight,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 55,
    backgroundColor: colors.incomeLight,
    borderRadius: 16,
    marginBottom: 16,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: colors.primaryGreen,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: '100%',
    color: colors.matteBlack,
    fontSize: 16,
  },
  passwordToggle: {
    padding: 8,
  },
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotPasswordText: {
    color: colors.primaryGreen,
    fontSize: 14,
    fontWeight: '500',
  },
  loadingContainer: {
    height: 55,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
  },
  button: {
    width: '100%',
    height: 55,
    borderRadius: 16,
    overflow: 'hidden',
    marginVertical: 10,
    shadowColor: colors.primaryGreenDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 16,
  },
  footerContainer: {
    marginTop: 30,
  },
  footerText: {
    fontSize: 14,
    color: colors.darkGray,
  },
  link: {
    color: colors.primaryGreen,
    fontWeight: '700',
  },
});

export default LoginScreen;