import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Dimensions,
  Animated,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../utils/supabase';
import {
  sendMessage,
  loadMessages,
  markMessagesAsRead,
  addMessageReaction,
  removeMessageReaction,
  sendTypingIndicator,
  removeTypingIndicator,
  updateUserPresence,
  getPartnerPresence,
  QUICK_REPLIES,
  getPersonalizedStarters,
  sendRestaurantSuggestion
} from '../utils/messaging';
import { useFonts, SourGummy_700Bold } from '@expo-google-fonts/sour-gummy';

const { width, height } = Dimensions.get('window');

const foodEmojis = ['🍕', '🍔', '🍟', '🌮', '🍝', '🍜', '🍱', '🍣', '🥘', '🍲', '🥗', '🍰', '🧁', '🍪', '🍩', '🥐', '🥨', '🌭', '🥪', '🍖'];
const heartEmojis = ['💕', '💖', '💗', '💝', '💘', '😍', '🥰', '😋', '🤤'];

const FloatingEmoji = ({ emoji, delay = 0 }) => {
  const animValue = useRef(new Animated.Value(0)).current;
  const opacityValue = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(animValue, {
            toValue: 1,
            duration: 3000,
            useNativeDriver: true,
          }),
          Animated.timing(opacityValue, {
            toValue: 0,
            duration: 3000,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const translateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -100],
  });

  return (
    <Animated.Text
      style={[
        styles.floatingEmoji,
        {
          transform: [{ translateY }],
          opacity: opacityValue,
        },
      ]}
    >
      {emoji}
    </Animated.Text>
  );
};

const DatePlanningPrompt = ({ onSelectRestaurant, onCustomDate }) => (
  <View style={styles.datePrompt}>
    <Text style={styles.datePromptTitle}>🍽️ Plan a food date!</Text>
    <TouchableOpacity style={styles.dateOption} onPress={onSelectRestaurant}>
      <Text style={styles.dateOptionText}>🎯 Pick from suggestions</Text>
    </TouchableOpacity>
    <TouchableOpacity style={styles.dateOption} onPress={onCustomDate}>
      <Text style={styles.dateOptionText}>✍️ Suggest a place</Text>
    </TouchableOpacity>
  </View>
);

const MessageBubble = ({ message, isMe, onReaction, reaction }) => {
  const [showReactionMenu, setShowReactionMenu] = useState(false);
  const reactionEmojis = ['❤️', '😂', '👍', '🔥', '🤤', '😍'];

  const handleLongPress = () => {
    setShowReactionMenu(true);
    setTimeout(() => setShowReactionMenu(false), 3000);
  };

  const handleReaction = async (emoji) => {
    setShowReactionMenu(false);
    try {
      if (reaction === emoji) {
        // Remove reaction if same emoji
        await removeMessageReaction(message.id);
      } else {
        // Add new reaction
        await addMessageReaction(message.id, emoji);
      }
    } catch (error) {
      console.error('Reaction error:', error);
    }
  };

  return (
    <View style={[styles.messageContainer, isMe ? styles.myMessage : styles.theirMessage]}>
      <TouchableOpacity onLongPress={handleLongPress} activeOpacity={0.8}>
        <View style={[styles.messageBubble, isMe ? styles.myBubble : styles.theirBubble]}>
          <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
            {message.content}
          </Text>
          <View style={styles.messageFooter}>
            <Text style={styles.messageTime}>
              {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {message.read_at && isMe && (
              <Ionicons name="checkmark-done" size={16} color="#4CAF50" style={styles.readIndicator} />
            )}
            {message.delivered_at && !message.read_at && isMe && (
              <Ionicons name="checkmark" size={16} color="#999" style={styles.readIndicator} />
            )}
          </View>
          {reaction && (
            <View style={styles.reactionBadge}>
              <Text style={styles.reactionEmoji}>{reaction}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>

      {/* Reaction Menu */}
      {showReactionMenu && (
        <View style={[styles.reactionMenu, isMe ? styles.reactionMenuRight : styles.reactionMenuLeft]}>
          {reactionEmojis.map(emoji => (
            <TouchableOpacity
              key={emoji}
              onPress={() => handleReaction(emoji)}
              style={[styles.reactionOption, reaction === emoji && styles.selectedReaction]}
            >
              <Text style={styles.reactionOptionText}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

export default function ChatScreen({ route, navigation }) {
  const { matchId, partnerName, partnerId } = route.params;
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [showDatePlanning, setShowDatePlanning] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showStarters, setShowStarters] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [messageReactions, setMessageReactions] = useState({});
  const [conversationStarters, setConversationStarters] = useState([]);
  const flatListRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const pollingIntervalRef = useRef(null);
  const lastMessageIdRef = useRef(null);
  const [fontsLoaded] = useFonts({ SourGummy_700Bold });

  // Polling function to check for new messages
  const pollForNewMessages = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get messages newer than the last known message
      let query = supabase
        .from('messages')
        .select('*')
        .eq('match_id', matchId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      if (lastMessageIdRef.current) {
        query = query.gt('created_at',
          (await supabase
            .from('messages')
            .select('created_at')
            .eq('id', lastMessageIdRef.current)
            .single()).data?.created_at || new Date().toISOString()
        );
      }

      const { data: newMessages, error } = await query;

      if (error) {
        console.error('Polling error:', error);
        return;
      }

      if (newMessages && newMessages.length > 0) {
        console.log('Found new messages via polling:', newMessages.length);

        const processedMessages = newMessages.map(msg => ({
          ...msg,
          content: msg.content || msg.encrypted_content
        }));

        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          const uniqueNewMessages = processedMessages.filter(m => !existingIds.has(m.id));

          if (uniqueNewMessages.length > 0) {
            // Update last message ID
            lastMessageIdRef.current = uniqueNewMessages[uniqueNewMessages.length - 1].id;

            // Auto-scroll to bottom
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
          }

          return [...prev, ...uniqueNewMessages];
        });
      }
    } catch (error) {
      console.error('Polling for messages failed:', error);
    }
  }, [matchId]);

  const initializeChat = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      setCurrentUserId(user.id);

      // Load messages using enhanced function
      const initialMessages = await loadMessages(matchId, 50);
      setMessages(initialMessages);

      // Store the latest message ID for polling
      if (initialMessages.length > 0) {
        lastMessageIdRef.current = initialMessages[initialMessages.length - 1].id;
      }

      // Get personalized conversation starters
      const starters = await getPersonalizedStarters(matchId);
      setConversationStarters(starters);

      // Update user presence
      await updateUserPresence(user.id, true);

      // Get partner's presence
      const partnerPresence = await getPartnerPresence(partnerId);
      setPartnerOnline(partnerPresence.is_online);

      // Subscribe to real-time updates
      const messagesSubscription = supabase
        .channel(`messages_${matchId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `match_id=eq.${matchId}`,
          },
          (payload) => {
            console.log('Real-time message received:', payload);
            const newMessage = payload.new;
            // Handle both sent and received messages for real-time updates
            const messageContent = newMessage.content || newMessage.encrypted_content;
            const processedMessage = {
              ...newMessage,
              content: messageContent
            };

            console.log('Processing real-time message:', {
              sender: newMessage.sender_id,
              currentUser: user.id,
              content: processedMessage.content,
              isFromOtherUser: newMessage.sender_id !== user.id
            });

            setMessages(prev => {
              // Check if message already exists to avoid duplicates
              const messageExists = prev.some(msg => msg.id === processedMessage.id);
              if (messageExists) {
                console.log('Message already exists, skipping');
                return prev;
              }
              console.log('Adding new message to chat:', processedMessage.content);
              return [...prev, processedMessage];
            });

            // Auto-scroll to bottom when new message arrives
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
          }
        )
        .subscribe((status) => {
          console.log('Messages subscription status:', status);
        });

      // Subscribe to typing indicators
      const typingSubscription = supabase
        .channel(`typing_${matchId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'typing_indicators',
            filter: `match_id=eq.${matchId}`,
          },
          (payload) => {
            if (payload.eventType === 'INSERT' && payload.new.user_id !== user.id) {
              setPartnerTyping(true);
              setTimeout(() => setPartnerTyping(false), 4000);
            } else if (payload.eventType === 'DELETE' && payload.old.user_id !== user.id) {
              setPartnerTyping(false);
            }
          }
        )
        .subscribe();

      // Subscribe to presence updates
      const presenceSubscription = supabase
        .channel(`presence_${partnerId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_presence',
            filter: `user_id=eq.${partnerId}`,
          },
          (payload) => {
            if (payload.new) {
              setPartnerOnline(payload.new.is_online);
            }
          }
        )
        .subscribe();

      // Subscribe to message reactions
      const reactionsSubscription = supabase
        .channel(`reactions_${matchId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'message_reactions',
          },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              setMessageReactions(prev => ({
                ...prev,
                [payload.new.message_id]: payload.new.emoji
              }));
            } else if (payload.eventType === 'DELETE') {
              setMessageReactions(prev => {
                const updated = { ...prev };
                delete updated[payload.old.message_id];
                return updated;
              });
            }
          }
        )
        .subscribe();

      // Start polling as backup for real-time updates
      console.log('Starting message polling every 2 seconds...');
      pollingIntervalRef.current = setInterval(pollForNewMessages, 2000);

      // Store subscriptions for cleanup
      const cleanup = () => {
        console.log('Cleaning up chat subscriptions...');
        messagesSubscription.unsubscribe();
        typingSubscription.unsubscribe();
        presenceSubscription.unsubscribe();
        reactionsSubscription.unsubscribe();

        // Clear polling interval
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }

        updateUserPresence(user.id, false);
      };

      return cleanup;
    } catch (error) {
      Alert.alert('Chat Error', error.message);
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [matchId, partnerId, navigation]);

  // Enhanced send message function
  const handleSendMessage = async () => {
    if (!inputText.trim() || !currentUserId) return;

    const messageContent = inputText.trim();
    setInputText('');
    Keyboard.dismiss();

    // Remove typing indicator
    await removeTypingIndicator(matchId);

    try {
      const sentMessage = await sendMessage(matchId, messageContent);
      console.log('Message sent successfully:', sentMessage);

      // Update the last message ID for polling
      if (sentMessage && sentMessage.id) {
        lastMessageIdRef.current = sentMessage.id;
      }

      // Don't add to local state immediately - let real-time subscription or polling handle it
      // This prevents duplicate messages and ensures proper real-time updates

      // Hide quick replies after sending
      setShowQuickReplies(false);
    } catch (error) {
      Alert.alert('Send Error', error.message);
      setInputText(messageContent); // Restore the message
    }
  };

  // Handle typing with indicator
  const handleTextChange = (text) => {
    setInputText(text);

    // Send typing indicator
    if (text.length > 0) {
      sendTypingIndicator(matchId);

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Set new timeout to remove typing indicator
      typingTimeoutRef.current = setTimeout(() => {
        removeTypingIndicator(matchId);
      }, 1000);
    } else {
      removeTypingIndicator(matchId);
    }
  };

  // Send quick reply
  const sendQuickReply = async (replyText) => {
    try {
      const sentMessage = await sendMessage(matchId, replyText);
      setMessages(prev => [...prev, sentMessage]);
      setShowQuickReplies(false);

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      Alert.alert('Send Error', error.message);
    }
  };

  // Send conversation starter
  const sendStarter = async (starterText) => {
    setInputText(starterText);
    setShowStarters(false);
  };

  const sendDatePlan = async (planText) => {
    const dateMessage = `🍽️ Food Date Idea: ${planText}`;
    setInputText(dateMessage);
    setTimeout(handleSendMessage, 100);
  };

  useEffect(() => {
    let cleanupFn = null;

    const setup = async () => {
      cleanupFn = await initializeChat();
    };

    setup();

    return () => {
      if (cleanupFn && typeof cleanupFn === 'function') {
        cleanupFn();
      }
    };
  }, [initializeChat]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const renderMessage = ({ item }) => (
    <MessageBubble
      message={item}
      isMe={item.sender_id === currentUserId}
      reaction={messageReactions[item.id]}
    />
  );

  const FoodBackground = () => {
    const [emojis, setEmojis] = useState([]);

    useEffect(() => {
      const generateEmojis = () => {
        const newEmojis = Array.from({ length: 8 }, (_, i) => ({
          id: i,
          emoji: foodEmojis[Math.floor(Math.random() * foodEmojis.length)],
          left: Math.random() * width,
          top: Math.random() * height,
          delay: Math.random() * 2000,
        }));
        setEmojis(newEmojis);
      };

      generateEmojis();
      const interval = setInterval(generateEmojis, 10000);
      return () => clearInterval(interval);
    }, []);

    return (
      <View style={styles.backgroundContainer}>
        {emojis.map((item) => (
          <View
            key={item.id}
            style={[
              styles.backgroundEmoji,
              {
                left: item.left,
                top: item.top,
              },
            ]}
          >
            <FloatingEmoji emoji={item.emoji} delay={item.delay} />
          </View>
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>🍳 Preparing your chat...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
          <FoodBackground />

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Text style={styles.backButtonText}>←</Text>
            </TouchableOpacity>
            <View style={styles.headerContent}>
              <Text style={[styles.headerTitle, fontsLoaded && { fontFamily: 'SourGummy_700Bold' }]}>
                💕 {partnerName}
              </Text>
              <Text style={styles.headerSubtitle}>
                {partnerTyping ? '✍️ typing...' : partnerOnline ? '🟢 online' : '🟡 offline'} • 🔐 encrypted
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowDatePlanning(!showDatePlanning)}
              style={styles.dateButton}
            >
              <Text style={styles.dateButtonText}>🍽️</Text>
            </TouchableOpacity>
          </View>

          {/* Enhanced Action Panels */}
          {showDatePlanning && (
            <View style={styles.actionPanel}>
              <Text style={styles.actionPanelTitle}>🍽️ Plan a food date!</Text>
              <TouchableOpacity
                style={styles.actionOption}
                onPress={() => {
                  navigation.navigate('SuggestionsScreen', { matchId, partnerName });
                  setShowDatePlanning(false);
                }}
              >
                <Text style={styles.actionOptionText}>🎯 Get restaurant suggestions</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionOption}
                onPress={() => {
                  setShowDatePlanning(false);
                  setInputText('🍽️ How about we try ');
                }}
              >
                <Text style={styles.actionOptionText}>✍️ Suggest a place</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Quick Replies Panel */}
          {showQuickReplies && (
            <View style={styles.actionPanel}>
              <Text style={styles.actionPanelTitle}>⚡ Quick Replies</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.quickRepliesContainer}>
                  {QUICK_REPLIES.map((reply, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.quickReplyButton}
                      onPress={() => sendQuickReply(reply)}
                    >
                      <Text style={styles.quickReplyText}>{reply}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Conversation Starters Panel */}
          {showStarters && (
            <View style={styles.actionPanel}>
              <Text style={styles.actionPanelTitle}>💬 Conversation Starters</Text>
              {conversationStarters.slice(0, 4).map((starter, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.actionOption}
                  onPress={() => sendStarter(starter)}
                >
                  <Text style={styles.actionOptionText}>{starter}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Messages */}
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.messagesContainer}>
              <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderMessage}
                style={styles.messagesList}
                contentContainerStyle={styles.messagesContent}
                showsVerticalScrollIndicator={false}
                keyboardDismissMode="on-drag"
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>🍝 Start your food journey together!</Text>
                    <Text style={styles.emptyStateSubtext}>Send a message to break the ice 🧊</Text>
                  </View>
                }
              />
            </View>
          </TouchableWithoutFeedback>

          {/* Enhanced Input Area */}
          <View style={styles.inputArea}>
            {/* Action Buttons Row */}
            <View style={styles.inputActions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => setShowQuickReplies(!showQuickReplies)}
              >
                <Ionicons name="flash" size={20} color="#ffb6c1" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => setShowStarters(!showStarters)}
              >
                <Ionicons name="chatbubble-ellipses" size={20} color="#ffb6c1" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => setShowDatePlanning(!showDatePlanning)}
              >
                <Ionicons name="restaurant" size={20} color="#ffb6c1" />
              </TouchableOpacity>
            </View>

            {/* Input Container */}
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                value={inputText}
                onChangeText={handleTextChange}
                placeholder="Share your food thoughts... 🤔"
                placeholderTextColor="rgba(255,182,193,0.6)"
                multiline={false}
                maxLength={500}
                returnKeyType="send"
                onSubmitEditing={handleSendMessage}
                enablesReturnKeyAutomatically={true}
                autoCorrect={true}
                autoCapitalize="sentences"
              />
              <TouchableOpacity
                style={[styles.sendButton, inputText.trim() ? styles.sendButtonActive : {}]}
                onPress={handleSendMessage}
                disabled={!inputText.trim()}
              >
                <Ionicons name="send" size={20} color="white" />
              </TouchableOpacity>
            </View>
          </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffb6c1',
  },
  keyboardContainer: {
    flex: 1,
  },
  backgroundContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  backgroundEmoji: {
    position: 'absolute',
  },
  floatingEmoji: {
    fontSize: 24,
    opacity: 0.3,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffb6c1',
  },
  loadingText: {
    fontSize: 18,
    color: 'white',
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255,182,193,0.9)',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  backButtonText: {
    fontSize: 24,
    color: '#ffb6c1',
    fontWeight: 'bold',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  dateButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateButtonText: {
    fontSize: 20,
  },
  datePrompt: {
    backgroundColor: 'white',
    margin: 15,
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 5,
  },
  datePromptTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffb6c1',
    textAlign: 'center',
    marginBottom: 15,
  },
  dateOption: {
    backgroundColor: '#ffb6c1',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  dateOptionText: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 16,
  },
  messagesList: {
    flex: 1,
    paddingHorizontal: 15,
    zIndex: 1,
  },
  messagesContent: {
    paddingVertical: 20,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 20,
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  emptyStateSubtext: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  messageContainer: {
    marginVertical: 5,
    maxWidth: '80%',
  },
  myMessage: {
    alignSelf: 'flex-end',
  },
  theirMessage: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  myBubble: {
    backgroundColor: 'white',
    borderBottomRightRadius: 5,
  },
  theirBubble: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderBottomLeftRadius: 5,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#000',
  },
  theirMessageText: {
    color: '#333',
  },
  messageTime: {
    fontSize: 11,
    color: 'rgba(0,0,0,0.5)',
    marginTop: 5,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 5,
  },
  readIndicator: {
    marginLeft: 5,
  },
  reactionBadge: {
    position: 'absolute',
    bottom: -8,
    right: 10,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#ffb6c1',
  },
  reactionEmoji: {
    fontSize: 16,
  },
  reactionMenu: {
    position: 'absolute',
    top: -40,
    backgroundColor: 'white',
    flexDirection: 'row',
    borderRadius: 20,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
  reactionMenuRight: {
    right: 0,
  },
  reactionMenuLeft: {
    left: 0,
  },
  reactionOption: {
    padding: 6,
    marginHorizontal: 2,
    borderRadius: 15,
  },
  selectedReaction: {
    backgroundColor: '#ffb6c1',
  },
  reactionOptionText: {
    fontSize: 18,
  },
  // Enhanced input area styles
  inputArea: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    zIndex: 10,
  },
  inputActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,182,193,0.2)',
  },
  actionButton: {
    marginHorizontal: 15,
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 15,
    paddingVertical: 15,
  },
  // Enhanced action panels
  actionPanel: {
    backgroundColor: 'white',
    margin: 15,
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 5,
  },
  actionPanelTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffb6c1',
    textAlign: 'center',
    marginBottom: 15,
  },
  actionOption: {
    backgroundColor: '#ffb6c1',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  actionOptionText: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 16,
  },
  quickRepliesContainer: {
    flexDirection: 'row',
    paddingHorizontal: 10,
  },
  quickReplyButton: {
    backgroundColor: '#ffb6c1',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 5,
    minWidth: 80,
  },
  quickReplyText: {
    color: 'white',
    fontWeight: '600',
    textAlign: 'center',
    fontSize: 14,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,182,193,0.3)',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: 'white',
    maxHeight: 100,
    marginRight: 10,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,182,193,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonActive: {
    backgroundColor: '#ffb6c1',
  },
  sendButtonText: {
    fontSize: 20,
  },
  messagesContainer: {
    flex: 1,
    zIndex: 1,
  },
});