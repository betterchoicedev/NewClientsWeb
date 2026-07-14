import React, { useEffect, useState } from 'react';
import { getChatMessages } from '../../supabase/secondaryClient';
import { Music } from 'lucide-react';

const MessagesTab = ({ themeClasses, t, userCode, activeTab, language }) => {
  const [messages, setMessages] = useState([]);
  const [firstMessageId, setFirstMessageId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [messagesContainerRef, setMessagesContainerRef] = useState(null);
  const [isUserAtBottom, setIsUserAtBottom] = useState(true); // Track if user is at bottom of chat
  const [selectedImage, setSelectedImage] = useState(null); // Track selected image for modal

  useEffect(() => {
    const loadMessages = async () => {
      if (!userCode) {
      setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const { data, error } = await getChatMessages(userCode);
        
        if (error) {
          console.error('Error loading messages:', error);
        } else {
          // Transform database messages to UI format
          const transformedMessages = (data || []).map(msg => ({
            id: msg.id,
            role: msg.role,
            message: msg.message,
            content: msg.content,
            attachments: msg.attachments,
            topic: msg.topic,
            sender: msg.role === 'user' ? 'user' : 'bot',
            timestamp: new Date(msg.created_at),
            created_at: msg.created_at
          }));
          
          // Filter valid messages
          const validMessages = filterValidMessages(transformedMessages);
          
          // Sort messages by timestamp (oldest first for chat display)
          const sortedMessages = validMessages.sort((a, b) => a.timestamp - b.timestamp);
          
          setMessages(sortedMessages);
          
          // Set the first message ID for pagination
          if (sortedMessages.length > 0) {
            setFirstMessageId(sortedMessages[0].id);
          }
          
          // Check if there are more messages to load (if we have 20+ messages)
          setHasMoreMessages(sortedMessages.length >= 20);
        }
      } catch (err) {
        console.error('Unexpected error loading messages:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadMessages();
  }, [userCode]);

  // Auto-refresh messages every 5 seconds when messages tab is active
  // Only refresh if user is at bottom of chat
  useEffect(() => {
    if (activeTab !== 'messages' || !userCode || !isUserAtBottom) return;

    const refreshMessages = async () => {
      try {
        // Capture scroll position before refresh
        const prevScrollTop = messagesContainerRef ? messagesContainerRef.scrollTop : 0;
        const prevScrollHeight = messagesContainerRef ? messagesContainerRef.scrollHeight : 0;

        const { data, error } = await getChatMessages(userCode);
        
        if (error) {
          console.error('Error refreshing messages:', error);
        } else {
          // Transform database messages to UI format
          const transformedMessages = (data || []).map(msg => ({
            id: msg.id,
            role: msg.role,
            message: msg.message,
            content: msg.content,
            attachments: msg.attachments,
            topic: msg.topic,
            sender: msg.role === 'user' ? 'user' : 'bot',
            timestamp: new Date(msg.created_at),
            created_at: msg.created_at
          }));
          
          // Filter valid messages
          const validMessages = filterValidMessages(transformedMessages);
          
          // Sort messages by timestamp (oldest first for chat display)
          const sortedMessages = validMessages.sort((a, b) => a.timestamp - b.timestamp);
          
          // Only update if messages have changed
          const currentMessageIds = messages.map(m => m.id).sort();
          const newMessageIds = sortedMessages.map(m => m.id).sort();
          
          if (JSON.stringify(currentMessageIds) !== JSON.stringify(newMessageIds)) {
            setMessages(sortedMessages);
            
            // Update firstMessageId if needed
            if (sortedMessages.length > 0) {
              setFirstMessageId(sortedMessages[0].id);
            }
            
            // Update hasMoreMessages
            setHasMoreMessages(sortedMessages.length >= 20);

            // Auto-scroll to bottom since user is at bottom
            if (messagesContainerRef && isUserAtBottom) {
              setTimeout(() => {
                if (messagesContainerRef) {
                  messagesContainerRef.scrollTop = messagesContainerRef.scrollHeight;
                }
              }, 100);
            }
          }
        }
      } catch (err) {
        console.error('Error refreshing messages:', err);
      }
    };

    // Set up interval for auto-refresh (only if user is at bottom)
    const interval = setInterval(refreshMessages, 5000); // 5 seconds

    // Cleanup interval on unmount or tab change
    return () => clearInterval(interval);
  }, [activeTab, userCode, messages, messagesContainerRef, isUserAtBottom]);

  // Function to scroll to bottom with multiple attempts
  const scrollToBottom = () => {
    if (messagesContainerRef) {
      // Use requestAnimationFrame for smoother scrolling
      requestAnimationFrame(() => {
        messagesContainerRef.scrollTop = messagesContainerRef.scrollHeight;
        
        // Double-check after a short delay to ensure it worked
    setTimeout(() => {
          if (messagesContainerRef) {
            messagesContainerRef.scrollTop = messagesContainerRef.scrollHeight;
          }
        }, 50);
      });
    }
  };

  // Check if user is near bottom of scroll (within 100px)
  const isNearBottom = () => {
    if (!messagesContainerRef) return true;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef;
    return scrollHeight - scrollTop - clientHeight < 100;
  };

  // Scroll to bottom when messages change (but not when loading more)
  useEffect(() => {
    if (!isLoadingMore && messages.length > 0) {
      // Only scroll to bottom if we're not in the middle of loading more messages
      const isInitialLoad = messages.length <= 20; // Assume initial load if 20 or fewer messages
      // Only auto-scroll if user is already at the bottom
      if (isInitialLoad && isUserAtBottom) {
        setTimeout(scrollToBottom, 100);
      }
    }
  }, [messages.length, isLoadingMore, messagesContainerRef, isUserAtBottom]);

  // Scroll to bottom when loading completes (only for initial load and if at bottom)
  useEffect(() => {
    if (!isLoading && messages.length > 0 && messages.length <= 20 && isUserAtBottom) {
      setTimeout(scrollToBottom, 200);
    }
  }, [isLoading, messages.length, messagesContainerRef, isUserAtBottom]);

  // Scroll to bottom when component mounts and messages are loaded (only for initial load)
  useEffect(() => {
    if (messages.length > 0 && messagesContainerRef && messages.length <= 20) {
      // Multiple attempts to ensure it scrolls
      setTimeout(scrollToBottom, 100);
      setTimeout(scrollToBottom, 300);
      setTimeout(scrollToBottom, 500);
    }
  }, [messagesContainerRef, messages.length]);

  // Function to load more messages (older messages)
  const handleLoadMore = async () => {
    if (!userCode || !firstMessageId || isLoadingMore) return;
    
    // Capture scroll position before loading
    const container = messagesContainerRef;
    const prevScrollHeight = container ? container.scrollHeight : 0;
    const prevScrollTop = container ? container.scrollTop : 0;
    setIsLoadingMore(true);
    
    try {
      // Find the current oldest message to use as reference point
      const firstMessage = messages.find(m => m.id === firstMessageId);
      if (!firstMessage) {
        console.error('❌ Could not find first message with ID:', firstMessageId);
        return;
      }
      
      // Fetch older messages using timestamp-based pagination
      const { data: olderMsgs, error } = await getChatMessages(userCode, firstMessage.created_at);
      
      if (error) {
        console.error('❌ Error loading more messages:', error);
        return;
      }
      
      if (olderMsgs && olderMsgs.length > 0) {
        // Transform database messages to UI format
        const transformedOlderMessages = olderMsgs.map(msg => ({
          id: msg.id,
          role: msg.role,
          message: msg.message,
          content: msg.content,
          attachments: msg.attachments,
          topic: msg.topic,
          sender: msg.role === 'user' ? 'user' : 'bot',
          timestamp: new Date(msg.created_at),
          created_at: msg.created_at
        }));
        
        // Filter valid messages
        const validOlderMessages = filterValidMessages(transformedOlderMessages);
        
        // Sort messages by timestamp (oldest first for chat display)
        const sortedOlderMessages = validOlderMessages.sort((a, b) => a.timestamp - b.timestamp);
        
        // Prepend older messages to the beginning of the array
        setMessages(prev => {
          const newMessages = [...sortedOlderMessages, ...prev];
          console.log('📝 Updated messages array:', {
            oldCount: prev.length,
            newCount: newMessages.length,
            addedCount: sortedOlderMessages.length
          });
          return newMessages;
        });
        
        // Update tracking variables
        setFirstMessageId(sortedOlderMessages[0].id); // New oldest message
        setHasMoreMessages(olderMsgs.length === 20); // More available if we got full batch
        
        // Restore scroll position after DOM updates
        setTimeout(() => {
          if (container) {
            const newScrollHeight = container.scrollHeight;
            const heightDifference = newScrollHeight - prevScrollHeight;
            container.scrollTop = prevScrollTop + heightDifference;
            console.log('🔄 Restored scroll position:', {
              prevScrollTop,
              prevScrollHeight,
              newScrollHeight,
              heightDifference,
              newScrollTop: prevScrollTop + heightDifference
            });
          }
        }, 50);
      } else {
        setHasMoreMessages(false); // No more messages
      }
    } catch (err) {
      console.error('❌ Error loading more messages:', err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Function to handle scroll - update isUserAtBottom state
  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const nearBottom = distanceFromBottom < 100; // Within 100px of bottom
    setIsUserAtBottom(nearBottom);
    
    // Auto-load more messages when scrolling to top
    if (scrollTop <= 50 && hasMoreMessages && !isLoadingMore && userCode && firstMessageId) {
      console.log('🔄 Auto-loading more messages at top...');
      handleLoadMore();
    }
  };

  // Filter valid messages (same logic as Chat.jsx)
  const filterValidMessages = (messages) => {
    return messages.filter(msg => {
      // Show assistant messages only if message is not null
      if (msg.role === 'assistant') {
        return msg.message !== null && msg.message !== undefined;
      }
      // Show user messages
      if (msg.role === 'user') {
        return true;
      }
      // Show system messages only if they contain specific content
      if (msg.role === 'system') {
        const content = msg.content || msg.message || '';
        return content.includes('ANALYZED FOOD CONTEXT') || content.includes('Image URL');
      }
      // Filter out other roles
      return false;
    });
  };

  // Format message time (same logic as Chat.jsx)
  const formatMessageTime = (dateString) => {
    if (!dateString) return '';
    
    const now = new Date();
    const messageDate = new Date(dateString);
    const diffMs = now - messageDate;
    const diffMins = Math.floor(diffMs / 60000);
    
    // "Just now" for < 1 minute
    if (diffMins < 1) {
      return language === 'hebrew' ? 'עכשיו' : 'Just now';
    }
    
    // "X min ago" for < 1 hour
    if (diffMins < 60) {
      return language === 'hebrew' ? `לפני ${diffMins} דקות` : `${diffMins} min ago`;
    }
    
    // Time only if today
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDay = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate());
    
    if (messageDay.getTime() === today.getTime()) {
      return formatChatTime(dateString);
    }
    
    // "Yesterday + time" if yesterday
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (messageDay.getTime() === yesterday.getTime()) {
      const timeStr = formatChatTime(dateString);
      return language === 'hebrew' ? `אתמול ${timeStr}` : `Yesterday ${timeStr}`;
    }
    
    // Full date + time if older
    const dateStr = language === 'hebrew'
      ? messageDate.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })
      : messageDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const timeStr = formatChatTime(dateString);
    return `${dateStr} ${timeStr}`;
  };

  // Check if should show date separator
  const shouldShowDateSeparator = (currentMsg, previousMsg) => {
    if (!previousMsg) return true;
    
    const currentDate = new Date(currentMsg.timestamp);
    const previousDate = new Date(previousMsg.timestamp);
    
    const currentDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
    const previousDay = new Date(previousDate.getFullYear(), previousDate.getMonth(), previousDate.getDate());
    
    return currentDay.getTime() !== previousDay.getTime();
  };

  // Helper function to normalize data URIs with proper MIME types
  const normalizeDataUri = (dataUri, mediaType) => {
    if (!dataUri || !dataUri.startsWith('data:')) {
      return dataUri;
    }
    
    // If it already has a proper MIME type, return as is
    if (dataUri.match(/^data:[a-z]+\/[a-z0-9+-]+;base64,/)) {
      return dataUri;
    }
    
    // Fix data:audio;base64, to have a proper MIME type
    if (mediaType === 'audio' && dataUri.startsWith('data:audio;base64,')) {
      try {
        const base64Data = dataUri.substring(dataUri.indexOf(',') + 1);
        const binaryString = atob(base64Data.substring(0, 100));
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Detect audio format from file headers
        // Ogg/Opus (most common for WhatsApp): bytes start with 0x4F 0x67 0x67 0x53 ("OggS")
        if (bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
          return dataUri.replace('data:audio;base64,', 'data:audio/ogg;base64,');
        }
        // MP3 detection
        if ((bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) || 
            (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0)) {
          return dataUri.replace('data:audio;base64,', 'data:audio/mpeg;base64,');
        }
        // WAV detection
        if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
          return dataUri.replace('data:audio;base64,', 'data:audio/wav;base64,');
        }
        // Default to ogg for unknown (most compatible)
        return dataUri.replace('data:audio;base64,', 'data:audio/ogg;base64,');
      } catch (e) {
        // Fallback to ogg if detection fails
        return dataUri.replace('data:audio;base64,', 'data:audio/ogg;base64,');
      }
    }
    
    // Fix data:image;base64, to have a proper MIME type
    if (mediaType === 'image' && dataUri.startsWith('data:image;base64,')) {
      return dataUri.replace('data:image;base64,', 'data:image/png;base64,');
    }
    
    return dataUri;
  };

  // Function to handle image click (open in modal)
  const handleImageClick = (imageSrc) => {
    setSelectedImage(imageSrc);
  };

  // Function to close image modal
  const handleCloseImageModal = () => {
    setSelectedImage(null);
  };

  // Handle ESC key to close modal
  useEffect(() => {
    if (!selectedImage) return;
    
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setSelectedImage(null);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [selectedImage]);

  // Function to render message content with attachments and formatting (same logic as Chat.jsx)
  const renderMessageContent = (msg) => {
    const topic = msg.topic;

    // Get content from message or content field
    let content = msg.message || msg.content || '';

    // dietitian_image: DB may store a raw data URI or JSON { text: caption, image: dataUri }
    let dietitianImageCaption = null;
    if (topic === 'dietitian_image' && typeof content === 'string' && content.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(content);
        const img = parsed.image;
        if (typeof img === 'string' && img.startsWith('data:image')) {
          const capFromText = parsed.text != null ? String(parsed.text).trim() : '';
          const capFromCaption = parsed.caption != null ? String(parsed.caption).trim() : '';
          const cap = capFromText || capFromCaption;
          if (cap) dietitianImageCaption = cap;
          content = img;
        }
      } catch (e) {
        // keep content as-is
      }
    }
    
    // For assistant role messages, extract only response_text from JSON
    if (msg.role === 'assistant' && content.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(content);
        if (parsed.response_text) {
          content = parsed.response_text;
        } else {
          // If no response_text, use empty string to show nothing
          content = '';
        }
      } catch (e) {
        // Not valid JSON, use as is
        console.error('Error parsing assistant message JSON:', e);
      }
    }
    
    // Handle system_reply topic: extract response_text from agent_response JSON
    if (topic === 'system_reply' && content.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(content);
        if (parsed.agent_response) {
          // agent_response is a JSON string, parse it to get response_text
          const agentResponseParsed = JSON.parse(parsed.agent_response);
          if (agentResponseParsed.response_text) {
            content = agentResponseParsed.response_text;
          }
        }
      } catch (e) {
        // Not valid JSON or parsing failed, use as is
        console.error('Error parsing system_reply JSON:', e);
      }
    }
    // Parse JSON if message starts with { (for non-system_reply messages)
    else if (content.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(content);
        if (parsed.response_text) {
          content = parsed.response_text;
        }
        // Remove buttons from parsed JSON - don't render them
        if (parsed.buttons) {
          delete parsed.buttons;
        }
      } catch (e) {
        // Not valid JSON, use as is
      }
    }
    
    // Remove any button-related content from the text
    // Remove WhatsApp button patterns like [Button Text] or button: patterns
    content = content.replace(/\[.*?\]/g, ''); // Remove [button text] patterns
    content = content.replace(/button:\s*[^\n]+/gi, ''); // Remove button: patterns
    content = content.trim();

    // Detect embedded media from final text (do not rely on topic — DB rows often omit topic)
    const hasBase64Image = content.startsWith('data:image');
    const hasBase64Audio = content.startsWith('data:audio');
    const normalizedImageData = hasBase64Image ? normalizeDataUri(content, 'image') : null;
    const normalizedAudioData = hasBase64Audio ? normalizeDataUri(content, 'audio') : null;

    // Filter out base64 data from text rendering
    // Only show text if it's not base64 data and not empty
    const isBase64Data = hasBase64Image || hasBase64Audio;
    const text = content && content.trim() && !isBase64Data ? content : '';
    
    // Render base64 media before attachments
    const base64MediaElements = [];
    
    // Render base64 images
    if (hasBase64Image) {
      base64MediaElements.push(
        <div key="base64-image" className="mb-3">
          {normalizedImageData ? (
            <img
              src={normalizedImageData}
              alt={dietitianImageCaption || 'Client image'}
              className="rounded-lg max-w-full max-h-64 object-cover shadow-sm border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity duration-200"
              onClick={() => handleImageClick(normalizedImageData)}
              onError={(e) => {
                console.error('Failed to load base64 image', e);
              }}
            />
          ) : (
            <div>Image data not found</div>
          )}
          {dietitianImageCaption && (
            <div
              className={`mt-2 text-xs whitespace-pre-wrap break-words ${
                msg.sender === 'user'
                  ? 'text-emerald-50/95'
                  : themeClasses.textSecondary
              }`}
            >
              {dietitianImageCaption}
            </div>
          )}
        </div>
      );
    }
    
    // Render base64 audio with enhanced UI
    if (hasBase64Audio) {
      base64MediaElements.push(
        <div key="base64-audio" className="mb-3">
          {normalizedAudioData ? (
            <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg shadow-sm">
              <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-2">
                  <Music className="w-4 h-4 text-slate-500" />
                  <span>{language === 'hebrew' ? 'הודעה קולית' : 'Audio Message'}</span>
                </div>
                <audio
                  src={normalizedAudioData}
                  controls
                  className="w-full h-10"
                  preload="metadata"
                  onError={(e) => {
                    console.error('Failed to load base64 audio', e);
                  }}
                  onLoadedMetadata={(e) => {
                    console.log('Audio loaded successfully');
                  }}
                >
                  Your browser does not support the audio tag.
                </audio>
              </div>
            </div>
          ) : (
            <div>Audio data not found</div>
          )}
        </div>
      );
    }
    
    // Handle attachments if they exist
    if (msg.attachments && Array.isArray(msg.attachments) && msg.attachments.length > 0) {
      return (
        <div className="space-y-2">
          {/* Render base64 media first */}
          {base64MediaElements}
          
          {msg.attachments.map((attachment, idx) => {
            const url = attachment.url || attachment;
            const type = attachment.type || attachment.mime_type || '';
            
            if (type.startsWith('image/') || url.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i)) {
              return (
                <img
                  key={idx}
                  src={url}
                  alt="Attachment"
                  className="max-w-full h-auto rounded-lg mt-2 shadow-md cursor-pointer"
                  style={{ maxHeight: '300px' }}
                  onClick={() => handleImageClick(url)}
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              );
            } else if (type.startsWith('video/') || url.match(/\.(mp4|webm|ogg)(\?|$)/i)) {
              return (
                <video
                  key={idx}
                  src={url}
                  controls
                  className="max-w-full h-auto rounded-lg mt-2"
                  style={{ maxHeight: '300px' }}
                />
              );
            } else if (type.startsWith('audio/') || url.match(/\.(mp3|wav|ogg)(\?|$)/i)) {
              return (
                <audio
                  key={idx}
                  src={url}
                  controls
                  className="w-full mt-2"
                />
              );
            } else {
              return (
                <a
                  key={idx}
                  href={url}
                  download
                  className="block text-blue-400 hover:text-blue-300 underline mt-2"
                >
                  {language === 'hebrew' ? 'הורד קובץ' : 'Download file'}
                </a>
              );
            }
          })}
          {/* Only show text if it's not base64 data */}
          {text && (
            <div className="whitespace-pre-wrap break-words">{text}</div>
          )}
        </div>
      );
    }
    
    // If we have base64 media but no attachments, render base64 media
    if (base64MediaElements.length > 0) {
      return (
        <div className="space-y-2">
          {base64MediaElements}
          {/* Only show text if it's not base64 data */}
          {text && (
            <div className="whitespace-pre-wrap break-words">{text}</div>
          )}
        </div>
      );
    }
    
    // Inline data:image/...;base64,... plus legacy http(s) image URLs in text
    const dataUriImageRegex = /(data:image[^;]*;base64,[A-Za-z0-9+/=]+)/gi;
    const urlRegex = /(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?[^\s]*)?)/gi;

    const renderHttpImageOrText = (segment, keyPrefix) => {
      if (!segment) return [];
      const parts = segment.split(urlRegex);
      return parts
        .map((part, index) => {
          if (!part) return null;
          const isHttpImage = /^https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp|bmp|svg)/i.test(part);
          if (isHttpImage) {
            return (
              <img
                key={`${keyPrefix}-http-${index}`}
                src={part}
                alt="Food analysis image"
                className="max-w-full h-auto rounded-lg mt-2 shadow-md cursor-pointer"
                style={{ maxHeight: '300px' }}
                onClick={() => handleImageClick(part)}
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            );
          }
          return (
            <span key={`${keyPrefix}-t-${index}`} className="whitespace-pre-wrap break-words">
              {part}
            </span>
          );
        })
        .filter(Boolean);
    };

    const chunks = content.split(dataUriImageRegex);
    return chunks.flatMap((chunk, index) => {
      if (!chunk) return [];
      if (/^data:image[^;]*;base64,/i.test(chunk)) {
        const norm = normalizeDataUri(chunk, 'image');
        return [
          <img
            key={`data-uri-${index}`}
            src={norm}
            alt="Client image"
            className="max-w-full h-auto rounded-lg mt-2 shadow-md cursor-pointer"
            style={{ maxHeight: '300px' }}
            onClick={() => handleImageClick(norm)}
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />,
        ];
      }
      return renderHttpImageOrText(chunk, `seg-${index}`);
    });
  };

  // Function to format date for chat
  const formatChatDate = (date) => {
    const now = new Date();
    const messageDate = new Date(date);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const messageDay = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate());
    
    if (messageDay.getTime() === today.getTime()) {
      return language === 'hebrew' ? 'היום' : 'Today';
    } else if (messageDay.getTime() === yesterday.getTime()) {
      return language === 'hebrew' ? 'אתמול' : 'Yesterday';
    } else {
      if (language === 'hebrew') {
        return messageDate.toLocaleDateString('he-IL', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
      } else {
        return messageDate.toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
      }
    }
  };

  // Function to format time for chat
  const formatChatTime = (date) => {
    if (language === 'hebrew') {
      return new Date(date).toLocaleTimeString('he-IL', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
    } else {
      return new Date(date).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
    }
  };


  if (isLoading) {
    return (
      <div className={`min-h-screen p-8 animate-fadeIn`}>
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
            <p className={`${themeClasses.textSecondary}`}>{t.profile.messagesTab.loading}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col animate-fadeIn overflow-hidden`}>
      {/* Header Section */}
      <div className="p-4 sm:p-6 pb-4 animate-slideInUp flex-shrink-0">
        <div className="flex items-center">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mr-4 shadow-lg shadow-purple-500/25 animate-pulse">
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd"/>
            </svg>
          </div>
    <div>
            <h2 className={`${themeClasses.textPrimary} text-3xl font-bold tracking-tight`}>
              {language === 'hebrew' ? 'הודעות מ-WhatsApp' : 'Messages from WhatsApp'}
            </h2>
            <p className={`${themeClasses.textSecondary} text-base mt-1`}>
              {language === 'hebrew' 
                ? 'צפייה בהודעות מהבוט שלכם ב-WhatsApp. כדי לשלוח הודעה, פנו לבוט ישירות ב-WhatsApp.'
                : 'View messages from your WhatsApp bot. To send a message, contact the bot directly on WhatsApp.'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={setMessagesContainerRef}
        className={`p-4 sm:p-6 flex-1 overflow-y-auto animate-slideInUp custom-scrollbar`} 
        style={{ animationDelay: '0.2s' }}
        onScroll={handleScroll}
      >
        {messages.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/25">
                      <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                      </svg>
                    </div>
                    <h3 className={`${themeClasses.textPrimary} text-2xl font-bold mb-4`}>
                      {language === 'hebrew' ? 'אין הודעות עדיין' : 'No Messages Yet'}
                    </h3>
                    <p className={`${themeClasses.textSecondary} text-lg mb-6`}>
                      {language === 'hebrew' 
                        ? 'ההודעות שלכם מהבוט ב-WhatsApp יופיעו כאן.'
                        : 'Your messages from the WhatsApp bot will appear here.'
                      }
                    </p>
                    <div className={`${themeClasses.bgSecondary} rounded-xl p-6 max-w-md mx-auto border-l-4 border-green-500`}>
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                          <svg className="w-6 h-6 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                          </svg>
                        </div>
                        <div className="flex-1 text-left">
                          <h4 className={`${themeClasses.textPrimary} font-semibold text-lg mb-2`}>
                            {language === 'hebrew' ? 'שלחו הודעה ב-WhatsApp' : 'Send a Message on WhatsApp'}
                          </h4>
                          <p className={`${themeClasses.textSecondary} text-sm`}>
                            {language === 'hebrew'
                              ? 'כדי לשלוח הודעה לבוט, פתחו את WhatsApp ופנו לבוט ישירות. ההודעות יופיעו כאן לאחר מכן.'
                              : 'To send a message to the bot, open WhatsApp and contact the bot directly. Messages will appear here afterwards.'
                            }
                          </p>
                        </div>
                      </div>
                    </div>
          </div>
        ) : (
          <div className="space-y-4">
                    {/* Load More Button */}
                    {hasMoreMessages && (
                      <div className="flex justify-center py-3">
                        <button
                          onClick={handleLoadMore}
                          disabled={isLoadingMore}
                          className="px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-purple-500/25"
                        >
                          {isLoadingMore ? (
                            <div className="flex items-center gap-2">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              Loading more...
                            </div>
                          ) : (
                            'Load more'
                          )}
                        </button>
                      </div>
                    )}
                    
                    {messages.map((message, index) => (
                      <div key={message.id}>
                        {/* Date Separator */}
                        {shouldShowDateSeparator(message, messages[index - 1]) && (
                        <div className="flex items-center justify-center my-4">
                          <div className={`${themeClasses.bgSecondary} ${themeClasses.textSecondary} px-3 py-1 rounded-full text-xs font-medium`}>
                              {formatChatDate(message.timestamp)}
                          </div>
                        </div>
                        )}
                        
                        {/* Message */}
                        <div
                          className={`mb-2 flex animate-slideInUp`}
                          style={{ 
                            animationDelay: `${0.3 + index * 0.1}s`,
                            justifyContent: message.sender === 'user' ? 'flex-end' : 'flex-start',
                            direction: message.sender === 'user' ? 'ltr' : 'ltr'
                          }}
                          >
                            <div
                              className={`max-w-[85%] sm:max-w-xs lg:max-w-md px-3 sm:px-4 py-2 sm:py-3 rounded-2xl shadow-lg relative ${
                                message.sender === 'user'
                                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white'
                                  : `${themeClasses.bgSecondary} ${themeClasses.textPrimary} border ${themeClasses.borderPrimary}`
                              }`}
                            >
                              <div className="text-sm leading-relaxed pr-12">
                                {renderMessageContent(message)}
                              </div>
                              <p className={`text-xs mt-1 absolute bottom-1 right-2 ${
                                message.sender === 'user' ? 'text-emerald-100' : themeClasses.textMuted
                              }`}>
                                {formatMessageTime(message.created_at)}
                              </p>
                            </div>
                          </div>
                      </div>
                    ))}
              </div>
            )}
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 p-4"
          onClick={handleCloseImageModal}
          style={{ backdropFilter: 'blur(4px)' }}
        >
          <div className="relative max-w-7xl max-h-full">
            {/* Close Button */}
            <button
              onClick={handleCloseImageModal}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors duration-200 z-10"
              aria-label="Close image"
            >
              <svg
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            
            {/* Image */}
            <img
              src={selectedImage}
              alt="Full size"
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              onError={(e) => {
                console.error('Failed to load image in modal', e);
                handleCloseImageModal();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default MessagesTab;
