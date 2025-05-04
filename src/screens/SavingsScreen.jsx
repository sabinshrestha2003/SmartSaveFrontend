import React, { useContext, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Animated,
  Dimensions,
  StatusBar,
} from 'react-native';
import { SavingsContext } from '../context/SavingsContext';
import { useAuth } from '../context/AuthContext';
import colors from '../styles/colors';
import CircularProgress from 'react-native-circular-progress-indicator';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { format } from 'date-fns';
import ConfettiCannon from 'react-native-confetti-cannon';
import { displayNotification } from '../utils/notifications';

const { width } = Dimensions.get('window');

const SavingsScreen = ({ navigation }) => {
  const { savingsGoals, loading, error, updateSavingsGoal, deleteSavingsGoal } =
    useContext(SavingsContext);
  const { user } = useAuth();
  const [isProgressModalVisible, setProgressModalVisible] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [progressInput, setProgressInput] = useState('');
  const [scrollY] = useState(new Animated.Value(0));
  const [showConfetti, setShowConfetti] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const fabAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(fabAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    return () => {
      fadeAnim.setValue(0);
      slideAnim.setValue(20);
      scaleAnim.setValue(0.9);
      fabAnim.setValue(0);
    };
  }, []);

  const totalTarget = savingsGoals.reduce(
    (sum, goal) => sum + (goal.target || 0),
    0,
  );
  const totalProgress = savingsGoals.reduce(
    (sum, goal) => sum + (goal.progress || 0),
    0,
  );
  const overallProgress =
    totalTarget > 0 ? (totalProgress / totalTarget) * 100 : 0;

  const formatDate = dateString => {
    try {
      const date = new Date(dateString);
      return format(date, 'MMM dd, yyyy');
    } catch (error) {
      return dateString;
    }
  };

  const handleUpdateProgress = async () => {
    if (!selectedGoal) {
      Alert.alert('Error', 'No goal selected.');
      return;
    }

    const additionalProgress = parseFloat(progressInput);
    if (isNaN(additionalProgress) || additionalProgress <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid positive number.');
      return;
    }

    const newProgress = (selectedGoal.progress || 0) + additionalProgress;
    const target = selectedGoal.target || 0;

    if (newProgress > target) {
      Alert.alert('Invalid Input', 'Progress cannot exceed the target amount.');
      return;
    }

    try {
      const updatedGoal = {
        ...selectedGoal,
        progress: newProgress,
        deadline: new Date(selectedGoal.deadline),
      };
      await updateSavingsGoal(selectedGoal.id, updatedGoal);

      await displayNotification(
        'Savings Goal Updated',
        `You added $${additionalProgress.toFixed(2)} to "${selectedGoal.name}".`,
        { screen: 'SavingsScreen' },
        user?.id
      );

      if (newProgress >= target) {
        setShowConfetti(true);
        setTimeout(async () => {
          setShowConfetti(false);
          await deleteSavingsGoal(selectedGoal.id);
          await displayNotification(
            'Goal Achieved!',
            `${selectedGoal.name} has been completed!`,
            { screen: 'SavingsScreen' },
            user?.id
          );
          Alert.alert(
            'Goal Achieved!',
            `${selectedGoal.name} has been completed and removed!`,
          );
        }, 3000);
      }

      setProgressModalVisible(false);
      setProgressInput('');
    } catch (error) {
      console.error(
        'Error updating goal:',
        error.response?.data || error.message,
      );
      Alert.alert(
        'Error',
        error.response?.data?.error || 'Failed to update savings goal.',
      );
    }
  };

  const handleFabPress = () => {
    Animated.sequence([
      Animated.timing(fabAnim, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(fabAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => navigation.navigate('AddGoal'));
  };

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0.9],
    extrapolate: 'clamp',
  });

  const headerHeight = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [180, 140],
    extrapolate: 'clamp',
  });

  const fabScale = fabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const fabRotate = fabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={colors.background}
        />
        <ActivityIndicator size="large" color={colors.accentPurple} />
        <Text style={styles.loadingText}>Loading savings goals...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <Animated.View
        style={[styles.header, { height: headerHeight, opacity: headerOpacity }]}
      >
        <LinearGradient
          colors={[colors.primaryGreen, colors.primaryGreenDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <Text style={styles.headerTitle}>Savings Goals</Text>
          <View style={styles.overallProgressContainer}>
            <CircularProgress
              value={overallProgress}
              radius={50}
              maxValue={100}
              textColor={colors.white}
              textStyle={{ fontWeight: 'bold', fontSize: 18 }}
              valueSuffix="%"
              activeStrokeColor={colors.accentGold}
              activeStrokeSecondaryColor={colors.accentGoldDark}
              inActiveStrokeColor={colors.white}
              inActiveStrokeOpacity={0.3}
              activeStrokeWidth={8}
              inActiveStrokeWidth={8}
            />
            <View style={styles.progressTextContainer}>
              <Text style={styles.overallProgressDetails}>
                ${(totalProgress || 0).toFixed(2)} / $
                {(totalTarget || 0).toFixed(2)}
              </Text>
              <Text style={styles.overallProgressLabel}>Overall Progress</Text>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      <Animated.FlatList
        data={savingsGoals}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.goalsList}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
        renderItem={({ item, index }) => {
          const progressPercentage =
            (item.target || 0) > 0
              ? ((item.progress || 0) / (item.target || 0)) * 100
              : 0;
          const progressColor =
            progressPercentage < 30
              ? colors.errorRed
              : progressPercentage < 70
              ? colors.warningAmber
              : colors.successGreen;

          return (
            <Animated.View
              style={{
                opacity: fadeAnim,
                transform: [
                  {
                    translateY: Animated.add(
                      slideAnim,
                      new Animated.Value(index * 10),
                    ),
                  },
                  { scale: scaleAnim },
                ],
              }}
            >
              <TouchableOpacity
                style={styles.goalCard}
                onPress={() => navigation.navigate('GoalDetails', { goal: item })}
                activeOpacity={0.95}
              >
                <View style={styles.goalCardHeader}>
                  <Text style={styles.goalTitle} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <View
                    style={[
                      styles.progressBadge,
                      { backgroundColor: progressColor },
                    ]}
                  >
                    <Text style={styles.progressBadgeText}>
                      {Math.round(progressPercentage)}%
                    </Text>
                  </View>
                </View>
                <View style={styles.goalDetails}>
                  <Text style={styles.goalAmount}>
                    ${(item.progress || 0).toFixed(2)} / $
                    {(item.target || 0).toFixed(2)}
                  </Text>
                  <View style={styles.progressBarContainer}>
                    <View
                      style={{
                        ...styles.progressBar,
                        width: `${Math.min(progressPercentage, 100)}%`,
                        backgroundColor: progressColor,
                      }}
                    />
                  </View>
                  <View style={styles.goalFooter}>
                    <View style={styles.deadlineContainer}>
                      <Ionicons
                        name="calendar-outline"
                        size={16}
                        color={colors.darkGray}
                        style={styles.deadlineIcon}
                      />
                      <Text style={styles.goalDeadline}>
                        {formatDate(item.deadline)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.updateButton}
                      onPress={() => {
                        setSelectedGoal(item);
                        setProgressModalVisible(true);
                      }}
                    >
                      <LinearGradient
                        colors={[
                          progressColor,
                          adjustColor(progressColor, -20),
                        ]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.updateButtonGradient}
                      >
                        <Icon name="add" size={16} color={colors.white} />
                        <Text style={styles.updateButtonText}>Add</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        }}
        ListEmptyComponent={
          <Animated.View
            style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
          >
            <View style={styles.emptyContainer}>
              <Icon name="savings" size={60} color={colors.mediumGray} />
              <Text style={styles.emptyText}>No savings goals yet</Text>
              <TouchableOpacity
                style={styles.emptyAddButton}
                onPress={() => navigation.navigate('AddGoal')}
              >
                <LinearGradient
                  colors={[colors.accentPurple, colors.accentPurpleDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.emptyAddButtonGradient}
                >
                  <Text style={styles.emptyAddButtonText}>Add First Goal</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Animated.View>
        }
      />

      <Animated.View
        style={[
          styles.fab,
          { transform: [{ scale: fabScale }, { rotate: fabRotate }] },
        ]}
      >
        <TouchableOpacity onPress={handleFabPress} activeOpacity={0.9}>
          <LinearGradient
            colors={[
              colors.primaryGreen,
              adjustColor(colors.primaryGreen, -20),
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fabGradient}
          >
            <Ionicons name="add" size={30} color={colors.white} />
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      <Modal
        visible={isProgressModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setProgressModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Add to {selectedGoal?.name}</Text>
            <Text style={styles.modalSubtitle}>
              Current: ${(selectedGoal?.progress || 0).toFixed(2)} / $
              {(selectedGoal?.target || 0).toFixed(2)}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Enter amount"
              placeholderTextColor={colors.mediumGray}
              keyboardType="numeric"
              value={progressInput}
              onChangeText={setProgressInput}
              autoFocus
            />
            <View style={styles.quickAmounts}>
              {[10, 25, 50, 100].map(amount => (
                <TouchableOpacity
                  key={amount}
                  style={styles.quickAmountButton}
                  onPress={() => setProgressInput(amount.toString())}
                >
                  <Text style={styles.quickAmountText}>+${amount}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setProgressModalVisible(false);
                  setProgressInput('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, { opacity: progressInput ? 1 : 0.5 }]}
                onPress={handleUpdateProgress}
                disabled={!progressInput}
              >
                <LinearGradient
                  colors={[colors.primaryGreen, colors.primaryGreenDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.saveButtonGradient}
                >
                  <Text style={styles.saveButtonText}>Save</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {showConfetti && (
        <ConfettiCannon
          count={200}
          origin={{ x: width / 2, y: -10 }}
          autoStart={true}
          fadeOut={true}
          explosionSpeed={500}
          fallSpeed={3000}
        />
      )}
    </View>
  );
};

const adjustColor = (color, amount) => {
  const clamp = val => Math.min(255, Math.max(0, val));
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const adjustR = clamp(r + amount);
  const adjustG = clamp(g + amount);
  const adjustB = clamp(b + amount);
  return `#${adjustR.toString(16).padStart(2, '0')}${adjustG
    .toString(16)
    .padStart(2, '0')}${adjustB.toString(16).padStart(2, '0')}`;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    width: '100%',
    overflow: 'hidden',
  },
  headerGradient: {
    flex: 1,
    paddingTop: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: 12,
  },
  overallProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  progressTextContainer: {
    flex: 1,
    marginLeft: 16,
  },
  overallProgressDetails: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.white,
  },
  overallProgressLabel: {
    fontSize: 14,
    color: colors.white,
    opacity: 0.9,
  },
  goalsList: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
  },
  goalCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
    elevation: 4,
    shadowColor: colors.shadow,
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(237, 242, 247, 0.8)',
  },
  goalCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  goalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.matteBlack,
    flex: 1,
  },
  progressBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  progressBadgeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
  goalDetails: {
    marginTop: 8,
  },
  goalAmount: {
    fontSize: 16,
    color: colors.darkGray,
    marginBottom: 12,
    fontWeight: '500',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: colors.subtleAccent,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  goalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deadlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deadlineIcon: {
    marginRight: 4,
  },
  goalDeadline: {
    fontSize: 14,
    color: colors.darkGray,
  },
  updateButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  updateButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  updateButtonText: {
    fontSize: 14,
    color: colors.white,
    marginLeft: 4,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: colors.white,
    padding: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modalHandle: {
    width: 40,
    height: 5,
    backgroundColor: colors.mediumGray,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.matteBlack,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.darkGray,
    textAlign: 'center',
    marginBottom: 20,
  },
  input: {
    backgroundColor: colors.subtleAccent,
    padding: 16,
    borderRadius: 16,
    color: colors.matteBlack,
    fontSize: 16,
    marginBottom: 16,
  },
  quickAmounts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  quickAmountButton: {
    backgroundColor: colors.subtleAccent,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    flex: 1,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  quickAmountText: {
    color: colors.darkGray,
    fontWeight: 'bold',
    fontSize: 14,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.subtleAccent,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginRight: 8,
  },
  saveButton: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    marginLeft: 8,
  },
  saveButtonGradient: {
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: colors.darkGray,
    fontWeight: 'bold',
    fontSize: 16,
  },
  saveButtonText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    color: colors.darkGray,
    fontSize: 16,
    marginTop: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    backgroundColor: colors.subtleAccent,
    borderRadius: 20,
    marginTop: 20,
  },
  emptyText: {
    fontSize: 18,
    color: colors.darkGray,
    marginTop: 16,
    marginBottom: 20,
  },
  emptyAddButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  emptyAddButtonGradient: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  emptyAddButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  fab: {
    position: 'absolute',
    bottom: 85,
    right: 30,
    elevation: 8,
    shadowColor: colors.accentPurpleDark,
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
  },
  fabGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default SavingsScreen;