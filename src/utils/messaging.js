import { supabase } from './supabase';

// Message types
export const MESSAGE_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  LOCATION: 'location',
  DATE_PLAN: 'date_plan',
  RESTAURANT_SUGGESTION: 'restaurant_suggestion'
};

// Quick reply templates
export const QUICK_REPLIES = [
  "Yes! 🙌",
  "Sounds great! 😊",
  "What time? ⏰",
  "Let's do it! 🔥",
  "Maybe later 🤔",
  "I'm in! 💫"
];

// Food-based conversation starters
export const CONVERSATION_STARTERS = [
  "What's your favorite comfort food? 🍜",
  "Best restaurant you've been to recently? 🍽️",
  "Cooking or ordering in tonight? 👨‍🍳",
  "Sweet or savory snacks? 🍪🥨",
  "Coffee or tea person? ☕🍵",
  "Pizza toppings - controversial opinions? 🍕"
];

// Message status management
export class MessageStatus {
  static SENT = 'sent';
  static DELIVERED = 'delivered';
  static READ = 'read';
  static FAILED = 'failed';
}

// Simple message sending without encryption
export async function sendMessage(matchId, content, messageType = MESSAGE_TYPES.TEXT, metadata = {}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    console.log('Attempting to send message:', { matchId, content, messageType });

    // Insert message - try both content and encrypted_content columns
    let insertData = {
      match_id: matchId,
      sender_id: user.id,
      message_type: messageType,
      metadata: metadata,
      created_at: new Date().toISOString(),
    };

    // Try with content column first, then fall back to encrypted_content
    let { data, error } = await supabase
      .from('messages')
      .insert({
        ...insertData,
        content: content, // Store content directly
      })
      .select()
      .single();

    // If content column doesn't exist, try with encrypted_content
    if (error && error.message && error.message.includes('content')) {
      console.log('Content column not found, trying encrypted_content column...');
      ({ data, error } = await supabase
        .from('messages')
        .insert({
          ...insertData,
          encrypted_content: content, // Store in encrypted_content column without encryption
        })
        .select()
        .single());
    }

    if (error) {
      console.error('Database error details:', error);
      // If it's a schema cache issue, provide a more helpful error
      if (error.message && error.message.includes('content column')) {
        throw new Error('Database schema issue: Please run the schema fix script in Supabase SQL editor');
      }
      throw error;
    }

    // Update user presence
    await updateUserPresence(user.id, true);

    return data;
  } catch (error) {
    console.error('Send message error:', error);
    throw error;
  }
}

// Get or create chat room with encryption
export async function getOrCreateChatRoom(matchId) {
  try {
    // Try to get existing chat room
    let { data: chatRoom, error } = await supabase
      .from('chat_rooms')
      .select('*')
      .eq('match_id', matchId)
      .single();

    if (chatRoom) {
      console.log('Using existing encryption key for match:', matchId);
    }

    if (error && error.code === 'PGRST116') {
      // Chat room doesn't exist, create new one
      const { data: matchData } = await supabase
        .from('matches')
        .select('user_a, user_b')
        .eq('id', matchId)
        .single();

      if (!matchData) throw new Error('Match not found');

      const encryptionKey = generateMatchKey(matchId, [matchData.user_a, matchData.user_b]);
      console.log('Generated new encryption key for match:', matchId);

      const { data: newRoom, error: createError } = await supabase
        .from('chat_rooms')
        .insert({
          match_id: matchId,
          encryption_key: encryptionKey,
        })
        .select()
        .single();

      if (createError) throw createError;
      chatRoom = newRoom;
    } else if (error) {
      throw error;
    }

    return chatRoom;
  } catch (error) {
    console.error('Chat room error:', error);
    return null;
  }
}

// Load messages without decryption
export async function loadMessages(matchId, limit = 50, offset = 0) {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('match_id', matchId)
      .is('deleted_at', null) // Exclude soft-deleted messages
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    let messages = (data || []).reverse(); // Show oldest first in UI

    // Handle both content and encrypted_content columns
    messages = messages.map(msg => {
      if (!msg.content && msg.encrypted_content) {
        // If using encrypted_content column, copy it to content for consistent interface
        msg.content = msg.encrypted_content;
      }
      return msg;
    });

    // Mark messages as delivered
    await markMessagesAsDelivered(matchId);

    return messages;
  } catch (error) {
    console.error('Load messages error:', error);
    return [];
  }
}

// Mark messages as delivered
export async function markMessagesAsDelivered(matchId) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.rpc('mark_messages_delivered', {
      p_match_id: matchId
    });
  } catch (error) {
    console.error('Mark delivered error:', error);
  }
}

// Mark messages as read
export async function markMessagesAsRead(messageIds) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const readReceipts = messageIds.map(messageId => ({
      message_id: messageId,
      user_id: user.id,
    }));

    await supabase
      .from('message_receipts')
      .upsert(readReceipts);

    // Update read_at timestamp
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .in('id', messageIds);
  } catch (error) {
    console.error('Mark read error:', error);
  }
}

// Add message reaction
export async function addMessageReaction(messageId, emoji) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('message_reactions')
      .upsert({
        message_id: messageId,
        user_id: user.id,
        emoji: emoji,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Add reaction error:', error);
    throw error;
  }
}

// Remove message reaction
export async function removeMessageReaction(messageId) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('message_reactions')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', user.id);
  } catch (error) {
    console.error('Remove reaction error:', error);
  }
}

// Typing indicator management
export async function sendTypingIndicator(matchId) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('typing_indicators')
      .upsert({
        match_id: matchId,
        user_id: user.id,
      });

    // Auto-remove after 3 seconds
    setTimeout(async () => {
      await removeTypingIndicator(matchId);
    }, 3000);
  } catch (error) {
    console.error('Typing indicator error:', error);
  }
}

export async function removeTypingIndicator(matchId) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('typing_indicators')
      .delete()
      .eq('match_id', matchId)
      .eq('user_id', user.id);
  } catch (error) {
    console.error('Remove typing indicator error:', error);
  }
}

// User presence management
export async function updateUserPresence(userId = null, isOnline = true) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const targetUserId = userId || user?.id;
    if (!targetUserId) return;

    await supabase
      .from('user_presence')
      .upsert({
        user_id: targetUserId,
        is_online: isOnline,
        last_seen: new Date().toISOString(),
      });
  } catch (error) {
    console.error('Update presence error:', error);
  }
}

// Get partner's online status
export async function getPartnerPresence(partnerId) {
  try {
    const { data, error } = await supabase
      .from('user_presence')
      .select('is_online, last_seen')
      .eq('user_id', partnerId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    return data || { is_online: false, last_seen: null };
  } catch (error) {
    console.error('Get presence error:', error);
    return { is_online: false, last_seen: null };
  }
}

// Send restaurant suggestion message
export async function sendRestaurantSuggestion(matchId, restaurants) {
  const content = `🍽️ Restaurant Suggestions:\n\n${restaurants.map((r, i) =>
    `${i + 1}. ${r.name}\n   ${r.categories?.join(' • ') || 'Restaurant'}\n   📍 ${r.address || 'Location available'}`
  ).join('\n\n')}`;

  return await sendSecureMessage(
    matchId,
    content,
    MESSAGE_TYPES.RESTAURANT_SUGGESTION,
    { restaurants }
  );
}

// Send date planning message
export async function sendDatePlan(matchId, planDetails) {
  const content = `📅 Date Plan: ${planDetails.title}\n🕒 ${planDetails.time}\n📍 ${planDetails.location}`;

  return await sendSecureMessage(
    matchId,
    content,
    MESSAGE_TYPES.DATE_PLAN,
    planDetails
  );
}

// Get conversation starters based on shared food preferences
export async function getPersonalizedStarters(matchId) {
  try {
    // Get shared preferences
    const { data } = await supabase.functions.invoke('get_shared_preferences', {
      body: { matchId }
    });

    const sharedLikes = data?.sharedLikes || [];

    if (sharedLikes.length === 0) {
      return CONVERSATION_STARTERS;
    }

    // Generate personalized starters based on shared preferences
    const personalizedStarters = sharedLikes.map(preference => {
      const starters = {
        italian: "What's your go-to Italian dish? 🍝",
        japanese: "Sushi or ramen? The eternal debate! 🍣🍜",
        mexican: "Spice level: mild or make-me-cry hot? 🌮🔥",
        chinese: "Dumplings vs noodles - which team are you on? 🥟",
        indian: "Favorite curry? I need recommendations! 🍛",
        thai: "Tom yum or pad thai? 🍜",
        korean: "Korean BBQ date sounds amazing, right? 🍖",
        pizza: "Pineapple on pizza - yes or absolutely not? 🍕",
      };
      return starters[preference] || `Love ${preference} food too! What's your favorite dish? 😋`;
    });

    return [...personalizedStarters.slice(0, 3), ...CONVERSATION_STARTERS];
  } catch (error) {
    console.error('Get starters error:', error);
    return CONVERSATION_STARTERS;
  }
}

// Message search functionality
export async function searchMessages(matchId, query, limit = 20) {
  try {
    const messages = await loadMessages(matchId, 200); // Load more for search

    const filteredMessages = messages.filter(msg =>
      msg.content.toLowerCase().includes(query.toLowerCase()) &&
      msg.message_type === MESSAGE_TYPES.TEXT
    ).slice(0, limit);

    return filteredMessages;
  } catch (error) {
    console.error('Search messages error:', error);
    return [];
  }
}