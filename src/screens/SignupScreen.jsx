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
  Modal,
  FlatList,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import colors from '../styles/colors';
import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');

const SignupScreen = ({ navigation }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [profession, setProfession] = useState('');
  const [customProfession, setCustomProfession] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const { signup, sendOTP } = useAuth();

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

  const validationMessages = {
    nameEmpty: 'Name cannot be empty.',
    invalidEmail: 'Please enter a valid email address.',
    professionEmpty: 'Please select or enter a profession.',
    shortPassword: 'Password must be at least 6 characters long.',
    passwordMismatch: 'Passwords do not match.',
    otpEmpty: 'Please enter the OTP.',
    networkError: 'Unable to connect to the server. Please check your network.',
  };

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const majorProfessions = [
    'Software Engineer',
    'Doctor',
    'Teacher',
    'Accountant',
    'Lawyer',
    'Nurse',
    'Engineer',
    'Marketing Manager',
    'Graphic Designer',
    'Data Scientist',
    'Entrepreneur',
    'Chef',
    'Architect',
    'Others',
  ];

  const handleSendOTP = async () => {
    const trimmedEmail = email.trim();
    if (!validateEmail(trimmedEmail)) {
      Alert.alert('Invalid Email', validationMessages.invalidEmail);
      return;
    }

    setOtpLoading(true);
    try {
      const success = await sendOTP(trimmedEmail);
      if (success) {
        setOtpSent(true);
        Alert.alert('Success', 'OTP sent to your email.');
      }
    } catch (error) {
      console.error('Send OTP Error:', error);
      Alert.alert('Error', validationMessages.networkError);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleProfessionSelect = (selectedProfession) => {
    setProfession(selectedProfession);
    if (selectedProfession !== 'Others') {
      setCustomProfession('');
    }
    setModalVisible(false);
  };

  const handleSignup = async () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const finalProfession = profession === 'Others' ? customProfession.trim() : profession;
    const trimmedOtpCode = otpCode.trim();

    if (!trimmedName) {
      Alert.alert('Invalid Name', validationMessages.nameEmpty);
      return;
    }
    if (!validateEmail(trimmedEmail)) {
      Alert.alert('Invalid Email', validationMessages.invalidEmail);
      return;
    }
    if (!finalProfession) {
      Alert.alert('Invalid Profession', validationMessages.professionEmpty);
      return;
    }
    if (password.length < 6) {
      Alert.alert('Invalid Password', validationMessages.shortPassword);
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Password Mismatch', validationMessages.passwordMismatch);
      return;
    }
    if (!trimmedOtpCode) {
      Alert.alert('Invalid OTP', validationMessages.otpEmpty);
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
      await signup(trimmedName, trimmedEmail, finalProfession, password, trimmedOtpCode);
      navigation.navigate('Tabs');
    } catch (error) {
      console.error('Signup Error:', error);
      Alert.alert('Error', error.message || validationMessages.networkError);
    } finally {
      setLoading(false);
    }
  };

  const renderProfessionItem = ({ item }) => (
    <TouchableOpacity
      style={styles.professionItem}
      onPress={() => handleProfessionSelect(item)}
    >
      <Text style={styles.professionText}>{item}</Text>
    </TouchableOpacity>
  );

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
            <Text style={styles.title}>Join SmartSave</Text>
            <Text style={styles.subtitle}>Create your account and start saving smartly</Text>

            <View style={styles.formContainer}>
              <View style={styles.inputContainer}>
                <Icon name="person-outline" size={20} color={colors.primaryGreen} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Full Name"
                  placeholderTextColor={colors.mediumGray}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  accessibilityLabel="Full Name Input"
                />
              </View>

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
                  accessibilityLabel="Email Input"
                />
              </View>

              {otpSent && (
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
              )}

              <TouchableOpacity
                style={styles.inputContainer}
                onPress={() => setModalVisible(true)}
                accessibilityLabel="Profession Selector"
              >
                <Icon name="briefcase-outline" size={20} color={colors.primaryGreen} style={styles.inputIcon} />
                <View style={styles.professionTextContainer}>
                  <Text
                    style={[
                      styles.professionText,
                      profession ? styles.professionSelected : styles.professionPlaceholder,
                    ]}
                    numberOfLines={1}
                  >
                    {profession || 'Select Profession'}
                  </Text>
                </View>
                <Icon name="chevron-down-outline" size={20} color={colors.darkGray} style={styles.dropdownIcon} />
              </TouchableOpacity>

              {profession === 'Others' && (
                <View style={styles.inputContainer}>
                  <Icon name="briefcase-outline" size={20} color={colors.primaryGreen} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your profession"
                    placeholderTextColor={colors.mediumGray}
                    value={customProfession}
                    onChangeText={setCustomProfession}
                    accessibilityLabel="Custom Profession Input"
                  />
                </View>
              )}

              <View style={styles.inputContainer}>
                <Icon name="lock-closed-outline" size={20} color={colors.primaryGreen} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor={colors.mediumGray}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  accessibilityLabel="Password Input"
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
                        (!name || !email || !profession || !password || !confirmPassword || !otpCode) &&
                          styles.disabledButton,
                      ]}
                      onPress={handleSignup}
                      disabled={!name || !email || !profession || !password || !confirmPassword || !otpCode}
                      activeOpacity={0.9}
                      accessibilityLabel="Sign Up Button"
                    >
                      <LinearGradient
                        colors={[colors.primaryGreen, colors.primaryGreenDark]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.buttonGradient}
                      >
                        <Text style={styles.buttonText}>Sign Up</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </Animated.View>
                )
              )}
            </View>

            <View style={styles.footerContainer}>
              <Text style={styles.footerText}>
                Already have an account?{' '}
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

      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Profession</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Icon name="close-outline" size={24} color={colors.darkGray} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={majorProfessions}
              renderItem={renderProfessionItem}
              keyExtractor={(item) => item}
              style={styles.professionList}
            />
          </View>
        </View>
      </Modal>
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
  professionTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  professionText: {
    fontSize: 16,
    lineHeight: 20,
  },
  professionPlaceholder: {
    color: colors.mediumGray,
  },
  professionSelected: {
    color: colors.matteBlack,
  },
  dropdownIcon: {
    marginLeft: 10,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '80%',
    maxHeight: '60%',
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.matteBlack,
  },
  professionList: {
    flexGrow: 0,
  },
  professionItem: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.incomeLight,
  },
  professionText: {
    fontSize: 16,
    color: colors.matteBlack,
  },
});

export default SignupScreen;