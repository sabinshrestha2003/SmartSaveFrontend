import React, { useState, useContext, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Easing,
  StatusBar,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SavingsContext } from '../context/SavingsContext';
import colors from '../styles/colors';
import moment from 'moment';
import { Target, DollarSign, Calendar, ArrowLeft } from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import { displayNotification } from '../utils/notifications';

const AddGoalScreen = ({ navigation }) => {
  const { addSavingsGoal } = useContext(SavingsContext);

  const [goalInput, setGoalInput] = useState({
    name: '',
    target: '',
    deadline: new Date(),
  });

  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const saveButtonAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleInputChange = (field, value) => {
    setGoalInput(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveGoal = async () => {
    const { name, target, deadline } = goalInput;

    if (!name.trim() || !target.trim() || !deadline) {
      Alert.alert('Missing Information', 'Please fill out all fields before saving.');
      return;
    }

    const parsedTarget = parseFloat(target);
    if (isNaN(parsedTarget) || parsedTarget <= 0) {
      Alert.alert('Invalid Target', 'Please enter a valid positive number for the target amount.');
      return;
    }

    if (new Date(deadline) < new Date()) {
      Alert.alert('Invalid Deadline', 'The deadline cannot be in the past.');
      return;
    }

    setLoading(true);
    Animated.sequence([
      Animated.timing(saveButtonAnim, { toValue: 0.95, duration: 100, useNativeDriver: true }),
      Animated.timing(saveButtonAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();

    try {
      await addSavingsGoal({
        name: name.trim(),
        target: parsedTarget,
        deadline: new Date(deadline),
        progress: 0,
      });
      await displayNotification(
        'New Savings Goal Added',
        `You created a goal for "${name.trim()}" with a target of $${parsedTarget.toFixed(2)}.`,
        { screen: 'SavingsScreen' }
      );
      Alert.alert('Success', 'Your savings goal has been added successfully!');
      navigation.goBack();
    } catch (error) {
      console.error('Error adding goal:', error);
      Alert.alert('Error', 'Failed to add goal. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackPress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.98, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start(() => navigation.goBack());
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBackPress}
          disabled={loading}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={[colors.accentPurple, colors.accentPurpleDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.backButtonGradient}
          >
            <ArrowLeft color={colors.white} size={24} />
          </LinearGradient>
        </TouchableOpacity>
        <Text style={styles.headerText}>Create New Goal</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Animated.View
          style={[
            styles.cardContainer,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }, { scale: scaleAnim }] },
          ]}
        >
          <View style={styles.card}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Goal Name</Text>
              <View style={styles.inputContainer}>
                <Target color={colors.accentPurple} size={20} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="What are you saving for?"
                  placeholderTextColor={colors.mediumGray}
                  value={goalInput.name}
                  onChangeText={text => handleInputChange('name', text)}
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Target Amount</Text>
              <View style={styles.inputContainer}>
                <DollarSign color={colors.accentPurple} size={20} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="How much do you need?"
                  placeholderTextColor={colors.mediumGray}
                  keyboardType="numeric"
                  value={goalInput.target}
                  onChangeText={text => handleInputChange('target', text)}
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Target Date</Text>
              <TouchableOpacity
                style={styles.inputContainer}
                onPress={() => setShowDatePicker(true)}
              >
                <Calendar color={colors.accentPurple} size={20} style={styles.inputIcon} />
                <Text style={styles.inputText}>
                  {goalInput.deadline ? moment(goalInput.deadline).format('MMMM Do, YYYY') : 'Select Deadline'}
                </Text>
              </TouchableOpacity>
            </View>

            {showDatePicker && (
              <DateTimePicker
                value={goalInput.deadline || new Date()}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowDatePicker(Platform.OS === 'ios');
                  if (selectedDate) {
                    handleInputChange('deadline', selectedDate);
                  }
                }}
                minimumDate={new Date()}
              />
            )}
          </View>

          <View style={styles.buttonContainer}>
            <Animated.View style={{ transform: [{ scale: saveButtonAnim }] }}>
              <TouchableOpacity
                style={[styles.saveButton, loading && { opacity: 0.6 }]}
                onPress={handleSaveGoal}
                disabled={loading}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={[colors.primaryGreen, colors.primaryGreenDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.saveButtonGradient}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.saveButtonText}>Create Goal</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            <TouchableOpacity
              style={[styles.cancelButton, loading && { opacity: 0.6 }]}
              onPress={handleBackPress}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 20,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  backButton: {
    borderRadius: 20,
    marginRight: 15,
    overflow: 'hidden',
  },
  backButtonGradient: {
    padding: 8,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.matteBlack,
    letterSpacing: 0.5,
  },
  cardContainer: {
    padding: 20,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 24,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(237, 242, 247, 0.8)',
  },
  formGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.matteBlack,
    marginBottom: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.subtleAccent,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    padding: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: colors.matteBlack,
    fontSize: 16,
  },
  inputText: {
    flex: 1,
    color: colors.matteBlack,
    fontSize: 16,
  },
  buttonContainer: {
    marginTop: 24,
  },
  saveButton: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: colors.primaryGreenDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  saveButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.white,
  },
  cancelButton: {
    backgroundColor: colors.subtleAccent,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.darkGray,
  },
});

export default AddGoalScreen;