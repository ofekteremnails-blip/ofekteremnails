// Chatbot Widget
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
      background: linear-gradient(135deg, #e8a4b8, #c97a96);
      color: white;
      border: none;
      border-radius: 50px;
      padding: 15px 25px;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(232,164,184,0.4);
      display: flex;
      align-items: center;
      gap: 10px;
      transition: all 0.3s;
      animation: chatPulse 2s infinite;
    }
    .chatbot-btn:hover { transform: translateY(-3px); box-shadow: 0 6px 25px rgba(232,164,184,0.6); }
    @keyframes chatPulse {
      0%,100% { box-shadow: 0 4px 20px rgba(232,164,184,0.4); }
      50% { box-shadow: 0 4px 30px rgba(232,164,184,0.7); }
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
      border-radius: 20px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transition: all 0.3s;
    }
    .chatbot-window.hidden { opacity: 0; pointer-events: none; transform: translateY(20px) scale(0.95); }
    .chatbot-header {
      background: linear-gradient(135deg, #e8a4b8, #c97a96);
      color: white;
      padding: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .chatbot-header-content { display: flex; align-items: center; gap: 12px; }
    .chatbot-avatar { font-size: 32px; }
    .chatbot-header h3 { margin: 0; font-size: 18px; font-weight: 700; }
    .chatbot-header p { margin: 0; font-size: 13px; opacity: 0.9; }
    .chatbot-close-btn {
      background: rgba(255,255,255,0.2); border: none; color: white;
      width: 32px; height: 32px; border-radius: 50%; cursor: pointer;
      font-size: 20px; display: flex; align-items: center; justify-content: center; transition: all 0.2s;
    }
    .chatbot-close-btn:hover { background: rgba(255,255,255,0.3); transform: rotate(90deg); }
    .chatbot-messages { flex: 1; overflow-y: auto; padding: 20px; background: #f9f9f9; }
    .chat-message { margin-bottom: 16px; animation: chatSlideIn 0.3s ease; }
    @keyframes chatSlideIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
    .message-bot { display: flex; gap: 10px; align-items: start; }
    .message-user { display: flex; gap: 10px; align-items: start; flex-direction: row-reverse; }
    .message-avatar { width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:18px; flex-shrink:0; }
    .bot-avatar { background: linear-gradient(135deg, #e8a4b8, #c97a96); }
    .user-avatar { background: #8b5a7d; }
    .message-bubble { max-width:70%; padding:10px 14px; border-radius:14px; line-height:1.5; font-size:14px; }
    .bot-bubble { background: white; color: #333; border-bottom-left-radius: 4px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
    .user-bubble { background: #8b5a7d; color: white; border-bottom-right-radius: 4px; }
    .quick-replies { display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; padding:0 46px; }
    .quick-reply-btn {
      background: white; border: 2px solid #e8a4b8; color: #8b5a7d;
      padding: 8px 14px; border-radius: 16px; font-size: 13px; cursor: pointer;
      transition: all 0.2s; font-family: 'DM Sans', sans-serif;
    }
    .quick-reply-btn:hover { background: #e8a4b8; color: white; transform: translateY(-2px); }
    .chatbot-input-area { padding:16px; background:white; border-top:1px solid #e0e0e0; display:flex; gap:10px; }
    #chatbot-input {
      flex:1; padding:10px 14px; border:2px solid #e0e0e0; border-radius:20px;
      font-size:14px; font-family:'DM Sans',sans-serif; transition:border-color 0.2s; direction:rtl;
    }
    #chatbot-input:focus { outline:none; border-color:#e8a4b8; }
    .chatbot-send-btn {
      background: linear-gradient(135deg, #e8a4b8, #c97a96); color:white; border:none;
      width:40px; height:40px; border-radius:50%; cursor:pointer;
      display:flex; align-items:center; justify-content:center; font-size:18px; transition:transform 0.2s;
    }
    .chatbot-send-btn:hover { transform: scale(1.1); }
    .typing-indicator { display:flex; gap:4px; padding:10px 14px; }
    .typing-dot { width:8px; height:8px; background:#999; border-radius:50%; animation:chatTyping 1.4s infinite; }
    .typing-dot:nth-child(2) { animation-delay:0.2s; }
    .typing-dot:nth-child(3) { animation-delay:0.4s; }
    @keyframes chatTyping { 0%,60%,100% { transform:translateY(0); } 30% { transform:translateY(-8px); } }
    @media (max-width:768px) {
      #chatbot-widget { bottom:80px; right:10px; }
      .chatbot-window { width:calc(100vw - 20px); height:calc(100vh - 160px); bottom:80px; right:10px; }
      .chatbot-btn { padding:12px 20px; }
      .chatbot-text { font-size:14px; }
    }
  `;

  const styleEl = document.createElement('style');
  styleEl.textContent = widgetCSS;
  document.head.appendChild(styleEl);
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

  function getWaPhone() {
    try {
      if (typeof getSettings === 'function') {
        const p = getSettings().waPhone;
        if (p) return p.replace(/\D/g, '');
      }
    } catch(e) {}
    return '972546827299';
  }

  function getWorkHoursText() {
    if (typeof getSettings !== 'function') return '🕐 לשעות הפעילות המעודכנות - שלחי לי הודעה בוואטסאפ 💅';
    const settings = getSettings();
    const dayNames = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
    let text = '🕐 שעות הפעילות שלי:\n\n';
    Object.entries(settings.workDays).forEach(([dow, day]) => {
      text += day.active ? `🗓️ ${dayNames[dow]}: ${day.start}–${day.end}\n` : `🗓️ ${dayNames[dow]}: סגור\n`;
    });
    return text;
  }

  function getServicesText() {
    if (typeof getServices !== 'function') return 'לא הצלחתי לטעון את המחירון, נסי שוב או צרי קשר בוואטסאפ 💕';
    const services = getServices();
    let text = '💰 מחירון השירותים:\n\n';
    services.forEach(s => { text += `${s.icon} ${s.name}${s.price ? ' - ₪' + s.price : ''} (${s.duration} דק\')\n`; });
    return text;
  }

  const faqData = {
    'שעות פעילות': {
      get answer() { return getWorkHoursText(); },
      quickReplies: ['מחירים', 'קביעת תור', 'כמה זמן מחזיק?']
    },
    'מחיר': {
      get answer() { return getServicesText(); },
      quickReplies: ['שעות פעילות', 'קביעת תור', 'כמה זמן מחזיק?']
    },
    'תור': {
      answer: '📅 מעולה! בואי נקבע לך תור 💅\n\nאת יכולה לקבוע בשתי דרכים:\n\n1️⃣ דרך האתר - מהיר ונוח\n2️⃣ דרך וואטסאפ - שלחי לי הודעה\n\nמה נוח לך?',
      quickReplies: ['קביעת תור באתר', 'קביעת תור בוואטסאפ']
    },
    'עמידות': {
      answer: '💪 לק הג\'ל מחזיק בין 2-3 שבועות!\n\nזה תלוי ב:\n✓ סוג הפעילות שלך\n✓ טיפול נכון בציפורניים\n✓ שימוש בכפפות בעבודות בית\n\nעם טיפול נכון - הלק יישאר מושלם! ✨',
      quickReplies: ['טיפים לשמירה', 'מחירים', 'קביעת תור']
    },
    'טיפים': {
      answer: '💡 טיפים לשמירה על הלק:\n\n✓ השתמשי בכפפות בעבודות בית\n✓ הימנעי מחשיפה ממושכת למים חמים\n✓ שמרי על לחות הידיים\n✓ אל תקלפי את הלק בעצמך!\n✓ חזרי לטיפול כל 2-3 שבועות 💅',
      quickReplies: ['כמה זמן מחזיק?', 'מחירים', 'קביעת תור']
    },
    'ביטול': {
      answer: '🔄 ביטול או שינוי תור:\n\nניתן לבטל או לשנות תור עד 24 שעות לפני המועד 📅\n\nפשוט שלחי לי הודעה בוואטסאפ או דרך האזור האישי באתר 💬',
      quickReplies: ['קביעת תור בוואטסאפ', 'קביעת תור באתר']
    },
    'תשלום': {
      answer: '💳 אפשרויות תשלום:\n\n✓ מזומן 💵\n✓ ביט / פייבוקס 📱\n✓ העברה בנקאית 🏦\n\nהתשלום מתבצע בסיום הטיפול 💅',
      quickReplies: ['מחירים', 'קביעת תור']
    },
    'מיקום': {
      answer: '💅 אני נמצאת באזור המרכז 📍\n\nהכתובת המדויקת תישלח לך בוואטסאפ:\n• בעת קביעת התור\n• או פשוט שלחי הודעה ואשלח לך מיד\n\n🚗 חניות בשפע באזור! חניה נוחה וזמינה',
      quickReplies: ['קבלת כתובת בוואטסאפ', 'קביעת תור', 'מחירים']
    }
  };

  const intentKeywords = {
    'שעות פעילות': ['שעות','פעילות','פתוח','סגור','מתי','זמינה','עובדת','ימים'],
    'מחיר': ['מחיר','עולה','כמה','עלות','מחירון','לק','טיפסים','בנייה','שירותים'],
    'תור': ['תור','קביעה','לקבוע','זימון','פגישה'],
    'עמידות': ['מחזיק','עמיד','כמה זמן','נשאר','עמידות'],
    'טיפים': ['טיפים','שמירה','לשמור','המלצות'],
    'ביטול': ['ביטול','לבטל','שינוי','לשנות'],
    'תשלום': ['תשלום','לשלם','מזומן','ביט','אשראי','פייבוקס'],
    'מיקום': ['איפה','כתובת','מיקום','נמצאת','איך מגיעים','חניה','מגיעים']
  };

  function findIntent(msg) {
    const lower = msg.toLowerCase();
    for (const [intent, keywords] of Object.entries(intentKeywords)) {
      if (keywords.some(k => lower.includes(k))) return intent;
    }
    return null;
  }

  function addMessage(text, isUser = false, quickReplies = []) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${isUser ? 'message-user' : 'message-bot'}`;

    const avatar = document.createElement('div');
    avatar.className = `message-avatar ${isUser ? 'user-avatar' : 'bot-avatar'}`;
    avatar.textContent = isUser ? '👤' : '💅';

    const bubble = document.createElement('div');
    bubble.className = `message-bubble ${isUser ? 'user-bubble' : 'bot-bubble'}`;
    bubble.innerHTML = text.replace(/\n/g, '<br>');

    msgDiv.appendChild(avatar);
    msgDiv.appendChild(bubble);
    chatbotMessages.appendChild(msgDiv);

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
    div.className = 'chat-message message-bot';
    div.id = 'typingIndicator';
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar bot-avatar';
    avatar.textContent = '💅';
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble bot-bubble typing-indicator';
    bubble.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
    div.appendChild(avatar);
    div.appendChild(bubble);
    chatbotMessages.appendChild(div);
    chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
  }

  function hideTyping() {
    document.getElementById('typingIndicator')?.remove();
  }

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
          'מצטערת, לא הבנתי 😅\n\nאת יכולה לשאול אותי על:\n• שעות פעילות\n• מחירים\n• קביעת תור\n• עמידות הלק\n• תשלום',
          false,
          ['שעות פעילות', 'מחירים', 'קביעת תור']
        );
      }
    }, 900);
  }

  function handleQuickReply(reply) {
    if (reply === 'קביעת תור באתר') { window.location.href = 'booking.html'; return; }
    if (reply === 'קביעת תור בוואטסאפ') {
      window.open(`https://wa.me/${getWaPhone()}?text=${encodeURIComponent('היי אופק! אשמח לקבוע תור 💅')}`, '_blank');
      return;
    }
    if (reply === 'קבלת כתובת בוואטסאפ') {
      window.open(`https://wa.me/${getWaPhone()}?text=${encodeURIComponent('היי אופק! אשמח לקבל את הכתובת 📍')}`, '_blank');
      return;
    }
    handleMessage(reply);
  }

  function initChatbot() {
    if (typeof loadSettingsFromSheets === 'function') loadSettingsFromSheets().catch(() => {});
    setTimeout(() => {
      addMessage(
        'היי! 👋 אני הצ\'אט בוט של אופק תרם ניילס 💅\n\nאני כאן לענות על כל השאלות שלך!\n\nמה תרצי לדעת?',
        false,
        ['שעות פעילות', 'מחירים', 'קביעת תור', 'איפה את נמצאת?']
      );
    }, 400);
  }

  chatbotSend.addEventListener('click', () => handleMessage(chatbotInput.value));
  chatbotInput.addEventListener('keypress', e => { if (e.key === 'Enter') handleMessage(chatbotInput.value); });
})();
