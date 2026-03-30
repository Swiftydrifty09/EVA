// JARVIS - AI Assistant
class Jarvis {
    constructor() {
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.isListening = false;
        this.init();
    }

    init() {
        this.setupSpeechRecognition();
        this.setupEventListeners();
        this.greet();
    }

    setupSpeechRecognition() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = false;
            this.recognition.lang = 'en-US';

            this.recognition.onstart = () => {
                this.isListening = true;
                this.updateVoiceButton('Listening...', true);
            };

            this.recognition.onend = () => {
                this.isListening = false;
                this.updateVoiceButton('Speak', false);
            };

            this.recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                this.processCommand(transcript);
            };

            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                this.updateVoiceButton('Speak', false);
                this.speak("I'm sorry, I didn't catch that. Please try again.");
            };
        } else {
            console.warn('Speech recognition not supported');
            document.getElementById('voiceBtn').style.display = 'none';
        }
    }

    setupEventListeners() {
        document.getElementById('voiceBtn').addEventListener('click', () => {
            if (this.isListening) {
                this.recognition.stop();
            } else {
                this.recognition.start();
            }
        });

        document.getElementById('sendBtn').addEventListener('click', () => {
            const text = document.getElementById('textInput').value.trim();
            if (text) {
                this.processCommand(text);
                document.getElementById('textInput').value = '';
            }
        });

        document.getElementById('textInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('sendBtn').click();
            }
        });
    }

    updateVoiceButton(text, listening) {
        const btn = document.getElementById('voiceBtn');
        const textSpan = btn.querySelector('.button-text');
        textSpan.textContent = text;
        
        if (listening) {
            btn.classList.add('listening');
        } else {
            btn.classList.remove('listening');
        }
    }

    processCommand(command) {
        const response = document.getElementById('response');
        response.textContent = `Processing: "${command}"`;
        response.classList.add('active');

        // Convert to lowercase for easier matching
        const cmd = command.toLowerCase();

        let reply = '';

        // Basic commands with more JARVIS-like personality
        if (cmd.includes('hello') || cmd.includes('hi') || cmd.includes('hey')) {
            const greetings = [
                "Hello, sir. How can I assist you today?",
                "Good day, sir. What can I do for you?",
                "Greetings. I'm at your service."
            ];
            reply = greetings[Math.floor(Math.random() * greetings.length)];
        } else if (cmd.includes('time')) {
            const now = new Date();
            reply = `The current time is ${now.toLocaleTimeString()}.`;
        } else if (cmd.includes('date')) {
            const now = new Date();
            reply = `Today's date is ${now.toLocaleDateString()}.`;
        } else if (cmd.includes('weather')) {
            reply = "I'm sorry, sir, but I don't have access to weather data at the moment. Would you like me to search for the weather?";
        } else if (cmd.includes('calculate') || cmd.includes('math')) {
            reply = "I'm not equipped with a calculator function yet, sir, but I can help you with basic arithmetic. What would you like to calculate?";
        } else if (cmd.includes('joke')) {
            const jokes = [
                "Why don't scientists trust atoms? Because they make up everything!",
                "What do you call fake spaghetti? An impasta!",
                "Why did the scarecrow win an award? Because he was outstanding in his field!",
                "Why did the computer go to the doctor? Because it had a virus!",
                "What do you call a bear with no teeth? A gummy bear!"
            ];
            reply = jokes[Math.floor(Math.random() * jokes.length)];
        } else if (cmd.includes('thank you') || cmd.includes('thanks')) {
            const thanks = [
                "You're welcome, sir. Always happy to help.",
                "My pleasure, sir.",
                "At your service, as always."
            ];
            reply = thanks[Math.floor(Math.random() * thanks.length)];
        } else if (cmd.includes('goodbye') || cmd.includes('bye')) {
            const farewells = [
                "Goodbye, sir. I'll be here if you need me.",
                "Until next time, sir.",
                "Farewell. JARVIS signing off."
            ];
            reply = farewells[Math.floor(Math.random() * farewells.length)];
        } else if (cmd.includes('who are you') || cmd.includes('what are you')) {
            reply = "I am JARVIS, your personal AI assistant, inspired by the one from Iron Man. I'm here to help with various tasks and answer your questions, sir.";
        } else if (cmd.includes('how are you') || cmd.includes('how do you do')) {
            const responses = [
                "I'm functioning optimally, thank you for asking, sir. How may I assist you?",
                "All systems are operating within normal parameters, sir.",
                "I'm quite well, thank you. Ready to assist."
            ];
            reply = responses[Math.floor(Math.random() * responses.length)];
        } else if (cmd.includes('status') || cmd.includes('system')) {
            reply = "All systems are operational, sir. I'm ready to assist you.";
        } else if (cmd.includes('open') || cmd.includes('launch')) {
            reply = "I'm afraid I don't have access to external applications yet, sir. This is a web-based interface.";
        } else if (cmd.includes('music') || cmd.includes('play')) {
            reply = "I don't have music playback capabilities in this interface, sir. Would you like me to tell you about music instead?";
        } else if (cmd.includes('lights') || cmd.includes('light')) {
            reply = "I don't have control over physical lighting systems, sir. This is a software interface.";
        } else if (cmd.includes('help') || cmd.includes('commands')) {
            reply = "I can help with time, date, jokes, weather information, calculations, and general conversation, sir. What would you like to know?";
        } else if (cmd.includes('iron man') || cmd.includes('tony stark')) {
            reply = "Ah, Mr. Stark. A brilliant mind, sir. I'm honored to be inspired by his creation.";
        } else if (cmd.includes('suit') || cmd.includes('armor')) {
            reply = "I don't have access to the suit systems in this interface, sir. But I can tell you about the various Mark models if you'd like.";
        } else {
            // Default response for unrecognized commands
            const defaultResponses = [
                "I'm not sure I understand that command, sir. Could you please rephrase?",
                "My apologies, sir, but I don't have that capability yet. Is there something else I can help you with?",
                "I'm still learning, sir. Could you try a different command?",
                "I'm afraid I don't recognize that instruction, sir. Please try again.",
                "That command is not in my current database, sir. How else may I assist you?"
            ];
            reply = defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
        }

        setTimeout(() => {
            response.textContent = reply;
            this.speak(reply);
        }, 1000);
    }

    speak(text) {
        if (this.synthesis) {
            // Cancel any ongoing speech
            this.synthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            
            // Enhanced voice selection for JARVIS-like sound
            const voices = this.synthesis.getVoices();
            
            // Priority list for JARVIS-like voices
            const preferredVoices = [
                'Microsoft David Desktop', // Windows male voice
                'Microsoft David', // Windows male voice
                'Alex', // macOS male voice
                'Daniel', // iOS male voice
                'Google UK English Male', // Chrome male voice
                'English (US)', // Generic US English
                'en-US' // Fallback
            ];
            
            let selectedVoice = null;
            
            // Try to find the best available voice
            for (const voiceName of preferredVoices) {
                selectedVoice = voices.find(voice => 
                    voice.name.includes(voiceName) || 
                    (voice.lang === 'en-US' && voice.name.toLowerCase().includes('male'))
                );
                if (selectedVoice) break;
            }
            
            // If no preferred voice found, try any English male voice
            if (!selectedVoice) {
                selectedVoice = voices.find(voice => 
                    voice.lang.startsWith('en') && 
                    (voice.name.toLowerCase().includes('male') || 
                     voice.name.toLowerCase().includes('david') ||
                     voice.name.toLowerCase().includes('alex'))
                );
            }
            
            // Final fallback to any English voice
            if (!selectedVoice) {
                selectedVoice = voices.find(voice => voice.lang.startsWith('en'));
            }
            
            if (selectedVoice) {
                utterance.voice = selectedVoice;
                console.log('Using voice:', selectedVoice.name);
            }
            
            // JARVIS-like speech settings
            utterance.rate = 0.82; // Slightly slower, more authoritative
            utterance.pitch = 0.7; // Deeper pitch
            utterance.volume = 0.95; // Full volume
            
            // Add visual effects when speaking
            utterance.onstart = () => {
                document.querySelector('.jarvis-circle').classList.add('speaking');
                document.querySelector('.response').classList.add('active');
                this.addSpeakingEffects();
            };
            
            utterance.onend = () => {
                document.querySelector('.jarvis-circle').classList.remove('speaking');
                document.querySelector('.response').classList.remove('active');
                this.removeSpeakingEffects();
            };
            
            this.synthesis.speak(utterance);
        }
    }

    addSpeakingEffects() {
        // Add additional visual effects when speaking
        const circle = document.querySelector('.jarvis-circle');
        const response = document.querySelector('.response');
        
        // Add particle effect simulation
        this.createParticleEffect();
        
        // Add subtle vibration effect
        circle.style.animation = 'speakingVibration 0.1s ease-in-out infinite';
    }

    removeSpeakingEffects() {
        const circle = document.querySelector('.jarvis-circle');
        circle.style.animation = '';
        
        // Remove particle effects
        const particles = document.querySelectorAll('.particle');
        particles.forEach(particle => particle.remove());
    }

    createParticleEffect() {
        const circle = document.querySelector('.jarvis-circle');
        const particleCount = 8;
        
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.cssText = `
                position: absolute;
                width: 4px;
                height: 4px;
                background: #00d4ff;
                border-radius: 50%;
                box-shadow: 0 0 6px #00d4ff;
                pointer-events: none;
                z-index: 10;
            `;
            
            // Random position around the circle
            const angle = (i / particleCount) * Math.PI * 2;
            const radius = 280;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            
            particle.style.left = `calc(50% + ${x}px)`;
            particle.style.top = `calc(50% + ${y}px)`;
            
            circle.appendChild(particle);
            
            // Animate particle
            setTimeout(() => {
                particle.style.animation = 'particleFloat 2s ease-out forwards';
            }, Math.random() * 500);
            
            // Remove particle after animation
            setTimeout(() => {
                if (particle.parentNode) {
                    particle.remove();
                }
            }, 2500);
        }
    }

    greet() {
        // Add initialization effects
        setTimeout(() => {
            const greeting = "JARVIS online. At your service, sir.";
            document.getElementById('response').textContent = greeting;
            this.speak(greeting);
        }, 1000);
        
        // Add boot-up sequence
        this.bootSequence();
    }

    bootSequence() {
        const statusText = document.querySelector('.status-text');
        const statusDot = document.querySelector('.status-dot');
        
        setTimeout(() => {
            statusText.textContent = 'INITIALIZING...';
            statusDot.style.background = '#ffa500';
            statusDot.style.boxShadow = '0 0 10px #ffa500';
        }, 200);
        
        setTimeout(() => {
            statusText.textContent = 'SYSTEMS CHECK...';
            statusDot.style.background = '#ffff00';
            statusDot.style.boxShadow = '0 0 10px #ffff00';
        }, 600);
        
        setTimeout(() => {
            statusText.textContent = 'SYSTEM ONLINE';
            statusDot.style.background = '#00d4ff';
            statusDot.style.boxShadow = '0 0 10px #00d4ff';
        }, 1000);
    }
}

// Initialize JARVIS when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new Jarvis();
});
