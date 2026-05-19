(function() {
  const widgetHTML = `
    <div id="chatbot-widget">
      <div id="chatbot-button" class="chatbot-btn">
        <span class="chatbot-icon">💅</span>
        <span class="chatbot-text">שאלי אותי!</span>
      </div>
      <div id="chatbot-window" class="chatbot-window hidden">
        <div class="chatbot-header">
          <div class="chatbot-header-content">
            <span class="chatbot-avatar">💅</span>
            <div>
              <h3>אופק - צ'אט בוט</h3>
              <p>אני כאן לעזור!</p>
            </div>
          </div>
          <button id="chatbot-close" class="chatbot-close-btn">✕</button>
        </div>
        <div id="chatbot-messages" class="chatbot-messages"></div>
        <div class="chatbot-input-area">
          <input type="text" id="chatbot-input" placeholder="כתבי את השאלה שלך..." />
          <button id="chatbot-send" class="chatbot-send-btn">➤</button>
        </div>
      </div>
    </div>
  `;

  const widgetCSS = `
    #chatbot-widget {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 9999;
      font-family: 'DM Sans', sans-serif;
    }
    .chatbot-btn {
      background: linear-gradient(135deg, #c9a0a0, #a07080);
      color: white;
      border: none;
      border-radius: 50px;
      padding: 15px 25px;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(160,112,128,0.4);
      display: flex;
      align-items: center;
      gap: 10px;
      transition: all 0.3s;
      animation: chatPulse 2s infinite;
    }
    .chatbot-btn:hover {
      transform: translateY(-3px);
      box-shadow: 0 6px 25px rgba(160,112,128,0.6);
    }
    @keyframes chatPulse {
      0%, 100% { box-shadow: 0 4px 20px rgba(160,112,128,0.4); }
      50% { box-shadow: 0 4px 30px rgba(160,112,128,0.7); }
    }
    .chatbot-icon { font-size: 24px; }
    .chatbot-text { font-weight: 600; font-size: 16px; }
    .chatbot-window {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 380px;
      max-width: calc(100vw - 40px);
      height: 550px;
      max-height: calc(100vh - 100px);
      background: white;
      border-radius: 4px;
      box-shadow: 0 10px 40px rgba(107,76,85,0.2);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transition: all 0.3s;
    }
    .chatbot-window.hidden {
      opacity: 0;
      pointer-events: none;
      transform: translateY(20px) scale(0.95);
    }
    .chatbot-header {
      background: linear-gradient(135deg, #6b4c55, #a07080);
      color: white;
      padding: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .chatbot-header-content { display: flex; align-items: center; gap: 12px; }
    .chatbot-avatar { font-size: 32px; }
    .chatbot-header h3 { margin: 0; font-size: 18px; font-weight: 600; }
    .chatbot-header p { margin: 0; font-size: 13px; opacity: 0.9; }
    .chatbot-close-btn {
      background: rgba(255,255,255,0.2);
      border: none;
      color: white;
      width: 32px; height: 32px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 18px;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.2s;
    }
    .chatbot-close-btn:hover { background: rgba(255,255,255,0.3); transform: rotate(90deg); }
    .chatbot-messages {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      background: #faf7f5;
    }
    .chat-message { margin-bottom: 16px; animation: slideIn 0.3s ease; }
    @keyframes slideIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
    .message-bot { display: flex; gap: 10px; align-items: start; }
    .message-user { display: flex; gap: 10px; align-items: start; flex-direction: row-reverse; }
    .message-avatar {
      width: 36px; height: 36px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 18px; flex-shrink: 0;
    }
    .bot-avatar { background: linear-gradient(135deg, #c9a0a0, #a07080); }
    .user-avatar { background: #6b4c55; }
    .message-bubble { max-width: 70%; padding: 10px 14px; border-radius: 14px; line-height: 1.5; font-size: 14px; }
    .bot-bubble { background: white; color: #3d2e32; border-bottom-left-radius: 4px; border: 1px solid #ede0da; }
    .user-bubble { background: #6b4c55; color: white; border-bottom-right-radius: 4px; }
    .quick-replies { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; padding: 0 46px; }
    .quick-reply-btn {
      background: white;
      border: 1.5px solid #c9a0a0;
      color: #6b4c55;
      padding: 8px 14px;
      border-radius: 50px;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
      font-family: 'DM Sans', sans-serif;
    }
    .quick-reply-btn:hover { background: #f2e0dc; border-color: #a07080; transform: translateY(-2px); }
    .chatbot-input-area {
      padding: 16px;
      background: white;
      border-top: 1px solid #ede0da;
      display: flex;
      gap: 10px;
    }
    #chatbot-input {
      flex: 1;
      padding: 10px 14px;
      border: 1px solid #ede0da;
      border-radius: 50px;
      font-size: 14px;
      font-family: 'DM Sans', sans-serif;
      outline: none;
      background: #faf7f5;
      transition: border-color 0.2s;
    }
    #chatbot-input:focus { border-color: #a07080; background: #fff; }
    .chatbot-send-btn {
      background: linear-gradient(135deg, #c9a0a0, #a07080);
      color: white;
      border: none;
      width: 40px; height: 40px;
      border-radius: 50%;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      font-size: 18px;
      transition: transform 0.2s;
    }
    .chatbot-send-btn:hover { transform: scale(1.1); }
    .typing-indicator { display: flex; gap: 4px; padding: 10px 14px; }
    .typing-dot { width: 8px; height: 8px; background: #c9a0a0; border-radius: 50%; animation: typing 1.4s infinite; }
    .typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .typing-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes typing { 0%,60%,100% { transform:translateY(0); } 30% { transform:translateY(-8px); } }
    @media (max-width: 768px) {
      #chatbot-widget { bottom: 10px; right: 10px; }
      .chatbot-window { width: calc(100vw - 20px); height: calc(100vh - 80px); bottom: 10px; right: 10px; }
      .chatbot-btn { padding: 12px 20px; }
      .chatbot-text { font-size: 14px; }
    }
  `;

  const style = document.createElement('style');
  style.textContent = widgetCSS;
  document.head.appendChild(style);
  document.body.insertAdjacentHTML('beforeend', widgetHTML);

  const chatbotButton   = document.getElementById('chatbot-button');
  const chatbotWindow   = document.getElementById('chatbot-window');
  const chatbotClose    = document.getElementById('chatbot-close');
  const chatbotMessages = document.getElementById('chatbot-messages');
  const chatbotInput    = document.getElementById('chatbot-input');
  const chatbotSend     = document.getElementById('chatbot-send');

  let isOpen = false;
  let initialized = false;

  chatbotButton.addEventListener('click', () => {
    isOpen = true;
    chatbotWindow.classList.remove('hidden');
    chatbotButton.style.display = 'none';
    if (!initialized) { initialized = true; initChatbot(); }
  });

  chatbotClose.addEventListener('click', () => {
    isOpen = false;
    chatbotWindow.classList.add('hidden');
    chatbotButton.style.display = 'flex';
  });

  function initChatbot() {
    setTimeout(() => {
      addMessage(
        'היי! 👋 אני הצ\'אט בוט של אופק 💅\n\nאני כאן כדי לענות על כל השאלות שלך!\n\nמה תרצי לדעת?',
        false,
        ['שעות פעילות', 'כמה עולה לק ג\'ל?', 'איפה את נמצאת?', 'קביעת תור']
      );
    }, 400);
  }

  function getServicesText() {
    if (typeof getServices !== 'function') return 'לפרטים על מחירים - צרי קשר בוואטסאפ! 💕';
    const services = getServices();
    let text = '💰 מחירון השירותים:\n\n';
    services.forEach(s => { text += `${s.icon} ${s.name} - ₪${s.price}\n`; });
    text += '\n📞 למבצעים - צרי קשר בוואטסאפ! 💕';
    return text;
  }

  const faqData = {
    'שעות פעילות': {
      answer: '🕐 שעות הפעילות שלי:\n\n🗓️ ראשון - חמישי: 10:00-20:00\n🗓️ שישי: 10:00-14:00\n🗓️ שבת: סגור\n\n💡 ניתן לתאם תורים מיוחדים לפי בקשה 💅',
      quickReplies: ['כמה עולה לק ג\'ל?', 'קביעת תור', 'איפה את נמצאת?']
    },
    'מחיר': {
      get answer() { return getServicesText(); },
      quickReplies: ['שעות פעילות', 'קביעת תור בוואטסאפ']
    },
    'מיקום': {
      answer: '📍 הכתובת המדויקת תישלח לך בוואטסאפ בעת קביעת התור 💅\n\n🚗 חניות בשפע באזור!',
      quickReplies: ['קבלת כתובת בוואטסאפ', 'קביעת תור', 'שעות פעילות']
    },
    'תור': {
      answer: '📅 מעולה! בואי נקבע לך תור\n\n1️⃣ דרך האתר - לחצי על הכפתור למטה\n2️⃣ דרך וואטסאפ - שלחי לי הודעה\n\nמה נוח לך יותר? 💅',
      quickReplies: ['קביעת תור באתר', 'קביעת תור בוואטסאפ']
    },
    'עמידות': {
      answer: '💪 לק הג\'ל מחזיק בין 2-3 שבועות!\n\nעם טיפול נכון - הלק יישאר מושלם! 💅✨',
      quickReplies: ['טיפים לשמירה', 'קביעת תור']
    },
    'טיפים': {
      answer: '💡 טיפים לשמירה על הלק:\n\n✓ השתמשי בכפפות בעבודות בית\n✓ הימנעי מחשיפה ממושכת למים חמים\n✓ אל תקלפי את הלק בעצמך!\n✓ חזרי לטיפול כל 2-3 שבועות 💅',
      quickReplies: ['קביעת תור', 'שעות פעילות']
    },
    'תשלום': {
      answer: '💳 אפשרויות תשלום:\n\n✓ מזומן 💵\n✓ ביט / פייבוקס 📱\n✓ העברה בנקאית 🏦',
      quickReplies: ['קביעת תור', 'שעות פעילות']
    }
  };

  const intentKeywords = {
    'שעות פעילות': ['שעות', 'פעילות', 'פתוח', 'סגור', 'מתי', 'זמינה', 'עובדת'],
    'מחיר': ['מחיר', 'עולה', 'כמה', 'עלות', 'מחירון'],
    'מיקום': ['איפה', 'מיקום', 'כתובת', 'נמצאת', 'הגעה'],
    'תור': ['תור', 'קביעה', 'לקבוע', 'זימון'],
    'עמידות': ['מחזיק', 'עמיד', 'נשאר', 'כמה זמן'],
    'טיפים': ['טיפים', 'שמירה', 'לשמור', 'המלצות'],
    'תשלום': ['תשלום', 'לשלם', 'מזומן', 'ביט', 'אשראי']
  };

  function findIntent(message) {
    const lower = message.toLowerCase();
    for (const [intent, keywords] of Object.entries(intentKeywords)) {
      for (const kw of keywords) {
        if (lower.includes(kw)) return intent;
      }
    }
    return null;
  }

  function addMessage(text, isUser = false, quickReplies = []) {
    const div = document.createElement('div');
    div.className = `chat-message ${isUser ? 'message-user' : 'message-bot'}`;
    const avatar = document.createElement('div');
    avatar.className = `message-avatar ${isUser ? 'user-avatar' : 'bot-avatar'}`;
    avatar.textContent = isUser ? '👤' : '💅';
    const bubble = document.createElement('div');
    bubble.className = `message-bubble ${isUser ? 'user-bubble' : 'bot-bubble'}`;
    bubble.innerHTML = text.replace(/\n/g, '<br>');
    div.appendChild(avatar);
    div.appendChild(bubble);
    chatbotMessages.appendChild(div);
    if (quickReplies.length > 0) {
      const repliesDiv = document.createElement('div');
      repliesDiv.className = 'quick-replies';
      quickReplies.forEach(reply => {
        const btn = document.createElement('button');
        btn.className = 'quick-reply-btn';
        btn.textContent = reply;
        btn.onclick = () => handleQuickReply(reply);
        repliesDiv.appendChild(btn);
      });
      chatbotMessages.appendChild(repliesDiv);
    }
    chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
  }

  function showTyping() {
    const div = document.createElement('div');
    div.className = 'chat-message message-bot'; div.id = 'typingIndicator';
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar bot-avatar'; avatar.textContent = '💅';
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble bot-bubble typing-indicator';
    bubble.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
    div.appendChild(avatar); div.appendChild(bubble);
    chatbotMessages.appendChild(div);
    chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
  }

  function hideTyping() { document.getElementById('typingIndicator')?.remove(); }

  function handleMessage(message) {
    if (!message.trim()) return;
    addMessage(message, true);
    chatbotInput.value = '';
    showTyping();
    setTimeout(() => {
      hideTyping();
      const intent = findIntent(message);
      if (intent && faqData[intent]) {
        addMessage(faqData[intent].answer, false, faqData[intent].quickReplies);
      } else {
        addMessage(
          'מצטערת, לא הבנתי 😅\n\nאת יכולה לשאול על:\n• שעות פעילות\n• מחירים\n• קביעת תור\n• מיקום',
          false,
          ['שעות פעילות', 'כמה עולה לק ג\'ל?', 'קביעת תור']
        );
      }
    }, 1000);
  }

  function handleQuickReply(reply) {
    if (reply === 'קביעת תור באתר') { window.location.href = 'booking.html'; return; }
    if (reply === 'קביעת תור בוואטסאפ') { window.open('https://wa.me/972546827299?text=היי%20אופק!%20אשמח%20לקבוע%20תור%20💅', '_blank'); return; }
    if (reply === 'קבלת כתובת בוואטסאפ') { window.open('https://wa.me/972546827299?text=היי%20אופק!%20אשמח%20לקבל%20את%20הכתובת%20💅', '_blank'); return; }
    handleMessage(reply);
  }

  chatbotSend.addEventListener('click', () => handleMessage(chatbotInput.value));
  chatbotInput.addEventListener('keypress', e => { if (e.key === 'Enter') handleMessage(chatbotInput.value); });
})();
