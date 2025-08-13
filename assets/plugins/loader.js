//
// SPDX-FileCopyrightText: Hadad <hadad@linuxmail.org>
// SPDX-License-Identifier: Apache-2.0
//

// Prism.
Prism.plugins.autoloader.languages_path = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/';

// WebSocket.
const socket = new WebSocket((window.location.protocol==="https:"?"wss":"ws")+"//"+window.location.host);

// UI elements.
const chatArea = document.getElementById('chatArea');
const chatBox = document.getElementById('chatBox');
const initialContent = document.getElementById('initialContent');
const form = document.getElementById('footerForm');
const input = document.getElementById('userInput');
const btn = document.getElementById('sendBtn');
const stopBtn = document.getElementById('stopBtn');
const promptItems = document.querySelectorAll('.prompt-item');
const mainHeader = document.getElementById('mainHeader');
const chatHeader = document.getElementById('chatHeader');
const homeBtn = document.getElementById('homeBtn');
const clearBtn = document.getElementById('clearBtn');

// Track state.
let streamMsg = null;
let conversationHistory = [];
let currentAssistantText = "";

// Render markdown content.
function renderMarkdown(el) {
  const raw = el.dataset.text || "";
  const html = marked.parse(raw, {
    gfm: true,
    breaks: true,
    smartLists: true,
    smartypants: false,
    headerIds: false
  });
  el.innerHTML = '<div class="md-content">' + html + '</div>';
  const wrapper = el.querySelector('.md-content');

  // Wrap tables.
  const tables = wrapper.querySelectorAll('table');
  tables.forEach(t => {
    if (t.parentNode && t.parentNode.classList && t.parentNode.classList.contains('table-wrapper')) return;
    const div = document.createElement('div');
    div.className = 'table-wrapper';
    t.parentNode.insertBefore(div, t);
    div.appendChild(t);
  });

  // Style horizontal rules.
  const hrs = wrapper.querySelectorAll('hr');
  hrs.forEach(h => {
    if (!h.classList.contains('styled-hr')) {
      h.classList.add('styled-hr');
    }
  });

  // Highlight code.
  Prism.highlightAllUnder(wrapper);
}

// Chat view.
function enterChatView() {
  mainHeader.style.display = 'none';
  chatHeader.style.display = 'flex';
  chatHeader.setAttribute('aria-hidden', 'false');
  chatBox.style.display = 'flex';
  initialContent.style.display = 'none';
}

// Home view.
function leaveChatView() {
  mainHeader.style.display = 'flex';
  chatHeader.style.display = 'none';
  chatHeader.setAttribute('aria-hidden', 'true');
  chatBox.style.display = 'none';
  initialContent.style.display = 'flex';
}

// Chat bubble.
function addMsg(who, text) {
  const div = document.createElement('div');
  div.className = 'bubble ' + (who==='user' ? 'bubble-user' : 'bubble-assist');
  div.dataset.text = text;
  renderMarkdown(div);
  chatBox.appendChild(div);
  chatBox.style.display='flex';
  chatBox.scrollTop = chatBox.scrollHeight;
  return div;
}

// Clear all chat.
function clearAllMessages() {
  try { socket.send(JSON.stringify({type:'stop'})); } catch {}
  conversationHistory = [];
  currentAssistantText = "";
  if(streamMsg) {
    const loadingEl = streamMsg.querySelector('.loading');
    if(loadingEl) loadingEl.remove();
    streamMsg = null;
  }
  chatBox.innerHTML = "";
  input.value = "";
  btn.disabled = true;
  stopBtn.style.display = 'none';
  btn.style.display = 'inline-flex';
  enterChatView();
}

// Wait for socket ready.
function sendWhenReady(msgFn) {
  if (socket.readyState === WebSocket.OPEN) {
    msgFn();
  } else {
    socket.addEventListener('open', function handler() {
      msgFn();
      socket.removeEventListener('open', handler);
    });
  }
}

// Prompts.
promptItems.forEach(p => {
  p.addEventListener('click', () => {
    input.value = p.dataset.prompt;
    sendWhenReady(submitMessage);
  });
});

// Send user message.
async function submitMessage() {
  const message = input.value.trim();
  if(!message) return;
  enterChatView();
  addMsg('user', message);
  conversationHistory.push({role: 'user', content: message});
  streamMsg = addMsg('assistant', '');
  const loadingEl = document.createElement('span');
  loadingEl.className = 'loading';
  streamMsg.appendChild(loadingEl);
  stopBtn.style.display = 'inline-flex';
  btn.style.display = 'none';
  input.value='';
  btn.disabled = true;
  try {
    socket.send(JSON.stringify({type:'ask', message, history: conversationHistory}));
  } catch (error) {
    if(streamMsg){ 
      const loadingEl = streamMsg.querySelector('.loading');
      if(loadingEl) loadingEl.remove();
      streamMsg.dataset.text = error.message || 'An error occurred during the request.';
      renderMarkdown(streamMsg);
      streamMsg.dataset.done='1'; 
      streamMsg=null; 
    }
    btn.style.display = 'inline-flex';
    stopBtn.style.display = 'none';
  }
}

// Submit.
form.addEventListener('submit', e => {
  e.preventDefault();
  submitMessage();
});

// Stop.
stopBtn.addEventListener('click', () => {
  stopBtn.style.pointerEvents = 'none';
  try { socket.send(JSON.stringify({type:'stop'})); } catch {}
});

// Home.
homeBtn.addEventListener('click', () => {
  leaveChatView();
});

// Clear messages.
clearBtn.addEventListener('click', () => {
  clearAllMessages();
});

// Socket messages.
socket.onmessage = (e) => {
  const data = JSON.parse(e.data);
  if(data.type==='chunk') {
    if(streamMsg) {
      const loadingEl = streamMsg.querySelector('.loading');
      if(loadingEl) loadingEl.remove();
      streamMsg.dataset.text += data.chunk;
      currentAssistantText = streamMsg.dataset.text ||"";
      renderMarkdown(streamMsg);
      chatBox.scrollTop = chatBox.scrollHeight;
    }
  } else if(data.type==='end' || data.type==='error') {
    if(streamMsg){
      const text = streamMsg.dataset.text || "";
      const loadingEl = streamMsg.querySelector('.loading');
      if(loadingEl) loadingEl.remove();
      streamMsg.dataset.done='1';
      if(data.type==='error') {
        streamMsg.dataset.text = data.error || 'An error occurred during the request.';
        renderMarkdown(streamMsg);
      } else {
        conversationHistory.push({role: 'assistant', content: text});
      }
      streamMsg = null;
    }
    btn.style.display = 'inline-flex';
    stopBtn.style.display = 'none';
    stopBtn.style.pointerEvents = 'auto';
  }
};

// Enable send button only if input has text.
input.addEventListener('input', () => {
  btn.disabled= input.value.trim() === '';
});

// Animations.
document.addEventListener('DOMContentLoaded', function() {
  AOS.init({
    duration: 800,
    easing: 'ease-out-cubic',
    once: true,
    offset: 50
  });
});