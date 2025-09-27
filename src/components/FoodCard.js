import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  TouchableOpacity
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const CARD_WIDTH = screenWidth * 0.9;
const CARD_HEIGHT = screenHeight * 0.7;

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export default function FoodCard({ restaurant, translateX, onPress }) {
  const cardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-screenWidth, 0, screenWidth],
      [-15, 0, 15],
      Extrapolation.CLAMP
    );

    const opacity = interpolate(
      Math.abs(translateX.value),
      [0, screenWidth * 0.8],
      [1, 0],
      Extrapolation.CLAMP
    );

    return {
      transform: [
        { translateX: translateX.value },
        { rotate: `${rotate}deg` },
      ],
      opacity,
    };
  });

  const overlayStyle = useAnimatedStyle(() => {
    const leftOpacity = interpolate(
      translateX.value,
      [-screenWidth * 0.3, 0],
      [1, 0],
      Extrapolation.CLAMP
    );

    const rightOpacity = interpolate(
      translateX.value,
      [0, screenWidth * 0.3],
      [0, 1],
      Extrapolation.CLAMP
    );

    return {
      opacity: Math.max(leftOpacity, rightOpacity),
    };
  });

  const likeOverlayStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [0, screenWidth * 0.3],
      [0, 1],
      Extrapolation.CLAMP
    );

    return { opacity };
  });

  const passOverlayStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [-screenWidth * 0.3, 0],
      [1, 0],
      Extrapolation.CLAMP
    );

    return { opacity };
  });

  return (
    <AnimatedTouchableOpacity
      style={[styles.card, cardStyle]}
      onPress={onPress}
      activeOpacity={1}
    >
      <Image
        source={{ uri: restaurant.image }}
        style={styles.image}
        resizeMode="cover"
      />

      <LinearGradient
        colors={['transparent', 'rgba(7, 45, 120, 0.8)']}
        style={styles.gradient}
      />

      <View style={styles.content}>
        <View style={styles.restaurantInfo}>
          <Text style={styles.name}>{restaurant.name}</Text>
          <Text style={styles.cuisine}>{restaurant.cuisine}</Text>
          <View style={styles.details}>
            <Text style={styles.rating}>⭐ {restaurant.rating}</Text>
            <Text style={styles.price}>{restaurant.price}</Text>
            <Text style={styles.distance}>{restaurant.distance}</Text>
          </View>
          {restaurant.description && (
            <Text style={styles.description} numberOfLines={2}>
              {restaurant.description}
            </Text>
          )}
        </View>
      </View>

      <Animated.View style={[styles.overlay, overlayStyle]}>
        <Animated.View style={[styles.likeOverlay, likeOverlayStyle]}>
          <Text style={styles.overlayText}>LOVE IT! 💕</Text>
        </Animated.View>
        <Animated.View style={[styles.passOverlay, passOverlayStyle]}>
          <Text style={styles.overlayText}>PASS 👎</Text>
        </Animated.View>
      </Animated.View>
    </AnimatedTouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 20,
    backgroundColor: 'white',
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%',
  },
  content: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
  },
  restaurantInfo: {
    marginBottom: 10,
  },
  name: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  cuisine: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 8,
  },
  details: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  rating: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
    marginRight: 15,
  },
  price: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
    marginRight: 15,
  },
  distance: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
  },
  description: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 20,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  likeOverlay: {
    backgroundColor: 'rgba(76, 175, 80, 0.8)',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    transform: [{ rotate: '-15deg' }],
  },
  passOverlay: {
    backgroundColor: 'rgba(244, 67, 54, 0.8)',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    transform: [{ rotate: '15deg' }],
  },
  overlayText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});