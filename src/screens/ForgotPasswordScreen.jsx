import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
  Animated,
  StatusBar,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import colors from '../styles/colors';
import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');

const ForgotPasswordScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { sendResetOTP, resetPassword } = useAuth();

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const buttonAnim = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start();
  }, []);

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const validatePassword = (password) => {
    const strongPasswordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
    return strongPasswordRegex.test(password);
  };

  const handleSendOTP = async () => {
    const trimmedEmail = email.trim();
    if (!validateEmail(trimmedEmail)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    setOtpLoading(true);
    try {
      const success = await sendResetOTP(trimmedEmail);
      if (success) {
        setOtpSent(true);
        Alert.alert('Success', 'OTP sent to your email.');
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Unable to send OTP. Please try again.');
      console.error('Send OTP Error:', error);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const trimmedEmail = email.trim();
    const trimmedOtpCode = otpCode.trim();
    const trimmedNewPassword = newPassword.trim();

    if (!trimmedEmail) {
      Alert.alert('Missing Email', 'Please enter your email.');
      return;
    }
    if (!validateEmail(trimmedEmail)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    if (!trimmedOtpCode) {
      Alert.alert('Missing OTP', 'Please enter the OTP.');
      return;
    }
    if (!trimmedNewPassword) {
      Alert.alert('Missing Password', 'Please enter a new password.');
      return;
    }
    if (!validatePassword(trimmedNewPassword)) {
      Alert.alert(
        'Invalid Password',
        'Password must be at least 8 characters long, contain an uppercase letter, and a number.'
      );
      return;
    }
    if (trimmedNewPassword !== confirmPassword.trim()) {
      Alert.alert('Password Mismatch', 'Passwords do not match.');
      return;
    }
    if (!otpSent) {
      Alert.alert('OTP Required', 'Please send OTP first.');
      return;
    }

    setLoading(true);
    Animated.sequence([
      Animated.timing(buttonAnim, { toValue: 0.95, duration: 100, useNativeDriver: true }),
      Animated.timing(buttonAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();

    try {
      await resetPassword(trimmedEmail, trimmedOtpCode, trimmedNewPassword);
      Alert.alert('Success', 'Password reset successfully. Please log in.');
      navigation.navigate('Login');
    } catch (error) {
      Alert.alert('Error', error.message || 'Unable to reset password. Please try again.');
      console.error('Reset Password Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <LinearGradient colors={[colors.background, colors.incomeLight]} style={styles.gradientBackground}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Animated.View
            style={[styles.contentContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
          >
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>Enter your email to receive an OTP and set a new password</Text>

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
                  accessibilityLabel="Email Input"
                />
              </View>

              {otpSent && (
                <>
                  <View style={styles.inputContainer}>
                    <Icon name="key-outline" size={20} color={colors.primaryGreen} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter OTP"
                      placeholderTextColor={colors.mediumGray}
                      value={otpCode}
                      onChangeText={setOtpCode}
                      keyboardType="numeric"
                      maxLength={6}
                      accessibilityLabel="OTP Input"
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Icon name="lock-closed-outline" size={20} color={colors.primaryGreen} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="New Password"
                      placeholderTextColor={colors.mediumGray}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry={!showPassword}
                      accessibilityLabel="New Password Input"
                    />
                    <TouchableOpacity style={styles.passwordToggle} onPress={() => setShowPassword(!showPassword)}>
                      <Icon
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color={colors.darkGray}
                      />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.inputContainer}>
                    <Icon name="lock-closed-outline" size={20} color={colors.primaryGreen} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Confirm Password"
                      placeholderTextColor={colors.mediumGray}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showConfirmPassword}
                      accessibilityLabel="Confirm Password Input"
                    />
                    <TouchableOpacity
                      style={styles.passwordToggle}
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      <Icon
                        name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color={colors.darkGray}
                      />
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {otpLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primaryGreen} />
                </View>
              ) : (
                !otpSent && (
                  <Animated.View style={{ transform: [{ scale: buttonAnim }] }}>
                    <TouchableOpacity
                      style={[styles.button, !email && styles.disabledButton]}
                      onPress={handleSendOTP}
                      disabled={!email}
                      activeOpacity={0.9}
                      accessibilityLabel="Send OTP Button"
                    >
                      <LinearGradient
                        colors={[colors.primaryGreen, colors.primaryGreenDark]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.buttonGradient}
                      >
                        <Text style={styles.buttonText}>Send OTP</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </Animated.View>
                )
              )}

              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primaryGreen} />
                </View>
              ) : (
                otpSent && (
                  <Animated.View style={{ transform: [{ scale: buttonAnim }] }}>
                    <TouchableOpacity
                      style={[
                        styles.button,
                        (!email || !otpCode || !newPassword || !confirmPassword) && styles.disabledButton,
                      ]}
                      onPress={handleResetPassword}
                      disabled={!email || !otpCode || !newPassword || !confirmPassword}
                      activeOpacity={0.9}
                      accessibilityLabel="Reset Password Button"
                    >
                      <LinearGradient
                        colors={[colors.primaryGreen, colors.primaryGreenDark]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.buttonGradient}
                      >
                        <Text style={styles.buttonText}>Reset Password</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </Animated.View>
                )
              )}
            </View>

            <View style={styles.footerContainer}>
              <Text style={styles.footerText}>
                Back to{' '}
                <Text
                  style={styles.link}
                  onPress={() => navigation.navigate('Login')}
                  accessibilityLabel="Navigate to Login"
                >
                  Log In
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

export default ForgotPasswordScreen;